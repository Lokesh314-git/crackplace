import { db } from '../config/firebase';
import { XpTransactionRecord } from '../game/scoring/levelCalculator';

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
    const sanitizedRecord: XpTransactionRecord = {
      ...record,
      id: key,
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
  }

  /**
   * Fetches recent XP audit transactions for a user
   */
  public static async getUserTransactions(userId: string, limitCount: number = 20): Promise<XpTransactionRecord[]> {
    if (db && typeof db.collection === 'function') {
      try {
        const snapshot = await db
          .collection('xpTransactions')
          .where('userId', '==', userId)
          .get();

        if (snapshot && !snapshot.empty) {
          const list: XpTransactionRecord[] = [];
          snapshot.forEach((doc: any) => {
            list.push(doc.data() as XpTransactionRecord);
          });
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return list.slice(0, limitCount);
        }
      } catch (err) {
        console.warn(`[XpTransactionService] DB fetch failed, falling back to memory history:`, err);
      }
    }

    return (memoryTransactionHistory.get(userId) || []).slice(0, limitCount);
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
