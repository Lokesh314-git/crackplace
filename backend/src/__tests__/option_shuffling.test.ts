import { BattleEngine, BattleSession } from '../services/BattleEngine';
import { QuestionService } from '../services/QuestionService';
import { Question } from '../types/question';
import { io } from '../index';

describe('Option Shuffling & Mapping System Suite', () => {
  beforeAll(() => {
    BattleEngine.initialize(io);
  });

  const createSampleQuestion = (correctLetter: 'A' | 'B' | 'C' | 'D'): Question => {
    const letterToIdx = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
    const correctOption = letterToIdx[correctLetter];

    return {
      id: `QA_${correctLetter}_001`,
      source: 'curated',
      category: 'dsa',
      topic: 'Algorithms',
      difficulty: 'medium',
      question: `Sample question where original answer is ${correctLetter}?`,
      options: ['Option A Text', 'Option B Text', 'Option C Text', 'Option D Text'],
      correctOption,
      explanation: `Explanation for ${correctLetter}`,
      active: true,
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  test('1. Preserves correct answer verification when original answer is A', () => {
    const q = createSampleQuestion('A');
    const pkg = QuestionService.generatePlayerQuestionPackage([q]);

    expect(pkg.sanitizedQuestions[0].options.length).toBe(4);
    const mapping = pkg.optionMappings[0]; // mapping[displayedIndex] = originalIndex
    expect(mapping.length).toBe(4);

    // Find which displayed option corresponds to original correctOption (0)
    const displayedCorrectIdx = mapping.indexOf(0);
    expect(displayedCorrectIdx).toBeGreaterThanOrEqual(0);
    expect(displayedCorrectIdx).toBeLessThanOrEqual(3);

    // Verify text of displayed correct option matches original option 0
    expect(pkg.sanitizedQuestions[0].options[displayedCorrectIdx]).toBe('Option A Text');
  });

  test('2. Preserves correct answer verification when original answer is B', () => {
    const q = createSampleQuestion('B');
    const pkg = QuestionService.generatePlayerQuestionPackage([q]);

    const mapping = pkg.optionMappings[0];
    const displayedCorrectIdx = mapping.indexOf(1);

    expect(displayedCorrectIdx).toBeGreaterThanOrEqual(0);
    expect(pkg.sanitizedQuestions[0].options[displayedCorrectIdx]).toBe('Option B Text');
  });

  test('3. Preserves correct answer verification when original answer is C', () => {
    const q = createSampleQuestion('C');
    const pkg = QuestionService.generatePlayerQuestionPackage([q]);

    const mapping = pkg.optionMappings[0];
    const displayedCorrectIdx = mapping.indexOf(2);

    expect(displayedCorrectIdx).toBeGreaterThanOrEqual(0);
    expect(pkg.sanitizedQuestions[0].options[displayedCorrectIdx]).toBe('Option C Text');
  });

  test('4. Preserves correct answer verification when original answer is D', () => {
    const q = createSampleQuestion('D');
    const pkg = QuestionService.generatePlayerQuestionPackage([q]);

    const mapping = pkg.optionMappings[0];
    const displayedCorrectIdx = mapping.indexOf(3);

    expect(displayedCorrectIdx).toBeGreaterThanOrEqual(0);
    expect(pkg.sanitizedQuestions[0].options[displayedCorrectIdx]).toBe('Option D Text');
  });

  test('5. Generates independent option permutations for multiple players on the same question', () => {
    const questions = [
      createSampleQuestion('A'),
      createSampleQuestion('B'),
      createSampleQuestion('C'),
      createSampleQuestion('D'),
      createSampleQuestion('A')
    ];

    const p1Package = QuestionService.generatePlayerQuestionPackage(questions);
    const p2Package = QuestionService.generatePlayerQuestionPackage(questions);
    const p3Package = QuestionService.generatePlayerQuestionPackage(questions);

    // All packages must have the same questions
    expect(p1Package.sanitizedQuestions.length).toBe(5);
    expect(p2Package.sanitizedQuestions.length).toBe(5);
    expect(p3Package.sanitizedQuestions.length).toBe(5);

    for (let i = 0; i < 5; i++) {
      expect(p1Package.sanitizedQuestions[i].id).toBe(questions[i].id);
      expect(p2Package.sanitizedQuestions[i].id).toBe(questions[i].id);
      expect(p3Package.sanitizedQuestions[i].id).toBe(questions[i].id);

      // Verify each player's displayed options are valid permutations of the original options
      const origSorted = [...questions[i].options].sort();
      expect([...p1Package.sanitizedQuestions[i].options].sort()).toEqual(origSorted);
      expect([...p2Package.sanitizedQuestions[i].options].sort()).toEqual(origSorted);
      expect([...p3Package.sanitizedQuestions[i].options].sort()).toEqual(origSorted);
    }
  });

  test('6. Battle submitAnswer validates player selection against their specific option mapping', async () => {
    const battleId = `battle_shuffle_test_${Date.now()}`;
    const question = createSampleQuestion('C'); // correct option is 2 ('Option C Text')
    const questions = [question, createSampleQuestion('A')]; // 2 questions so answering Q0 doesn't prematurely trigger async conclusion

    const p1Package = QuestionService.generatePlayerQuestionPackage(questions);
    const p2Package = QuestionService.generatePlayerQuestionPackage(questions);

    const session: BattleSession = {
      battleId,
      battleType: 'dsa',
      status: 'ACTIVE',
      questions,
      sanitizedQuestions: QuestionService.sanitizeForClient(questions),
      timeLimitPerQuestion: 30,
      totalQuestions: 2,
      battleStartedAt: Date.now(),
      battleEndsAt: Date.now() + 60000,
      concluded: false,
      createdAt: Date.now(),
      players: {
        'player_1': {
          userId: 'player_1',
          socketId: 'sock_1',
          displayName: 'Player 1',
          level: 1,
          rating: 1200,
          score: 0,
          progressIndex: 0,
          finished: false,
          online: true,
          submissions: {},
          optionMappings: p1Package.optionMappings,
          sanitizedQuestions: p1Package.sanitizedQuestions
        },
        'player_2': {
          userId: 'player_2',
          socketId: 'sock_2',
          displayName: 'Player 2',
          level: 1,
          rating: 1200,
          score: 0,
          progressIndex: 0,
          finished: false,
          online: true,
          submissions: {},
          optionMappings: p2Package.optionMappings,
          sanitizedQuestions: p2Package.sanitizedQuestions
        }
      }
    };

    await BattleEngine.saveBattle(session);

    // Player 1 picks their displayed CORRECT option (which maps to original index 2)
    const p1Mapping = p1Package.optionMappings[0];
    const p1DisplayedCorrect = p1Mapping.indexOf(2);

    const p1Events: any[] = [];
    const p1Socket: any = {
      id: 'sock_1',
      data: { userId: 'player_1', battleId },
      emit: (event: string, payload: any) => p1Events.push({ event, payload })
    };

    await BattleEngine.submitAnswer(p1Socket, {
      battleId,
      questionIndex: 0,
      selectedOption: p1DisplayedCorrect
    });

    const p1Eval = p1Events.find(e => e.event === 'answer_evaluated');
    expect(p1Eval).toBeDefined();
    expect(p1Eval.payload.isCorrect).toBe(true);
    expect(p1Eval.payload.correctOption).toBe(p1DisplayedCorrect);
    expect(p1Eval.payload.pointsAwarded).toBeGreaterThan(0);

    // Player 2 picks a displayed WRONG option
    const p2Mapping = p2Package.optionMappings[0];
    const p2DisplayedCorrect = p2Mapping.indexOf(2);
    const p2DisplayedWrong = (p2DisplayedCorrect + 1) % 4;

    const p2Events: any[] = [];
    const p2Socket: any = {
      id: 'sock_2',
      data: { userId: 'player_2', battleId },
      emit: (event: string, payload: any) => p2Events.push({ event, payload })
    };

    await BattleEngine.submitAnswer(p2Socket, {
      battleId,
      questionIndex: 0,
      selectedOption: p2DisplayedWrong
    });

    const p2Eval = p2Events.find(e => e.event === 'answer_evaluated');
    expect(p2Eval).toBeDefined();
    expect(p2Eval.payload.isCorrect).toBe(false);
    expect(p2Eval.payload.correctOption).toBe(p2DisplayedCorrect); // Feedback shows correct displayed position
    expect(p2Eval.payload.pointsAwarded).toBe(0);

    await BattleEngine.deleteBattle(battleId);
  });

  test('7. Reconnection restores player-specific question package without reshuffling', async () => {
    const battleId = `battle_reconnect_shuffle_${Date.now()}`;
    const question = createSampleQuestion('B');
    const questions = [question];

    const p1Package = QuestionService.generatePlayerQuestionPackage(questions);

    const session: BattleSession = {
      battleId,
      battleType: 'dsa',
      status: 'ACTIVE',
      questions,
      sanitizedQuestions: QuestionService.sanitizeForClient(questions),
      timeLimitPerQuestion: 30,
      totalQuestions: 1,
      battleStartedAt: Date.now(),
      battleEndsAt: Date.now() + 30000,
      concluded: false,
      createdAt: Date.now(),
      players: {
        'player_reconnect': {
          userId: 'player_reconnect',
          socketId: 'sock_old',
          displayName: 'Reconnect Player',
          level: 1,
          rating: 1200,
          score: 0,
          progressIndex: 0,
          finished: false,
          online: false,
          submissions: {},
          optionMappings: p1Package.optionMappings,
          sanitizedQuestions: p1Package.sanitizedQuestions
        }
      }
    };

    await BattleEngine.saveBattle(session);

    const restoredEvents: any[] = [];
    const reconnectSocket: any = {
      id: 'sock_new',
      data: { userId: 'player_reconnect' },
      join: jest.fn(),
      emit: (event: string, payload: any) => restoredEvents.push({ event, payload }),
      to: () => ({ emit: jest.fn() })
    };

    const reconnected = await BattleEngine.handlePlayerReconnect(reconnectSocket, battleId);
    expect(reconnected).toBe(true);

    const restorePayload = restoredEvents.find(e => e.event === 'battle_restored')?.payload;
    expect(restorePayload).toBeDefined();
    // Restored quiz matches player's sanitizedQuestions exactly
    expect(restorePayload.quiz).toEqual(p1Package.sanitizedQuestions);

    await BattleEngine.deleteBattle(battleId);
  });

  test('8. Single attempt quiz options shuffling maintains correctOptionIndex consistency', () => {
    for (let i = 0; i < 20; i++) {
      const q = createSampleQuestion(i % 4 === 0 ? 'A' : i % 4 === 1 ? 'B' : i % 4 === 2 ? 'C' : 'D');
      const originalCorrectText = q.options[q.correctOption];

      const shuffled = QuestionService.shuffleQuestionOptions(q);
      expect(shuffled.options[shuffled.correctOption]).toBe(originalCorrectText);
      expect(shuffled.options.length).toBe(q.options.length);
    }
  });
});
