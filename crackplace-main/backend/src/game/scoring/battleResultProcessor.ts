import { db } from '../../config/firebase';
import { RewardCalculator, BattleParticipantInput, BattleResultPackage, PlayerRewardResult } from './rewardCalculator';
import { LevelCalculator } from './levelCalculator';
import { GAME_CONFIG } from '../config/gameConfig';
import { updateDailyStreak } from '../../utils/gamification';

// In-memory idempotency cache for fast retrieval and local dev fallback
const completedBattlesCache = new Map<string, BattleResultPackage>();
const activeProcessingLocks = new Set<string>();

export interface BattleRewardProcessingOptions {
  battleId: string;
  playerA: BattleParticipantInput;
  playerB: BattleParticipantInput;
  totalQuestions: number;
}

export class BattleResultProcessor {
  /**
   * Process and persist battle completion idempotently.
   * If already completed, returns existing cached result immediately without re-awarding.
   */
  public static async processBattleRewards(options: BattleRewardProcessingOptions): Promise<BattleResultPackage> {
    const { battleId, playerA, playerB, totalQuestions } = options;

    // 1. Check idempotency cache first
    if (completedBattlesCache.has(battleId)) {
      console.log(`[BattleResultProcessor] Battle ${battleId} already processed (memory cache hit). Returning existing result.`);
      return completedBattlesCache.get(battleId)!;
    }

    // 2. Lock guard against concurrent processing
    if (activeProcessingLocks.has(battleId)) {
      console.warn(`[BattleResultProcessor] Battle ${battleId} is currently being processed. Awaiting lock release...`);
      // Short spin wait if lock is held
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (completedBattlesCache.has(battleId)) {
          return completedBattlesCache.get(battleId)!;
        }
      }
    }

    activeProcessingLocks.add(battleId);

