import { db } from '../config/firebase';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { calculateLevelFromXP } from '../utils/gamification';

/**
 * Authoritative check to determine if a user should be excluded from all public leaderboards.
 * Excludes soft-deleted accounts, blocked/banned accounts, test fixtures, bots,
 * and any user who has not reached Level 3+ (Level 1 and Level 2 users are locked out and hidden).
 */
export function isUserExcludedFromLeaderboard(data: any, uid: string): boolean {
  if (!data) return true;

  // 1. Soft-deleted and deactivated markers
  if (data.accountStatus === 'deleted' || data.isDeleted === true || Boolean(data.deletedAt)) {
    return true;
  }

  // 2. Blocked / banned accounts
  if (data.accountStatus === 'blocked') {
    return true;
  }

  // 3. Explicit manual exclusion by admin
  if (data.ineligibleForLeaderboard === true) {
    return true;
  }

  // 4. Scrubbed / tombstoned account indicators
  if (typeof data.displayName === 'string' && data.displayName.trim().toLowerCase() === 'deleted user') {
    return true;
  }
  if (typeof data.email === 'string' && data.email.toLowerCase().startsWith('deleted_')) {
    return true;
  }

  // 5. Test fixtures, demo accounts, and bot IDs
  if (
    data.isTest ||
    data.isDemo ||
    data.environment === 'test' ||
    uid.startsWith('user_test_') ||
    uid.startsWith('user_host_') ||
    uid.startsWith('user_guest_') ||
    uid.startsWith('user_third_')
  ) {
    return true;
  }

  // 6. Level requirement: Players must reach Level 3+ to participate in any leaderboard
  // Eligibility is strictly derived from actual accumulated XP (trusted ledger)
  const rawXp = Number(data.totalXp ?? data.xp ?? 0);
  const actualLevel = calculateLevelFromXP(rawXp);
  if (actualLevel < 3) {
    return true;
  }

  return false;
}

/**
 * Invalidate all Redis leaderboard cache entries (weekly, global/all-time, college, department, friends).
 */
export async function invalidateLeaderboardCache(): Promise<number> {
  let clearedCount = 0;
  try {
    const knownKeys = [
      'leaderboard:weekly:200',
      'leaderboard:weekly:100',
      'leaderboard:weekly:50',
      'leaderboard:weekly:25',
      'leaderboard:global:200',
      'leaderboard:global:100',
      'leaderboard:global:50',
      'leaderboard:global:25',
      'leaderboard:elo:200',
      'leaderboard:elo:100',
      'leaderboard:elo:50',
      'leaderboard:elo:25',
      'leaderboard:college:200',
      'leaderboard:college:100',
      'leaderboard:college:50',
      'leaderboard:college:25',
      'leaderboard:department:200',
      'leaderboard:department:100',
      'leaderboard:department:50',
      'leaderboard:department:25',
      'leaderboard:friends:200',
      'leaderboard:friends:100',
      'leaderboard:friends:50',
      'leaderboard:friends:25',
      'leaderboard:top50',
      'leaderboard:weekly:top50'
    ];

    let patternKeys: string[] = [];
    if (redisClient && typeof redisClient.keys === 'function') {
      try {
        patternKeys = await redisClient.keys('leaderboard:*');
      } catch (patternErr) {
        logger.warn('[LEADERBOARD_CACHE] Pattern key lookup failed, falling back to static keys', {
          error: String(patternErr)
        });
      }
    }

    const uniqueKeys = Array.from(new Set([...knownKeys, ...patternKeys]));
    if (uniqueKeys.length > 0 && redisClient && typeof redisClient.del === 'function') {
      clearedCount = await redisClient.del(...uniqueKeys);
      logger.info(`[LEADERBOARD_CACHE] Cleared ${clearedCount} leaderboard cache keys in Redis`);
    }
  } catch (error) {
    logger.error('[LEADERBOARD_CACHE] Failed to invalidate leaderboard cache keys', {
      error: String(error)
    });
  }
  return clearedCount;
}

/**
 * Idempotent cleanup job that scans Firestore for legacy deleted/scrubbed user records
 * and ensures they have tombstone markers (ineligibleForLeaderboard: true, isDeleted: true),
 * then synchronizes leaderboardEligible flag for all accounts according to Level 3 rules,
 * then invalidates the leaderboard cache so no stale rankings are served.
 */
export async function cleanupLeaderboardStaleRecords(): Promise<{
  cleanedCount: number;
  totalScanned: number;
  timestamp: string;
}> {
  const timestamp = new Date().toISOString();
  let cleanedCount = 0;
  let totalScanned = 0;

  try {
    logger.info('[LEADERBOARD_CLEANUP] Starting stale user record audit in Firestore...');
    const snapshot = await db.collection('users').get();
    totalScanned = snapshot.size;

    const batch = db.batch();
    let batchOperations = 0;

    snapshot.forEach((doc: any) => {
      const data = doc.data() || {};
      const uid = doc.id;

      const isMarkedDeleted =
        data.accountStatus === 'deleted' ||
        data.isDeleted === true ||
        Boolean(data.deletedAt) ||
        (typeof data.displayName === 'string' && data.displayName.trim().toLowerCase() === 'deleted user') ||
        (typeof data.email === 'string' && data.email.toLowerCase().startsWith('deleted_'));

      if (isMarkedDeleted) {
        // Check if any required exclusion fields are missing
        const needsUpdate =
          data.accountStatus !== 'deleted' ||
          data.isDeleted !== true ||
          data.ineligibleForLeaderboard !== true ||
          !data.deletedAt ||
          data.displayName !== 'Deleted User';

        if (needsUpdate) {
          const docRef = db.collection('users').doc(uid);
          batch.update(docRef, {
            accountStatus: 'deleted',
            isDeleted: true,
            ineligibleForLeaderboard: true,
            leaderboardEligible: false,
            deletedAt: data.deletedAt || timestamp,
            displayName: 'Deleted User',
            photoURL: null,
            updatedAt: timestamp
          });
          batchOperations++;
          cleanedCount++;
        }
      } else {
        // Active account: check if leaderboardEligible is out of sync with actual Level 3+ status
        const rawXp = Number(data.totalXp ?? data.xp ?? 0);
        const actualLevel = calculateLevelFromXP(rawXp);
        const isExcluded =
          data.accountStatus === 'blocked' ||
          data.ineligibleForLeaderboard === true ||
          data.isTest ||
          data.isDemo;

        const expectedEligible = actualLevel >= 3 && !isExcluded;

        // If leaderboardEligible is explicitly out of sync
        if (data.leaderboardEligible !== expectedEligible) {
          const docRef = db.collection('users').doc(uid);
          batch.update(docRef, {
            leaderboardEligible: expectedEligible,
            updatedAt: timestamp
          });
          batchOperations++;
          cleanedCount++;
        }
      }
    });

    if (batchOperations > 0) {
      await batch.commit();
      logger.info(`[LEADERBOARD_CLEANUP] Successfully updated ${cleanedCount} user documents with eligibility flags.`);
    } else {
      logger.info('[LEADERBOARD_CLEANUP] Audit complete. All records have accurate eligibility flags.');
    }

    // Always invalidate cache after cleanup to purge any lingering rankings
    await invalidateLeaderboardCache();
  } catch (error: any) {
    logger.error('[LEADERBOARD_CLEANUP] Error during leaderboard stale record cleanup:', {
      error: error.message
    });
  }

  return {
    cleanedCount,
    totalScanned,
    timestamp
  };
}
