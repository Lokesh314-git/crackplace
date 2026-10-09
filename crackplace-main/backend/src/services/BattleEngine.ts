import { Server, Socket } from 'socket.io';
import { redisClient } from '../config/redis';
import { db } from '../config/firebase';
import { QuestionService } from './QuestionService';
import { Question, SanitizedQuestion } from '../types/question';
import { syncMissionsState, processMissionProgress, checkAndUnlockAchievements } from '../utils/gamification';
import {
  GAME_CONFIG,
  ScoreCalculator,
  BattleResultProcessor,
  BattleParticipantInput,
  BattleResultPackage,
  PlayerRewardResult
} from '../game';
import { resolveUserAvatar } from '../utils/avatarResolver';
import logger from '../utils/logger';

export type BattleStatus = 
  | 'WAITING' 
  | 'MATCHED' 
  | 'PREPARING' 
  | 'READY' 
  | 'ACTIVE' 
  | 'FINISHING' 
  | 'COMPLETED' 
  | 'ABORTED';

export interface PlayerBattleState {
  userId: string;
  socketId: string;
  displayName: string;
  photoURL?: string;
  level: number;
  rating: number;
  score: number;
  progressIndex: number;
  finished: boolean;
  online: boolean;
  disconnectedAt?: number;
  submissions: { [qIndex: number]: { selectedOption: number; isCorrect: boolean; points: number; timeMs: number } };
  optionMappings?: { [qIndex: number]: number[] };
  sanitizedQuestions?: SanitizedQuestion[];
  equippedRing?: string | null;
  equippedFrame?: string | null;
  equippedBackground?: string | null;
  equippedTitle?: string | null;
}

export interface BattleSession {
  battleId: string;
  battleType: string;
  status: BattleStatus;
  hostUid?: string;
  isPrivate?: boolean;
  questions: Question[];
  sanitizedQuestions: SanitizedQuestion[];
  timeLimitPerQuestion: number;
  totalQuestions: number;
  battleStartedAt?: number;
  battleEndsAt?: number;
  players: { [userId: string]: PlayerBattleState };
  concluded: boolean;
  winnerId?: string;
  resultPackage?: BattleResultPackage;
  createdAt: number;
  disconnectGraceExpiresAt?: { [userId: string]: number };
}

export class BattleEngine {
  private static io: Server;
  private static battleTimerIntervals = new Map<string, NodeJS.Timeout>();
  private static concludingBattles = new Set<string>();

  public static initialize(ioInstance: Server) {
    this.io = ioInstance;
  }

  /**
   * Redis key helpers
   */
  private static getBattleKey(battleId: string): string {
    return `battle:state:${battleId}`;
  }

  private static getMatchmakingQueueKey(category: string): string {
    return `matchmaking:queue:${category.toLowerCase()}`;
  }

  /**
   * Fetch active battle state from Redis
   */
  public static async getBattle(battleId: string): Promise<BattleSession | null> {
    try {
      const data = await redisClient.get(this.getBattleKey(battleId));
      return data ? (JSON.parse(data) as BattleSession) : null;
    } catch (err) {
      logger.error('Failed to get battle from Redis', { battleId, error: String(err) });
      return null;
    }
  }

  /**
   * Save battle state to Redis with 1-hour TTL
   */
  public static async saveBattle(battle: BattleSession): Promise<void> {
    try {
      await redisClient.set(this.getBattleKey(battle.battleId), JSON.stringify(battle), 'EX', 3600);
    } catch (err) {
      logger.error('Failed to save battle in Redis', { battleId: battle.battleId, error: String(err) });
    }
  }

  /**
   * Delete ephemeral battle state
   */
  public static async deleteBattle(battleId: string): Promise<void> {
    try {
      await redisClient.del(this.getBattleKey(battleId));
      if (this.battleTimerIntervals.has(battleId)) {
        clearInterval(this.battleTimerIntervals.get(battleId)!);
        this.battleTimerIntervals.delete(battleId);
      }
    } catch (err) {
      logger.error('Failed to delete battle from Redis', { battleId, error: String(err) });
    }
  }

