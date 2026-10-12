import { db } from '../config/firebase';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Authoritative check to determine if a user should be excluded from all public leaderboards.
 * Excludes soft-deleted accounts, blocked/banned accounts, test fixtures, and bots.
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

  // 3. Explicit leaderboard ineligibility flag
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

  return false;
}

/**
 * Invalidate all Redis leaderboard cache entries (global, weekly, and custom limits).
 */
export async function invalidateLeaderboardCache(): Promise<number> {
  let clearedCount = 0;
  try {
    const knownKeys = [
      'leaderboard:global:100',
      'leaderboard:weekly:100',
      'leaderboard:global:50',
      'leaderboard:weekly:50',
      'leaderboard:global:25',
      'leaderboard:weekly:25',
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
            deletedAt: data.deletedAt || timestamp,
            displayName: 'Deleted User',
            photoURL: null,
            updatedAt: timestamp
          });
          batchOperations++;
          cleanedCount++;
        }
      }
    });

    if (batchOperations > 0) {
      await batch.commit();
      logger.info(`[LEADERBOARD_CLEANUP] Successfully updated ${cleanedCount} stale user documents with exclusion flags.`);
    } else {
      logger.info('[LEADERBOARD_CLEANUP] Audit complete. No legacy records required updates.');
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