    try {
      // 3. If DB is active, check if battleRewards/{battleId} already exists
      if (db && typeof db.collection === 'function') {
        try {
          const rewardDocRef = db.collection('battleRewards').doc(battleId);
          const existingReward = await rewardDocRef.get();
          if (existingReward && existingReward.exists) {
            const data = existingReward.data() as BattleResultPackage;
            completedBattlesCache.set(battleId, data);
            console.log(`[BattleResultProcessor] Battle ${battleId} found in Firestore battleRewards. Returning existing record.`);
            return data;
          }
        } catch (dbErr) {
          console.warn(`[BattleResultProcessor] DB reward check failed, proceeding to compute:`, dbErr);
        }
      }

      // 4. Calculate authoritative result
      const resultPackage = RewardCalculator.calculateBattleRewards(battleId, playerA, playerB, totalQuestions);

      // 5. Atomic persistence to database
      if (db && typeof db.collection === 'function') {
        await this.persistRewardsTransaction(resultPackage, playerA, playerB);
      } else {
        console.log(`[BattleResultProcessor] Operating in Mock/Local mode. Skipping remote Firestore write.`);
      }

      // 6. Cache result package in memory
      completedBattlesCache.set(battleId, resultPackage);

      // 7. Structured Audit Log
      this.logRewardAudit(resultPackage);

      return resultPackage;
    } finally {
      activeProcessingLocks.delete(battleId);
    }
  }

  /**
   * Persist user progression updates and battle reward audit records in Firestore
   */
  private static async persistRewardsTransaction(
    resultPackage: BattleResultPackage,
    playerA: BattleParticipantInput,
    playerB: BattleParticipantInput
  ): Promise<void> {
    if (!db) return;

    try {
      const batch = db.batch();

      // 1. Write battle reward audit document (JSON sanitized to remove any undefined fields)
      const sanitizedReward = JSON.parse(JSON.stringify(resultPackage));
      sanitizedReward.processedAt = new Date().toISOString();

      const rewardDocRef = db.collection('battleRewards').doc(resultPackage.battleId);
      batch.set(rewardDocRef, sanitizedReward);

      // 2. Update battle record status
      const battleDocRef = db.collection('battles').doc(resultPackage.battleId);
      batch.set(
        battleDocRef,
        {
          status: 'COMPLETED',
          winnerId: resultPackage.winnerId || null,
          loserId: resultPackage.loserId || null,
          isDraw: resultPackage.isDraw,
          scores: {
            [resultPackage.playerA.userId]: resultPackage.playerA.score,
            [resultPackage.playerB.userId]: resultPackage.playerB.score,
          },
          completedAt: resultPackage.completedAt,
        },
        { merge: true }
      );

      // 3. Update Player A progression & XP Transaction
      await this.queueUserUpdate(batch, resultPackage.playerA, resultPackage.battleId);

      // 4. Update Player B progression & XP Transaction
      await this.queueUserUpdate(batch, resultPackage.playerB, resultPackage.battleId);

      // Commit batch atomically
      await batch.commit();
      console.log(`[BattleResultProcessor] Successfully committed Firestore rewards transaction for battle ${resultPackage.battleId}`);
    } catch (err) {
      console.error(`[BattleResultProcessor] Failed to commit Firestore transaction for battle ${resultPackage.battleId}:`, err);
    }
  }

  private static async queueUserUpdate(
    batch: FirebaseFirestore.WriteBatch,
    reward: PlayerRewardResult,
    battleId: string
  ): Promise<void> {
    if (!db) return;
    const userRef = db.collection('users').doc(reward.userId);

    const isWin = reward.outcome === 'WIN';
    const isLoss = reward.outcome === 'LOSS';

    // Fetch user current document to safely increment stats
    let currentData: any = {};
    try {
      const userSnap = await userRef.get();
      currentData = userSnap && userSnap.exists ? userSnap.data() || {} : {};
    } catch (fetchErr) {
      console.warn(`[BattleResultProcessor] Could not fetch user data for ${reward.userId}:`, fetchErr);
    }

    const totalBattles = (currentData.totalBattles || 0) + 1;
    const battlesWon = (currentData.battlesWon || 0) + (isWin ? 1 : 0);
    const battlesLost = (currentData.battlesLost || 0) + (isLoss ? 1 : 0);
    const winRate = totalBattles > 0 ? Math.round((battlesWon / totalBattles) * 100) : 0;

    const streakResult = updateDailyStreak(currentData.dailyStreak || 0, currentData.longestStreak || 0, currentData.lastActiveDate || '');

    batch.set(
      userRef,
      {
        xp: reward.xp.current,
        totalXp: reward.xp.current,
        level: reward.xp.levelAfter,
        coins: reward.coins.current,
        eloRating: reward.elo.current,
        battleRating: reward.elo.current,
        totalBattles,
        battlesWon,
        battlesLost,
        winRate,
        dailyStreak: streakResult.dailyStreak,
        longestStreak: streakResult.longestStreak,
        lastActiveDate: streakResult.lastActiveDate,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Record auditable XP transaction in batch
    const txKey = `battle_${battleId}_${reward.userId}`;
    const txRef = db.collection('xpTransactions').doc(txKey);
    batch.set(txRef, {
      id: txKey,
      userId: reward.userId,
      source: 'battle',
      referenceId: battleId,
      xpBefore: reward.xp.previous,
      xpEarned: reward.xp.earned,
      xpAfter: reward.xp.current,
      levelBefore: reward.xp.levelBefore,
      levelAfter: reward.xp.levelAfter,
      leveledUp: reward.xp.leveledUp,
      levelsGained: reward.xp.levelsGained,
      createdAt: new Date().toISOString(),
    });
  }

  private static logRewardAudit(pkg: BattleResultPackage): void {
    console.log(
      JSON.stringify({
        event: 'battle_rewards_processed',
        battleId: pkg.battleId,
        isDraw: pkg.isDraw,
        winnerId: pkg.winnerId,
        playerA: {
          userId: pkg.playerA.userId,
          score: pkg.playerA.score,
          xp: { old: pkg.playerA.xp.previous, earned: pkg.playerA.xp.earned, new: pkg.playerA.xp.current },
          level: { old: pkg.playerA.xp.levelBefore, new: pkg.playerA.xp.levelAfter, leveledUp: pkg.playerA.xp.leveledUp },
          coins: { old: pkg.playerA.coins.previous, earned: pkg.playerA.coins.earned, new: pkg.playerA.coins.current },
          elo: { old: pkg.playerA.elo.previous, change: pkg.playerA.elo.change, new: pkg.playerA.elo.current },
        },
        playerB: {
          userId: pkg.playerB.userId,
          score: pkg.playerB.score,
          xp: { old: pkg.playerB.xp.previous, earned: pkg.playerB.xp.earned, new: pkg.playerB.xp.current },
          level: { old: pkg.playerB.xp.levelBefore, new: pkg.playerB.xp.levelAfter, leveledUp: pkg.playerB.xp.leveledUp },
          coins: { old: pkg.playerB.coins.previous, earned: pkg.playerB.coins.earned, new: pkg.playerB.coins.current },
          elo: { old: pkg.playerB.elo.previous, change: pkg.playerB.elo.change, new: pkg.playerB.elo.current },
        },
      })
    );
  }
}
