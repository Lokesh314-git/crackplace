import { GAME_CONFIG } from '../config/gameConfig';

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

export interface XpTransactionRecord {
  id?: string;
  userId: string;
  source: 'battle' | 'quiz' | 'coding' | 'interview' | 'study_notes' | 'mission' | 'daily_login' | 'lucky_spin' | 'mystery_box' | 'achievement' | 'admin' | 'practice';
  referenceId: string;
  xpBefore: number;
  xpEarned: number;
  xpAfter: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  levelsGained: number;
  createdAt: string;
}

export interface XpRewardEvaluation {
  xpBefore: number;
  xpEarned: number;
  xpAfter: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  levelsGained: number;
  progress: LevelProgressDetails;
  transaction: XpTransactionRecord;
}

export class LevelCalculator {
  /**
   * Cumulative XP threshold required to unlock a specific level
   */
  public static getXpRequiredForLevel(level: number): number {
    if (level <= 1) return GAME_CONFIG.levels.level1Xp;
    let total = GAME_CONFIG.levels.level1Xp;
    for (let i = 2; i <= level; i++) {
      total += GAME_CONFIG.levels.level1Xp + GAME_CONFIG.levels.levelGrowthIncrement * (i - 1);
    }
    return total;
  }

  public static calculateCumulativeXpForLevel(level: number): number {
    return this.getXpRequiredForLevel(level);
  }

  /**
   * Deterministically calculates current player level from total accumulated XP.
   * Monotonic: XP can only increase; player level NEVER decreases.
   */
  public static calculateLevelFromXP(totalXp: number): number {
    const safeXp = Math.max(0, Number(totalXp) || 0);
    let level = 1;
    while (true) {
      const requiredForNext = this.getXpRequiredForLevel(level);
      if (safeXp < requiredForNext) {
        break;
      }
      level++;
    }
    return level;
  }

  /**
   * Complete level progression metadata for UI rendering and progress bars
   */
  public static calculateLevelProgress(totalXp: number): LevelProgressDetails {
    const safeXp = Math.max(0, Number(totalXp) || 0);
    const level = this.calculateLevelFromXP(safeXp);

    const currentLevelBaseXp = level === 1 ? 0 : this.getXpRequiredForLevel(level - 1);
    const nextLevelRequiredXp = this.getXpRequiredForLevel(level);

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

  /**
   * Authoritatively evaluates an XP addition transaction and derives exact level transitions.
   * Guarantees:
   * 1. XP can never decrease (safe earned XP is >= 0)
   * 2. Levels are derived strictly from total XP via calculateLevelFromXP
   * 3. Multiple level-ups in a single transaction are accurately calculated
   * 4. Produces an auditable transaction record
   */
  public static evaluateXpReward(params: {
    currentXp: number;
    xpEarned: number;
    userId: string;
    source: XpTransactionRecord['source'];
    referenceId: string;
    createdAt?: string;
  }): XpRewardEvaluation {
    const xpBefore = Math.max(0, Number(params.currentXp) || 0);
    const safeXpEarned = Math.max(0, Number(params.xpEarned) || 0);
    const xpAfter = xpBefore + safeXpEarned;

    const levelBefore = this.calculateLevelFromXP(xpBefore);
    const levelAfter = this.calculateLevelFromXP(xpAfter);
    const leveledUp = levelAfter > levelBefore;
    const levelsGained = Math.max(0, levelAfter - levelBefore);
    const progress = this.calculateLevelProgress(xpAfter);

    const transaction: XpTransactionRecord = {
      userId: params.userId,
      source: params.source,
      referenceId: params.referenceId,
      xpBefore,
      xpEarned: safeXpEarned,
      xpAfter,
      levelBefore,
      levelAfter,
      leveledUp,
      levelsGained,
      createdAt: params.createdAt || new Date().toISOString()
    };

    return {
      xpBefore,
      xpEarned: safeXpEarned,
      xpAfter,
      levelBefore,
      levelAfter,
      leveledUp,
      levelsGained,
      progress,
      transaction
    };
  }
}

export default LevelCalculator;
