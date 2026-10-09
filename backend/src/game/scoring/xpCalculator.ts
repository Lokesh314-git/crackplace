import { GAME_CONFIG } from '../config/gameConfig';

export interface BattleXpInput {
  outcome: 'WIN' | 'LOSS' | 'DRAW';
  correctAnswersCount?: number;
  correctCount?: number;
  totalQuestions?: number;
  speedBonusCount?: number;
}

export interface BattleXpResult {
  baseXP: number;
  performanceXP: number;
  speedXP: number;
  perfectXP: number;
  totalXP: number;
}

export interface QuizXpInput {
  correctAnswers: number;
  totalQuestions: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export class XpCalculator {
  /**
   * Authoritative calculation for PvP Battle XP
   */
  public static calculateBattleXP(input: BattleXpInput): BattleXpResult & number {
    let baseXP = GAME_CONFIG.xp.battleLossReward;
    if (input.outcome === 'WIN') {
      baseXP = GAME_CONFIG.xp.battleWinBonus;
    } else if (input.outcome === 'DRAW') {
      baseXP = GAME_CONFIG.xp.battleDrawReward;
    }

    const correct = input.correctAnswersCount ?? input.correctCount ?? 0;
    const performanceXP = correct * GAME_CONFIG.xp.battlePerCorrectAnswer;
    const speedXP = (input.speedBonusCount || 0) * 2;
    const perfectXP = (input.totalQuestions && correct === input.totalQuestions) 
      ? GAME_CONFIG.xp.battle.perfectBonus 
      : 0;

    const totalXP = baseXP + performanceXP + speedXP + perfectXP;

    // Create a Number primitive that also carries breakdown properties
    const result = Object.assign(Number(totalXP), {
      baseXP,
      performanceXP,
      speedXP,
      perfectXP,
      totalXP,
      valueOf: () => totalXP
    }) as any;

    return result;
  }

  /**
   * Authoritative calculation for Practice Quiz XP
   */
  public static calculateQuizXP(input: QuizXpInput): number {
    const baseXp = input.correctAnswers * GAME_CONFIG.xp.quizPerCorrectAnswer;
    const hardBonus = input.difficulty === 'hard' ? input.correctAnswers * 10 : 0;
    const perfectBonus = input.correctAnswers === input.totalQuestions ? GAME_CONFIG.xp.quizPerfectBonus : 0;
    const participationXp = GAME_CONFIG.xp.quizParticipation;

    return baseXp + hardBonus + perfectBonus + participationXp;
  }

  /**
   * Coding challenge pass XP
   */
  public static calculateCodingXP(): number {
    return GAME_CONFIG.xp.codingChallengePass;
  }

  /**
   * HR mock interview completion XP
   */
  public static calculateHRXP(): number {
    return GAME_CONFIG.xp.hrInterviewCompletion;
  }
}

export default XpCalculator;
