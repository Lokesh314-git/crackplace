import {
  GAME_CONFIG,
  ScoreCalculator,
  XpCalculator,
  LevelCalculator,
  CoinCalculator,
  EloCalculator,
  RewardCalculator,
  BattleResultProcessor,
  BattleParticipantInput
} from '../game';

describe('Authoritative Game Economy & Battle Calculations', () => {
  describe('1. Score Calculator', () => {
    it('calculates correct answer score with base points and difficulty modifier', () => {
      const easyScore = ScoreCalculator.calculateQuestionScore({
        correct: true,
        responseTimeMs: 15000,
        timeLimitMs: 30000,
        difficulty: 'Easy'
      });
      expect(easyScore.basePoints).toBe(20);
      expect(easyScore.difficultyMultiplier).toBe(1.0);
      expect(easyScore.pointsAwarded).toBe(20);

      const hardScore = ScoreCalculator.calculateQuestionScore({
        correct: true,
        responseTimeMs: 15000,
        timeLimitMs: 30000,
        difficulty: 'Hard'
      });
      expect(hardScore.difficultyMultiplier).toBe(GAME_CONFIG.scoring.difficultyMultipliers.hard);
      expect(hardScore.pointsAwarded).toBe(Math.round(20 * GAME_CONFIG.scoring.difficultyMultipliers.hard));
    });

    it('awards speed bonus for fast correct answers within threshold', () => {
      const fastScore = ScoreCalculator.calculateQuestionScore({
        correct: true,
        responseTimeMs: 1000, // Very fast (< 50% time limit)
        timeLimitMs: 30000,
        difficulty: 'Medium'
      });
      expect(fastScore.speedBonus).toBeGreaterThan(0);
      expect(fastScore.pointsAwarded).toBe(fastScore.basePoints * fastScore.difficultyMultiplier + fastScore.speedBonus);
    });

    it('awards exactly 0 points for incorrect answers or timeouts', () => {
      const wrongScore = ScoreCalculator.calculateQuestionScore({
        correct: false,
        responseTimeMs: 3000,
        timeLimitMs: 30000,
        difficulty: 'Hard'
      });
      expect(wrongScore.pointsAwarded).toBe(0);
      expect(wrongScore.speedBonus).toBe(0);
    });

    it('calculates aggregate battle scores accurately', () => {
      const submissions = [
        { questionIndex: 0, selectedOption: 1, correct: true, responseTimeMs: 1000, timeLimitMs: 30000, difficulty: 'Medium' as const },
        { questionIndex: 1, selectedOption: 2, correct: false, responseTimeMs: 5000, timeLimitMs: 30000, difficulty: 'Medium' as const },
        { questionIndex: 2, selectedOption: 0, correct: true, responseTimeMs: 10000, timeLimitMs: 30000, difficulty: 'Medium' as const },
        { questionIndex: 3, selectedOption: 3, correct: true, responseTimeMs: 2000, timeLimitMs: 30000, difficulty: 'Medium' as const },
        { questionIndex: 4, selectedOption: -1, correct: false, responseTimeMs: 30000, timeLimitMs: 30000, difficulty: 'Medium' as const }
      ];

      const breakdown = ScoreCalculator.calculateBattleScore(submissions);
      expect(breakdown.answeredCount).toBe(5);
      expect(breakdown.correctAnswersCount).toBe(3);
      expect(breakdown.wrongAnswersCount).toBe(2);
      expect(breakdown.finalScore).toBeGreaterThan(60); // 3 correct * 20 + speed bonuses
    });
  });

  describe('2. XP and Level Progression System', () => {
    it('awards configured XP for win, loss, and draw', () => {
      const winXP = XpCalculator.calculateBattleXP({ outcome: 'WIN', correctCount: 5, totalQuestions: 5 });
      const lossXP = XpCalculator.calculateBattleXP({ outcome: 'LOSS', correctCount: 2, totalQuestions: 5 });
      const drawXP = XpCalculator.calculateBattleXP({ outcome: 'DRAW', correctCount: 3, totalQuestions: 5 });

      expect(winXP.totalXP).toBe(GAME_CONFIG.xp.battle.win + 5 * GAME_CONFIG.xp.battle.perCorrectAnswer + GAME_CONFIG.xp.battle.perfectBonus);
      expect(lossXP.totalXP).toBe(GAME_CONFIG.xp.battle.loss + 2 * GAME_CONFIG.xp.battle.perCorrectAnswer);
      expect(drawXP.totalXP).toBe(GAME_CONFIG.xp.battle.draw + 3 * GAME_CONFIG.xp.battle.perCorrectAnswer);
    });

    it('derives levels monotonically from cumulative XP', () => {
      // Level 1: 0 to 99 XP
      expect(LevelCalculator.calculateLevelFromXP(0)).toBe(1);
      expect(LevelCalculator.calculateLevelFromXP(50)).toBe(1);
      expect(LevelCalculator.calculateLevelFromXP(99)).toBe(1);

      // Level 2: 100 to 249 XP (100 + 150 = 250 for Level 3)
      expect(LevelCalculator.calculateLevelFromXP(100)).toBe(2);
      expect(LevelCalculator.calculateLevelFromXP(249)).toBe(2);

      // Level 3: 250 XP
      expect(LevelCalculator.calculateLevelFromXP(250)).toBe(3);
    });

    it('correctly handles multiple level increases from large single rewards', () => {
      // 0 XP (Level 1) receives 1000 XP
      const startXP = 0;
      const gainedXP = 1000;
      const newXP = startXP + gainedXP;

      const levelBefore = LevelCalculator.calculateLevelFromXP(startXP);
      const progress = LevelCalculator.calculateLevelProgress(newXP);

      expect(levelBefore).toBe(1);
      expect(progress.currentLevel).toBeGreaterThan(3);
      expect(progress.progressPercentage).toBeGreaterThanOrEqual(0);
      expect(progress.progressPercentage).toBeLessThanOrEqual(100);
    });

    it('never allows level to decrease on match loss', () => {
      const startingXP = 850;
      const initialLevel = LevelCalculator.calculateLevelFromXP(startingXP);
      
      // Loss awards 10 XP
      const lossXP = XpCalculator.calculateBattleXP({ outcome: 'LOSS', correctCount: 0, totalQuestions: 5 }).totalXP;
      const afterLossXP = startingXP + lossXP;
      const afterLossLevel = LevelCalculator.calculateLevelFromXP(afterLossXP);

      expect(afterLossLevel).toBeGreaterThanOrEqual(initialLevel);
      expect(afterLossXP).toBeGreaterThan(startingXP);
    });
  });

  describe('3. Coin System', () => {
    it('awards configured coins for battle outcomes', () => {
      const winCoins = CoinCalculator.calculateBattleCoins({ outcome: 'WIN' });
      const lossCoins = CoinCalculator.calculateBattleCoins({ outcome: 'LOSS' });
      const drawCoins = CoinCalculator.calculateBattleCoins({ outcome: 'DRAW' });

      expect(winCoins.totalCoins).toBe(GAME_CONFIG.coins.battle.win);
      expect(lossCoins.totalCoins).toBe(GAME_CONFIG.coins.battle.loss);
      expect(drawCoins.totalCoins).toBe(GAME_CONFIG.coins.battle.draw);
    });

    it('prevents negative coin balances', () => {
      const initial = 20;
      const delta = -50;
      const result = CoinCalculator.applyTransaction(initial, delta);
      expect(result).toBe(0);
    });
  });

  describe('4. Symmetrical Elo / Rating System', () => {
    it('maintains mathematical symmetry (gain of A == loss of B) for equal ratings', () => {
      const match = EloCalculator.calculateMatchRatings(
        { userId: 'playerA', rating: 1000 },
        { userId: 'playerB', rating: 1000 },
        'WIN'
      );

      expect(match.playerA.change).toBe(16);
      expect(match.playerB.change).toBe(-16);
      expect(match.playerA.change + match.playerB.change).toBe(0);
      expect(match.playerA.newRating).toBe(1016);
      expect(match.playerB.newRating).toBe(984);
    });

    it('awards fewer points to higher-rated player beating lower-rated player', () => {
      const match = EloCalculator.calculateMatchRatings(
        { userId: 'pro', rating: 1400 },
        { userId: 'novice', rating: 1000 },
        'WIN'
      );

      expect(match.playerA.change).toBeLessThan(10);
      expect(match.playerB.change).toBe(-match.playerA.change);
    });

    it('awards massive points for upset win (lower-rated beats higher-rated)', () => {
      const match = EloCalculator.calculateMatchRatings(
        { userId: 'underdog', rating: 900 },
        { userId: 'favorite', rating: 1300 },
        'WIN'
      );

      expect(match.playerA.change).toBeGreaterThan(25);
      expect(match.playerB.change).toBe(-match.playerA.change);
    });

    it('enforces minimum rating floor', () => {
      const single = EloCalculator.calculateSinglePlayerChange({
        playerRating: 105,
        opponentRating: 1500,
        outcome: 'LOSS'
      });

      expect(single.newRating).toBeGreaterThanOrEqual(GAME_CONFIG.elo.minFloor || 100);
    });
  });

  describe('5. Authoritative Reward Calculator and Idempotency', () => {
    const p1Submissions = [
      { questionIndex: 0, selectedOption: 1, correct: true, responseTimeMs: 2000, timeLimitMs: 30000, difficulty: 'Medium' as const },
      { questionIndex: 1, selectedOption: 2, correct: true, responseTimeMs: 3000, timeLimitMs: 30000, difficulty: 'Medium' as const },
      { questionIndex: 2, selectedOption: 0, correct: true, responseTimeMs: 4000, timeLimitMs: 30000, difficulty: 'Medium' as const },
      { questionIndex: 3, selectedOption: 3, correct: true, responseTimeMs: 5000, timeLimitMs: 30000, difficulty: 'Medium' as const },
      { questionIndex: 4, selectedOption: 1, correct: false, responseTimeMs: 6000, timeLimitMs: 30000, difficulty: 'Medium' as const }
    ];

    const p2Submissions = [
      { questionIndex: 0, selectedOption: 1, correct: true, responseTimeMs: 2000, timeLimitMs: 30000, difficulty: 'Medium' as const },
      { questionIndex: 1, selectedOption: 0, correct: false, responseTimeMs: 3000, timeLimitMs: 30000, difficulty: 'Medium' as const },
      { questionIndex: 2, selectedOption: 2, correct: false, responseTimeMs: 4000, timeLimitMs: 30000, difficulty: 'Medium' as const },
      { questionIndex: 3, selectedOption: 3, correct: true, responseTimeMs: 5000, timeLimitMs: 30000, difficulty: 'Medium' as const },
      { questionIndex: 4, selectedOption: 1, correct: false, responseTimeMs: 6000, timeLimitMs: 30000, difficulty: 'Medium' as const }
    ];

    const participantA: BattleParticipantInput = {
      userId: 'user_loki',
      username: 'Loki',
      submissions: p1Submissions,
      previousState: { totalXp: 340, coins: 66, eloRating: 979 }
    };

    const participantB: BattleParticipantInput = {
      userId: 'user_sandhya',
      username: 'Sandhya',
      submissions: p2Submissions,
      previousState: { totalXp: 120, coins: 115, eloRating: 980 }
    };

    it('calculates deterministic battle outcome and player rewards matching authoritative rules', () => {
      const result = RewardCalculator.calculateBattleRewards('battle_test_101', participantA, participantB, 5);

      expect(result.status).toBe('COMPLETED');
      expect(result.winnerId).toBe('user_loki');
      expect(result.loserId).toBe('user_sandhya');
      expect(result.isDraw).toBe(false);

      // Player A (Winner)
      expect(result.playerA.outcome).toBe('WIN');
      expect(result.playerA.score).toBeGreaterThan(result.playerB.score);
      expect(result.playerA.xp.earned).toBeGreaterThanOrEqual(40);
      expect(result.playerA.xp.previous + result.playerA.xp.earned).toBe(result.playerA.xp.current);
      expect(result.playerA.coins.previous + result.playerA.coins.earned).toBe(result.playerA.coins.current);
      expect(result.playerA.elo.previous + result.playerA.elo.change).toBe(result.playerA.elo.current);

      // Player B (Loser)
      expect(result.playerB.outcome).toBe('LOSS');
      expect(result.playerB.xp.previous + result.playerB.xp.earned).toBe(result.playerB.xp.current);
      expect(result.playerB.coins.previous + result.playerB.coins.earned).toBe(result.playerB.coins.current);
      expect(result.playerB.elo.previous + result.playerB.elo.change).toBe(result.playerB.elo.current);
    });

    it('is completely idempotent when executed multiple times through BattleResultProcessor', async () => {
      const battleId = `idempotent_battle_${Date.now()}`;

      // First run
      const result1 = await BattleResultProcessor.processBattleRewards({
        battleId,
        playerA: participantA,
        playerB: participantB,
        totalQuestions: 5
      });

      // Second run with duplicate invocation
      const result2 = await BattleResultProcessor.processBattleRewards({
        battleId,
        playerA: participantA,
        playerB: participantB,
        totalQuestions: 5
      });

      expect(result1.battleId).toBe(battleId);
      expect(result2).toEqual(result1);
      expect(result2.playerA.xp.current).toBe(result1.playerA.xp.current);
      expect(result2.playerA.coins.current).toBe(result1.playerA.coins.current);
      expect(result2.playerA.elo.current).toBe(result1.playerA.elo.current);
    }, 15000);
  });
});
