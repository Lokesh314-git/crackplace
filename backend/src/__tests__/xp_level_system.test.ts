import { LevelCalculator, XpRewardEvaluation } from '../game/scoring/levelCalculator';
import { XpTransactionService } from '../services/XpTransactionService';
import { GAME_CONFIG } from '../game/config/gameConfig';
import { RewardCalculator, BattleParticipantInput } from '../game/scoring/rewardCalculator';
import { BattleResultProcessor } from '../game/scoring/battleResultProcessor';

describe('Server-Authoritative XP and Level-Up System Comprehensive Suite', () => {
  beforeEach(() => {
    XpTransactionService.clearCache();
  });

  // 1. XP reward without level-up
  it('1. should process XP reward without level-up correctly', () => {
    const evalResult: XpRewardEvaluation = LevelCalculator.evaluateXpReward({
      currentXp: 30,
      xpEarned: 40,
      userId: 'user_test_1',
      source: 'quiz',
      referenceId: 'quiz_01'
    });

    expect(evalResult.xpBefore).toBe(30);
    expect(evalResult.xpEarned).toBe(40);
    expect(evalResult.xpAfter).toBe(70);
    expect(evalResult.levelBefore).toBe(1);
    expect(evalResult.levelAfter).toBe(1);
    expect(evalResult.leveledUp).toBe(false);
    expect(evalResult.levelsGained).toBe(0);
    expect(evalResult.progress.xpProgressInLevel).toBe(70);
    expect(evalResult.progress.xpNeededForNextLevel).toBe(100);
    expect(evalResult.progress.progressPercentage).toBe(70);
  });

  // 2. XP reward causing level-up
  it('2. should detect level-up when crossing a single level threshold', () => {
    const evalResult = LevelCalculator.evaluateXpReward({
      currentXp: 80,
      xpEarned: 40,
      userId: 'user_test_2',
      source: 'battle',
      referenceId: 'battle_01'
    });

    expect(evalResult.xpBefore).toBe(80);
    expect(evalResult.xpEarned).toBe(40);
    expect(evalResult.xpAfter).toBe(120);
    expect(evalResult.levelBefore).toBe(1);
    expect(evalResult.levelAfter).toBe(2);
    expect(evalResult.leveledUp).toBe(true);
    expect(evalResult.levelsGained).toBe(1);
    expect(evalResult.progress.currentLevelBaseXp).toBe(100);
    expect(evalResult.progress.nextLevelRequiredXp).toBe(250);
    expect(evalResult.progress.xpProgressInLevel).toBe(20);
    expect(evalResult.progress.xpNeededForNextLevel).toBe(150);
    expect(evalResult.progress.progressPercentage).toBe(13); // round(20/150 * 100) = 13%
  });

  // 3. XP reward causing multiple level-ups
  it('3. should accurately detect and handle multiple level-ups in a single large reward', () => {
    // 50 XP (Level 1) + 450 XP = 500 XP (Level 3: 250..449 is Level 3, 450..699 is Level 4 -> Level 4)
    const evalResult = LevelCalculator.evaluateXpReward({
      currentXp: 50,
      xpEarned: 650,
      userId: 'user_test_3',
      source: 'achievement',
      referenceId: 'ach_mega'
    });

    expect(evalResult.xpBefore).toBe(50);
    expect(evalResult.xpEarned).toBe(650);
    expect(evalResult.xpAfter).toBe(700); // 700 XP is exact threshold for Level 5
    expect(evalResult.levelBefore).toBe(1);
    expect(evalResult.levelAfter).toBe(5);
    expect(evalResult.leveledUp).toBe(true);
    expect(evalResult.levelsGained).toBe(4);
  });

  // 4. Exact level threshold
  it('4. should transition level exactly at boundary thresholds', () => {
    // Level 1 threshold to Level 2 is 100
    expect(LevelCalculator.calculateLevelFromXP(100)).toBe(2);
    // Level 2 threshold to Level 3 is 250
    expect(LevelCalculator.calculateLevelFromXP(250)).toBe(3);
    // Level 3 threshold to Level 4 is 450
    expect(LevelCalculator.calculateLevelFromXP(450)).toBe(4);
    // Level 4 threshold to Level 5 is 700
    expect(LevelCalculator.calculateLevelFromXP(700)).toBe(5);

    const prog100 = LevelCalculator.calculateLevelProgress(100);
    expect(prog100.level).toBe(2);
    expect(prog100.xpProgressInLevel).toBe(0);
    expect(prog100.progressPercentage).toBe(0);

    const prog250 = LevelCalculator.calculateLevelProgress(250);
    expect(prog250.level).toBe(3);
    expect(prog250.xpProgressInLevel).toBe(0);
    expect(prog250.progressPercentage).toBe(0);
  });

  // 5. One XP below threshold
  it('5. should keep player at previous level when 1 XP below threshold', () => {
    expect(LevelCalculator.calculateLevelFromXP(99)).toBe(1);
    expect(LevelCalculator.calculateLevelFromXP(249)).toBe(2);
    expect(LevelCalculator.calculateLevelFromXP(449)).toBe(3);
    expect(LevelCalculator.calculateLevelFromXP(699)).toBe(4);

    const prog99 = LevelCalculator.calculateLevelProgress(99);
    expect(prog99.level).toBe(1);
    expect(prog99.xpProgressInLevel).toBe(99);
    expect(prog99.xpNeededForNextLevel).toBe(100);
    expect(prog99.progressPercentage).toBe(99);
  });

  // 6. One XP above threshold
  it('6. should place player at new level when 1 XP above threshold', () => {
    expect(LevelCalculator.calculateLevelFromXP(101)).toBe(2);
    expect(LevelCalculator.calculateLevelFromXP(251)).toBe(3);
    expect(LevelCalculator.calculateLevelFromXP(451)).toBe(4);
    expect(LevelCalculator.calculateLevelFromXP(701)).toBe(5);

    const prog101 = LevelCalculator.calculateLevelProgress(101);
    expect(prog101.level).toBe(2);
    expect(prog101.xpProgressInLevel).toBe(1);
    expect(prog101.xpNeededForNextLevel).toBe(150);
  });

  // 7. Zero XP reward
  it('7. should safely process zero XP reward with no mutation', () => {
    const evalResult = LevelCalculator.evaluateXpReward({
      currentXp: 180,
      xpEarned: 0,
      userId: 'user_test_7',
      source: 'practice',
      referenceId: 'ref_zero'
    });

    expect(evalResult.xpBefore).toBe(180);
    expect(evalResult.xpEarned).toBe(0);
    expect(evalResult.xpAfter).toBe(180);
    expect(evalResult.levelBefore).toBe(2);
    expect(evalResult.levelAfter).toBe(2);
    expect(evalResult.leveledUp).toBe(false);
    expect(evalResult.levelsGained).toBe(0);
  });

  // 8. Duplicate reward request
  it('8. should identify and block duplicate reward transactions via idempotency service', async () => {
    const testUserId = `user_test_8_${Date.now()}`;
    const testRefId = `quiz_duplicate_test_${Date.now()}`;
    const record = {
      userId: testUserId,
      source: 'quiz' as const,
      referenceId: testRefId,
      xpBefore: 100,
      xpEarned: 50,
      xpAfter: 150,
      levelBefore: 2,
      levelAfter: 2,
      leveledUp: false,
      levelsGained: 0,
      createdAt: new Date().toISOString()
    };

    // First check: should not be processed yet
    const beforeRecorded = await XpTransactionService.isRewardProcessed('quiz', testRefId, testUserId);
    expect(beforeRecorded).toBe(false);

    // Record transaction
    await XpTransactionService.recordTransaction(record);

    // Second check: should now be detected as processed
    const afterRecorded = await XpTransactionService.isRewardProcessed('quiz', testRefId, testUserId);
    expect(afterRecorded).toBe(true);

    // Verify transaction history retrieval
    const history = await XpTransactionService.getUserTransactions(testUserId);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].referenceId).toBe(testRefId);
    expect(history[0].xpEarned).toBe(50);
  });

  // 9. Battle retry / re-processing idempotency
  it('9. should deterministically award identical rewards for re-calculated battles', () => {
    const p1: BattleParticipantInput = {
      userId: 'p1_id',
      username: 'Player 1',
      submissions: [
        { questionIndex: 0, selectedOption: 1, correct: true, responseTimeMs: 2000, timeLimitMs: 30000, difficulty: 'Medium' }
      ],
      previousState: { totalXp: 120, coins: 50, eloRating: 1000 }
    };

    const p2: BattleParticipantInput = {
      userId: 'p2_id',
      username: 'Player 2',
      submissions: [
        { questionIndex: 0, selectedOption: 0, correct: false, responseTimeMs: 4000, timeLimitMs: 30000, difficulty: 'Medium' }
      ],
      previousState: { totalXp: 80, coins: 50, eloRating: 1000 }
    };

    const res1 = RewardCalculator.calculateBattleRewards('battle_retry_test', p1, p2, 1);
    const res2 = RewardCalculator.calculateBattleRewards('battle_retry_test', p1, p2, 1);

    expect(res1.playerA.xp.earned).toBe(res2.playerA.xp.earned);
    expect(res1.playerA.xp.current).toBe(res2.playerA.xp.current);
    expect(res1.playerB.xp.earned).toBe(res2.playerB.xp.earned);
    expect(res1.playerB.xp.current).toBe(res2.playerB.xp.current);
  });

  // 10. Browser refresh / verify consistency
  it('10. should ensure total XP and level remain consistent across state reconstructions', () => {
    const startingXp = 340;
    const computedLevel = LevelCalculator.calculateLevelFromXP(startingXp);
    const progress = LevelCalculator.calculateLevelProgress(startingXp);

    expect(computedLevel).toBe(3);
    expect(progress.level).toBe(3);
    expect(progress.currentLevelBaseXp).toBe(250);
    expect(progress.nextLevelRequiredXp).toBe(450);
    expect(progress.xpProgressInLevel).toBe(90);
    expect(progress.xpNeededForNextLevel).toBe(200);
    expect(progress.progressPercentage).toBe(45);
  });

  // 11. Reconnection simulation
  it('11. should enforce monotonic XP gain during reconnects and never lose XP', () => {
    let currentTotalXp = 200;
    const step1 = LevelCalculator.evaluateXpReward({
      currentXp: currentTotalXp,
      xpEarned: 30,
      userId: 'reconnect_user',
      source: 'quiz',
      referenceId: 'q1'
    });
    currentTotalXp = step1.xpAfter;

    // Simulate reconnection with cached or re-sent event
    const step2 = LevelCalculator.evaluateXpReward({
      currentXp: currentTotalXp,
      xpEarned: 20,
      userId: 'reconnect_user',
      source: 'coding',
      referenceId: 'c1'
    });

    expect(step2.xpBefore).toBe(230);
    expect(step2.xpAfter).toBe(250);
    expect(step2.levelAfter).toBe(3); // Reached Level 3 threshold!
    expect(step2.leveledUp).toBe(true);
  });

  // 12. Multiple simultaneous activities
  it('12. should maintain mathematical equation: xpBefore + xpEarned = xpAfter across sequential activities', () => {
    let runningXp = 0;
    const activities = [
      { source: 'daily_login' as const, earned: 5 },
      { source: 'quiz' as const, earned: 60 },
      { source: 'coding' as const, earned: 100 },
      { source: 'battle' as const, earned: 45 },
      { source: 'achievement' as const, earned: 100 }
    ];

    for (const act of activities) {
      const evalRes = LevelCalculator.evaluateXpReward({
        currentXp: runningXp,
        xpEarned: act.earned,
        userId: 'seq_user',
        source: act.source,
        referenceId: `ref_${act.source}`
      });

      expect(evalRes.xpBefore + evalRes.xpEarned).toBe(evalRes.xpAfter);
      expect(evalRes.levelAfter).toBe(LevelCalculator.calculateLevelFromXP(evalRes.xpAfter));
      runningXp = evalRes.xpAfter;
    }

    expect(runningXp).toBe(310);
    expect(LevelCalculator.calculateLevelFromXP(runningXp)).toBe(3);
  });

  // 13. Existing user with old XP
  it('13. should correctly derive level for legacy user documents where level field is missing or stale', () => {
    const legacyUserDoc = {
      displayName: 'Veteran Cadet',
      xp: 1250,
      // missing level field
    };

    const derivedLevel = LevelCalculator.calculateLevelFromXP(legacyUserDoc.xp);
    const progress = LevelCalculator.calculateLevelProgress(legacyUserDoc.xp);

    // 0..99: 1, 100..249: 2, 250..449: 3, 450..699: 4, 700..999: 5, 1000..1349: 6
    expect(derivedLevel).toBe(6);
    expect(progress.level).toBe(6);
    expect(progress.currentLevelBaseXp).toBe(1000);
    expect(progress.nextLevelRequiredXp).toBe(1350);
    expect(progress.xpProgressInLevel).toBe(250);
    expect(progress.xpNeededForNextLevel).toBe(350);
  });

  // 14. Negative / invalid XP
  it('14. should safely clamp negative or invalid XP inputs without decreasing level or NaN corruption', () => {
    const invalidEval = LevelCalculator.evaluateXpReward({
      currentXp: -50,
      xpEarned: -100,
      userId: 'invalid_user',
      source: 'admin',
      referenceId: 'test_neg'
    });

    expect(invalidEval.xpBefore).toBe(0);
    expect(invalidEval.xpEarned).toBe(0);
    expect(invalidEval.xpAfter).toBe(0);
    expect(invalidEval.levelAfter).toBe(1);
    expect(invalidEval.leveledUp).toBe(false);

    expect(LevelCalculator.calculateLevelFromXP(NaN)).toBe(1);
    expect(LevelCalculator.calculateLevelFromXP(-999)).toBe(1);
  });

  // 15. Very large XP values
  it('15. should handle very large XP values efficiently without infinite loop or precision breakdown', () => {
    const largeXp = 1000000; // 1 Million XP
    const highLevel = LevelCalculator.calculateLevelFromXP(largeXp);
    const highProgress = LevelCalculator.calculateLevelProgress(largeXp);

    expect(highLevel).toBeGreaterThan(100);
    expect(highProgress.level).toBe(highLevel);
    expect(highProgress.totalXp).toBe(largeXp);
    expect(highProgress.progressPercentage).toBeGreaterThanOrEqual(0);
    expect(highProgress.progressPercentage).toBeLessThanOrEqual(100);
    expect(highProgress.xpProgressInLevel).toBeGreaterThanOrEqual(0);
  });
});
