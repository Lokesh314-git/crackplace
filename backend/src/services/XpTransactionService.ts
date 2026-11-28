import { db } from '../config/firebase';
import { XpTransactionRecord } from '../game/scoring/levelCalculator';
import { SeasonService } from './SeasonService';
import { invalidateLeaderboardCache } from './leaderboardCleanup';

// In-memory cache for ultra-fast deduplication
const processedRewardsCache = new Map<string, XpTransactionRecord>();
const memoryTransactionHistory = new Map<string, XpTransactionRecord[]>();

export class XpTransactionService {
  /**
   * Generates a deterministic idempotency key for an activity and user
   */
  public static getIdempotencyKey(source: string, referenceId: string, userId: string): string {
    return `${source}_${referenceId}_${userId}`;
  }

  /**
   * Checks whether a reward has already been processed and awarded
   */
  public static async isRewardProcessed(source: string, referenceId: string, userId: string): Promise<boolean> {
    const key = this.getIdempotencyKey(source, referenceId, userId);

    // 1. Check in-memory cache
    if (processedRewardsCache.has(key)) {
      return true;
    }

    // 2. Check Firestore / Mock DB if available
    if (db && typeof db.collection === 'function') {
      try {
        const docRef = db.collection('xpTransactions').doc(key);
        const snap = await docRef.get();
        if (snap && snap.exists) {
          processedRewardsCache.set(key, snap.data() as XpTransactionRecord);
          return true;
        }
      } catch (err) {
        console.warn(`[XpTransactionService] DB check failed for key ${key}:`, err);
      }
    }

    return false;
  }

  /**
   * Persists an auditable XP transaction record
   */
  public static async recordTransaction(
    record: XpTransactionRecord,
    firestoreTransactionOrBatch?: any
  ): Promise<void> {
    const key = this.getIdempotencyKey(record.source, record.referenceId, record.userId);
    const currentSeason = SeasonService.getSeasonBoundaries();
    const sanitizedRecord: XpTransactionRecord & { seasonId?: string } = {
      ...record,
      id: key,
      seasonId: (record as any).seasonId || currentSeason.seasonId,
      createdAt: record.createdAt || new Date().toISOString()
    };

    // Cache immediately in memory
    processedRewardsCache.set(key, sanitizedRecord);

    const userHistory = memoryTransactionHistory.get(record.userId) || [];
    userHistory.unshift(sanitizedRecord);
    if (userHistory.length > 50) userHistory.pop();
    memoryTransactionHistory.set(record.userId, userHistory);

    // Structured Server Audit Log
    console.log(
      `[XP_TRANSACTION] User=${record.userId} Source=${record.source} Ref=${record.referenceId} Earned=+${record.xpEarned} (XP: ${record.xpBefore} -> ${record.xpAfter}, Lvl: ${record.levelBefore} -> ${record.levelAfter}${record.leveledUp ? ' LEVELED UP!' : ''})`
    );

    // If writing within an existing Firestore transaction or batch
    if (firestoreTransactionOrBatch && typeof firestoreTransactionOrBatch.set === 'function') {
      if (db && typeof db.collection === 'function') {
        const docRef = db.collection('xpTransactions').doc(key);
        firestoreTransactionOrBatch.set(docRef, sanitizedRecord);
      }
      return;
    }

    // Standalone database persistence
    if (db && typeof db.collection === 'function') {
      try {
        const docRef = db.collection('xpTransactions').doc(key);
        await docRef.set(sanitizedRecord);
      } catch (err) {
        console.warn(`[XpTransactionService] Failed to persist transaction record to Firestore:`, err);
      }
    }

    // Refresh leaderboard caches when verified XP is awarded
    if (record.xpEarned > 0) {
      void invalidateLeaderboardCache();
    }
  }

  /**
   * Fetches recent XP audit transactions for a user (with cursor-based pagination)
   */
  public static async getUserTransactionsPaginated(
    userId: string,
    limitCount: number = 10,
    cursor?: string | null
  ): Promise<{ transactions: XpTransactionRecord[]; nextCursor: string | null; hasMore: boolean }> {
    const safeLimit = Math.min(50, Math.max(1, Number(limitCount) || 10));
    let list: XpTransactionRecord[] = [];

    if (db && typeof db.collection === 'function') {
      try {
        const snapshot = await db
          .collection('xpTransactions')
          .where('userId', '==', userId)
          .get();

        if (snapshot && !snapshot.empty) {
          snapshot.forEach((doc: any) => {
            const d = doc.data() as XpTransactionRecord;
            if (d && d.userId === userId) {
              list.push({ id: doc.id, ...d });
            }
          });
        }
      } catch (err) {
        console.warn(`[XpTransactionService] DB fetch failed, falling back to memory history:`, err);
        list = [...(memoryTransactionHistory.get(userId) || [])];
      }
    } else {
      list = [...(memoryTransactionHistory.get(userId) || [])];
    }

    // Sort deterministically newest-first (createdAt DESC, id DESC)
    list.sort((a, b) => {
      const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

    let startIndex = 0;
    if (cursor && typeof cursor === 'string' && cursor.includes('::')) {
      const [cursorTime, cursorId] = cursor.split('::');
      const cursorMs = new Date(cursorTime).getTime();
      startIndex = list.findIndex(tx => {
        const txMs = new Date(tx.createdAt).getTime();
        if (txMs < cursorMs) return true;
        if (txMs === cursorMs && String(tx.id || '') < cursorId) return true;
        return false;
      });
      if (startIndex === -1) {
        return { transactions: [], nextCursor: null, hasMore: false };
      }
    }

    const pageItems = list.slice(startIndex, startIndex + safeLimit);
    const hasMore = startIndex + safeLimit < list.length;
    const lastTx = pageItems[pageItems.length - 1];
    const nextCursor = hasMore && lastTx
      ? `${lastTx.createdAt}::${lastTx.id || ''}`
      : null;

    return {
      transactions: pageItems,
      nextCursor,
      hasMore
    };
  }

  /**
   * Fetches recent XP audit transactions for a user
   */
  public static async getUserTransactions(userId: string, limitCount: number = 20): Promise<XpTransactionRecord[]> {
    const res = await this.getUserTransactionsPaginated(userId, limitCount);
    return res.transactions;
  }

  /**
   * Clears in-memory caches (primarily for unit tests)
   */
  public static clearCache(): void {
    processedRewardsCache.clear();
    memoryTransactionHistory.clear();
  }
}

export default XpTransactionService;
