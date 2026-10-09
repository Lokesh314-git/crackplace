import { BattleEngine, BattleSession } from '../services/BattleEngine';
import { QuestionService } from '../services/QuestionService';
import { io } from '../index';

describe('Server-Authoritative Battle Engine Suite', () => {
  beforeAll(() => {
    BattleEngine.initialize(io);
  });

  it('should select fast curated questions for live battles without network delay', async () => {
    const questions = await QuestionService.selectBattleQuestions('DSA', 5);
    expect(questions.length).toBe(5);
    expect(questions[0]).toHaveProperty('question');
    expect(questions[0]).toHaveProperty('correctOption');
  });

  it('should transition battle sessions through valid FSM states and save in Redis', async () => {
    const questions = await QuestionService.selectBattleQuestions('DSA', 5);
    const sanitized = QuestionService.sanitizeForClient(questions);
    const battleId = `test_battle_${Date.now()}`;

    const battle: BattleSession = {
      battleId,
      battleType: 'DSA',
      status: 'ACTIVE',
      questions,
      sanitizedQuestions: sanitized,
      timeLimitPerQuestion: 30,
      totalQuestions: 5,
      concluded: false,
      createdAt: Date.now(),
      players: {
        'player_1': {
          userId: 'player_1',
          socketId: 'sock_1',
          displayName: 'Tester 1',
          level: 1,
          rating: 1200,
          score: 0,
          progressIndex: 0,
          finished: false,
          online: true,
          submissions: {}
        },
        'player_2': {
          userId: 'player_2',
          socketId: 'sock_2',
          displayName: 'Tester 2',
          level: 1,
          rating: 1200,
          score: 0,
          progressIndex: 0,
          finished: false,
          online: true,
          submissions: {}
        }
      }
    };

    await BattleEngine.saveBattle(battle);
    const retrieved = await BattleEngine.getBattle(battleId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.status).toBe('ACTIVE');
    expect(retrieved?.players['player_1'].score).toBe(0);

    await BattleEngine.deleteBattle(battleId);
    const deleted = await BattleEngine.getBattle(battleId);
    expect(deleted).toBeNull();
  });
});
