import { BattleEngine, BattleSession } from '../services/BattleEngine';
import { QuestionService } from '../services/QuestionService';
import { io } from '../index';

describe('Battle Arena Complete Authoritative Flow Suite', () => {
  beforeAll(() => {
    BattleEngine.initialize(io);
  });

  const createMockBattleSession = (battleId: string, questionsCount: number = 5): BattleSession => {
    const questions = QuestionService.getCuratedFallbackQuestions('DSA').slice(0, questionsCount);
    const sanitized = QuestionService.sanitizeForClient(questions);

    return {
      battleId,
      battleType: 'DSA',
      status: 'ACTIVE',
      questions,
      sanitizedQuestions: sanitized,
      timeLimitPerQuestion: 30,
      totalQuestions: questionsCount,
      battleStartedAt: Date.now(),
      battleEndsAt: Date.now() + questionsCount * 30 * 1000,
      concluded: false,
      createdAt: Date.now(),
      players: {
        'player_a': {
          userId: 'player_a',
          socketId: 'sock_a',
          displayName: 'Player A',
          level: 2,
          rating: 1200,
          score: 0,
          progressIndex: 0,
          finished: false,
          online: true,
          submissions: {}
        },
        'player_b': {
          userId: 'player_b',
          socketId: 'sock_b',
          displayName: 'Player B',
          level: 2,
          rating: 1200,
          score: 0,
          progressIndex: 0,
          finished: false,
          online: true,
          submissions: {}
        }
      }
    };
  };

  it('1. should validate correct answer and award score without UI mismatch', async () => {
    const battleId = `battle_correct_test_${Date.now()}`;
    const session = createMockBattleSession(battleId, 5);
    await BattleEngine.saveBattle(session);

    const emittedEvents: any[] = [];
    const mockSocket: any = {
      id: 'sock_a',
      data: { userId: 'player_a', battleId },
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      }
    };

    const firstQuestion = session.questions[0];
    const correctIdx = firstQuestion.correctOption; // Authoritative correct option (0-indexed)

    // Submit correct option
    await BattleEngine.submitAnswer(mockSocket, {
      battleId,
      questionIndex: 0,
      selectedOption: correctIdx
    });

    const evaluatedEvent = emittedEvents.find(e => e.event === 'answer_evaluated');
    expect(evaluatedEvent).toBeDefined();
    expect(evaluatedEvent.payload.isCorrect).toBe(true);
    expect(evaluatedEvent.payload.correctOption).toBe(correctIdx);
    expect(evaluatedEvent.payload.pointsAwarded).toBeGreaterThan(0);
    expect(evaluatedEvent.payload.nextQuestionIndex).toBe(1);

    const updated = await BattleEngine.getBattle(battleId);
    expect(updated?.players['player_a'].score).toBeGreaterThan(0);
    expect(updated?.players['player_a'].progressIndex).toBe(1);
    expect(updated?.players['player_a'].submissions[0].isCorrect).toBe(true);

    await BattleEngine.deleteBattle(battleId);
  });

  it('2. should validate incorrect answer, award 0 points, and still advance progress', async () => {
    const battleId = `battle_wrong_test_${Date.now()}`;
    const session = createMockBattleSession(battleId, 5);
    await BattleEngine.saveBattle(session);

    const emittedEvents: any[] = [];
    const mockSocket: any = {
      id: 'sock_a',
      data: { userId: 'player_a', battleId },
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      }
    };

    const firstQuestion = session.questions[0];
    const wrongIdx = (firstQuestion.correctOption + 1) % 4; // Deliberately wrong option

    // Submit incorrect option
    await BattleEngine.submitAnswer(mockSocket, {
      battleId,
      questionIndex: 0,
      selectedOption: wrongIdx
    });

    const evaluatedEvent = emittedEvents.find(e => e.event === 'answer_evaluated');
    expect(evaluatedEvent).toBeDefined();
    expect(evaluatedEvent.payload.isCorrect).toBe(false);
    expect(evaluatedEvent.payload.correctOption).toBe(firstQuestion.correctOption);
    expect(evaluatedEvent.payload.pointsAwarded).toBe(0);
    expect(evaluatedEvent.payload.nextQuestionIndex).toBe(1);

    const updated = await BattleEngine.getBattle(battleId);
    expect(updated?.players['player_a'].score).toBe(0);
    expect(updated?.players['player_a'].progressIndex).toBe(1);
    expect(updated?.players['player_a'].submissions[0].isCorrect).toBe(false);

    await BattleEngine.deleteBattle(battleId);
  });

  it('3. should advance questions sequentially 0 -> 1 -> 2 -> 3 -> 4 without getting stuck', async () => {
    const battleId = `battle_progression_test_${Date.now()}`;
    const session = createMockBattleSession(battleId, 5);
    await BattleEngine.saveBattle(session);

    const emittedEvents: any[] = [];
    const mockSocket: any = {
      id: 'sock_a',
      data: { userId: 'player_a', battleId },
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      }
    };

    // Answer questions 0 to 4 in succession
    for (let qIdx = 0; qIdx < 5; qIdx++) {
      const q = session.questions[qIdx];
      await BattleEngine.submitAnswer(mockSocket, {
        battleId,
        questionIndex: qIdx,
        selectedOption: q.correctOption
      });

      const updated = await BattleEngine.getBattle(battleId);
      expect(updated?.players['player_a'].progressIndex).toBe(qIdx + 1);
    }

    const finalSession = await BattleEngine.getBattle(battleId);
    expect(finalSession?.players['player_a'].progressIndex).toBe(5);
    expect(finalSession?.players['player_a'].finished).toBe(true);

    await BattleEngine.deleteBattle(battleId);
  });

  it('4. should be idempotent against duplicate answer submissions', async () => {
    const battleId = `battle_dup_test_${Date.now()}`;
    const session = createMockBattleSession(battleId, 5);
    await BattleEngine.saveBattle(session);

    const emittedEvents: any[] = [];
    const mockSocket: any = {
      id: 'sock_a',
      data: { userId: 'player_a', battleId },
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      }
    };

    const firstQuestion = session.questions[0];

    // First submission
    await BattleEngine.submitAnswer(mockSocket, {
      battleId,
      questionIndex: 0,
      selectedOption: firstQuestion.correctOption
    });

    const battleAfterFirst = await BattleEngine.getBattle(battleId);
    const scoreAfterFirst = battleAfterFirst?.players['player_a'].score;
    const progressAfterFirst = battleAfterFirst?.players['player_a'].progressIndex;

    // Duplicate submission
    await BattleEngine.submitAnswer(mockSocket, {
      battleId,
      questionIndex: 0,
      selectedOption: firstQuestion.correctOption
    });

    const battleAfterSecond = await BattleEngine.getBattle(battleId);
    expect(battleAfterSecond?.players['player_a'].score).toBe(scoreAfterFirst);
    expect(battleAfterSecond?.players['player_a'].progressIndex).toBe(progressAfterFirst);

    await BattleEngine.deleteBattle(battleId);
  });

  it('5. should restore complete battle state upon reconnection', async () => {
    const battleId = `battle_reconnect_test_${Date.now()}`;
    const session = createMockBattleSession(battleId, 5);
    // Simulate player A already on Question 3 with score 60
    session.players['player_a'].progressIndex = 3;
    session.players['player_a'].score = 60;
    session.players['player_a'].online = false;
    await BattleEngine.saveBattle(session);

    const emittedEvents: any[] = [];
    const mockSocket: any = {
      id: 'new_sock_a',
      data: { userId: 'player_a' },
      join: (_room: string) => {},
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
      to: (_room: string) => ({
        emit: (_ev: string, _pl: any) => {}
      })
    };

    const restored = await BattleEngine.handlePlayerReconnect(mockSocket, battleId);
    expect(restored).toBe(true);

    const restoreEvent = emittedEvents.find(e => e.event === 'battle_restored');
    expect(restoreEvent).toBeDefined();
    expect(restoreEvent.payload.battleId).toBe(battleId);
    expect(restoreEvent.payload.currentQuestionIndex).toBe(3);
    expect(restoreEvent.payload.playerScore).toBe(60);
    expect(restoreEvent.payload.quiz.length).toBe(5);

    await BattleEngine.deleteBattle(battleId);
  });

  it('6. should allow independent pacing for both players without state collision', async () => {
    const battleId = `battle_pacing_test_${Date.now()}`;
    const session = createMockBattleSession(battleId, 5);
    await BattleEngine.saveBattle(session);

    const socketA: any = {
      id: 'sock_a',
      data: { userId: 'player_a', battleId },
      emit: () => {}
    };

    const socketB: any = {
      id: 'sock_b',
      data: { userId: 'player_b', battleId },
      emit: () => {}
    };

    // Player A answers question 0, 1, 2 quickly
    for (let i = 0; i < 3; i++) {
      await BattleEngine.submitAnswer(socketA, {
        battleId,
        questionIndex: i,
        selectedOption: session.questions[i].correctOption
      });
    }

    // Player B answers only question 0 slowly
    await BattleEngine.submitAnswer(socketB, {
      battleId,
      questionIndex: 0,
      selectedOption: session.questions[0].correctOption
    });

    const midBattle = await BattleEngine.getBattle(battleId);
    expect(midBattle?.players['player_a'].progressIndex).toBe(3);
    expect(midBattle?.players['player_b'].progressIndex).toBe(1);

    // Player B now catches up with questions 1, 2, 3, 4
    for (let i = 1; i < 5; i++) {
      await BattleEngine.submitAnswer(socketB, {
        battleId,
        questionIndex: i,
        selectedOption: session.questions[i].correctOption
      });
    }

    // Player A answers questions 3, 4
    for (let i = 3; i < 5; i++) {
      await BattleEngine.submitAnswer(socketA, {
        battleId,
        questionIndex: i,
        selectedOption: session.questions[i].correctOption
      });
    }

    const completedBattle = await BattleEngine.getBattle(battleId);
    expect(completedBattle?.players['player_a'].finished).toBe(true);
    expect(completedBattle?.players['player_b'].finished).toBe(true);

    await BattleEngine.deleteBattle(battleId);
  }, 15000);
});
