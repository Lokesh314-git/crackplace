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
 * Cumulative XP threshold required to unlock a specific level.
 * Level 1: 100 XP (0..99 is Level 1)
 * Level 2: 250 XP (100..249 is Level 2)
 * Level 3: 450 XP (250..449 is Level 3)
 * Level 4: 700 XP (450..699 is Level 4)
 * Level 5: 1000 XP (700..999 is Level 5)
 */
export function getXpRequiredForLevel(level: number): number {
  if (level <= 1) return GAME_CONFIG.levels.level1Xp;
  let total = GAME_CONFIG.levels.level1Xp;
  for (let i = 2; i <= level; i++) {
    total += GAME_CONFIG.levels.level1Xp + GAME_CONFIG.levels.levelGrowthIncrement * (i - 1);
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
