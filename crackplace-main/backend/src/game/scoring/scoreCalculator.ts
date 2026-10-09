import { GAME_CONFIG } from '../config/gameConfig';

export interface QuestionScoreInput {
  isCorrect?: boolean;
  correct?: boolean;
  isTimeout?: boolean;
  difficulty?: 'easy' | 'medium' | 'hard' | 'Easy' | 'Medium' | 'Hard';
  responseTimeMs?: number;
  timeLimitMs?: number;
}

export interface QuestionScoreResult {
  isCorrect: boolean;
  basePoints: number;
  difficultyMultiplier: number;
  speedBonus: number;
  finalPoints: number;
  pointsAwarded: number;
}

export interface QuestionSubmission {
  questionIndex?: number;
  selectedOption: number;
  correct?: boolean;
  isCorrect?: boolean;
  points?: number;
  timeMs?: number;
  responseTimeMs?: number;
  timeLimitMs?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'Easy' | 'Medium' | 'Hard';
}

export interface PlayerSubmissionRecord {
  selectedOption: number;
  isCorrect: boolean;
  points: number;
  timeMs: number;
  responseTimeMs?: number;
}

export interface BattleScoreSummary {
  totalScore: number;
  finalScore: number;
  correctAnswers: number;
  correctAnswersCount: number;
  wrongAnswers: number;
  wrongAnswersCount: number;
  unanswered: number;
  answeredCount: number;
  accuracy: number;
  accuracyPercentage: number;
  totalResponseTimeMs: number;
  averageResponseTimeMs: number;
  speedBonusCount: number;
}

export type BattleScoreBreakdown = BattleScoreSummary;

export class ScoreCalculator {
  /**
   * Deterministically calculates score for a single question response
   */
  public static calculateQuestionScore(input: QuestionScoreInput): QuestionScoreResult {
    const isCorrect = Boolean(input.isCorrect ?? input.correct);
    const isTimeout = Boolean(input.isTimeout);

    if (!isCorrect || isTimeout) {
      return {
        isCorrect: false,
        basePoints: 0,
        difficultyMultiplier: 1.0,
        speedBonus: 0,
        finalPoints: GAME_CONFIG.scoring.wrongPoints,
        pointsAwarded: GAME_CONFIG.scoring.wrongPoints
      };
    }

    const basePoints = GAME_CONFIG.scoring.correctBasePoints;
    const diff = (input.difficulty?.toLowerCase() || 'medium') as 'easy' | 'medium' | 'hard';
    const difficultyMultiplier = GAME_CONFIG.scoring.difficultyMultipliers[diff] || 1.0;

    let speedBonus = 0;
    const threshold = input.timeLimitMs ? input.timeLimitMs * 0.5 : GAME_CONFIG.scoring.speedBonusThresholdMs;
    if (GAME_CONFIG.scoring.speedBonusEnabled && input.responseTimeMs !== undefined) {
      if (input.responseTimeMs < threshold) {
        const ratio = Math.max(0, 1 - input.responseTimeMs / threshold);
        speedBonus = Math.round(ratio * GAME_CONFIG.scoring.speedBonusMax);
      }
    }

    const finalPoints = Math.round(basePoints * difficultyMultiplier) + speedBonus;

    return {
      isCorrect: true,
      basePoints,
      difficultyMultiplier,
      speedBonus,
      finalPoints,
      pointsAwarded: finalPoints
    };
  }

  /**
   * Summarizes all question submissions for a player in a battle
   */
  public static calculateBattleScore(
    submissions: { [qIndex: number]: PlayerSubmissionRecord } | QuestionSubmission[],
    totalQuestionsCount?: number
  ): BattleScoreSummary {
    let totalScore = 0;
    let correctAnswers = 0;
    let wrongAnswers = 0;
    let answeredCount = 0;
    let totalResponseTimeMs = 0;
    let speedBonusCount = 0;

    const list: QuestionSubmission[] = Array.isArray(submissions)
      ? submissions
      : Object.values(submissions);

    const totalQuestions = totalQuestionsCount || list.length;

    for (const sub of list) {
      answeredCount++;
      const isCorrect = Boolean(sub.isCorrect ?? sub.correct);
      const respTime = sub.responseTimeMs ?? 5000;
      totalResponseTimeMs += respTime;

      const scored = this.calculateQuestionScore({
        correct: isCorrect,
        difficulty: sub.difficulty,
        responseTimeMs: respTime,
        timeLimitMs: sub.timeLimitMs
      });

      totalScore += scored.finalPoints;
      if (scored.speedBonus > 0) speedBonusCount++;

      if (isCorrect) {
        correctAnswers++;
      } else {
        wrongAnswers++;
      }
    }

    const unanswered = Math.max(0, totalQuestions - answeredCount);
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const avgResponseTime = answeredCount > 0 ? Math.round(totalResponseTimeMs / answeredCount) : 0;

    return {
      totalScore,
      finalScore: totalScore,
      correctAnswers,
      correctAnswersCount: correctAnswers,
      wrongAnswers,
      wrongAnswersCount: wrongAnswers,
      unanswered,
      answeredCount,
      accuracy,
      accuracyPercentage: accuracy,
      totalResponseTimeMs,
      averageResponseTimeMs: avgResponseTime,
      speedBonusCount
    };
  }
}

export default ScoreCalculator;
