import { ScoreCalculator, QuestionSubmission, BattleScoreBreakdown } from './scoreCalculator';
import { XpCalculator } from './xpCalculator';
import { LevelCalculator } from './levelCalculator';
import { CoinCalculator } from './coinCalculator';
import { EloCalculator, MatchEloResult } from './eloCalculator';

export interface BattleParticipantInput {
  userId: string;
  username: string;
  submissions: QuestionSubmission[];
  previousState: {
    totalXp: number;
    coins: number;
    eloRating: number;
  };
}

export interface PlayerRewardResult {
  userId: string;
  username: string;
  outcome: 'WIN' | 'LOSS' | 'DRAW';
  score: number;
  opponentScore: number;
  scoreBreakdown: BattleScoreBreakdown;
  xp: {
    previous: number;
    earned: number;
    current: number;
    levelBefore: number;
    levelAfter: number;
    leveledUp: boolean;
    levelsGained: number;
    progressPercentage: number;
    xpIntoCurrentLevel: number;
    xpRequiredForNextLevel: number;
  };
  coins: {
    previous: number;
    earned: number;
    current: number;
  };
  elo: {
    previous: number;
    change: number;
    current: number;
    expectedScore: number;
  };
  stats: {
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    accuracyPercentage: number;
    averageResponseTimeMs: number;
  };
}

export interface BattleResultPackage {
  battleId: string;
  status: 'COMPLETED';
  winnerId: string | null;
  loserId: string | null;
  isDraw: boolean;
  tieBreakerUsed?: string;
  playerA: PlayerRewardResult;
  playerB: PlayerRewardResult;
  completedAt: string;
}

/**
 * Authoritative battle rewards orchestrator.
 * Computes deterministic scores, outcomes, XP, levels, coins, and Elo for both players.
 */