  /**
   * Matchmaking Join Queue (Distributed Redis Queue)
   */
  public static async joinMatchmaking(socket: Socket, payload: { battleType: string; rating: number; profile: any }) {
    const userId = socket.data.userId;
    if (!userId) {
      socket.emit('match_error', { message: 'Unauthorized socket connection.' });
      return;
    }

    const category = payload.battleType || 'DSA';
    const queueKey = this.getMatchmakingQueueKey(category);

    const playerTicket = {
      userId,
      socketId: socket.id,
      rating: payload.rating || 1200,
      profile: payload.profile || {},
      joinedAt: Date.now()
    };

    logger.info('User joined matchmaking queue', { userId, category, rating: payload.rating });

    try {
      // Find candidate opponent in queue
      const rawQueue = await redisClient.smembers(queueKey);
      let opponentTicket: any = null;

      for (const raw of rawQueue) {
        const candidate = JSON.parse(raw);
        if (candidate.userId !== userId) {
          opponentTicket = candidate;
          break;
        }
      }

      if (opponentTicket) {
        // Atomic Match Found: Remove opponent from queue
        await redisClient.srem(queueKey, JSON.stringify(opponentTicket));
        logger.info('Match successfully paired', { player1: userId, player2: opponentTicket.userId, category });
        
        await this.createMatch(playerTicket, opponentTicket, category);
      } else {
        // Enqueue current player
        await redisClient.sadd(queueKey, JSON.stringify(playerTicket));
        socket.emit('match_status', { message: 'Searching for an active placement contender...' });
      }
    } catch (err: any) {
      logger.error('Error in matchmaking queue operation', { userId, error: err.message });
      socket.emit('match_error', { message: 'Matchmaking service encountered an error.' });
    }
  }

  /**
   * Matchmaking Leave Queue
   */
  public static async leaveMatchmaking(socket: Socket) {
    const userId = socket.data.userId;
    if (!userId) return;

    const categories = ['Aptitude', 'DSA', 'DBMS', 'Operating Systems', 'Technical', 'Reasoning'];
    for (const cat of categories) {
      const queueKey = this.getMatchmakingQueueKey(cat);
      try {
        const rawQueue = await redisClient.smembers(queueKey);
        for (const raw of rawQueue) {
          const item = JSON.parse(raw);
          if (item.userId === userId || item.socketId === socket.id) {
            await redisClient.srem(queueKey, raw);
            logger.info('User removed from matchmaking queue', { userId, category: cat });
          }
        }
      } catch (err) {
        // Safe ignore
      }
    }
  }

