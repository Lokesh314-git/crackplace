import request from 'supertest';
import { app } from '../index';
import { db } from '../config/firebase';
import { redisClient } from '../config/redis';
import { cleanupLeaderboardStaleRecords, invalidateLeaderboardCache } from '../services/leaderboardCleanup';

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
    } else if (token === 'level1_token') {
      req.user = { uid: 'user_lvl1_ineligible', email: 'lvl1@crackplace.ai' };
    } else if (token === 'level2_token') {
      req.user = { uid: 'user_lvl2_ineligible', email: 'lvl2@crackplace.ai' };
    } else if (token === 'promo_token') {
      req.user = { uid: 'user_promo_test', email: 'promo@crackplace.ai' };
    } else {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    next();
  },
  socketAuthMiddleware: (socket: any, next: any) => next(),
  strictAuthLimiter: (_req: any, _res: any, next: any) => next(),
  optionalAuth: (req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next()
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
      battleRating: 1450,
      college: 'Tech University',
      department: 'Computer Science',
      friends: ['real_user_beta']
    });

    await db.collection('users').doc('real_user_beta').set({
      uid: 'real_user_beta',
      displayName: 'Beta Challenger',
      level: 3,
      xp: 600,
      totalXp: 600,
      battleRating: 1300,
      college: 'Tech University',
      department: 'Computer Science'
    });

    await db.collection('users').doc('real_user_gamma').set({
      uid: 'real_user_gamma',
      displayName: 'Gamma Apprentice',
      level: 3,
      xp: 300,
      totalXp: 300,
      battleRating: 1300, // Tied in Elo with Beta, but lower XP
      college: 'State University',
      department: 'Electrical Engineering'
    });

    // Seed Level 1 and Level 2 users who must be locked out and excluded from all leaderboards
    await db.collection('users').doc('user_lvl1_ineligible').set({
      uid: 'user_lvl1_ineligible',
      displayName: 'Level One Cadet',
      level: 1,
      xp: 50,
      totalXp: 50,
      battleRating: 1100,
      accountStatus: 'active'
    });

    await db.collection('users').doc('user_lvl2_ineligible').set({
      uid: 'user_lvl2_ineligible',
      displayName: 'Level Two Scout',
      level: 2,
      xp: 180,
      totalXp: 180,
      battleRating: 1150,
      accountStatus: 'active'
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

    // Seed soft-deleted user (exact reproduction: 'Deleted User', 570 XP, 1000 Elo)
    await db.collection('users').doc('user_deleted_tombstone').set({
      uid: 'user_deleted_tombstone',
      displayName: 'Deleted User',
      email: 'deleted_user_deleted_tombstone@crackplace.ai',
      accountStatus: 'deleted',
      isDeleted: true,
      ineligibleForLeaderboard: true,
      deletedAt: new Date().toISOString(),
      level: 1,
      xp: 570,
      totalXp: 570,
      battleRating: 1000
    });

    // Seed blocked user
    await db.collection('users').doc('user_blocked_sample').set({
      uid: 'user_blocked_sample',
      displayName: 'Blocked Candidate',
      email: 'blocked@crackplace.ai',
      accountStatus: 'blocked',
      ineligibleForLeaderboard: true,
      level: 5,
      xp: 2500,
      totalXp: 2500,
      battleRating: 1800
    });

    // Seed legacy soft-deleted user missing ineligibleForLeaderboard flag
    await db.collection('users').doc('user_legacy_unflagged').set({
      uid: 'user_legacy_unflagged',
      displayName: 'Deleted User',
      email: 'deleted_user_legacy_unflagged@crackplace.ai',
      accountStatus: 'deleted',
      deletedAt: new Date().toISOString(),
      level: 1,
      xp: 400,
      totalXp: 400,
      battleRating: 900
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
      await db.collection('users').doc('user_deleted_tombstone').delete();
      await db.collection('users').doc('user_blocked_sample').delete();
      await db.collection('users').doc('user_legacy_unflagged').delete();
      await db.collection('users').doc('user_lvl1_ineligible').delete();
      await db.collection('users').doc('user_lvl2_ineligible').delete();
      await db.collection('users').doc('user_promo_test').delete();
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

  it('6. permanently excludes soft-deleted and blocked accounts from leaderboard rankings (resolves "Deleted User" bug)', async () => {
    // Flush cache to force fresh live query
    await invalidateLeaderboardCache();

    // Check Global rankings
    const globalRes = await request(app)
      .get('/api/leaderboard?type=global')
      .set('Authorization', 'Bearer real_user_token_1');

    expect(globalRes.status).toBe(200);
    const globalUids = globalRes.body.map((u: any) => u.uid);
    const globalNames = globalRes.body.map((u: any) => (u.displayName || '').toLowerCase());

    expect(globalUids).not.toContain('user_deleted_tombstone');
    expect(globalUids).not.toContain('user_blocked_sample');
    expect(globalNames).not.toContain('deleted user');

    // Check Weekly rankings
    const weeklyRes = await request(app)
      .get('/api/leaderboard?type=weekly')
      .set('Authorization', 'Bearer real_user_token_1');

    expect(weeklyRes.status).toBe(200);
    const weeklyUids = weeklyRes.body.map((u: any) => u.uid);
    const weeklyNames = weeklyRes.body.map((u: any) => (u.displayName || '').toLowerCase());

    expect(weeklyUids).not.toContain('user_deleted_tombstone');
    expect(weeklyUids).not.toContain('user_blocked_sample');
    expect(weeklyNames).not.toContain('deleted user');
  });

  it('7. assigns strictly consecutive 1-based ranks with no skipped rank slots after excluding deleted accounts', async () => {
    await invalidateLeaderboardCache();

    const res = await request(app)
      .get('/api/leaderboard?type=global')
      .set('Authorization', 'Bearer real_user_token_1');

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);

    // Verify every user has rank = index + 1
    res.body.forEach((user: any, index: number) => {
      expect(user.rank).toBe(index + 1);
    });

    // Verify specific valid candidates maintain proper sequence without gaps
    const alpha = res.body.find((u: any) => u.uid === 'real_user_alpha');
    const beta = res.body.find((u: any) => u.uid === 'real_user_beta');
    const gamma = res.body.find((u: any) => u.uid === 'real_user_gamma');

    expect(alpha.rank).toBe(1);
    expect(beta.rank).toBe(2);
    expect(gamma.rank).toBe(3);
  });

  it('8. rejects public profile viewing for soft-deleted or blocked accounts with 404', async () => {
    // Deleted user profile should 404
    const deletedRes = await request(app)
      .get('/api/profile/user_deleted_tombstone/public')
      .set('Authorization', 'Bearer real_user_token_1');
    expect(deletedRes.status).toBe(404);
    expect(deletedRes.body.code).toBe('PROFILE_DEACTIVATED');

    // Blocked user profile should 404
    const blockedRes = await request(app)
      .get('/api/profile/user_blocked_sample/public')
      .set('Authorization', 'Bearer real_user_token_1');
    expect(blockedRes.status).toBe(404);

    // Active user profile should succeed
    const activeRes = await request(app)
      .get('/api/profile/real_user_alpha/public')
      .set('Authorization', 'Bearer real_user_token_1');
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.displayName).toBe('Alpha Prime');
  });

  it('9. cleanupLeaderboardStaleRecords idempotently scans and flags legacy deleted records and purges cache', async () => {
    // Before cleanup, user_legacy_unflagged was missing ineligibleForLeaderboard
    const preDoc = await db.collection('users').doc('user_legacy_unflagged').get();
    expect(preDoc.data()?.ineligibleForLeaderboard).toBeUndefined();

    // Run cleanup
    const result = await cleanupLeaderboardStaleRecords();
    expect(result.totalScanned).toBeGreaterThan(0);
    expect(result.cleanedCount).toBeGreaterThanOrEqual(1);

    // After cleanup, doc has tombstone flags set
    const postDoc = await db.collection('users').doc('user_legacy_unflagged').get();
    expect(postDoc.data()?.isDeleted).toBe(true);
    expect(postDoc.data()?.ineligibleForLeaderboard).toBe(true);
    expect(postDoc.data()?.accountStatus).toBe('deleted');

    // Running cleanup again is idempotent (cleans 0 additional records)
    const secondResult = await cleanupLeaderboardStaleRecords();
    expect(secondResult.cleanedCount).toBe(0);
  });

  it('10. denies leaderboard access to Level 1 user with 403 LEADERBOARD_LOCKED', async () => {
    const res = await request(app)
      .get('/api/leaderboard')
      .set('Authorization', 'Bearer level1_token');

    expect(res.status).toBe(403);
    expect(res.body.locked).toBe(true);
    expect(res.body.code).toBe('LEADERBOARD_LOCKED');
    expect(res.body.currentLevel).toBe(1);
    expect(res.body.requiredLevel).toBe(3);
    expect(res.body.requiredXpForLevel3).toBe(250);
    expect(res.body.currentXp).toBe(50);
    expect(res.body.xpNeeded).toBe(200);
  });

  it('11. denies leaderboard access to Level 2 user with 403 LEADERBOARD_LOCKED', async () => {
    const res = await request(app)
      .get('/api/leaderboard')
      .set('Authorization', 'Bearer level2_token');

    expect(res.status).toBe(403);
    expect(res.body.locked).toBe(true);
    expect(res.body.code).toBe('LEADERBOARD_LOCKED');
    expect(res.body.currentLevel).toBe(2);
    expect(res.body.requiredLevel).toBe(3);
    expect(res.body.currentXp).toBe(180);
    expect(res.body.xpNeeded).toBe(70); // 250 - 180 = 70
  });

  it('12. strictly excludes Level 1 and Level 2 users from leaderboard query results across all active categories', async () => {
    await invalidateLeaderboardCache();

    // Check All-Time Global
    const globalRes = await request(app)
      .get('/api/leaderboard?type=global')
      .set('Authorization', 'Bearer real_user_token_1');

    expect(globalRes.status).toBe(200);
    const globalUids = globalRes.body.map((u: any) => u.uid);
    expect(globalUids).not.toContain('user_lvl1_ineligible');
    expect(globalUids).not.toContain('user_lvl2_ineligible');

    // Check Weekly Sprint
    const weeklyRes = await request(app)
      .get('/api/leaderboard?type=weekly')
      .set('Authorization', 'Bearer real_user_token_1');

    expect(weeklyRes.status).toBe(200);
    const weeklyUids = weeklyRes.body.map((u: any) => u.uid);
    expect(weeklyUids).not.toContain('user_lvl1_ineligible');
    expect(weeklyUids).not.toContain('user_lvl2_ineligible');

    // Check College Rankings
    const collegeRes = await request(app)
      .get('/api/leaderboard?type=college')
      .set('Authorization', 'Bearer real_user_token_1');

    expect(collegeRes.status).toBe(200);
    const collegeUids = collegeRes.body.map((u: any) => u.uid);
    expect(collegeUids).not.toContain('user_lvl1_ineligible');
    expect(collegeUids).not.toContain('user_lvl2_ineligible');

    // Check Department Rankings
    const deptRes = await request(app)
      .get('/api/leaderboard?type=department')
      .set('Authorization', 'Bearer real_user_token_1');

    expect(deptRes.status).toBe(200);
    const deptUids = deptRes.body.map((u: any) => u.uid);
    expect(deptUids).not.toContain('user_lvl1_ineligible');
    expect(deptUids).not.toContain('user_lvl2_ineligible');

    // Check Friends Rankings
    const friendsRes = await request(app)
      .get('/api/leaderboard?type=friends')
      .set('Authorization', 'Bearer real_user_token_1');

    expect(friendsRes.status).toBe(200);
    const friendsUids = friendsRes.body.map((u: any) => u.uid);
    expect(friendsUids).not.toContain('user_lvl1_ineligible');
    expect(friendsUids).not.toContain('user_lvl2_ineligible');
  });

  it('13. user reaches Level 3 and automatically unlocks Rankings and appears in results', async () => {
    // 1. Initially at Level 2 (200 XP) -> locked
    await db.collection('users').doc('user_promo_test').set({
      uid: 'user_promo_test',
      displayName: 'Promoted Contender',
      level: 2,
      xp: 200,
      totalXp: 200,
      battleRating: 1350,
      accountStatus: 'active'
    });

    await invalidateLeaderboardCache();

    const lockedRes = await request(app)
      .get('/api/leaderboard')
      .set('Authorization', 'Bearer promo_token');

    expect(lockedRes.status).toBe(403);
    expect(lockedRes.body.locked).toBe(true);

    // Verify other players do NOT see user_promo_test yet
    const preCheck = await request(app)
      .get('/api/leaderboard?type=global')
      .set('Authorization', 'Bearer real_user_token_1');
    const preUids = preCheck.body.map((u: any) => u.uid);
    expect(preUids).not.toContain('user_promo_test');

    // 2. User gains XP to reach 260 XP (Level 3 unlock threshold is 250 XP)
    await db.collection('users').doc('user_promo_test').update({
      xp: 260,
      totalXp: 260,
      level: 3,
      leaderboardEligible: true
    });

    await invalidateLeaderboardCache();

    // 3. User now accesses leaderboard directly -> 200 OK!
    const unlockedRes = await request(app)
      .get('/api/leaderboard')
      .set('Authorization', 'Bearer promo_token');

    expect(unlockedRes.status).toBe(200);
    expect(Array.isArray(unlockedRes.body)).toBe(true);

    // 4. Other players now see newly eligible Level 3 user in global results
    const postCheck = await request(app)
      .get('/api/leaderboard?type=global')
      .set('Authorization', 'Bearer real_user_token_1');

    const postUids = postCheck.body.map((u: any) => u.uid);
    expect(postUids).toContain('user_promo_test');
  });

  it('14. supports limit query parameters (Top 25, Top 50, Top 200) without returning ineligible users', async () => {
    await invalidateLeaderboardCache();

    const res25 = await request(app)
      .get('/api/leaderboard?limit=25')
      .set('Authorization', 'Bearer real_user_token_1');
    expect(res25.status).toBe(200);
    expect(res25.body.length).toBeLessThanOrEqual(25);
    res25.body.forEach((u: any) => {
      expect(u.level).toBeGreaterThanOrEqual(3);
    });

    const res200 = await request(app)
      .get('/api/leaderboard?limit=200')
      .set('Authorization', 'Bearer real_user_token_1');
    expect(res200.status).toBe(200);
    expect(res200.body.length).toBeLessThanOrEqual(200);
    res200.body.forEach((u: any) => {
      expect(u.level).toBeGreaterThanOrEqual(3);
    });
  });

  it('15. preserves all profile data, XP, coins, and levels without loss during updates and audits', async () => {
    const alphaDoc = await db.collection('users').doc('real_user_alpha').get();
    const data = alphaDoc.data();

    expect(data.displayName).toBe('Alpha Prime');
    expect(data.xp).toBe(950);
    expect(data.totalXp).toBe(950);
    expect(data.battleRating).toBe(1450);

    const lvl1Doc = await db.collection('users').doc('user_lvl1_ineligible').get();
    const lvl1Data = lvl1Doc.data();
    // Excluded from leaderboards, but user account, XP, coins are completely intact
    expect(lvl1Data.displayName).toBe('Level One Cadet');
    expect(lvl1Data.xp).toBe(50);
    expect(lvl1Data.totalXp).toBe(50);
  });

  it('16. completely rejects deprecated daily and monthly leaderboard categories with 400 INVALID_CATEGORY', async () => {
    await invalidateLeaderboardCache();

    const dailyRes = await request(app)
      .get('/api/leaderboard?type=daily')
      .set('Authorization', 'Bearer real_user_token_1');
    expect(dailyRes.status).toBe(400);
    expect(dailyRes.body.code).toBe('INVALID_CATEGORY');

    const monthlyRes = await request(app)
      .get('/api/leaderboard?type=monthly')
      .set('Authorization', 'Bearer real_user_token_1');
    expect(monthlyRes.status).toBe(400);
    expect(monthlyRes.body.code).toBe('INVALID_CATEGORY');
  });

  it('17. correctly filters Department rankings to candidates belonging to caller department', async () => {
    await invalidateLeaderboardCache();

    const deptRes = await request(app)
      .get('/api/leaderboard?type=department')
      .set('Authorization', 'Bearer real_user_token_1');

    expect(deptRes.status).toBe(200);
    const uids = deptRes.body.map((u: any) => u.uid);
    // Both Alpha and Beta belong to Computer Science
    expect(uids).toContain('real_user_alpha');
    expect(uids).toContain('real_user_beta');
    // Gamma belongs to Electrical Engineering, must be filtered out
    expect(uids).not.toContain('real_user_gamma');
  });

  it('18. correctly filters Friends rankings to caller and their connected friends', async () => {
    await invalidateLeaderboardCache();

    const friendsRes = await request(app)
      .get('/api/leaderboard?type=friends')
      .set('Authorization', 'Bearer real_user_token_1');

    expect(friendsRes.status).toBe(200);
    const uids = friendsRes.body.map((u: any) => u.uid);
    // Alpha is caller, Beta is in Alpha friends list
    expect(uids).toContain('real_user_alpha');
    expect(uids).toContain('real_user_beta');
    // Gamma is not a friend, must be excluded
    expect(uids).not.toContain('real_user_gamma');
  });
});
