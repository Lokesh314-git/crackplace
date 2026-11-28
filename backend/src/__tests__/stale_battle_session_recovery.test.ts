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

describe('Stale Active Battle Session Detection, Recovery & Matchmaking Suite', () => {
  const queueKey = 'matchmaking:queue:quantitative_aptitude';
  const u1 = 'stale_test_u1';
  const u2 = 'stale_test_u2';

  beforeEach(async () => {
    await redisClient.del(queueKey);
    await redisClient.del(`battle:active:${u1}`);
    await redisClient.del(`battle:active:${u2}`);

    await db.collection('users').doc(u1).set({
      uid: u1,
      displayName: 'Test Cadet 1',
      battleRating: 1000,
      xp: 500,
      accountStatus: 'active',
      activeBattleId: null,
      battleStatus: 'idle'
    });
    await db.collection('users').doc(u2).set({
      uid: u2,
      displayName: 'Test Cadet 2',
      battleRating: 1020,
      xp: 500,
      accountStatus: 'active',
      activeBattleId: null,
      battleStatus: 'idle'
    });
  });

  afterAll(async () => {
    try {
      await redisClient.del(queueKey);
      await redisClient.del(`battle:active:${u1}`);
      await redisClient.del(`battle:active:${u2}`);
      await db.collection('users').doc(u1).delete();
      await db.collection('users').doc(u2).delete();
    } catch {}
  });

  it('1. cleans up stale Redis lock pointing to a non-existent battle and allows matchmaking', async () => {
    await redisClient.set(`battle:active:${u1}`, 'battle_ghost_999', 'EX', 3600);

    const session = await BattleEngine.getValidatedActiveSession(u1);
    expect(session.hasActiveBattle).toBe(false);
    expect(session.cleanedStaleSession).toBe(true);

    const s1 = createMockSocket(u1, 'sock_1');
    await BattleEngine.joinMatchmaking(s1, { battleType: 'quantitative_aptitude' });

    const errorEvt = s1.emitted.find((e: any) => e.event === 'match_error');
    const statusEvt = s1.emitted.find((e: any) => e.event === 'match_status');
    expect(errorEvt).toBeUndefined();
    expect(statusEvt).toBeDefined();
  });

  it('2. cleans up stale Firestore activeBattleId pointing to a deleted battleRooms doc', async () => {
    const deletedRoomId = 'battle_deleted_room_1';
    await db.collection('users').doc(u1).set({ activeBattleId: deletedRoomId, battleStatus: 'active' }, { merge: true });
    await redisClient.set(
      `battle:${deletedRoomId}`,
      JSON.stringify({
        battleId: deletedRoomId,
        battleType: 'quantitative_aptitude',
        status: 'ACTIVE',
        concluded: false,
        battleEndsAt: Date.now() + 60_000,
        players: { [u1]: { userId: u1, score: 0, progressIndex: 0 } }
      }),
      'EX',
      3600
    );
    // Ensure battleRooms doc does NOT exist (deleted)
    await db.collection('battleRooms').doc(deletedRoomId).delete().catch(() => {});

    const session = await BattleEngine.getValidatedActiveSession(u1);
    expect(session.hasActiveBattle).toBe(false);
    expect(session.cleanedStaleSession).toBe(true);

    const updatedUser = (await db.collection('users').doc(u1).get()).data();
    expect(updatedUser?.activeBattleId).toBeNull();
    expect(updatedUser?.battleStatus).toBe('idle');
  });

  it('3. detects and auto-concludes an expired active battle so user is not permanently locked', async () => {
    const expiredId = `battle_expired_${Date.now()}`;
    await redisClient.set(`battle:active:${u1}`, expiredId, 'EX', 3600);
    await BattleEngine.saveBattle({
      battleId: expiredId,
      battleType: 'quantitative_aptitude',
      status: 'ACTIVE',
      hostUid: u1,
      questions: [],
      sanitizedQuestions: [],
      timeLimitPerQuestion: 30,
      totalQuestions: 5,
      battleStartedAt: Date.now() - 200_000,
      battleEndsAt: Date.now() - 10_000, // already expired
      concluded: false,
      createdAt: Date.now() - 200_000,
      players: {
        [u1]: { userId: u1, socketId: 's1', displayName: 'P1', level: 1, rating: 1000, score: 20, progressIndex: 1, finished: false, online: true, submissions: {} },
        [u2]: { userId: u2, socketId: 's2', displayName: 'P2', level: 1, rating: 1000, score: 0, progressIndex: 0, finished: false, online: false, submissions: {} }
      }
    });

    const session = await BattleEngine.getValidatedActiveSession(u1);
    expect(session.hasActiveBattle).toBe(false);
    expect(session.cleanedStaleSession).toBe(true);
    expect(await redisClient.get(`battle:active:${u1}`)).toBeNull();
  });

  it('4. blocks second matchmaking when user is genuinely in an active battle, then allows after abandon', async () => {
    const liveId = `battle_live_${Date.now()}`;
    await redisClient.set(`battle:active:${u1}`, liveId, 'EX', 3600);
    await db.collection('battleRooms').doc(liveId).set({
      roomId: liveId,
      status: 'in-progress',
      expirationTime: new Date(Date.now() + 3600_000).toISOString()
    });
    await BattleEngine.saveBattle({
      battleId: liveId,
      battleType: 'quantitative_aptitude',
      status: 'ACTIVE',
      hostUid: u1,
      questions: [],
      sanitizedQuestions: [],
      timeLimitPerQuestion: 30,
      totalQuestions: 5,
      battleStartedAt: Date.now(),
      battleEndsAt: Date.now() + 150_000,
      concluded: false,
      createdAt: Date.now(),
      players: {
        [u1]: { userId: u1, socketId: 's1', displayName: 'P1', level: 1, rating: 1000, score: 0, progressIndex: 0, finished: false, online: true, submissions: {} },
        [u2]: { userId: u2, socketId: 's2', displayName: 'P2', level: 1, rating: 1000, score: 0, progressIndex: 0, finished: false, online: true, submissions: {} }
      }
    });

    // Valid active session should be returned for Resume Battle
    const active = await BattleEngine.getValidatedActiveSession(u1);
    expect(active.hasActiveBattle).toBe(true);
    expect(active.battleId).toBe(liveId);

    // Trying to enter matchmaking while genuinely in a battle must emit ACTIVE_BATTLE_EXISTS
    const s1 = createMockSocket(u1, 'sock_1');
    await BattleEngine.joinMatchmaking(s1, { battleType: 'quantitative_aptitude' });
    const errEvt = s1.emitted.find((e: any) => e.event === 'match_error');
    expect(errEvt).toBeDefined();
    expect(errEvt.payload.code).toBe('ACTIVE_BATTLE_EXISTS');
    expect(errEvt.payload.battleId).toBe(liveId);

    // Abandoning the battle releases locks immediately
    const abandonRes = await BattleEngine.handleAbandonBattle(u1, liveId);
    expect(abandonRes.abandoned).toBe(true);
    expect(await redisClient.get(`battle:active:${u1}`)).toBeNull();
    expect(await redisClient.get(`battle:active:${u2}`)).toBeNull();

    // Now user can re-enter matchmaking immediately
    const s1Retry = createMockSocket(u1, 'sock_1_retry');
    await BattleEngine.joinMatchmaking(s1Retry, { battleType: 'quantitative_aptitude' });
    expect(s1Retry.emitted.find((e: any) => e.event === 'match_status')).toBeDefined();
  });

  it('5. handles cancel search and simultaneous matchmaking requests idempotently without duplicate queue entries', async () => {
    const s1a = createMockSocket(u1, 'sock_1a');
    const s1b = createMockSocket(u1, 'sock_1b');

    await Promise.all([
      BattleEngine.joinMatchmaking(s1a, { battleType: 'quantitative_aptitude' }),
      BattleEngine.joinMatchmaking(s1b, { battleType: 'quantitative_aptitude' })
    ]);

    const members = await redisClient.smembers(queueKey);
    const u1Entries = members.filter((m: string) => JSON.parse(m).userId === u1);
    expect(u1Entries.length).toBe(1);

    await BattleEngine.leaveMatchmaking(s1b);
    const afterLeave = await redisClient.smembers(queueKey);
    expect(afterLeave.filter((m: string) => JSON.parse(m).userId === u1).length).toBe(0);

    // Immediately search again
    const s1c = createMockSocket(u1, 'sock_1c');
    await BattleEngine.joinMatchmaking(s1c, { battleType: 'quantitative_aptitude' });
    expect(s1c.emitted.find((e: any) => e.event === 'match_status')).toBeDefined();
  });
});
