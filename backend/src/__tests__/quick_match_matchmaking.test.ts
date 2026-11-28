import { BattleEngine } from '../services/BattleEngine';
import { redisClient } from '../config/redis';
import { db } from '../config/firebase';

const createMockSocket = (userId: string, socketId: string) => {
  const emitted: Array<{ event: string; payload: any }> = [];
  return {
    id: socketId,
    data: { userId },
    emit: (event: string, payload: any) => {
      emitted.push({ event, payload });
    },
    emitted
  } as any;
};

describe('Quick Match Aptitude-Only & Fair Matchmaking Audit Suite', () => {
  const queueKey = 'matchmaking:queue:quantitative_aptitude';

  beforeEach(async () => {
    try {
      await redisClient.del(queueKey);
      await redisClient.del('battle:active:qm_user_1');
      await redisClient.del('battle:active:qm_user_2');
      await redisClient.del('battle:active:qm_user_3');
      await redisClient.del('battle:active:qm_banned_1');
    } catch {}

    await db.collection('users').doc('qm_user_1').set({
      uid: 'qm_user_1',
      displayName: 'Aptitude Player 1',
      battleRating: 1000,
      xp: 500,
      accountStatus: 'active'
    });
    await db.collection('users').doc('qm_user_2').set({
      uid: 'qm_user_2',
      displayName: 'Aptitude Player 2',
      battleRating: 1050,
      xp: 600,
      accountStatus: 'active'
    });
    await db.collection('users').doc('qm_user_3').set({
      uid: 'qm_user_3',
      displayName: 'High Elo Player 3',
      battleRating: 1400,
      xp: 1200,
      accountStatus: 'active'
    });
    await db.collection('users').doc('qm_banned_1').set({
      uid: 'qm_banned_1',
      displayName: 'Banned User',
      battleRating: 1000,
      accountStatus: 'blocked'
    });
  });

  afterAll(async () => {
    try {
      await db.collection('users').doc('qm_user_1').delete();
      await db.collection('users').doc('qm_user_2').delete();
      await db.collection('users').doc('qm_user_3').delete();
      await db.collection('users').doc('qm_banned_1').delete();
      await redisClient.del(queueKey);
    } catch {}
  });

  it('1. calculates expanding Elo search ranges accurately by wait time', () => {
    expect(BattleEngine.getAllowedEloRange(0)).toBe(100);
    expect(BattleEngine.getAllowedEloRange(9999)).toBe(100);
    expect(BattleEngine.getAllowedEloRange(10_000)).toBe(200);
    expect(BattleEngine.getAllowedEloRange(19_999)).toBe(200);
    expect(BattleEngine.getAllowedEloRange(20_000)).toBe(300);
    expect(BattleEngine.getAllowedEloRange(30_000)).toBe(500);
    expect(BattleEngine.getAllowedEloRange(60_000)).toBe(500);
  });

  it('2. findBestEloOpponent selects closest Elo opponent, respects Elo bounds, and never self-matches', () => {
    const now = Date.now();
    const seeker = { userId: 'qm_user_1', rating: 1000, joinedAt: now };

    // Self and out-of-range (1400 at t=0 -> diff 400 > 100) must be skipped; 1050 is closest valid
    const candidates = [
      { userId: 'qm_user_1', rating: 1000, joinedAt: now - 5000 }, // self
      { userId: 'qm_user_3', rating: 1400, joinedAt: now - 1000 }, // diff 400 > 100
      { userId: 'qm_user_2', rating: 1050, joinedAt: now - 2000 }  // diff 50 <= 100
    ];

    const best = BattleEngine.findBestEloOpponent(seeker, candidates, now);
    expect(best).not.toBeNull();
    expect(best.userId).toBe('qm_user_2');

    // After 35 seconds wait, range expands to ±500, so 1400 Elo becomes matchable
    const waitedSeeker = { userId: 'qm_user_1', rating: 1000, joinedAt: now - 35_000 };
    const expandedBest = BattleEngine.findBestEloOpponent(waitedSeeker, [candidates[1]], now);
    expect(expandedBest).not.toBeNull();
    expect(expandedBest.userId).toBe('qm_user_3');
  });

  it('3. restricts Quick Match strictly to Quantitative Aptitude even if another subject is passed', async () => {
    const s1 = createMockSocket('qm_user_1', 'sock_1');
    await BattleEngine.joinMatchmaking(s1, { battleType: 'dsa', rating: 1000, profile: {} });

    const members = await redisClient.smembers(queueKey);
    expect(members.length).toBe(1);
    const ticket = JSON.parse(members[0]);
    expect(ticket.userId).toBe('qm_user_1');
    expect(ticket.rating).toBe(1000);
  });

  it('4. prevents duplicate queue entries and self-matching on repeated joinMatchmaking calls', async () => {
    const s1a = createMockSocket('qm_user_1', 'sock_1a');
    const s1b = createMockSocket('qm_user_1', 'sock_1b');

    await BattleEngine.joinMatchmaking(s1a, { battleType: 'quantitative_aptitude' });
    await BattleEngine.joinMatchmaking(s1b, { battleType: 'quantitative_aptitude' });

    const members = await redisClient.smembers(queueKey);
    expect(members.length).toBe(1);
  });

  it('5. blocks restricted/banned accounts from entering Quick Match queue', async () => {
    const bannedSocket = createMockSocket('qm_banned_1', 'sock_banned');
    await BattleEngine.joinMatchmaking(bannedSocket, { battleType: 'quantitative_aptitude' });

    expect(bannedSocket.emitted.some((e: any) => e.event === 'match_error')).toBe(true);
    const members = await redisClient.smembers(queueKey);
    expect(members.length).toBe(0);
  });

  it('6. pairs two eligible players within Elo range and creates identical 5 Aptitude questions in identical order', async () => {
    const s1 = createMockSocket('qm_user_1', 'sock_1');
    const s2 = createMockSocket('qm_user_2', 'sock_2');

    await BattleEngine.joinMatchmaking(s1, { battleType: 'quantitative_aptitude' });
    await BattleEngine.joinMatchmaking(s2, { battleType: 'quantitative_aptitude' });

    // Queue should now be empty after match pairing
    const remaining = await redisClient.smembers(queueKey);
    expect(remaining.length).toBe(0);

    // Both players should have active battle locks pointing to the same battleId
    const b1 = await redisClient.get('battle:active:qm_user_1');
    const b2 = await redisClient.get('battle:active:qm_user_2');
    expect(b1).toBeTruthy();
    expect(b1).toBe(b2);

    const battle = await BattleEngine.getBattle(b1!);
    expect(battle).not.toBeNull();
    expect(battle!.battleType).toBe('quantitative_aptitude');
    expect(battle!.questions.length).toBe(5);
    expect(battle!.players['qm_user_1'].sanitizedQuestions!.length).toBe(5);
    expect(battle!.players['qm_user_2'].sanitizedQuestions!.length).toBe(5);

    // Identical question IDs in identical order for both players
    const p1Ids = battle!.players['qm_user_1'].sanitizedQuestions!.map(q => q.id);
    const p2Ids = battle!.players['qm_user_2'].sanitizedQuestions!.map(q => q.id);
    expect(p1Ids).toEqual(p2Ids);

    await BattleEngine.deleteBattle(b1!);
  });

  it('7. handles cancellation cleanly via leaveMatchmaking', async () => {
    const s1 = createMockSocket('qm_user_1', 'sock_cancel');
    await BattleEngine.joinMatchmaking(s1, { battleType: 'quantitative_aptitude' });
    expect((await redisClient.smembers(queueKey)).length).toBe(1);

    await BattleEngine.leaveMatchmaking(s1);
    expect((await redisClient.smembers(queueKey)).length).toBe(0);
  });

  it('8. cleanupExpiredMatchmakingAndRooms prunes expired queue tickets safely', async () => {
    const expiredTicket = JSON.stringify({
      userId: 'expired_user_test',
      socketId: 'sock_old',
      rating: 1000,
      joinedAt: Date.now() - 300_000
    });
    await redisClient.sadd(queueKey, expiredTicket);

    const res = await BattleEngine.cleanupExpiredMatchmakingAndRooms();
    expect(res.prunedQueueTickets).toBeGreaterThanOrEqual(1);
    const remaining = await redisClient.smembers(queueKey);
    expect(remaining).not.toContain(expiredTicket);
  });
});