export class RewardCalculator {
  public static calculateBattleRewards(
    battleId: string,
    playerA: BattleParticipantInput,
    playerB: BattleParticipantInput,
    totalQuestions: number
  ): BattleResultPackage {
    // 1. Authoritative score calculations
    const scoreA = ScoreCalculator.calculateBattleScore(playerA.submissions);
    const scoreB = ScoreCalculator.calculateBattleScore(playerB.submissions);

    // 2. Authoritative winner determination
    let outcomeA: 'WIN' | 'LOSS' | 'DRAW' = 'DRAW';
    let outcomeB: 'WIN' | 'LOSS' | 'DRAW' = 'DRAW';
    let winnerId: string | null = null;
    let loserId: string | null = null;
    let isDraw = false;
    let tieBreakerUsed: string | undefined;

    if (scoreA.finalScore > scoreB.finalScore) {
      outcomeA = 'WIN';
      outcomeB = 'LOSS';
      winnerId = playerA.userId;
      loserId = playerB.userId;
    } else if (scoreB.finalScore > scoreA.finalScore) {
      outcomeA = 'LOSS';
      outcomeB = 'WIN';
      winnerId = playerB.userId;
      loserId = playerA.userId;
    } else {
      // Tie breaker: faster total response time wins if scores are tied
      if (scoreA.totalResponseTimeMs < scoreB.totalResponseTimeMs) {
        outcomeA = 'WIN';
        outcomeB = 'LOSS';
        winnerId = playerA.userId;
        loserId = playerB.userId;
        tieBreakerUsed = 'response_time';
      } else if (scoreB.totalResponseTimeMs < scoreA.totalResponseTimeMs) {
        outcomeA = 'LOSS';
        outcomeB = 'WIN';
        winnerId = playerB.userId;
        loserId = playerA.userId;
        tieBreakerUsed = 'response_time';
      } else {
        isDraw = true;
      }
    }

    // 3. Elo Calculations
    const eloResults: MatchEloResult = EloCalculator.calculateMatchRatings(
      { userId: playerA.userId, rating: playerA.previousState.eloRating },
      { userId: playerB.userId, rating: playerB.previousState.eloRating },
      outcomeA
    );

    // 4. XP and Level Calculations for Player A
    const xpEarnedA = XpCalculator.calculateBattleXP({
      outcome: outcomeA,
      correctCount: scoreA.correctAnswersCount,
      totalQuestions,
      speedBonusCount: scoreA.speedBonusCount,
    }).totalXP;

    const newXpA = (playerA.previousState.totalXp || 0) + xpEarnedA;
    const levelBeforeA = LevelCalculator.calculateLevelFromXP(playerA.previousState.totalXp || 0);
    const levelProgA = LevelCalculator.calculateLevelProgress(newXpA);
    const leveledUpA = levelProgA.currentLevel > levelBeforeA;
    const levelsGainedA = Math.max(0, levelProgA.currentLevel - levelBeforeA);

    // Coins for Player A
    const coinsEarnedA = CoinCalculator.calculateBattleCoins({ outcome: outcomeA }).totalCoins;
    const newCoinsA = CoinCalculator.applyTransaction(playerA.previousState.coins || 0, coinsEarnedA);

    // 5. XP and Level Calculations for Player B
    const xpEarnedB = XpCalculator.calculateBattleXP({
      outcome: outcomeB,
      correctCount: scoreB.correctAnswersCount,
      totalQuestions,
      speedBonusCount: scoreB.speedBonusCount,
    }).totalXP;

    const newXpB = (playerB.previousState.totalXp || 0) + xpEarnedB;
    const levelBeforeB = LevelCalculator.calculateLevelFromXP(playerB.previousState.totalXp || 0);
    const levelProgB = LevelCalculator.calculateLevelProgress(newXpB);
    const leveledUpB = levelProgB.currentLevel > levelBeforeB;
    const levelsGainedB = Math.max(0, levelProgB.currentLevel - levelBeforeB);

    // Coins for Player B
    const coinsEarnedB = CoinCalculator.calculateBattleCoins({ outcome: outcomeB }).totalCoins;
    const newCoinsB = CoinCalculator.applyTransaction(playerB.previousState.coins || 0, coinsEarnedB);

    // Build player reward objects
    const rewardA: PlayerRewardResult = {
      userId: playerA.userId,
      username: playerA.username,
      outcome: outcomeA,
      score: scoreA.finalScore,
      opponentScore: scoreB.finalScore,
      scoreBreakdown: scoreA,
      xp: {
        previous: playerA.previousState.totalXp || 0,
        earned: xpEarnedA,
        current: newXpA,
        levelBefore: levelBeforeA,
        levelAfter: levelProgA.currentLevel,
        leveledUp: leveledUpA,
        levelsGained: levelsGainedA,
        progressPercentage: levelProgA.progressPercentage,
        xpIntoCurrentLevel: levelProgA.xpIntoCurrentLevel,
        xpRequiredForNextLevel: levelProgA.xpRequiredForNextLevel,
      },
      coins: {
        previous: playerA.previousState.coins || 0,
        earned: coinsEarnedA,
        current: newCoinsA,
      },
      elo: {
        previous: eloResults.playerA.previousRating,
        change: eloResults.playerA.change,
        current: eloResults.playerA.newRating,
        expectedScore: eloResults.playerA.expectedScore,
      },
      stats: {
        correctCount: scoreA.correctAnswersCount,
        wrongCount: scoreA.wrongAnswersCount,
        unansweredCount: Math.max(0, totalQuestions - scoreA.answeredCount),
        accuracyPercentage: totalQuestions > 0 ? Math.round((scoreA.correctAnswersCount / totalQuestions) * 100) : 0,
        averageResponseTimeMs: scoreA.averageResponseTimeMs,
      },
    };

    const rewardB: PlayerRewardResult = {
      userId: playerB.userId,
      username: playerB.username,
      outcome: outcomeB,
      score: scoreB.finalScore,
      opponentScore: scoreA.finalScore,
      scoreBreakdown: scoreB,
      xp: {
        previous: playerB.previousState.totalXp || 0,
        earned: xpEarnedB,
        current: newXpB,
        levelBefore: levelBeforeB,
        levelAfter: levelProgB.currentLevel,
        leveledUp: leveledUpB,
        levelsGained: levelsGainedB,
        progressPercentage: levelProgB.progressPercentage,
        xpIntoCurrentLevel: levelProgB.xpIntoCurrentLevel,
        xpRequiredForNextLevel: levelProgB.xpRequiredForNextLevel,
      },
      coins: {
        previous: playerB.previousState.coins || 0,
        earned: coinsEarnedB,
        current: newCoinsB,
      },
      elo: {
        previous: eloResults.playerB.previousRating,
        change: eloResults.playerB.change,
        current: eloResults.playerB.newRating,
        expectedScore: eloResults.playerB.expectedScore,
      },
      stats: {
        correctCount: scoreB.correctAnswersCount,
        wrongCount: scoreB.wrongAnswersCount,
        unansweredCount: Math.max(0, totalQuestions - scoreB.answeredCount),
        accuracyPercentage: totalQuestions > 0 ? Math.round((scoreB.correctAnswersCount / totalQuestions) * 100) : 0,
        averageResponseTimeMs: scoreB.averageResponseTimeMs,
      },
    };

    return {
      battleId,
      status: 'COMPLETED',
      winnerId,
      loserId,
      isDraw,
      tieBreakerUsed,
      playerA: rewardA,
      playerB: rewardB,
      completedAt: new Date().toISOString(),
    };
  }
}
