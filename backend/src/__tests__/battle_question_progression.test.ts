import { BattleEngine } from '../services/BattleEngine';
import { redisClient } from '../config/redis';
import { db } from '../config/firebase';

const createBattleSocket = (userId: string, socketId: string) => {
  const emitted: Array<{ event: string; payload: any }> = [];
  const roomEmitted: Array<{ room: string; event: string; payload: any }> = [];
  return {
    id: socketId,
    data: { userId },
    emit: (event: string, payload: any) => {
      emitted.push({ event, payload });
    },
    to: (room: string) => ({
      emit: (event: string, payload: any) => {
        roomEmitted.push({ room, event, payload });
      }
    }),
    emitted,
    roomEmitted
  } as any;
};

describe('Battle Question Progression & Simultaneous Submission Suite', () => {
  const p1 = 'prog_u1';
  const p2 = 'prog_u2';
  let battleId = '';

  const makeQuestions = () =>
    Array.from({ length: 5 }, (_, i) => ({
      id: `q_prog_${i}`,
      question: `Question ${i + 1}?`,
      options: ['A', 'B', 'C', 'D'],
      correctOption: 0,
      category: 'quantitative_aptitude',
      difficulty: 'Medium',
      explanation: 'A is correct'
    }));

  beforeEach(async () => {
    battleId = `battle_prog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await db.collection('users').doc(p1).set({ uid: p1, displayName: 'Prog P1', battleRating: 1000, xp: 500, coins: 100 });
    await db.collection('users').doc(p2).set({ uid: p2, displayName: 'Prog P2', battleRating: 1000, xp: 500, coins: 100 });

    const qs = makeQuestions();
    await BattleEngine.saveBattle({
      battleId,
      battleType: 'quantitative_aptitude',
      status: 'ACTIVE',
      hostUid: p1,
      questions: qs as any,
      sanitizedQuestions: qs as any,
      timeLimitPerQuestion: 30,
      totalQuestions: 5,
      battleStartedAt: Date.now(),
      battleEndsAt: Date.now() + 150_000,
      concluded: false,
      createdAt: Date.now(),
      players: {
        [p1]: { userId: p1, socketId: 's1', displayName: 'Prog P1', level: 1, rating: 1000, score: 0, progressIndex: 0, finished: false, online: true, submissions: {} },
        [p2]: { userId: p2, socketId: 's2', displayName: 'Prog P2', level: 1, rating: 1000, score: 0, progressIndex: 0, finished: false, online: true, submissions: {} }
      }
    });
  });

  afterAll(async () => {
    try {
      await db.collection('users').doc(p1).delete();
      await db.collection('users').doc(p2).delete();
    } catch {}
  });

  it('1. serializes simultaneous Question 1 submissions so neither player overwrites the other', async () => {
    const s1 = createBattleSocket(p1, 's1');
    const s2 = createBattleSocket(p2, 's2');

    await Promise.all([
      BattleEngine.submitAnswer(s1, { battleId, questionIndex: 0, selectedOption: 0, responseTimeMs: 2000 }),
      BattleEngine.submitAnswer(s2, { battleId, questionIndex: 0, selectedOption: 1, responseTimeMs: 2500 })
    ]);

    const live = await BattleEngine.getBattle(battleId);
    expect(live?.players[p1].progressIndex).toBe(1);
    expect(live?.players[p2].progressIndex).toBe(1);
    expect(live?.players[p1].submissions[0]).toBeDefined();
    expect(live?.players[p2].submissions[0]).toBeDefined();

    const eval1 = s1.emitted.find((e: any) => e.event === 'answer_evaluated');
    const eval2 = s2.emitted.find((e: any) => e.event === 'answer_evaluated');
    expect(eval1.payload.nextQuestionIndex).toBe(1);
    expect(eval2.payload.nextQuestionIndex).toBe(1);

    // step_update is dispatched via socket.to(battleId) (only to opponent, not sender)
    expect(s1.roomEmitted.find((e: any) => e.event === 'step_update')?.payload.uid).toBe(p1);
    expect(s2.roomEmitted.find((e: any) => e.event === 'step_update')?.payload.uid).toBe(p2);
  });

  it('2. rejects duplicate clicks on Question 1 idempotently without double-scoring or advancing twice', async () => {
    const s1 = createBattleSocket(p1, 's1');

    await BattleEngine.submitAnswer(s1, { battleId, questionIndex: 0, selectedOption: 0 });
    const scoreAfterFirst = (await BattleEngine.getBattle(battleId))?.players[p1].score;

    await BattleEngine.submitAnswer(s1, { battleId, questionIndex: 0, selectedOption: 0 });
    const live = await BattleEngine.getBattle(battleId);
    expect(live?.players[p1].score).toBe(scoreAfterFirst);
    expect(live?.players[p1].progressIndex).toBe(1);
  });

  it('3. handles timeout (-1) and progresses through all 5 questions to battle conclusion', async () => {
    const s1 = createBattleSocket(p1, 's1');
    const s2 = createBattleSocket(p2, 's2');

    // Q1 timeout for p1, correct for p2
    await BattleEngine.submitAnswer(s1, { battleId, questionIndex: 0, selectedOption: -1 });
    await BattleEngine.submitAnswer(s2, { battleId, questionIndex: 0, selectedOption: 0 });

    // Q2..Q5 for both players
    for (let q = 1; q < 5; q++) {
      await Promise.all([
        BattleEngine.submitAnswer(s1, { battleId, questionIndex: q, selectedOption: 0 }),
        BattleEngine.submitAnswer(s2, { battleId, questionIndex: q, selectedOption: 0 })
      ]);
    }

    const finalBattle = await BattleEngine.getBattle(battleId);
    expect(finalBattle?.concluded).toBe(true);
    expect(finalBattle?.status).toBe('COMPLETED');
    expect(finalBattle?.players[p1].progressIndex).toBe(5);
    expect(finalBattle?.players[p2].progressIndex).toBe(5);
    expect(await redisClient.get(`battle:active:${p1}`)).toBeNull();
    expect(await redisClient.get(`battle:active:${p2}`)).toBeNull();
  });
});
