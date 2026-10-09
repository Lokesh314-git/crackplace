import { GAME_CONFIG } from '../config/gameConfig';

export interface EloCalculationInput {
  playerRating: number;
  opponentRating: number;
  outcome: 'WIN' | 'LOSS' | 'DRAW';
  kFactor?: number;
}

export interface MatchEloResult {
  playerA: {
    userId: string;
    previousRating: number;
    expectedScore: number;
    actualScore: number;
    change: number;
    newRating: number;
  };
  playerB: {
    userId: string;
    previousRating: number;
    expectedScore: number;
    actualScore: number;
    change: number;
    newRating: number;
  };
}

/**
 * Standard Elo Rating System calculator.
 * Implements standard logistic expected score calculation:
 *   E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 *   R'_A = R_A + K * (S_A - E_A)
 * Ensures zero-sum symmetry (gain of A = loss of B, prior to floor enforcement).
 */
export class EloCalculator {
  /**
   * Calculate expected score for Player A facing Player B
   */
  public static calculateExpectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  /**
   * Calculate Elo change for a single player
   */
  public static calculateSinglePlayerChange(input: EloCalculationInput): { change: number; newRating: number } {
    const { playerRating, opponentRating, outcome, kFactor = GAME_CONFIG.elo.kFactor } = input;
    const expected = this.calculateExpectedScore(playerRating, opponentRating);

    let actual = 0.5;
    if (outcome === 'WIN') actual = 1.0;
    if (outcome === 'LOSS') actual = 0.0;

    const rawChange = Math.round(kFactor * (actual - expected));
    const minFloor = GAME_CONFIG.elo.minFloor;
    const maxCeiling = GAME_CONFIG.elo.maxCeiling;

    let newRating = playerRating + rawChange;
    if (minFloor !== undefined) {
      newRating = Math.max(minFloor, newRating);
    }
    if (maxCeiling !== undefined) {
      newRating = Math.min(maxCeiling, newRating);
    }

    const effectiveChange = newRating - playerRating;

    return {
      change: effectiveChange,
      newRating,
    };
  }

  /**
   * Calculate symmetrical match Elo changes for both participants simultaneously.
   */
  public static calculateMatchRatings(
    playerA: { userId: string; rating: number },
    playerB: { userId: string; rating: number },
    outcomeA: 'WIN' | 'LOSS' | 'DRAW',
    customK?: number
  ): MatchEloResult {
    const k = customK || GAME_CONFIG.elo.kFactor;
    const rA = playerA.rating || GAME_CONFIG.elo.startingRating;
    const rB = playerB.rating || GAME_CONFIG.elo.startingRating;

    const eA = this.calculateExpectedScore(rA, rB);
    const eB = 1 - eA; // Exact mathematical symmetry

    let sA = 0.5;
    let sB = 0.5;
    if (outcomeA === 'WIN') {
      sA = 1.0;
      sB = 0.0;
    } else if (outcomeA === 'LOSS') {
      sA = 0.0;
      sB = 1.0;
    }

    const rawChangeA = Math.round(k * (sA - eA));
    // Enforce symmetry: change of B = -change of A
    const rawChangeB = -rawChangeA;

    const minFloor = GAME_CONFIG.elo.minFloor;
    const maxCeiling = GAME_CONFIG.elo.maxCeiling;

    let newRatingA = rA + rawChangeA;
    let newRatingB = rB + rawChangeB;

    if (minFloor !== undefined) {
      newRatingA = Math.max(minFloor, newRatingA);
      newRatingB = Math.max(minFloor, newRatingB);
    }
    if (maxCeiling !== undefined) {
      newRatingA = Math.min(maxCeiling, newRatingA);
      newRatingB = Math.min(maxCeiling, newRatingB);
    }

    return {
      playerA: {
        userId: playerA.userId,
        previousRating: rA,
        expectedScore: Math.round(eA * 1000) / 1000,
        actualScore: sA,
        change: newRatingA - rA,
        newRating: newRatingA,
      },
      playerB: {
        userId: playerB.userId,
        previousRating: rB,
        expectedScore: Math.round(eB * 1000) / 1000,
        actualScore: sB,
        change: newRatingB - rB,
        newRating: newRatingB,
      },
    };
  }
}
