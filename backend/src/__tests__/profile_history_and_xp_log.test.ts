import request from 'supertest';
import { app } from '../index';
import { db } from '../config/firebase';
import { AssessmentHistoryService } from '../services/AssessmentHistoryService';
import { XpTransactionService } from '../services/XpTransactionService';
import { verifyToken } from '../middleware/auth';

jest.mock('../middleware/auth', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    const auth = req.headers.authorization;
    if (auth === 'Bearer profile_user_a_token') {
      req.user = { uid: 'profile_user_a', email: 'a@test.com', role: 'student' };
      return next();
    }
    if (auth === 'Bearer profile_user_b_token') {
      req.user = { uid: 'profile_user_b', email: 'b@test.com', role: 'student' };
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  },
  optionalAuth: (req: any, _res: any, next: any) => next(),
  socketAuthMiddleware: (_socket: any, next: any) => next(),
  requireAdmin: (_req: any, _res: any, next: any) => next()
}));

describe('My Profile: Assessment History & XP Log Pagination & Integrity Suite', () => {
  const userA = 'profile_user_a';
  const userB = 'profile_user_b';
  const createdDocIds: string[] = [];
  const createdTxIds: string[] = [];

  beforeAll(async () => {
    const baseTime = new Date('2026-11-28T10:00:00.000Z').getTime();

    // Seed 15 completed assessments for User A (quizzes + coding + battle)
    for (let i = 1; i <= 15; i++) {
      const id = `hist_a_${i}`;
      const type = i % 3 === 0 ? 'coding' : 'quiz';
      await AssessmentHistoryService.recordCompletedAssessment({
        assessmentId: id,
        userId: userA,
        type,
        title: `Assessment #${i}`,
        category: type === 'coding' ? 'DSA' : 'quantitative_aptitude',
        topic: type === 'coding' ? 'Arrays and Strings' : 'Probability',
        difficulty: 'medium',
        totalQuestions: 5,
        correctAnswers: 4,
        incorrectAnswers: 1,
        accuracy: 80,
        score: 80,
        xpEarned: 25,
        completedAt: new Date(baseTime + i * 60_000).toISOString(),
        durationSeconds: 120
      });
      createdDocIds.push(AssessmentHistoryService.getRecordId(type, id, userA));
    }

    // Seed an incomplete quiz for User A (must NOT appear in Assessment History)
    await db.collection('quizzes').doc('incomplete_quiz_a').set({
      userId: userA,
      category: 'quantitative_aptitude',
      topic: 'Probability',
      results: null,
      createdAt: new Date(baseTime + 20 * 60_000).toISOString()
    });

    // Seed 1 completed assessment for User B (must NOT leak to User A)
    await AssessmentHistoryService.recordCompletedAssessment({
      assessmentId: 'hist_b_1',
      userId: userB,
      type: 'quiz',
      title: 'User B Private Quiz',
      category: 'dbms',
      topic: 'SQL Queries',
      difficulty: 'hard',
      totalQuestions: 10,
      correctAnswers: 9,
      incorrectAnswers: 1,
      accuracy: 90,
      score: 90,
      xpEarned: 50,
      completedAt: new Date(baseTime + 30 * 60_000).toISOString(),
      durationSeconds: 200
    });
    createdDocIds.push(AssessmentHistoryService.getRecordId('quiz', 'hist_b_1', userB));

    // Seed 14 XP transactions for User A and 1 for User B
    for (let i = 1; i <= 14; i++) {
      const refId = `tx_ref_${i}`;
      await XpTransactionService.recordTransaction({
        userId: userA,
        source: i % 2 === 0 ? 'quiz' : 'coding',
        referenceId: refId,
        xpBefore: (i - 1) * 20,
        xpEarned: 20,
        xpAfter: i * 20,
        levelBefore: 1,
        levelAfter: 1,
        leveledUp: false,
        levelsGained: 0,
        createdAt: new Date(baseTime + i * 60_000).toISOString()
      });
      createdTxIds.push(XpTransactionService.getIdempotencyKey(i % 2 === 0 ? 'quiz' : 'coding', refId, userA));
    }

    await XpTransactionService.recordTransaction({
      userId: userB,
      source: 'battle',
      referenceId: 'tx_b_private',
      xpBefore: 0,
      xpEarned: 30,
      xpAfter: 30,
      levelBefore: 1,
      levelAfter: 1,
      leveledUp: false,
      levelsGained: 0,
      createdAt: new Date(baseTime + 99 * 60_000).toISOString()
    });
    createdTxIds.push(XpTransactionService.getIdempotencyKey('battle', 'tx_b_private', userB));
  });

  afterAll(async () => {
    try {
      for (const id of createdDocIds) {
        await db.collection('assessmentHistory').doc(id).delete();
      }
      await db.collection('quizzes').doc('incomplete_quiz_a').delete();
      for (const txId of createdTxIds) {
        await db.collection('xpTransactions').doc(txId).delete();
      }
    } catch {}
  });

  it('1. rejects unauthenticated requests to assessment history and XP log with 401', async () => {
    const histRes = await request(app).get('/api/auth/assessments/history');
    expect(histRes.status).toBe(401);

    const xpRes = await request(app).get('/api/auth/xp/transactions');
    expect(xpRes.status).toBe(401);
  });

  it('2. returns latest 10 completed assessments newest-first and paginates next batch via cursor without duplicates', async () => {
    const page1 = await request(app)
      .get('/api/auth/assessments/history?limit=10')
      .set('Authorization', 'Bearer profile_user_a_token');

    expect(page1.status).toBe(200);
    expect(page1.body.items.length).toBe(10);
    expect(page1.body.hasMore).toBe(true);
    expect(page1.body.nextCursor).toBeTruthy();

    // Newest assessment (#15) must appear first
    expect(page1.body.items[0].assessmentId).toBe('hist_a_15');
    // Incomplete quiz must NOT appear
    expect(page1.body.items.some((i: any) => i.assessmentId === 'incomplete_quiz_a')).toBe(false);
    // User B's record must NOT appear
    expect(page1.body.items.some((i: any) => i.userId === userB)).toBe(false);

    // Fetch Page 2 using cursor
    const page2 = await request(app)
      .get(`/api/auth/assessments/history?limit=10&cursor=${encodeURIComponent(page1.body.nextCursor)}`)
      .set('Authorization', 'Bearer profile_user_a_token');

    expect(page2.status).toBe(200);
    expect(page2.body.items.length).toBe(5);
    expect(page2.body.hasMore).toBe(false);
    expect(page2.body.nextCursor).toBeNull();

    // Zero duplicate IDs across pages
    const allIds = [...page1.body.items, ...page2.body.items].map((i: any) => i.id);
    expect(new Set(allIds).size).toBe(15);
  });

  it('3. prevents duplicate assessment history records on repeated submissions', async () => {
    await AssessmentHistoryService.recordCompletedAssessment({
      assessmentId: 'hist_a_15',
      userId: userA,
      type: 'coding',
      title: 'Assessment #15 Duplicate',
      category: 'DSA',
      topic: 'Arrays and Strings',
      difficulty: 'medium',
      totalQuestions: 5,
      correctAnswers: 4,
      incorrectAnswers: 1,
      accuracy: 80,
      score: 80,
      xpEarned: 25,
      completedAt: new Date('2026-11-28T10:15:00.000Z').toISOString(),
      durationSeconds: 120
    });

    const page1 = await request(app)
      .get('/api/auth/assessments/history?limit=20')
      .set('Authorization', 'Bearer profile_user_a_token');

    const matches = page1.body.items.filter((i: any) => i.assessmentId === 'hist_a_15');
    expect(matches.length).toBe(1);
  });

  it('4. paginates XP transactions (10 per page, newest-first, no duplicates, strict UID isolation)', async () => {
    const page1 = await request(app)
      .get('/api/auth/xp/transactions?limit=10')
      .set('Authorization', 'Bearer profile_user_a_token');

    expect(page1.status).toBe(200);
    expect(page1.body.transactions.length).toBe(10);
    expect(page1.body.hasMore).toBe(true);
    expect(page1.body.nextCursor).toBeTruthy();

    // Newest transaction (#14) must be first, and User B's transaction must not leak
    expect(page1.body.transactions[0].referenceId).toBe('tx_ref_14');
    expect(page1.body.transactions.some((tx: any) => tx.userId === userB)).toBe(false);

    const page2 = await request(app)
      .get(`/api/auth/xp/transactions?limit=10&cursor=${encodeURIComponent(page1.body.nextCursor)}`)
      .set('Authorization', 'Bearer profile_user_a_token');

    expect(page2.status).toBe(200);
    expect(page2.body.transactions.length).toBe(4);
    expect(page2.body.hasMore).toBe(false);
    expect(page2.body.nextCursor).toBeNull();

    const allTxIds = [...page1.body.transactions, ...page2.body.transactions].map((tx: any) => tx.id);
    expect(new Set(allTxIds).size).toBe(14);
  });
});