  /**
   * Create and Start Server-Authoritative Match
   */
  public static async createMatch(p1: any, p2: any, category: string) {
    const battleId = `battle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const questionsCount = 5;
    const timeLimit = 30;

    // Fast local question selection without external network latency
    const questions = await QuestionService.selectBattleQuestions(category, questionsCount, 'Medium');
    const sanitized = QuestionService.sanitizeForClient(questions);

    // Generate independent shuffled option orders for each player
    const p1Package = QuestionService.generatePlayerQuestionPackage(questions);
    const p2Package = QuestionService.generatePlayerQuestionPackage(questions);

    const now = Date.now();
    const battleDurationMs = questionsCount * timeLimit * 1000;

    const p1Avatar = resolveUserAvatar({ ...p1.profile, uid: p1.userId });
    const p2Avatar = resolveUserAvatar({ ...p2.profile, uid: p2.userId });

    const battle: BattleSession = {
      battleId,
      battleType: category,
      status: 'ACTIVE',
      questions,
      sanitizedQuestions: sanitized,
      timeLimitPerQuestion: timeLimit,
      totalQuestions: questions.length,
      battleStartedAt: now,
      battleEndsAt: now + battleDurationMs,
      concluded: false,
      createdAt: now,
      players: {
        [p1.userId]: {
          userId: p1.userId,
          socketId: p1.socketId,
          displayName: p1.profile.displayName || 'Cadet 1',
          photoURL: p1Avatar.url,
          level: p1.profile.level || 1,
          rating: p1.rating || GAME_CONFIG.elo.startingRating,
          score: 0,
          progressIndex: 0,
          finished: false,
          online: true,
          submissions: {},
          optionMappings: p1Package.optionMappings,
          sanitizedQuestions: p1Package.sanitizedQuestions,
          equippedRing: p1.profile.equippedRing,
          equippedFrame: p1.profile.equippedFrame,
          equippedBackground: p1.profile.equippedBackground,
          equippedTitle: p1.profile.equippedTitle
        },
        [p2.userId]: {
          userId: p2.userId,
          socketId: p2.socketId,
          displayName: p2.profile.displayName || 'Cadet 2',
          photoURL: p2Avatar.url,
          level: p2.profile.level || 1,
          rating: p2.rating || GAME_CONFIG.elo.startingRating,
          score: 0,
          progressIndex: 0,
          finished: false,
          online: true,
          submissions: {},
          optionMappings: p2Package.optionMappings,
          sanitizedQuestions: p2Package.sanitizedQuestions,
          equippedRing: p2.profile.equippedRing,
          equippedFrame: p2.profile.equippedFrame,
          equippedBackground: p2.profile.equippedBackground,
          equippedTitle: p2.profile.equippedTitle
        }
      }
    };

    await this.saveBattle(battle);

    // Notify sockets with their respective player-shuffled question packages
    this.io.of('/matchmaking').to(p1.socketId).emit('match_found', {
      battleId,
      opponent: {
        userId: p2.userId,
        displayName: p2.profile.displayName,
        level: p2.profile.level,
        rating: p2.rating || GAME_CONFIG.elo.startingRating,
        photoURL: p2Avatar.url,
        equippedRing: p2.profile.equippedRing,
        equippedFrame: p2.profile.equippedFrame,
        equippedBackground: p2.profile.equippedBackground,
        equippedTitle: p2.profile.equippedTitle
      },
      quiz: p1Package.sanitizedQuestions,
      battleEndsAt: battle.battleEndsAt
    });

    this.io.of('/matchmaking').to(p2.socketId).emit('match_found', {
      battleId,
      opponent: {
        userId: p1.userId,
        displayName: p1.profile.displayName,
        level: p1.profile.level,
        rating: p1.rating || GAME_CONFIG.elo.startingRating,
        photoURL: p1Avatar.url,
        equippedRing: p1.profile.equippedRing,
        equippedFrame: p1.profile.equippedFrame,
        equippedBackground: p1.profile.equippedBackground,
        equippedTitle: p1.profile.equippedTitle
      },
      quiz: p2Package.sanitizedQuestions,
      battleEndsAt: battle.battleEndsAt
    });

    // Setup Authoritative Server Timer
    this.startAuthoritativeTimer(battleId, battleDurationMs);
  }

  /**
   * Authoritative Server Timer: Automatically finalizes match when time expires
   */
  private static startAuthoritativeTimer(battleId: string, durationMs: number) {
    if (this.battleTimerIntervals.has(battleId)) {
      clearTimeout(this.battleTimerIntervals.get(battleId)!);
    }

    const timer = setTimeout(async () => {
      logger.info('Authoritative Battle Timer expired. Auto-concluding battle...', { battleId });
      await this.concludeBattle(battleId, 'timer_expired');
    }, durationMs + 2000); // 2s buffer for network latency

    this.battleTimerIntervals.set(battleId, timer);
  }

  /**
   * Handle Server-Authoritative Answer Submission with Option Mapping Resolution
   */
  public static async submitAnswer(
    socket: Socket,
    data: { battleId: string; questionIndex: number; selectedOption: number }
  ) {
    const userId = socket.data.userId;
    if (!userId) {
      socket.emit('battle_error', { message: 'Unauthorized submission' });
      return;
    }

    const battle = await this.getBattle(data.battleId);
    if (!battle) {
      socket.emit('battle_error', { message: 'Battle session not found or expired.' });
      return;
    }

    if (battle.status !== 'ACTIVE' || battle.concluded) {
      socket.emit('battle_error', { message: 'Battle is no longer active.' });
      return;
    }

    const player = battle.players[userId];
    if (!player) {
      socket.emit('battle_error', { message: 'Player not enrolled in this battle.' });
      return;
    }

    const qIndex = data.questionIndex;
    if (qIndex < 0 || qIndex >= battle.questions.length) {
      socket.emit('battle_error', { message: 'Invalid question index.' });
      return;
    }

    const authoritativeQuestion = battle.questions[qIndex];
    const mapping = player.optionMappings?.[qIndex];

    // Compute player's displayed correct option for UI feedback
    const displayedCorrectOption = mapping && Array.isArray(mapping)
      ? mapping.indexOf(authoritativeQuestion.correctOption)
      : authoritativeQuestion.correctOption;

    // Idempotency: If player already submitted for this question, return existing result
    if (player.submissions && player.submissions[qIndex]) {
      const prevSub = player.submissions[qIndex];
      logger.warn('Duplicate answer submission safely returned cached evaluation', { userId, battleId: data.battleId, qIndex });
      socket.emit('answer_evaluated', {
        questionIndex: qIndex,
        selectedOption: prevSub.selectedOption,
        isCorrect: prevSub.isCorrect,
        score: player.score,
        pointsAwarded: prevSub.points,
        explanation: authoritativeQuestion.explanation || '',
        correctOption: displayedCorrectOption !== -1 ? displayedCorrectOption : authoritativeQuestion.correctOption,
        nextQuestionIndex: player.progressIndex,
        totalQuestions: battle.totalQuestions
      });
      return;
    }

    const isTimeout = data.selectedOption === -1;
    // Map displayed option index back to original database option index
    const originalSelectedOption = isTimeout
      ? -1
      : (mapping && Array.isArray(mapping) && typeof mapping[data.selectedOption] === 'number'
          ? mapping[data.selectedOption]
          : data.selectedOption);

    const isCorrect = !isTimeout && originalSelectedOption === authoritativeQuestion.correctOption;

    const timeLimitMs = (battle.timeLimitPerQuestion || 30) * 1000;
    const scoreResult = ScoreCalculator.calculateQuestionScore({
      correct: isCorrect,
      responseTimeMs: 5000,
      timeLimitMs,
      difficulty: 'Medium'
    });

    const pointsAwarded = scoreResult.pointsAwarded;

    player.score += pointsAwarded;
    player.progressIndex = qIndex + 1;
    if (!player.submissions) player.submissions = {};
    player.submissions[qIndex] = {
      selectedOption: data.selectedOption,
      isCorrect,
      points: pointsAwarded,
      timeMs: Date.now()
    };

    logger.info('Battle answer validated', {
      event: 'answer_validation',
      battleId: data.battleId,
      userId,
      questionIndex: qIndex,
      questionId: authoritativeQuestion.id,
      displayedSelectedOption: data.selectedOption,
      originalSelectedOption,
      authoritativeCorrectOption: authoritativeQuestion.correctOption,
      displayedCorrectOption,
      isCorrect,
      pointsAwarded,
      scoreAfter: player.score,
      progressIndexAfter: player.progressIndex
    });

    const isFinalQuestion = player.progressIndex >= battle.totalQuestions;
    if (isFinalQuestion) {
      player.finished = true;
    }

    await this.saveBattle(battle);

    // Send authoritative response back to the answering player using their displayed option coordinates
    socket.emit('answer_evaluated', {
      questionIndex: qIndex,
      selectedOption: data.selectedOption,
      isCorrect,
      score: player.score,
      pointsAwarded,
      explanation: authoritativeQuestion.explanation || '',
      correctOption: displayedCorrectOption !== -1 ? displayedCorrectOption : authoritativeQuestion.correctOption,
      nextQuestionIndex: player.progressIndex,
      totalQuestions: battle.totalQuestions
    });

    // Broadcast synchronized progress to opponent
    this.io.of('/battle').to(data.battleId).emit('step_update', {
      uid: userId,
      score: player.score,
      progressIndex: player.progressIndex,
      finished: player.finished
    });

    // Check if all players have finished
    const allFinished = Object.values(battle.players).every(p => p.finished);
    if (allFinished) {
      logger.info('All players completed questions. Concluding match immediately.', { battleId: data.battleId });
      await this.concludeBattle(data.battleId, 'all_players_finished');
    }
  }

  /**
   * Handle Custom Room Join
   */
  public static async handleJoinCustomRoom(socket: Socket, roomId: string) {
    const userId = socket.data.userId;
    if (!userId || !roomId) return;

    try {
      if (!db) return;
      const roomRef = db.collection('battleRooms').doc(roomId);
      const roomDoc = await roomRef.get();
      if (!roomDoc.exists) return;

      const roomData = roomDoc.data()!;
      if (roomData.status === 'in-progress' || roomData.status === 'completed') {
        return;
      }

      // Fetch user profile for lobby display
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.exists ? userDoc.data()! : {};

      const players = roomData.players || {};
      if (!players[userId]) {
        players[userId] = {
          uid: userId,
          displayName: userData.displayName || 'Candidate',
          photoURL: userData.photoURL || '',
          level: userData.level || 1,
          battleRating: userData.battleRating || 1200,
          ready: false,
          online: true,
          score: 0,
          progressIndex: 0,
          finished: false
        };
        await roomRef.update({ players });
      } else {
        players[userId].online = true;
        await roomRef.update({ [`players.${userId}.online`]: true });
      }

      socket.join(roomId);
      socket.data.battleId = roomId;

      // Broadcast updated lobby info to all players in room
      const updatedDoc = await roomRef.get();
      this.io.of('/battle').to(roomId).emit('lobby_updated', updatedDoc.data());
    } catch (err: any) {
      logger.error('Error handling join custom room', { roomId, userId, error: err.message });
    }
  }

  /**
   * Handle Custom Room Toggle Ready
   */
  public static async handleToggleReady(socket: Socket, data: { battleId: string; userId?: string }) {
    const userId = socket.data.userId || data.userId;
    const roomId = data.battleId;
    if (!userId || !roomId || !db) return;

    try {
      const roomRef = db.collection('battleRooms').doc(roomId);
      const roomDoc = await roomRef.get();
      if (!roomDoc.exists) return;

      const roomData = roomDoc.data()!;
      const players = roomData.players || {};
      if (players[userId]) {
        players[userId].ready = !players[userId].ready;
        await roomRef.update({ players });

        this.io.of('/battle').to(roomId).emit('lobby_updated', {
          ...roomData,
          players
        });
      }
    } catch (err: any) {
      logger.error('Error handling toggle ready', { roomId, userId, error: err.message });
    }
  }

  /**
   * Handle Custom Room Start Battle Request
   */
  public static async handleStartBattleRequest(socket: Socket, data: { battleId: string; userId?: string }) {
    const userId = socket.data.userId || data.userId;
    const roomId = data.battleId;
    if (!userId || !roomId || !db) return;

    try {
      const roomRef = db.collection('battleRooms').doc(roomId);
      const roomDoc = await roomRef.get();
      if (!roomDoc.exists) return;

      const roomData = roomDoc.data()!;
      if (roomData.hostUid !== userId) {
        socket.emit('battle_error', { message: 'Only the room host can start the battle.' });
        return;
      }

      const players = roomData.players || {};
      const uids = Object.keys(players);
      if (uids.length < 2) {
        socket.emit('battle_error', { message: 'Need at least 2 players to start battle.' });
        return;
      }

      const allReady = Object.values(players).every((p: any) => p.ready);
      if (!allReady) {
        socket.emit('battle_error', { message: 'All players must be ready to start.' });
        return;
      }

      // Notify clients preparation started
      this.io.of('/battle').to(roomId).emit('battle_preparing');

      const questionsCount = roomData.settings?.questionsCount || 5;
      const timeLimit = roomData.settings?.timeLimit || 30;
      const category = roomData.battleType || 'DSA';
      const difficulty = roomData.settings?.difficulty || 'Medium';

      const questions = await QuestionService.selectBattleQuestions(category, questionsCount, difficulty);
      const sanitized = QuestionService.sanitizeForClient(questions);

      const now = Date.now();
      const battleDurationMs = questionsCount * timeLimit * 1000;

      const battleSessionPlayers: { [uid: string]: PlayerBattleState } = {};
      for (const uid of uids) {
        const p = players[uid];
        const pAvatar = resolveUserAvatar({ ...p, uid });
        const playerPackage = QuestionService.generatePlayerQuestionPackage(questions);
        battleSessionPlayers[uid] = {
          userId: uid,
          socketId: '',
          displayName: p.displayName || 'Candidate',
          photoURL: pAvatar.url,
          level: p.level || 1,
          rating: p.battleRating || GAME_CONFIG.elo.startingRating,
          score: 0,
          progressIndex: 0,
          finished: false,
          online: true,
          submissions: {},
          optionMappings: playerPackage.optionMappings,
          sanitizedQuestions: playerPackage.sanitizedQuestions
        };
      }

      const battle: BattleSession = {
        battleId: roomId,
        battleType: category,
        status: 'ACTIVE',
        hostUid: userId,
        isPrivate: !!roomData.settings?.isPrivate,
        questions,
        sanitizedQuestions: sanitized,
        timeLimitPerQuestion: timeLimit,
        totalQuestions: questions.length,
        battleStartedAt: now,
        battleEndsAt: now + battleDurationMs,
        concluded: false,
        createdAt: now,
        players: battleSessionPlayers
      };

      await this.saveBattle(battle);
      await roomRef.update({ status: 'in-progress' });

      // Start authoritative timer
      this.startAuthoritativeTimer(roomId, battleDurationMs);

      // Emit battle starting with per-player customized quiz
      try {
        const sockets = await this.io.of('/battle').in(roomId).fetchSockets();
        if (sockets && sockets.length > 0) {
          for (const s of sockets) {
            const sUid = s.data.userId;
            const pState = battleSessionPlayers[sUid];
            const pQuiz = pState?.sanitizedQuestions || sanitized;
            s.emit('battle_starting', {
              quiz: pQuiz,
              battleEndsAt: battle.battleEndsAt
            });
          }
        } else {
          this.io.of('/battle').to(roomId).emit('battle_starting', {
            quiz: sanitized,
            battleEndsAt: battle.battleEndsAt
          });
        }
      } catch {
        this.io.of('/battle').to(roomId).emit('battle_starting', {
          quiz: sanitized,
          battleEndsAt: battle.battleEndsAt
        });
      }
    } catch (err: any) {
      logger.error('Error starting custom battle', { roomId, userId, error: err.message });
      socket.emit('battle_error', { message: 'Failed to start battle session.' });
    }
  }

  /**
   * Handle Player Disconnection with Reconnection Grace Period
   */
  public static async handlePlayerDisconnect(socket: Socket) {
    const userId = socket.data.userId;
    const battleId = socket.data.battleId;
    if (!userId || !battleId) return;

    const battle = await this.getBattle(battleId);
    if (!battle || battle.status !== 'ACTIVE' || battle.concluded) return;

    const player = battle.players[userId];
    if (!player) return;

    player.online = false;
    player.disconnectedAt = Date.now();
    const gracePeriodSeconds = 45;
    const graceExpiresAt = Date.now() + gracePeriodSeconds * 1000;

    if (!battle.disconnectGraceExpiresAt) battle.disconnectGraceExpiresAt = {};
    battle.disconnectGraceExpiresAt[userId] = graceExpiresAt;

    await this.saveBattle(battle);

    // Notify opponent of disconnection grace window
    this.io.of('/battle').to(battleId).emit('player_disconnected', {
      userId,
      gracePeriodSeconds
    });

    // Schedule forfeit if player does not reconnect before grace expiration
    setTimeout(async () => {
      const refreshedBattle = await this.getBattle(battleId);
      if (refreshedBattle && !refreshedBattle.concluded && refreshedBattle.status === 'ACTIVE') {
        const refreshedPlayer = refreshedBattle.players[userId];
        if (refreshedPlayer && !refreshedPlayer.online) {
          logger.info(`Player ${userId} failed to reconnect within grace period. Forfeiting match.`, { battleId });
          await this.concludeBattle(battleId, 'forfeit', userId);
        }
      }
    }, gracePeriodSeconds * 1000);
  }

  /**
   * Handle Player Reconnection: Restores full battle snapshot or concluded results
   */
  public static async handlePlayerReconnect(socket: Socket, battleId: string): Promise<boolean> {
    const userId = socket.data.userId;
    if (!userId) return false;

    const battle = await this.getBattle(battleId);
    if (!battle) return false;

    const player = battle.players[userId];
    if (!player) return false;

    player.online = true;
    player.socketId = socket.id;
    socket.data.battleId = battleId;
    socket.join(battleId);

    if (battle.disconnectGraceExpiresAt && battle.disconnectGraceExpiresAt[userId]) {
      delete battle.disconnectGraceExpiresAt[userId];
    }

    await this.saveBattle(battle);

    // If battle has already concluded, immediately transmit the authoritative result to the reconnecting player
    if (battle.status === 'COMPLETED' || battle.concluded) {
      const uids = Object.keys(battle.players);
      const isPlayerA = uids[0] === userId;
      const resultPackage = battle.resultPackage;

      if (resultPackage) {
        const playerPayload = {
          battleId,
          status: 'COMPLETED',
          winnerId: resultPackage.winnerId,
          isDraw: resultPackage.isDraw,
          playerReward: isPlayerA ? resultPackage.playerA : resultPackage.playerB,
          opponentReward: isPlayerA ? resultPackage.playerB : resultPackage.playerA,
          playerDeltas: {
            [uids[0]]: {
              elo: resultPackage.playerA.elo.change,
              xp: resultPackage.playerA.xp.earned,
              coins: resultPackage.playerA.coins.earned,
              score: resultPackage.playerA.score
            },
            [uids[1]]: {
              elo: resultPackage.playerB.elo.change,
              xp: resultPackage.playerB.xp.earned,
              coins: resultPackage.playerB.coins.earned,
              score: resultPackage.playerB.score
            }
          }
        };

        socket.emit('battle_concluded', playerPayload);
        socket.emit('battle:completed', playerPayload);
        return true;
      }
    }

    // Otherwise restore the active battle state
    socket.emit('battle_restored', {
      battleId,
      battleType: battle.battleType,
      quiz: player.sanitizedQuestions || battle.sanitizedQuestions,
      currentQuestionIndex: player.progressIndex,
      playerScore: player.score,
      timeLimitPerQuestion: battle.timeLimitPerQuestion,
      battleEndsAt: battle.battleEndsAt,
      totalQuestions: battle.totalQuestions,
      opponentProgress: Object.values(battle.players).find(p => p.userId !== userId) || null
    });

    // Notify room that player returned
    socket.to(battleId).emit('player_reconnected', { userId });
    return true;
  }

  /**
   * Finalize Battle, Calculate Elo/XP/Coins, Persist History atomically via BattleResultProcessor
   */
  public static async concludeBattle(battleId: string, reason: string, forfeitedUserId?: string) {
    if (this.concludingBattles.has(battleId)) {
      logger.info('Battle finalization already in progress (concurrency lock hit)', { battleId });
      return;
    }

    const battle = await this.getBattle(battleId);
    if (!battle) return;

    if (battle.concluded && battle.resultPackage) {
      logger.info('Battle already finalized (idempotent skip)', { battleId });
      return;
    }

    this.concludingBattles.add(battleId);

    // Cancel timer if running
    if (this.battleTimerIntervals.has(battleId)) {
      clearTimeout(this.battleTimerIntervals.get(battleId)!);
      this.battleTimerIntervals.delete(battleId);
    }

    try {
      battle.concluded = true;
      battle.status = 'COMPLETED';

      const uids = Object.keys(battle.players);
      if (uids.length < 2) {
        await this.deleteBattle(battleId);
        return;
      }

      const p1 = battle.players[uids[0]];
      const p2 = battle.players[uids[1]];

      // 1. Build question submissions lists
      const mapSubmissions = (player: PlayerBattleState) => {
        const list: any[] = [];
        for (let i = 0; i < battle.totalQuestions; i++) {
          const sub = player.submissions?.[i];
          if (sub) {
            list.push({
              questionIndex: i,
              selectedOption: sub.selectedOption,
              correct: sub.isCorrect,
              responseTimeMs: sub.timeMs ? Math.min(30000, Math.max(500, Date.now() - sub.timeMs)) : 5000,
              timeLimitMs: battle.timeLimitPerQuestion * 1000,
              difficulty: 'Medium'
            });
          } else {
            list.push({
              questionIndex: i,
              selectedOption: -1,
              correct: false,
              responseTimeMs: battle.timeLimitPerQuestion * 1000,
              timeLimitMs: battle.timeLimitPerQuestion * 1000,
              difficulty: 'Medium'
            });
          }
        }
        return list;
      };

      // 2. Fetch or estimate durable progression state for both users
      let xp1 = 0, coins1 = 100, r1 = p1.rating || GAME_CONFIG.elo.startingRating;
      let xp2 = 0, coins2 = 100, r2 = p2.rating || GAME_CONFIG.elo.startingRating;

      try {
        if (db) {
          const [doc1, doc2] = await Promise.all([
            db.collection('users').doc(p1.userId).get(),
            db.collection('users').doc(p2.userId).get()
          ]);
          if (doc1.exists) {
            const d1 = doc1.data() || {};
            xp1 = d1.totalXp ?? d1.xp ?? 0;
            coins1 = d1.coins ?? 100;
            r1 = d1.battleRating ?? d1.eloRating ?? GAME_CONFIG.elo.startingRating;
          }
          if (doc2.exists) {
            const d2 = doc2.data() || {};
            xp2 = d2.totalXp ?? d2.xp ?? 0;
            coins2 = d2.coins ?? 100;
            r2 = d2.battleRating ?? d2.eloRating ?? GAME_CONFIG.elo.startingRating;
          }
        }
      } catch (fetchErr) {
        logger.warn('Failed to pre-fetch Firestore profile for rewards, falling back to session state', { error: String(fetchErr) });
      }

      const participantA: BattleParticipantInput = {
        userId: p1.userId,
        username: p1.displayName,
        submissions: mapSubmissions(p1),
        previousState: {
          totalXp: xp1,
          coins: coins1,
          eloRating: r1
        }
      };

      const participantB: BattleParticipantInput = {
        userId: p2.userId,
        username: p2.displayName,
        submissions: mapSubmissions(p2),
        previousState: {
          totalXp: xp2,
          coins: coins2,
          eloRating: r2
        }
      };

      // 3. Process rewards through authoritative BattleResultProcessor
      const resultPackage: BattleResultPackage = await BattleResultProcessor.processBattleRewards({
        battleId,
        playerA: participantA,
        playerB: participantB,
        totalQuestions: battle.totalQuestions
      });

      battle.winnerId = resultPackage.winnerId || 'draw';
      battle.resultPackage = resultPackage;
      await this.saveBattle(battle);

      // Save Immutable Record in battleHistory & Mark battleRoom completed
      try {
        if (db) {
          await db.collection('battleHistory').add({
            battleId,
            uids: [p1.userId, p2.userId],
            winnerId: resultPackage.winnerId,
            isDraw: resultPackage.isDraw,
            category: battle.battleType,
            difficulty: 'Medium',
            reason,
            createdAt: new Date().toISOString(),
            scores: {
              [p1.userId]: resultPackage.playerA.score,
              [p2.userId]: resultPackage.playerB.score
            },
            eloChanges: {
              [p1.userId]: resultPackage.playerA.elo.change,
              [p2.userId]: resultPackage.playerB.elo.change
            },
            players: {
              [p1.userId]: {
                uid: p1.userId,
                displayName: p1.displayName || 'Candidate',
                photoURL: p1.photoURL || '',
                score: resultPackage.playerA.score,
                eloChange: resultPackage.playerA.elo.change,
                xpEarned: resultPackage.playerA.xp.earned,
                coinsEarned: resultPackage.playerA.coins.earned
              },
              [p2.userId]: {
                uid: p2.userId,
                displayName: p2.displayName || 'Candidate',
                photoURL: p2.photoURL || '',
                score: resultPackage.playerB.score,
                eloChange: resultPackage.playerB.elo.change,
                xpEarned: resultPackage.playerB.xp.earned,
                coinsEarned: resultPackage.playerB.coins.earned
              }
            }
          });

          // Mark custom room completed so no new joins can occur
          const roomRef = db.collection('battleRooms').doc(battleId);
          const roomDoc = await roomRef.get();
          if (roomDoc.exists) {
            await roomRef.update({ status: 'completed', completedAt: new Date().toISOString() });
          }
        }
      } catch (histErr) {
        logger.error('Failed to log immutable battle history / update room completion', { battleId, error: String(histErr) });
      }

      // 4. Build targeted result payloads
      const p1Payload = {
        battleId,
        status: 'COMPLETED',
        winnerId: resultPackage.winnerId,
        isDraw: resultPackage.isDraw,
        playerReward: resultPackage.playerA,
        opponentReward: resultPackage.playerB,
        playerDeltas: {
          [p1.userId]: {
            elo: resultPackage.playerA.elo.change,
            xp: resultPackage.playerA.xp.earned,
            coins: resultPackage.playerA.coins.earned,
            score: resultPackage.playerA.score
          },
          [p2.userId]: {
            elo: resultPackage.playerB.elo.change,
            xp: resultPackage.playerB.xp.earned,
            coins: resultPackage.playerB.coins.earned,
            score: resultPackage.playerB.score
          }
        }
      };

      const p2Payload = {
        battleId,
        status: 'COMPLETED',
        winnerId: resultPackage.winnerId,
        isDraw: resultPackage.isDraw,
        playerReward: resultPackage.playerB,
        opponentReward: resultPackage.playerA,
        playerDeltas: {
          [p1.userId]: {
            elo: resultPackage.playerA.elo.change,
            xp: resultPackage.playerA.xp.earned,
            coins: resultPackage.playerA.coins.earned,
            score: resultPackage.playerA.score
          },
          [p2.userId]: {
            elo: resultPackage.playerB.elo.change,
            xp: resultPackage.playerB.xp.earned,
            coins: resultPackage.playerB.coins.earned,
            score: resultPackage.playerB.score
          }
        }
      };

      // 5. Direct Socket Dispatches
      try {
        const sockets = await this.io.of('/battle').in(battleId).fetchSockets();
        for (const s of sockets) {
          const sUid = s.data.userId;
          if (sUid === p2.userId) {
            s.emit('battle_concluded', p2Payload);
            s.emit('battle:completed', p2Payload);
          } else {
            s.emit('battle_concluded', p1Payload);
            s.emit('battle:completed', p1Payload);
          }
        }
      } catch (sockErr) {
        logger.warn('Failed to fetch sockets for conclusion dispatch', { battleId, error: String(sockErr) });
      }

      // 6. Broadcast Room Fallback
      this.io.of('/battle').to(battleId).emit('battle_concluded', p1Payload);
      this.io.of('/battle').to(battleId).emit('battle:completed', {
        ...resultPackage,
        battleId,
        status: 'COMPLETED'
      });

      logger.info('Battle finalization broadcast completed', { battleId, winnerId: resultPackage.winnerId });
    } finally {
      this.concludingBattles.delete(battleId);
    }
  }
}

export default BattleEngine;
