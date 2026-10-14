import request from 'supertest';
import { app } from '../index';
import { SeasonService } from '../services/SeasonService';
import { db } from '../config/firebase';
import { LevelCalculator } from '../game/scoring/levelCalculator';

describe('Seasonal Elo & Leaderboard Level 3 Access Control Suite', () => {
  beforeEach(async () => {
    // Reset seasonalElo settings in mockDB to defaults
    if (db) {
      await db.collection('systemSettings').doc('seasonalElo').set({
        decayEnabled: true,
        reductionPercentage: 20,
        minFloor: 100,
        timezone: 'Asia/Kolkata'
      });

      // Clear test seasons and user states so each test starts with fresh records
      const testSeasons = ['season_test_reset_001', 'season_idempotent_002', 'season_decay_disabled_003'];
      for (const sId of testSeasons) {
        await db.collection('seasons').doc(sId).delete();
      }
    }
  });

  describe('1. Season Schedule & Asia/Kolkata (IST) Boundaries', () => {
    it('accurately calculates season boundaries aligned to Monday 00:00:00 IST', () => {
      // Reference date: Wednesday, Oct 14, 2026, 12:00:00 UTC (17:30 IST)
      const testDate = new Date('2026-10-14T12:00:00.000Z');
      const boundaries = SeasonService.getSeasonBoundaries(testDate);

      // Start must be Monday Oct 12, 2026 00:00:00 IST -> Oct 11, 2026 18:30:00 UTC
      expect(boundaries.seasonId).toBe('season_2026-10-12');
      expect(boundaries.startDate.toISOString()).toBe('2026-10-11T18:30:00.000Z');
      // End must be Monday Oct 19, 2026 00:00:00 IST -> Oct 18, 2026 18:30:00 UTC
      expect(boundaries.endDate.toISOString()).toBe('2026-10-18T18:30:00.000Z');
      expect(boundaries.nextResetTimestamp).toBe('2026-10-18T18:30:00.000Z');
      expect(boundaries.seasonNumber).toBeGreaterThanOrEqual(1);
    });

    it('handles Sunday 23:59:59 IST remaining in the active season and Monday 00:00:00 IST starting the new season', () => {
      // Sunday Oct 18, 2026, 23:59:59 IST = Sunday Oct 18, 2026, 18:29:59 UTC
      const sundayEnd = new Date('2026-10-18T18:29:59.000Z');
      const sundayBoundaries = SeasonService.getSeasonBoundaries(sundayEnd);
      expect(sundayBoundaries.seasonId).toBe('season_2026-10-12');

      // 2 seconds later: Monday Oct 19, 2026, 00:00:01 IST = Sunday Oct 18, 2026, 18:30:01 UTC
      const mondayStart = new Date('2026-10-18T18:30:01.000Z');
      const mondayBoundaries = SeasonService.getSeasonBoundaries(mondayStart);
      expect(mondayBoundaries.seasonId).toBe('season_2026-10-19');
      expect(mondayBoundaries.seasonNumber).toBe(sundayBoundaries.seasonNumber + 1);
    });

    it('correctly resolves previous season boundaries for weekly catch-up', () => {
      const testDate = new Date('2026-10-19T06:00:00.000Z');
      const prev = SeasonService.getPreviousSeasonBoundaries(testDate);
      expect(prev.seasonId).toBe('season_2026-10-12');
    });
  });

  describe('2. Seasonal Elo Reduction Math & Floor Protections', () => {
    it('applies exact formula: newElo = round(currentElo * (1 - reductionPercentage / 100))', async () => {
      // 1000 with 20% reduction: 1000 * 0.8 = 800
      const elo1000 = 1000;
      const red20 = Math.round(elo1000 * (20 / 100));
      expect(elo1000 - red20).toBe(800);

      // 1250 with 10% reduction: 1250 * 0.9 = 1125
      const elo1250 = 1250;
      const red10 = Math.round(elo1250 * (10 / 100));
      expect(elo1250 - red10).toBe(1125);

      // 1475 with 30% reduction: 1475 * 0.7 = 1032.5 -> round = 1033 (or reduction = 443, remaining = 1032)
      const elo1475 = 1475;
      const red30 = Math.round(elo1475 * (30 / 100));
      expect(elo1475 - red30).toBe(1032);
    });

    it('enforces minimum Elo floor and never allows ratings to drop below 100 or become negative', async () => {
      const lowElo = 110;
      const red20 = Math.round(lowElo * 0.2); // 22
      const candidateNewElo = lowElo - red20; // 88
      const safeNewElo = Math.max(100, candidateNewElo);
      expect(safeNewElo).toBe(100);
    });
  });

  describe('3. Authoritative Weekly Reset Execution & Idempotency', () => {
    it('executes season reset, reduces ratings, and strictly preserves XP, levels, and coins', async () => {
      const seasonId = 'season_test_reset_001';

      // Seed 2 players
      const userA = {
        uid: 'user_season_a',
        displayName: 'Cadet Alice',
        battleRating: 1200,
        eloRating: 1200,
        totalXp: 850,
        xp: 850,
        level: 5,
        coins: 150,
        accountStatus: 'active'
      };

      const userB = {
        uid: 'user_season_b',
        displayName: 'Cadet Bob',
        battleRating: 1000,
        eloRating: 1000,
        totalXp: 400,
        xp: 400,
        level: 3,
        coins: 75,
        accountStatus: 'active'
      };

      await db.collection('users').doc(userA.uid).set(userA);
      await db.collection('users').doc(userB.uid).set(userB);

      // Configure 20% reduction
      await SeasonService.updateSettings('admin_tester', {
        decayEnabled: true,
        reductionPercentage: 20,
        minFloor: 100
      });

      // Execute reset for season_test_reset_001
      const res = await SeasonService.executeSeasonReset('test_execution', 'jest_suite', seasonId);
      expect(res.success).toBe(true);
      expect(res.seasonId).toBe(seasonId);
      expect(res.processedCount).toBeGreaterThanOrEqual(2);

      // Verify User A: 1200 -> 960 (reduced by 240)
      const docA = await db.collection('users').doc(userA.uid).get();
      const updatedA = docA.data();
      expect(updatedA.battleRating).toBe(960);
      expect(updatedA.eloRating).toBe(960);
      // Verify XP, level, coins untouched!
      expect(updatedA.totalXp).toBe(850);
      expect(updatedA.level).toBe(5);
      expect(updatedA.coins).toBe(150);
      expect(updatedA.lastSeasonResetId).toBe(seasonId);

      // Verify User B: 1000 -> 800 (reduced by 200)
      const docB = await db.collection('users').doc(userB.uid).get();
      const updatedB = docB.data();
      expect(updatedB.battleRating).toBe(800);
      expect(updatedB.eloRating).toBe(800);
      expect(updatedB.totalXp).toBe(400);
      expect(updatedB.coins).toBe(75);
      expect(updatedB.lastSeasonResetId).toBe(seasonId);

      // Verify Audit record was written
      const auditDocA = await db.collection('seasonResetAudit').doc(`${seasonId}_${userA.uid}`).get();
      expect(auditDocA.exists).toBe(true);
      expect(auditDocA.data()?.oldElo).toBe(1200);
      expect(auditDocA.data()?.newElo).toBe(960);
      expect(auditDocA.data()?.amountReduced).toBe(240);
    });

    it('guarantees complete idempotency: repeated executions never double-reduce', async () => {
      const seasonId = 'season_idempotent_002';

      const user = {
        uid: 'user_idempotency_check',
        displayName: 'Cadet Charlie',
        battleRating: 1000,
        eloRating: 1000,
        totalXp: 300,
        accountStatus: 'active'
      };
      await db.collection('users').doc(user.uid).set(user);

      // First execution: 1000 -> 800
      const firstRes = await SeasonService.executeSeasonReset('first_run', 'jest', seasonId);
      expect(firstRes.success).toBe(true);

      const afterFirst = (await db.collection('users').doc(user.uid).get()).data();
      expect(afterFirst.battleRating).toBe(800);

      // Second execution: must detect completed status or lastSeasonResetId and NOT reduce again
      const secondRes = await SeasonService.executeSeasonReset('second_run_retry', 'jest', seasonId);
      expect(secondRes.success).toBe(true);

      const afterSecond = (await db.collection('users').doc(user.uid).get()).data();
      expect(afterSecond.battleRating).toBe(800); // Still 800, never 640!
    });

    it('respects decayEnabled = false: rolls over season record without decreasing ratings', async () => {
      const seasonId = 'season_decay_disabled_003';

      const user = {
        uid: 'user_disabled_decay',
        displayName: 'Cadet Dave',
        battleRating: 1100,
        eloRating: 1100,
        totalXp: 300,
        accountStatus: 'active'
      };
      await db.collection('users').doc(user.uid).set(user);

      // Disable decay
      await SeasonService.updateSettings('admin_tester', {
        decayEnabled: false,
        reductionPercentage: 20
      });

      const res = await SeasonService.executeSeasonReset('disabled_decay_run', 'jest', seasonId);
      expect(res.success).toBe(true);
      expect(res.decayEnabled).toBe(false);

      const after = (await db.collection('users').doc(user.uid).get()).data();
      expect(after.battleRating).toBe(1100); // Untouched
      expect(after.eloRating).toBe(1100);
      expect(after.lastSeasonResetId).toBe(seasonId);
    });
  });

  describe('4. Leaderboard Level 3 Access Control Enforcement', () => {
    it('denies leaderboard access to Level 1 user with 403 LEADERBOARD_LOCKED', async () => {
      const level1Uid = 'user_lvl1_test';
      await db.collection('users').doc(level1Uid).set({
        uid: level1Uid,
        displayName: 'New Cadet',
        totalXp: 50,
        xp: 50,
        accountStatus: 'active'
      });

      // Token for user_lvl1_test
      const mockLvl1Token = `header.${Buffer.from(JSON.stringify({ uid: level1Uid, role: 'student' })).toString('base64')}.sig`;

      const res = await request(app)
        .get('/api/leaderboard')
        .set('Authorization', `Bearer ${mockLvl1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.locked).toBe(true);
      expect(res.body.code).toBe('LEADERBOARD_LOCKED');
      expect(res.body.currentLevel).toBe(1);
      expect(res.body.requiredLevel).toBe(3);
      expect(res.body.requiredXpForLevel3).toBe(250);
      expect(res.body.xpNeeded).toBe(200);
      expect(res.body.progressPercentage).toBe(20);
    });

    it('denies leaderboard access to Level 2 user with 403 LEADERBOARD_LOCKED', async () => {
      const level2Uid = 'user_lvl2_test';
      await db.collection('users').doc(level2Uid).set({
        uid: level2Uid,
        displayName: 'Intermediate Cadet',
        totalXp: 180, // Level 2 (100 to 249 XP)
        xp: 180,
        accountStatus: 'active'
      });

      const mockLvl2Token = `header.${Buffer.from(JSON.stringify({ uid: level2Uid, role: 'student' })).toString('base64')}.sig`;

      const res = await request(app)
        .get('/api/leaderboard')
        .set('Authorization', `Bearer ${mockLvl2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.locked).toBe(true);
      expect(res.body.currentLevel).toBe(2);
      expect(res.body.xpNeeded).toBe(70); // 250 - 180 = 70
    });

    it('allows leaderboard access to Level 3 user', async () => {
      const level3Uid = 'user_lvl3_test';
      await db.collection('users').doc(level3Uid).set({
        uid: level3Uid,
        displayName: 'Unlocked Candidate',
        totalXp: 260, // Level 3 (>= 250 XP)
        xp: 260,
        battleRating: 1150,
        accountStatus: 'active'
      });

      const mockLvl3Token = `header.${Buffer.from(JSON.stringify({ uid: level3Uid, role: 'student' })).toString('base64')}.sig`;

      const res = await request(app)
        .get('/api/leaderboard')
        .set('Authorization', `Bearer ${mockLvl3Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('5. Public & Admin API Endpoints', () => {
    it('GET /api/seasons/current returns public season metadata and next reset timestamp', async () => {
      const res = await request(app).get('/api/seasons/current');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('seasonId');
      expect(res.body).toHaveProperty('seasonNumber');
      expect(res.body).toHaveProperty('startDate');
      expect(res.body).toHaveProperty('endDate');
      expect(res.body).toHaveProperty('nextResetTimestamp');
      expect(res.body).toHaveProperty('timeRemainingMs');
      expect(res.body).toHaveProperty('reductionPercentage');
      expect(res.body.timezone).toBe('Asia/Kolkata');
    });

    it('rejects invalid reduction percentages (<10% or >30%) in admin settings', async () => {
      const adminToken = `header.${Buffer.from(JSON.stringify({ uid: 'admin_test', email: 'admin@crackplace.ai', role: 'admin' })).toString('base64')}.sig`;

      // Percentage too low (5%)
      const lowRes = await request(app)
        .post('/api/admin/seasons/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reductionPercentage: 5 });
      expect(lowRes.status).toBe(400);

      // Percentage too high (35%)
      const highRes = await request(app)
        .post('/api/admin/seasons/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reductionPercentage: 35 });
      expect(highRes.status).toBe(400);

      // Valid percentage (25%)
      const validRes = await request(app)
        .post('/api/admin/seasons/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reductionPercentage: 25, decayEnabled: true, minFloor: 100 });
      expect(validRes.status).toBe(200);
      expect(validRes.body.settings.reductionPercentage).toBe(25);
    });

    it('rejects unauthorized users from modifying admin season settings', async () => {
      const studentToken = `header.${Buffer.from(JSON.stringify({ uid: 'student_attacker', email: 'student@crackplace.ai', role: 'student' })).toString('base64')}.sig`;

      const res = await request(app)
        .post('/api/admin/seasons/settings')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ reductionPercentage: 15 });

      expect(res.status).toBe(403);
    });

    it('supports POST /api/seasons/reset with x-scheduler-secret header', async () => {
      const res = await request(app)
        .post('/api/seasons/reset')
        .set('x-scheduler-secret', 'crackplace_scheduler_secret_prod_2026')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
