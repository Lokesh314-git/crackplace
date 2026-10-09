export interface LevelProgressDetails {
  level: number;
  currentLevel: number;
  totalXp: number;
  currentLevelBaseXp: number;
  nextLevelRequiredXp: number;
  xpProgressInLevel: number;
  xpIntoCurrentLevel: number;
  xpNeededForNextLevel: number;
  xpRequiredForNextLevel: number;
  progressPercentage: number;
}

export const GAME_CONFIG = {
  levels: {
    level1Xp: 100,
    levelGrowthIncrement: 50
  }
};

/**
 * Cumulative XP threshold required to complete a specific level (and reach level + 1).
 * e.g., getXpRequiredForLevel(1) returns the total XP needed to reach Level 2.
 */
export function getXpRequiredForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i <= level; i++) {
    total += Math.floor(1000 * Math.pow(i, 1.6));
  }
  return total;
}

export function calculateCumulativeXpForLevel(level: number): number {
  return getXpRequiredForLevel(level);
}

/**
 * Deterministically calculates player level strictly from total accumulated XP.
 * Monotonic: XP can only increase; player level NEVER decreases.
 */
export function calculateLevelFromXP(totalXp: number): number {
  const safeXp = Math.max(0, Number(totalXp) || 0);
  let level = 1;
  while (true) {
    const requiredForNext = getXpRequiredForLevel(level);
    if (safeXp < requiredForNext) {
      break;
    }
    level++;
  }
  return level;
}

/**
 * Complete level progression metadata for UI rendering, progress bars, and tooltips.
 */
export function calculateLevelProgress(totalXp: number): LevelProgressDetails {
  const safeXp = Math.max(0, Number(totalXp) || 0);
  const level = calculateLevelFromXP(safeXp);

  const currentLevelBaseXp = level === 1 ? 0 : getXpRequiredForLevel(level - 1);
  const nextLevelRequiredXp = getXpRequiredForLevel(level);

  const xpProgressInLevel = safeXp - currentLevelBaseXp;
  const xpNeededForNextLevel = nextLevelRequiredXp - currentLevelBaseXp;
  const progressPercentage = xpNeededForNextLevel > 0
    ? Math.min(100, Math.round((xpProgressInLevel / xpNeededForNextLevel) * 100))
    : 100;

  return {
    level,
    currentLevel: level,
    totalXp: safeXp,
    currentLevelBaseXp,
    nextLevelRequiredXp,
    xpProgressInLevel,
    xpIntoCurrentLevel: xpProgressInLevel,
    xpNeededForNextLevel,
    xpRequiredForNextLevel: xpNeededForNextLevel,
    progressPercentage
  };
}

export default {
  getXpRequiredForLevel,
  calculateCumulativeXpForLevel,
  calculateLevelFromXP,
  calculateLevelProgress
};
