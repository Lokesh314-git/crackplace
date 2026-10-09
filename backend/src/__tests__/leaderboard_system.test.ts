import request from 'supertest';
import { app } from '../index';
import { db } from '../config/firebase';
import { redisClient } from '../config/redis';

// Mock auth middleware
jest.mock('../middleware/auth', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const token = authHeader.split('Bearer ')[1];
    if (token === 'real_user_token_1') {
      req.user = { uid: 'real_user_alpha', email: 'alpha@real.com' };
    } else if (token === 'real_user_token_2') {
      req.user = { uid: 'real_user_beta', email: 'beta@real.com' };
    } else {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    next();
  },
  socketAuthMiddleware: (socket: any, next: any) => next(),
  strictAuthLimiter: (_req: any, _res: any, next: any) => next()
}));

jest.setTimeout(25000);

describe('Authoritative Leaderboard System Suite', () => {
  beforeAll(async () => {
    // Clear Redis leaderboard caches
    try {
      await redisClient.del('leaderboard:global:50');
      await redisClient.del('leaderboard:weekly:50');
      await redisClient.del('leaderboard:top50');
    } catch {
      // Safe ignore
    }

    // Seed test users (both real candidates and test/demo accounts)
    await db.collection('users').doc('real_user_alpha').set({
      uid: 'real_user_alpha',
      displayName: 'Alpha Prime',
      level: 4,
      xp: 950,
      totalXp: 950,
      battleRating: 1450
    });

    await db.collection('users').doc('real_user_beta').set({
      uid: 'real_user_beta',
      displayName: 'Beta Challenger',
      level: 3,
      xp: 600,
      totalXp: 600,
      battleRating: 1300
    });

    await db.collection('users').doc('real_user_gamma').set({
      uid: 'real_user_gamma',
      displayName: 'Gamma Apprentice',
      level: 2,
      xp: 300,
      totalXp: 300,
      battleRating: 1300 // Tied in Elo with Beta, but lower XP
    });

    // Seed test fixtures that MUST be excluded from production leaderboards
    await db.collection('users').doc('user_test_demo_account').set({
      uid: 'user_test_demo_account',
      displayName: 'Fake Demo Bot',
      level: 99,
      xp: 99999,
      battleRating: 3000,
      isTest: true,
      isDemo: true
    });

    await db.collection('users').doc('user_host_sample').set({
      uid: 'user_host_sample',
      displayName: 'Host Master Demo',
      level: 10,
      xp: 5000,
      battleRating: 2000,
      isDemo: true
    });

    // Seed weekly XP transactions for Alpha and Beta
    const thisWeek = new Date().toISOString();
    await db.collection('xpTransactions').doc('weekly_tx_alpha_1').set({
      id: 'weekly_tx_alpha_1',
      userId: 'real_user_alpha',
      xpEarned: 150,
      source: 'battle',
      createdAt: thisWeek
    });

    await db.collection('xpTransactions').doc('weekly_tx_beta_1').set({
      id: 'weekly_tx_beta_1',
      userId: 'real_user_beta',
      xpEarned: 350, // Beta has more weekly XP than Alpha!
      source: 'quiz',
      createdAt: thisWeek
    });
  });

  afterAll(async () => {
    try {
      await db.collection('users').doc('real_user_alpha').delete();
      await db.collection('users').doc('real_user_beta').delete();
      await db.collection('users').doc('real_user_gamma').delete();
      await db.collection('users').doc('user_test_demo_account').delete();
      await db.collection('users').doc('user_host_sample').delete();
      await db.collection('xpTransactions').doc('weekly_tx_alpha_1').delete();
      await db.collection('xpTransactions').doc('weekly_tx_beta_1').delete();
    } catch {
      // Safe cleanup
    }
  });

  it('1. should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/leaderboard');
    expect(res.status).toBe(401);
  });

  it('2. should return All-Time Global rankings sorted deterministically (Elo DESC, XP DESC)', async () => {
    // Clear cache to read fresh state
    try {
      await redisClient.del('leaderboard:global:50');
    } catch {}

    const res = await request(app)
      .get('/api/leaderboard?type=global')
      .set('Authorization', 'Bearer real_user_token_1');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const uids = res.body.map((u: any) => u.uid);
    expect(uids).toContain('real_user_alpha');
    expect(uids).toContain('real_user_beta');
    expect(uids).toContain('real_user_gamma');

    // Filtered demo/test accounts must NOT appear
    expect(uids).not.toContain('user_test_demo_account');
    expect(uids).not.toContain('user_host_sample');
    expect(uids).not.toContain('1'); // Sandhya P fake fallback ID
    expect(uids).not.toContain('2'); // Lokesh A fake fallback ID

    // Verify deterministic order: Alpha (1450 Elo) > Beta (1300 Elo, 600 XP) > Gamma (1300 Elo, 300 XP)
    const alphaIdx = res.body.findIndex((u: any) => u.uid === 'real_user_alpha');
    const betaIdx = res.body.findIndex((u: any) => u.uid === 'real_user_beta');
    const gammaIdx = res.body.findIndex((u: any) => u.uid === 'real_user_gamma');

    expect(alphaIdx).toBeLessThan(betaIdx);
    expect(betaIdx).toBeLessThan(gammaIdx);

    // Verify dynamic rank numbers
    expect(res.body[alphaIdx].rank).toBe(alphaIdx + 1);
    expect(res.body[betaIdx].rank).toBe(betaIdx + 1);
  });

  it('3. should return Weekly Sprint rankings sorted by weekly XP DESC', async () => {
    try {
      await redisClient.del('leaderboard:weekly:50');
    } catch {}

    const res = await request(app)
      .get('/api/leaderboard?type=weekly')
      .set('Authorization', 'Bearer real_user_token_1');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const beta = res.body.find((u: any) => u.uid === 'real_user_beta');
    const alpha = res.body.find((u: any) => u.uid === 'real_user_alpha');

    expect(beta).toBeDefined();
    expect(alpha).toBeDefined();
    expect(beta.weeklyXp).toBe(350);
    expect(alpha.weeklyXp).toBe(150);

    const betaIdx = res.body.findIndex((u: any) => u.uid === 'real_user_beta');
    const alphaIdx = res.body.findIndex((u: any) => u.uid === 'real_user_alpha');

    // In Weekly sprint, Beta (350 XP) must be ranked ahead of Alpha (150 XP)
    expect(betaIdx).toBeLessThan(alphaIdx);
  });

  it('4. should derive Level accurately from XP for all returned candidate entries', async () => {
    const res = await request(app)
      .get('/api/leaderboard?type=global')
      .set('Authorization', 'Bearer real_user_token_1');

    expect(res.status).toBe(200);
    const alpha = res.body.find((u: any) => u.uid === 'real_user_alpha');
    expect(alpha.level).toBeGreaterThanOrEqual(1);
    expect(typeof alpha.level).toBe('number');
  });

  it('5. should never duplicate identical UIDs in leaderboard results', async () => {
    const res = await request(app)
      .get('/api/leaderboard?type=global')
      .set('Authorization', 'Bearer real_user_token_1');

    const uids = res.body.map((u: any) => u.uid);
    const uniqueUids = new Set(uids);
    expect(uids.length).toBe(uniqueUids.size);
  });
});
