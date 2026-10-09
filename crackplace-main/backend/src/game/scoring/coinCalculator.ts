import { GAME_CONFIG } from '../config/gameConfig';

export interface CoinCalculationInput {
  outcome: 'WIN' | 'LOSS' | 'DRAW';
  accuracyPercentage?: number;
  streakCount?: number;
}

export interface CoinCalculationResult {
  baseCoins: number;
  bonusCoins: number;
  totalCoins: number;
}

/**
 * Calculates coins awarded for completing a battle or quiz activity.
 * Ensures coins awarded are deterministic, non-negative, and strictly follows game configuration.
 */
export class CoinCalculator {
  private static getTierReward(accuracyPercentage: number, tiers: { minScore: number; minCoins: number; maxCoins: number }[]): number {
    const sortedTiers = [...tiers].sort((a, b) => b.minScore - a.minScore);
    for (const tier of sortedTiers) {
      if (accuracyPercentage >= tier.minScore) {
        // Linear interpolation between minCoins and maxCoins if there's a range to next tier, 
        // or just the midpoint, or maxCoins. The user said "100-200 coins", let's give the max 
        // if they hit the top of the tier, and interpolate.
        // For simplicity and deterministic behavior without random: 
        // Let's return the minCoins + (maxCoins-minCoins) * (score in this tier).
        // Let's just use maxCoins for deterministic high rewards based on exact score.
        // Wait, "The reward must NOT be random."
        // We will do a direct interpolation:
        let nextTierMin = 100;
        const currentTierIndex = sortedTiers.indexOf(tier);
        if (currentTierIndex > 0) {
          nextTierMin = sortedTiers[currentTierIndex - 1].minScore;
        }
        
        const tierRange = Math.max(1, nextTierMin - tier.minScore);
        const scoreInTier = Math.max(0, accuracyPercentage - tier.minScore);
        const ratio = Math.min(1, scoreInTier / tierRange);
        
        return Math.floor(tier.minCoins + (tier.maxCoins - tier.minCoins) * ratio);
      }
    }
    return 0;
  }

  /**
   * Calculate coins for a multiplayer battle outcome
   */
  public static calculateBattleCoins(input: CoinCalculationInput): CoinCalculationResult {
    const { outcome, accuracyPercentage = 0, streakCount = 0 } = input;
    const config = GAME_CONFIG.coins.rewards.battle;
    
    let baseCoins = this.getTierReward(accuracyPercentage, config.tiers);
    let bonusCoins = config.participationBonus;

    switch (outcome) {
      case 'WIN':
        bonusCoins += config.winBonus;
        break;
      case 'DRAW':
        bonusCoins += Math.floor(config.winBonus / 2);
        break;
      case 'LOSS':
        // Loss just gets participation bonus
        break;
    }

    if (outcome === 'WIN' && streakCount > 2) {
      bonusCoins += Math.min(10, Math.floor(streakCount * 2));
    }

    const totalCoins = Math.max(0, baseCoins + bonusCoins);

    return {
      baseCoins,
      bonusCoins,
      totalCoins,
    };
  }

  /**
   * Calculate coins for solo quiz completion
   */
  public static calculateQuizCoins(correctCount: number, totalQuestions: number): CoinCalculationResult {
    if (totalQuestions <= 0) return { baseCoins: 0, bonusCoins: 0, totalCoins: 0 };

    const accuracyPercentage = Math.round((correctCount / totalQuestions) * 100);
    const config = GAME_CONFIG.coins.rewards.practice;

    const baseCoins = this.getTierReward(accuracyPercentage, config.tiers);
    const bonusCoins = config.completionBonus;
    const totalCoins = Math.max(0, baseCoins + bonusCoins);

    return {
      baseCoins,
      bonusCoins,
      totalCoins,
    };
  }

  /**
   * Safely adjust coins balance, guaranteeing no negative balance unless explicitly handled.
   */
  public static applyTransaction(currentCoins: number, delta: number): number {
    return Math.max(0, (currentCoins || 0) + delta);
  }
}
