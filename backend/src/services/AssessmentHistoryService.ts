import { db } from '../config/firebase';
import logger from '../utils/logger';

export type AssessmentType = 'quiz' | 'coding' | 'interview' | 'study_notes' | 'battle';

export interface AssessmentHistoryRecord {
  id?: string;
  assessmentId: string;
  userId: string;
  type: AssessmentType;
  title: string;
  category: string;
  topic: string;
  difficulty: string;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracy: number;
  score: number;
  xpEarned: number;
  status: 'completed';
  completedAt: string;
  durationSeconds: number;
  // Optional metadata for 1v1 battles
  opponentName?: string;
  opponentAvatar?: string;
  opponentScore?: number;
  winnerId?: string | null;
  isDraw?: boolean;
  eloChange?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export class AssessmentHistoryService {
  public static getRecordId(type: AssessmentType, assessmentId: string, userId: string): string {
    return `${type}_${assessmentId}_${userId}`;
  }

  /**
   * Idempotently persists a completed assessment record to Firestore `assessmentHistory`.
   */
  public static async recordCompletedAssessment(
    record: Omit<AssessmentHistoryRecord, 'id' | 'status'>,
    firestoreTransactionOrBatch?: any
  ): Promise<void> {
    if (!record.userId || !record.assessmentId) return;

    const docId = this.getRecordId(record.type, record.assessmentId, record.userId);
    const payload: AssessmentHistoryRecord = {
      ...record,
      id: docId,
      status: 'completed',
      completedAt: record.completedAt || new Date().toISOString()
    };

    try {
      if (firestoreTransactionOrBatch && typeof firestoreTransactionOrBatch.set === 'function') {
        if (db && typeof db.collection === 'function') {
          firestoreTransactionOrBatch.set(db.collection('assessmentHistory').doc(docId), payload);
        }
        return;
      }

      if (db && typeof db.collection === 'function') {
        await db.collection('assessmentHistory').doc(docId).set(payload, { merge: true });
      }
    } catch (err: any) {
      logger.warn('[AssessmentHistoryService] Failed to persist assessment history', {
        docId,
        error: err.message
      });
    }
  }

  /**
   * Cursor-based paginated retrieval of completed assessments for a specific authenticated user.
   * Merges `assessmentHistory` with legacy completed `quizzes`, `mock_interviews`, and `battleHistory`
   * without duplicating records or exposing incomplete/other-user records.
   */
  public static async getUserHistoryPaginated(
    userId: string,
    limitCount: number = 10,
    cursor?: string | null
  ): Promise<PaginatedResult<AssessmentHistoryRecord>> {
    const safeLimit = Math.min(50, Math.max(1, Number(limitCount) || 10));
    const mergedMap = new Map<string, AssessmentHistoryRecord>();

    if (!db || typeof db.collection !== 'function') {
      return { items: [], nextCursor: null, hasMore: false };
    }

    // 1. Primary authoritative `assessmentHistory` collection
    try {
      const snap = await db.collection('assessmentHistory')
        .where('userId', '==', userId)
        .get();

      if (snap && !snap.empty) {
        snap.forEach((doc: any) => {
          const d = doc.data() || {};
          if (d.userId !== userId || d.status !== 'completed') return;
          const dedupKey = `${d.type || 'quiz'}_${d.assessmentId || doc.id}`;
          mergedMap.set(dedupKey, {
            id: doc.id,
            ...d
          } as AssessmentHistoryRecord);
        });
      }
    } catch (err: any) {
      logger.warn('[AssessmentHistoryService] Primary history query failed', { userId, error: err.message });
    }

    // 2. Legacy completed Practice Quizzes (`quizzes` where results != null)
    try {
      const quizSnap = await db.collection('quizzes')
        .where('userId', '==', userId)
        .get();

      if (quizSnap && !quizSnap.empty) {
        quizSnap.forEach((doc: any) => {
          const d = doc.data() || {};
          // Exclude incomplete or abandoned quizzes
          if (d.userId !== userId || !d.results) return;
          const dedupKey = `quiz_${doc.id}`;
          if (mergedMap.has(dedupKey)) return;

          const totalQ = Number(d.results.totalQuestions ?? d.questions?.length ?? 0);
          const correctQ = Number(d.results.correctAnswers ?? 0);
          const incorrectQ = Math.max(0, totalQ - correctQ);
          const score = Number(d.results.score ?? (totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0));

          mergedMap.set(dedupKey, {
            id: doc.id,
            assessmentId: doc.id,
            userId,
            type: 'quiz',
            title: d.topic && d.topic !== 'All' ? `${d.category} — ${d.topic}` : `${d.category || 'Practice'} Quiz`,
            category: d.category || 'Practice',
            topic: d.topic || 'General',
            difficulty: d.difficulty || 'medium',
            totalQuestions: totalQ,
            correctAnswers: correctQ,
            incorrectAnswers: incorrectQ,
            accuracy: score,
            score,
            xpEarned: Number(d.results.xpEarned ?? 0),
            status: 'completed',
            completedAt: d.submittedAt || d.createdAt || new Date().toISOString(),
            durationSeconds: Number(d.results.timeTakenSeconds ?? 0)
          });
        });
      }
    } catch {
      // Safe fallback
    }

    // 3. Legacy completed 1v1 Battles (`battleHistory`)
    try {
      const battleSnap = await db.collection('battleHistory')
        .where('uids', 'array-contains', userId)
        .get();

      if (battleSnap && !battleSnap.empty) {
        battleSnap.forEach((doc: any) => {
          const d = doc.data() || {};
          const uids: string[] = Array.isArray(d.uids) ? d.uids : Object.keys(d.scores || {});
          if (!uids.includes(userId)) return;

          const battleId = d.battleId || doc.id;
          const dedupKey = `battle_${battleId}`;
          if (mergedMap.has(dedupKey)) return;

          const oppUid = uids.find(u => u !== userId);
          const me = d.players?.[userId] || {};
          const opp = oppUid ? (d.players?.[oppUid] || {}) : {};
          const myScore = Number(me.score ?? d.scores?.[userId] ?? 0);
          const oppScore = Number(opp.score ?? (oppUid ? d.scores?.[oppUid] : 0) ?? 0);
          const isDraw = Boolean(d.isDraw || d.winnerId === 'draw');
          const isWinner = d.winnerId === userId;
          const eloChange = Number(me.eloChange ?? d.eloChanges?.[userId] ?? 0);

          mergedMap.set(dedupKey, {
            id: doc.id,
            assessmentId: battleId,
            userId,
            type: 'battle',
            title: `1v1 Battle vs ${opp.displayName || 'Peer Candidate'}`,
            category: d.category || 'quantitative_aptitude',
            topic: d.topic || '1v1 Competitive',
            difficulty: d.difficulty || 'Medium',
            totalQuestions: 5,
            correctAnswers: 0,
            incorrectAnswers: 0,
            accuracy: 0,
            score: myScore,
            xpEarned: Number(me.xpEarned ?? 0),
            status: 'completed',
            completedAt: d.createdAt || new Date().toISOString(),
            durationSeconds: 0,
            opponentName: opp.displayName || 'Peer Candidate',
            opponentAvatar: opp.photoURL || '',
            opponentScore: oppScore,
            winnerId: d.winnerId,
            isDraw,
            eloChange: isDraw ? eloChange : (isWinner ? Math.abs(eloChange) : eloChange)
          });
        });
      }
    } catch {
      // Safe fallback
    }

    // 4. Sort deterministically newest-first: (completedAt DESC, id DESC)
    const allRecords = Array.from(mergedMap.values()).sort((a, b) => {
      const timeDiff = new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return String(b.id || b.assessmentId).localeCompare(String(a.id || a.assessmentId));
    });

    // 5. Apply cursor-based pagination (cursor = "<completedAt>::<id>")
    let startIndex = 0;
    if (cursor && typeof cursor === 'string' && cursor.includes('::')) {
      const [cursorTime, cursorId] = cursor.split('::');
      const cursorMs = new Date(cursorTime).getTime();
      startIndex = allRecords.findIndex(item => {
        const itemMs = new Date(item.completedAt).getTime();
        if (itemMs < cursorMs) return true;
        if (itemMs === cursorMs && String(item.id || item.assessmentId) < cursorId) return true;
        return false;
      });
      if (startIndex === -1) {
        return { items: [], nextCursor: null, hasMore: false };
      }
    }

    const pageItems = allRecords.slice(startIndex, startIndex + safeLimit);
    const hasMore = startIndex + safeLimit < allRecords.length;
    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor = hasMore && lastItem
      ? `${lastItem.completedAt}::${lastItem.id || lastItem.assessmentId}`
      : null;

    return {
      items: pageItems,
      nextCursor,
      hasMore
    };
  }
}

export default AssessmentHistoryService;
