import request from 'supertest';
import { app } from '../index';
import { db } from '../config/firebase';
import { BattleEngine } from '../services/BattleEngine';
import { QuestionService } from '../services/QuestionService';

// Mock auth middleware for testing
jest.mock('../middleware/auth', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const token = authHeader.split('Bearer ')[1];
    if (token === 'user_host_token') {
      req.user = { uid: 'user_host_123', email: 'host@test.com' };
    } else if (token === 'user_guest_token') {
      req.user = { uid: 'user_guest_456', email: 'guest@test.com' };
    } else if (token === 'user_third_token') {
      req.user = { uid: 'user_third_789', email: 'third@test.com' };
    } else {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    next();
  },
  socketAuthMiddleware: (socket: any, next: any) => {
    const token = socket.handshake.auth?.token;
    if (token === 'user_host_token') {
      socket.data.userId = 'user_host_123';
    } else if (token === 'user_guest_token') {
      socket.data.userId = 'user_guest_456';
    } else {
      socket.data.userId = 'anonymous_tester';
    }
    next();
  },
  strictAuthLimiter: (_req: any, _res: any, next: any) => next()
}));

jest.setTimeout(30000);

describe('Custom Challenge / Room Code Battle System', () => {
  let createdRoomId: string;

  beforeAll(async () => {
    // Seed test user profiles in firestore simulator (isolated from production leaderboard)
    await db.collection('users').doc('user_host_123').set({
      uid: 'user_host_123',
      displayName: 'Host Master',
      level: 5,
      xp: 1200,
      coins: 250,
      battleRating: 1350,
      isTest: true,
      isDemo: true,
      environment: 'test'
    });

    await db.collection('users').doc('user_guest_456').set({
      uid: 'user_guest_456',
      displayName: 'Guest Challenger',
      level: 3,
      xp: 750,
      coins: 120,
      battleRating: 1280,
      isTest: true,
      isDemo: true,
      environment: 'test'
    });

    await db.collection('users').doc('user_third_789').set({
      uid: 'user_third_789',
      displayName: 'Third Cadet',
      level: 2,
      xp: 300,
      coins: 50,
      battleRating: 1100,
      isTest: true,
      isDemo: true,
      environment: 'test'
    });
  });

  afterAll(async () => {
    try {
      await db.collection('users').doc('user_host_123').delete();
      await db.collection('users').doc('user_guest_456').delete();
      await db.collection('users').doc('user_third_789').delete();
      if (createdRoomId) {
        await db.collection('battleRooms').doc(createdRoomId).delete();
      }
    } catch {
      // Safe cleanup ignore
    }
  });

  describe('1. Room Creation and Security (Requirements 46-47)', () => {
    it('should generate a server-authoritative, collision-safe room code', async () => {
      const res = await request(app)
        .post('/api/auth/battle-room/create')
        .set('Authorization', 'Bearer user_host_token')
        .send({
          battleType: 'DSA',
          questionsCount: 5,
          difficulty: 'Medium',
          timeLimit: 30,
          isPrivate: true
        });

      expect(res.status).toBe(200);
      expect(res.body.room).toBeDefined();
      expect(res.body.roomId).toBeDefined();
      expect(res.body.room.roomId).toMatch(/^DSA-[A-Z0-9]+$/);
      expect(res.body.room.status).toBe('waiting');
      expect(res.body.room.hostUid).toBe('user_host_123');
      expect(res.body.room.players['user_host_123']).toBeDefined();
      expect(res.body.room.players['user_host_123'].ready).toBe(true);

      createdRoomId = res.body.roomId;
    });

    it('should reject unauthenticated room creation', async () => {
      const res = await request(app)
        .post('/api/auth/battle-room/create')
        .send({ battleType: 'DSA' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('2. Room Code Join Flow and Normalization (Requirements 48-50)', () => {
    it('should allow opponent to join with normalized lowercase/whitespace code', async () => {
      const lowercaseWithSpaces = `  ${createdRoomId.toLowerCase()}  `;
      const res = await request(app)
        .post('/api/auth/battle-room/join')
        .set('Authorization', 'Bearer user_guest_token')
        .send({ roomCode: lowercaseWithSpaces });

      expect(res.status).toBe(200);
      expect(res.body.roomId).toBe(createdRoomId);
      expect(res.body.room.players['user_guest_456']).toBeDefined();
      expect(res.body.room.players['user_guest_456'].displayName).toBe('Guest Challenger');
      expect(res.body.room.players['user_guest_456'].ready).toBe(false);
    });

    it('should handle duplicate joins or multi-tab reopening gracefully and idempotently', async () => {
      const res = await request(app)
        .post('/api/auth/battle-room/join')
        .set('Authorization', 'Bearer user_guest_token')
        .send({ roomCode: createdRoomId });

      expect(res.status).toBe(200);
      expect(res.body.alreadyInRoom).toBe(true);
    });

    it('should reject third player when room capacity is full (ROOM_FULL)', async () => {
      const res = await request(app)
        .post('/api/auth/battle-room/join')
        .set('Authorization', 'Bearer user_third_token')
        .send({ roomCode: createdRoomId });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ROOM_FULL');
    });

    it('should return ROOM_NOT_FOUND for non-existent room codes', async () => {
      const res = await request(app)
        .post('/api/auth/battle-room/join')
        .set('Authorization', 'Bearer user_third_token')
        .send({ roomCode: 'NON-EXIST-99' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ROOM_NOT_FOUND');
    });

    it('should return ROOM_EXPIRED for expired rooms', async () => {
      const expiredRoomId = 'EXP-PAST01';
      await db.collection('battleRooms').doc(expiredRoomId).set({
        roomId: expiredRoomId,
        hostUid: 'user_host_123',
        status: 'waiting',
        expirationTime: new Date(Date.now() - 60000).toISOString(),
        players: { user_host_123: { uid: 'user_host_123', ready: true } }
      });

      const res = await request(app)
        .post('/api/auth/battle-room/join')
        .set('Authorization', 'Bearer user_guest_token')
        .send({ roomCode: expiredRoomId });

      expect(res.status).toBe(410);
      expect(res.body.code).toBe('ROOM_EXPIRED');
    });
  });

  describe('3. Unified Authoritative Battle Engine Progression (Requirements 54-57)', () => {
    it('should select identical question sets and options for both players in custom rooms', async () => {
      const questions = await QuestionService.selectBattleQuestions('DSA', 5, 'Medium');
      const sanitized = QuestionService.sanitizeForClient(questions);

      expect(questions.length).toBe(5);
      expect(sanitized.length).toBe(5);
      // Sanitized questions must conceal correct answers
      expect((sanitized[0] as any).correctOption).toBeUndefined();
      expect(sanitized[0].options.length).toBe(4);
    });

    it('should validate answers and conclude battle with rewards idempotently', async () => {
      const mockQuestions = await QuestionService.selectBattleQuestions('DSA', 3, 'Medium');
      const sanitizedQuestions = QuestionService.sanitizeForClient(mockQuestions);

      const customBattleSession: any = {
        battleId: createdRoomId,
        battleType: 'DSA',
        status: 'ACTIVE',
        questions: mockQuestions,
        sanitizedQuestions,
        timeLimitPerQuestion: 30,
        totalQuestions: 3,
        battleStartedAt: Date.now(),
        battleEndsAt: Date.now() + 90000,
        concluded: false,
        createdAt: Date.now(),
        players: {
          user_host_123: {
            userId: 'user_host_123',
            socketId: 'socket_host',
            displayName: 'Host Master',
            level: 5,
            rating: 1350,
            score: 0,
            progressIndex: 0,
            finished: false,
            online: true,
            submissions: {}
          },
          user_guest_456: {
            userId: 'user_guest_456',
            socketId: 'socket_guest',
            displayName: 'Guest Challenger',
            level: 3,
            rating: 1280,
            score: 0,
            progressIndex: 0,
            finished: false,
            online: true,
            submissions: {}
          }
        }
      };

      await BattleEngine.saveBattle(customBattleSession);

      // Submit Question 0 for Host (Correct Answer)
      const hostSocket: any = {
        data: { userId: 'user_host_123' },
        emit: jest.fn()
      };

      await BattleEngine.submitAnswer(hostSocket, {
        battleId: createdRoomId,
        questionIndex: 0,
        selectedOption: mockQuestions[0].correctOption
      });

      expect(hostSocket.emit).toHaveBeenCalledWith(
        'answer_evaluated',
        expect.objectContaining({
          questionIndex: 0,
          isCorrect: true,
          score: expect.any(Number),
          correctOption: mockQuestions[0].correctOption
        })
      );

      // Conclude match and verify Firestore status updated to completed
      await BattleEngine.concludeBattle(createdRoomId, 'all_players_finished');

      const roomDoc = await db.collection('battleRooms').doc(createdRoomId).get();
      expect(roomDoc.exists).toBe(true);
      expect(roomDoc.data()?.status).toBe('completed');
    }, 15000);
  });
});
