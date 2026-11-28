import { Server, Socket } from 'socket.io';
import { redisClient } from '../config/redis';
import { db } from '../config/firebase';
import { QuestionService } from './QuestionService';
import { AssessmentHistoryService } from './AssessmentHistoryService';
import { Question, SanitizedQuestion } from '../types/question';
import { syncMissionsState, processMissionProgress, checkAndUnlockAchievements, calculateLevelFromXP } from '../utils/gamification';
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
import { SUBJECT_LIST } from '../constants/subjects';

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
  private static battleLocks = new Map<string, Promise<void>>();
  private static matchmakingLockChain: Promise<void> = Promise.resolve();
  private static sweepInterval: NodeJS.Timeout | null = null;
  private static readonly QUEUE_TICKET_TTL_MS = 180_000; // 3 minutes max queue lifetime

  public static initialize(ioInstance: Server) {
    this.io = ioInstance;
    this.startMatchmakingSweep();
  }

  /**
   * Concurrency-safe async mutex for atomic matchmaking operations
   */
  private static async withMatchmakingLock<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const prev = this.matchmakingLockChain;
    this.matchmakingLockChain = new Promise<void>(resolve => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * Per-battle async mutex to serialize Redis read-modify-write operations (prevents simultaneous submitAnswer races)
   */
  private static async withBattleLock<T>(battleId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.battleLocks.get(battleId) || Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>(resolve => {
      release = resolve;
    });
    const chained = prev.then(() => next, () => next);
    this.battleLocks.set(battleId, chained);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.battleLocks.get(battleId) === chained) {
        this.battleLocks.delete(battleId);
      }
    }
  }

  /**
   * Expanding Elo search window based on waiting duration:
   * 0-10s: ±100 | 10-20s: ±200 | 20-30s: ±300 | 30+s: ±500
   */
  public static getAllowedEloRange(waitMs: number): number {
    if (waitMs < 10_000) return 100;
    if (waitMs < 20_000) return 200;
    if (waitMs < 30_000) return 300;
    return 500;
  }

  /**
   * Select closest eligible opponent within expanding Elo windows.
   * Never matches self or expired tickets.
   */
  public static findBestEloOpponent(
    seeker: { userId: string; rating: number; joinedAt: number },
    candidates: Array<{ userId: string; rating: number; joinedAt: number; socketId?: string }>,
    nowMs: number = Date.now()
  ): any | null {
    const seekerWait = Math.max(0, nowMs - (seeker.joinedAt || nowMs));
    const seekerRange = this.getAllowedEloRange(seekerWait);

    let bestCandidate: any = null;
    let bestDiff = Infinity;

    for (const candidate of candidates) {
      if (!candidate || !candidate.userId || candidate.userId === seeker.userId) continue;
      if (nowMs - (candidate.joinedAt || nowMs) > this.QUEUE_TICKET_TTL_MS) continue;

      const candWait = Math.max(0, nowMs - (candidate.joinedAt || nowMs));
      const candRange = this.getAllowedEloRange(candWait);
      const effectiveRange = Math.max(seekerRange, candRange);
      const eloDiff = Math.abs((seeker.rating || 1000) - (candidate.rating || 1000));

      if (eloDiff <= effectiveRange) {
        if (
          eloDiff < bestDiff ||
          (eloDiff === bestDiff && (candidate.joinedAt || 0) < (bestCandidate?.joinedAt || Infinity))
        ) {
          bestDiff = eloDiff;
          bestCandidate = candidate;
        }
      }
    }

    return bestCandidate;
  }

  /**
   * Redis key helpers
   */
  private static getBattleKey(battleId: string): string {
    return `battle:state:${battleId}`;
  }

  private static getActiveBattleUserKey(userId: string): string {
    return `battle:active:${userId}`;
  }

  private static getMatchmakingQueueKey(category: string): string {
    const slug = QuestionService.normalizeSubjectSlug(category);
    return `matchmaking:queue:${slug}`;
  }

  private static async setActiveBattleLock(userId: string, battleId: string): Promise<void> {
    try {
      await redisClient.set(this.getActiveBattleUserKey(userId), battleId, 'EX', 3600);
    } catch {
      // Safe ignore
    }
    try {
      if (db) {
        await db.collection('users').doc(userId).set({
          activeBattleId: battleId,
          battleStatus: 'active'
        }, { merge: true });
      }
    } catch {
      // Safe ignore
    }
  }

  private static async clearActiveBattleLock(userId: string): Promise<void> {
    try {
      await redisClient.del(this.getActiveBattleUserKey(userId));
    } catch {
      // Safe ignore
    }
    try {
      if (db) {
        await db.collection('users').doc(userId).set({
          activeBattleId: null,
          battleStatus: 'idle'
        }, { merge: true });
      }
    } catch {
      // Safe ignore
    }
  }

  public static async getActiveBattleIdForUser(userId: string): Promise<string | null> {
    const result = await this.validateAndRecoverActiveBattle(userId);
    return result.battleId;
  }

  /**
   * Validates whether a user is genuinely participating in a live, non-expired battle.
   * Automatically cleans up stale Redis locks, expired rooms, and outdated Firestore activeBattleId references.
   */
  public static async validateAndRecoverActiveBattle(userId: string): Promise<{
    battleId: string | null;
    cleanedStaleSession: boolean;
    battle?: BattleSession;
  }> {
    let battleId: string | null = null;
    let hadFirestoreRef = false;

    try {
      battleId = await redisClient.get(this.getActiveBattleUserKey(userId));
    } catch {
      battleId = null;
    }

    if (db) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const uData = userDoc.data() || {};
          const fsBattleId = uData.activeBattleId || uData.currentBattleId || null;
          if (fsBattleId) {
            hadFirestoreRef = true;
            if (!battleId) battleId = fsBattleId;
          }
        }
      } catch {
        // Non-fatal
      }
    }

    if (!battleId) {
      return { battleId: null, cleanedStaleSession: false };
    }

    const existingBattle = await this.getBattle(battleId);

    // 1. Missing from Redis -> stale reference
    if (!existingBattle) {
      await this.clearActiveBattleLock(userId);
      if (db) {
        try {
          const roomDoc = await db.collection('battleRooms').doc(battleId).get();
          if (roomDoc.exists) {
            const rData = roomDoc.data() || {};
            if (rData.status === 'in-progress' || rData.status === 'ACTIVE') {
              await db.collection('battleRooms').doc(battleId).update({
                status: 'expired',
                completedAt: new Date().toISOString()
              });
            }
          }
        } catch {
          // Safe ignore
        }
      }
      return { battleId: null, cleanedStaleSession: true };
    }

    // 2. Already concluded/completed/aborted or user is not a registered participant
    const isParticipant = Boolean(existingBattle.players && existingBattle.players[userId]);
    if (
      existingBattle.concluded ||
      existingBattle.status === 'COMPLETED' ||
      existingBattle.status === 'ABORTED' ||
      !isParticipant
    ) {
      await this.clearActiveBattleLock(userId);
      return { battleId: null, cleanedStaleSession: true };
    }

    // 3. Battle time expired -> finalize cleanly and release locks
    if (existingBattle.battleEndsAt && Date.now() > existingBattle.battleEndsAt + 5000) {
      try {
        await this.concludeBattle(battleId, 'timeout');
      } catch {
        await this.clearActiveBattleLock(userId);
      }
      return { battleId: null, cleanedStaleSession: true };
    }

    // 4. Verify Firestore battleRooms doc is not completed/expired/cancelled/deleted
    if (db) {
      try {
        const roomDoc = await db.collection('battleRooms').doc(battleId).get();
        if (roomDoc.exists) {
          const rData = roomDoc.data() || {};
          const expMs = rData.expirationTime ? new Date(rData.expirationTime).getTime() : 0;
          if (
            rData.status === 'completed' ||
            rData.status === 'expired' ||
            rData.status === 'cancelled' ||
            (expMs > 0 && expMs <= Date.now())
          ) {
            await this.clearActiveBattleLock(userId);
            return { battleId: null, cleanedStaleSession: true };
          }
        } else if (hadFirestoreRef) {
          // User's Firestore activeBattleId pointed to a deleted room
          await this.deleteBattle(battleId);
          await this.clearActiveBattleLock(userId);
          return { battleId: null, cleanedStaleSession: true };
        }
      } catch {
        // Non-fatal
      }
    }

    return { battleId, cleanedStaleSession: false, battle: existingBattle };
  }

  /**
   * Returns validated active battle session summary for frontend recovery/resume on load.
   */
  public static async getValidatedActiveSession(userId: string) {
    const { battleId, cleanedStaleSession, battle } = await this.validateAndRecoverActiveBattle(userId);
    if (!battleId || !battle) {
      return { hasActiveBattle: false, cleanedStaleSession };
    }

    const me = battle.players[userId];
    const oppUid = Object.keys(battle.players).find(uid => uid !== userId);
    const opp = oppUid ? battle.players[oppUid] : null;

    return {
      hasActiveBattle: true,
      cleanedStaleSession,
      battleId: battle.battleId,
      battleType: battle.battleType,
      status: battle.status,
      battleEndsAt: battle.battleEndsAt,
      currentQuestionIndex: me?.progressIndex || 0,
      totalQuestions: battle.totalQuestions,
      playerScore: me?.score || 0,
      opponent: opp
        ? {
          userId: opp.userId,
          displayName: opp.displayName,
          level: opp.level,
          rating: opp.rating,
          photoURL: opp.photoURL
        }
        : null
    };
  }

  /**
   * Explicitly abandon/forfeit an active battle so both players' locks are released immediately.
   */
  public static async handleAbandonBattle(userId: string, requestedBattleId?: string): Promise<{ abandoned: boolean; battleId: string | null }> {
    const { battleId, battle } = await this.validateAndRecoverActiveBattle(userId);
    const targetId = requestedBattleId || battleId;
    if (!targetId) {
      await this.clearActiveBattleLock(userId);
      return { abandoned: false, battleId: null };
    }

    const liveBattle = battle || (await this.getBattle(targetId));
    if (!liveBattle || liveBattle.concluded || liveBattle.status !== 'ACTIVE' || !liveBattle.players[userId]) {
      await this.clearActiveBattleLock(userId);
      return { abandoned: false, battleId: null };
    }

    await this.concludeBattle(targetId, 'forfeit', userId);
    return { abandoned: true, battleId: targetId };
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
   * Delete ephemeral battle state and release player locks
   */
  public static async deleteBattle(battleId: string): Promise<void> {
    try {
      const existing = await this.getBattle(battleId);
      if (existing?.players) {
        await Promise.all(Object.keys(existing.players).map(uid => this.clearActiveBattleLock(uid)));
      }
      await redisClient.del(this.getBattleKey(battleId));
      if (this.battleTimerIntervals.has(battleId)) {
        clearTimeout(this.battleTimerIntervals.get(battleId)!);
        this.battleTimerIntervals.delete(battleId);
      }
    } catch (err) {
      logger.error('Failed to delete battle from Redis', { battleId, error: String(err) });
    }
  }

  /**
   * Periodic matchmaking sweep for waiting players whose Elo range expands over time
   */
  private static startMatchmakingSweep() {
    if (this.sweepInterval) return;
    this.sweepInterval = setInterval(async () => {
      try {
        await this.runMatchmakingSweep();
      } catch {
        // Non-fatal sweep guard
      }
    }, 3000);
    if (typeof this.sweepInterval.unref === 'function') {
      this.sweepInterval.unref();
    }
  }

  public static async runMatchmakingSweep(): Promise<void> {
    const category = 'quantitative_aptitude';
    const queueKey = this.getMatchmakingQueueKey(category);

    await this.withMatchmakingLock(async () => {
      const rawQueue = await redisClient.smembers(queueKey);
      if (!rawQueue || rawQueue.length === 0) return;

      const now = Date.now();
      const activeTickets: Array<{ raw: string; ticket: any }> = [];

      for (const raw of rawQueue) {
        try {
          const t = JSON.parse(raw);
          if (!t?.userId || now - (t.joinedAt || 0) > this.QUEUE_TICKET_TTL_MS) {
            await redisClient.srem(queueKey, raw);
            continue;
          }
          // Verify active battle lock hasn't been acquired elsewhere
          const activeId = await this.getActiveBattleIdForUser(t.userId);
          if (activeId) {
            await redisClient.srem(queueKey, raw);
            continue;
          }
          activeTickets.push({ raw, ticket: t });
        } catch {
          await redisClient.srem(queueKey, raw);
        }
      }

      if (activeTickets.length < 2) return;

      const claimed = new Set<string>();
      for (const entry of activeTickets) {
        if (claimed.has(entry.ticket.userId)) continue;
        const remaining = activeTickets
          .filter(c => !claimed.has(c.ticket.userId) && c.ticket.userId !== entry.ticket.userId)
          .map(c => c.ticket);

        const match = this.findBestEloOpponent(entry.ticket, remaining, now);
        if (match) {
          const matchEntry = activeTickets.find(c => c.ticket.userId === match.userId);
          if (!matchEntry) continue;

          claimed.add(entry.ticket.userId);
          claimed.add(match.userId);

          await redisClient.srem(queueKey, entry.raw);
          await redisClient.srem(queueKey, matchEntry.raw);

          try {
            await this.createMatch(entry.ticket, matchEntry.ticket, category);
          } catch (err: any) {
            logger.error('Match creation failed during sweep, rolling back', { error: err.message });
          }
        }
      }
    });
  }

  /**
   * Matchmaking Join Queue (Strictly Quantitative Aptitude + Authoritative Eligibility & Elo Matching)
   */
  public static async joinMatchmaking(socket: Socket, payload: { battleType?: string; rating?: number; profile?: any }) {
    const userId = socket.data.userId;
    if (!userId) {
      socket.emit('match_error', { message: 'Unauthorized socket connection.' });
      return;
    }

    // PART 1: Restrict Quick Match strictly to Quantitative Aptitude
    const category = 'quantitative_aptitude';
    const queueKey = this.getMatchmakingQueueKey(category);

    try {
      // 1. Authoritative Eligibility & Profile Verification from Firestore
      let userData: any = {};
      if (db) {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          userData = userDoc.data() || {};
          if (userData.accountStatus === 'blocked' || userData.accountStatus === 'deleted' || userData.isDeleted || userData.banned) {
            socket.emit('match_error', { message: 'Your account is restricted from competitive matchmaking.' });
            return;
          }
        }
      }

      // 2. Prevent entering queue if already in a genuinely active battle (auto-cleans stale refs)
      const existingBattleId = await this.getActiveBattleIdForUser(userId);
      if (existingBattleId) {
        socket.emit('match_error', {
          message: 'You are already participating in an active battle.',
          code: 'ACTIVE_BATTLE_EXISTS',
          battleId: existingBattleId
        });
        return;
      }

      const rawXp = Number(userData.xp ?? userData.totalXp ?? 0);
      const authoritativeRating = Number(userData.battleRating ?? userData.eloRating ?? GAME_CONFIG.elo.startingRating ?? 1000);
      const authoritativeLevel = rawXp > 0 ? calculateLevelFromXP(rawXp) : Number(userData.level || payload?.profile?.level || 1);

      const playerTicket = {
        userId,
        socketId: socket.id,
        rating: authoritativeRating,
        profile: {
          ...(payload?.profile || {}),
          displayName: userData.displayName || payload?.profile?.displayName || 'Cadet',
          photoURL: userData.photoURL || payload?.profile?.avatar || '',
          level: authoritativeLevel,
          equippedRing: userData.equippedRing || payload?.profile?.equippedRing || '',
          equippedFrame: userData.equippedFrame || payload?.profile?.equippedFrame || '',
          equippedBackground: userData.equippedBackground || payload?.profile?.equippedBackground || '',
          equippedTitle: userData.equippedTitle || payload?.profile?.equippedTitle || ''
        },
        joinedAt: Date.now()
      };

      logger.info('User entering Quick Match queue (Aptitude)', { userId, category, rating: authoritativeRating });

      // 3. Concurrency-safe atomic matchmaking check & enqueue
      await this.withMatchmakingLock(async () => {
        // Re-verify inside lock to prevent race conditions from simultaneous requests
        const raceBattleId = await this.getActiveBattleIdForUser(userId);
        if (raceBattleId) {
          socket.emit('match_error', {
            message: 'You are already participating in an active battle.',
            code: 'ACTIVE_BATTLE_EXISTS',
            battleId: raceBattleId
          });
          return;
        }

        const rawQueue = await redisClient.smembers(queueKey);
        const now = Date.now();
        const validCandidates: Array<{ raw: string; ticket: any }> = [];

        // Deduplicate: remove any stale/existing entry for this userId and expired entries
        for (const raw of rawQueue) {
          try {
            const candidate = JSON.parse(raw);
            if (!candidate?.userId || candidate.userId === userId || now - (candidate.joinedAt || 0) > this.QUEUE_TICKET_TTL_MS) {
              await redisClient.srem(queueKey, raw);
              continue;
            }
            const oppActiveBattle = await this.getActiveBattleIdForUser(candidate.userId);
            if (oppActiveBattle) {
              await redisClient.srem(queueKey, raw);
              continue;
            }
            validCandidates.push({ raw, ticket: candidate });
          } catch {
            await redisClient.srem(queueKey, raw);
          }
        }

        const opponentTicket = this.findBestEloOpponent(
          playerTicket,
          validCandidates.map(c => c.ticket),
          now
        );

        if (opponentTicket) {
          const oppEntry = validCandidates.find(c => c.ticket.userId === opponentTicket.userId);
          if (oppEntry) {
            await redisClient.srem(queueKey, oppEntry.raw);
          }

          logger.info('Fair Elo Match paired', {
            player1: userId,
            player2: opponentTicket.userId,
            rating1: playerTicket.rating,
            rating2: opponentTicket.rating,
            category
          });

          try {
            await this.createMatch(playerTicket, opponentTicket, category);
          } catch (matchErr: any) {
            // Rollback: re-enqueue waiting opponent if match creation fails
            await redisClient.sadd(queueKey, JSON.stringify(opponentTicket));
            throw matchErr;
          }
        } else {
          await redisClient.sadd(queueKey, JSON.stringify(playerTicket));
          socket.emit('match_status', {
            message: 'Searching for an Aptitude competitor within ±100 Elo...',
            eloRange: 100
          });
        }
      });
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

    const categories = Array.from(new Set([
      ...SUBJECT_LIST.map(s => s.slug),
      'quantitative_aptitude',
      'dsa',
      'dbms',
      'operating_system',
      'computer_network',
      'logical_reasoning',
      'verbal_ability',
      'hr_behavioral'
    ]));
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
   * Create and Start Server-Authoritative Quick Match (Quantitative Aptitude, 5 MCQs, Synchronized)
   */
  public static async createMatch(p1: any, p2: any, category: string = 'quantitative_aptitude') {
    if (!p1?.userId || !p2?.userId || p1.userId === p2.userId) {
      logger.error('INITIALIZATION_FAILED', { reason: 'Invalid or identical player IDs', p1: p1?.userId, p2: p2?.userId });
      throw new Error('Cannot create match with invalid or identical player IDs.');
    }

    const battleId = `battle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const questionsCount = 5;
    const timeLimit = 30;
    const normalizedCategory = 'quantitative_aptitude';

    logger.info('MATCH_FOUND', { battleId, p1: p1.userId, p2: p2.userId, category: normalizedCategory });
    logger.info('MATCH_VALIDATED', { battleId, p1: p1.userId, p2: p2.userId });

    // Claim active-battle locks atomically before emitting match_found
    logger.info('ROOM_CREATION_STARTED', { battleId, p1: p1.userId, p2: p2.userId });
    await this.setActiveBattleLock(p1.userId, battleId);
    await this.setActiveBattleLock(p2.userId, battleId);
    logger.info('PLAYERS_REGISTERED', { battleId, p1: p1.userId, p2: p2.userId });

    let questions: Question[] = [];
    try {
      logger.info('QUESTIONS_FETCH_STARTED', { battleId, category: normalizedCategory, count: questionsCount });
      questions = await QuestionService.selectBattleQuestions(normalizedCategory, questionsCount, 'Medium');
      logger.info('QUESTIONS_FETCHED', { battleId, count: questions.length });
      if (!Array.isArray(questions) || questions.length !== questionsCount || questions.some(q => !q?.question || !Array.isArray(q?.options) || q.options.length < 4)) {
        throw new Error(`Invalid or incomplete question set returned (${questions?.length || 0}/${questionsCount})`);
      }
      logger.info('QUESTIONS_VALIDATED', { battleId, count: questions.length });
    } catch (qErr: any) {
      logger.error('INITIALIZATION_FAILED', { battleId, p1: p1.userId, p2: p2.userId, error: qErr?.message || String(qErr) });
      await this.clearActiveBattleLock(p1.userId);
      await this.clearActiveBattleLock(p2.userId);
      throw qErr;
    }
    const sanitized = QuestionService.sanitizeForClient(questions);

    // Generate independent shuffled option orders for each player while preserving identical questions & order
    const p1Package = QuestionService.generatePlayerQuestionPackage(questions);
    const p2Package = QuestionService.generatePlayerQuestionPackage(questions);

    const now = Date.now();
    const battleDurationMs = questionsCount * timeLimit * 1000;

    const p1Avatar = resolveUserAvatar({ ...p1.profile, uid: p1.userId });
    const p2Avatar = resolveUserAvatar({ ...p2.profile, uid: p2.userId });

    const battle: BattleSession = {
      battleId,
      battleType: normalizedCategory,
      status: 'ACTIVE',
      hostUid: p1.userId,
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
    logger.info('BATTLE_INITIALIZED', { battleId, p1: p1.userId, p2: p2.userId });

    // Persist synchronized Quick Match metadata in Firestore battleRooms
    try {
      if (db) {
        await db.collection('battleRooms').doc(battleId).set({
          roomId: battleId,
          mode: 'quick_match',
          hostUid: p1.userId,
          opponentUid: p2.userId,
          hostName: p1.profile.displayName || 'Cadet 1',
          hostAvatar: p1Avatar.url,
          opponentName: p2.profile.displayName || 'Cadet 2',
          opponentAvatar: p2Avatar.url,
          subject: 'Quantitative Aptitude',
          battleType: normalizedCategory,
          questionIds: questions.map(q => q.id),
          questionOrder: questions.map((q, idx) => ({ index: idx, id: q.id, topic: q.topic })),
          settings: {
            questionsCount: questions.length,
            difficulty: 'Medium',
            timeLimit,
            isPrivate: false,
            topic: 'Mixed Aptitude (Top 5)'
          },
          status: 'in-progress',
          createdAt: new Date(now).toISOString(),
          startedAt: new Date(now).toISOString(),
          expirationTime: new Date(now + 60 * 60 * 1000).toISOString()
        });
      }
    } catch (roomErr: any) {
      logger.warn('Non-fatal: failed to persist Quick Match room metadata in Firestore', { battleId, error: roomErr.message });
    }

    // Notify sockets with their respective player-shuffled question packages
    if (this.io) {
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
    }

    // Setup Authoritative Server Timer
    this.startAuthoritativeTimer(battleId, battleDurationMs);
    logger.info('BATTLE_READY', { battleId, p1: p1.userId, p2: p2.userId });
    logger.info('BATTLE_STARTED', { battleId, p1: p1.userId, p2: p2.userId });
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
    data: { battleId: string; questionIndex: number; selectedOption: number; responseTimeMs?: number }
  ) {
    const userId = socket.data.userId;
    if (!userId || !data?.battleId) {
      socket.emit('battle_error', { message: 'Unauthorized submission' });
      return;
    }

    const result = await this.evaluatePlayerAnswer(userId, data, socket);
    if (!result.ok) {
      socket.emit('battle_error', { message: result.error });
    }
  }

  /**
   * Authoritative, concurrency-safe answer evaluation shared by Socket.IO and REST fallback.
   */
  public static async evaluatePlayerAnswer(
    userId: string,
    data: { battleId: string; questionIndex: number; selectedOption: number; responseTimeMs?: number },
    replySocket?: Socket
  ): Promise<{ ok: true; evaluation: any } | { ok: false; status: number; error: string }> {
    logger.info('ANSWER_ENDPOINT_REACHED', { userId, battleId: data?.battleId, questionIndex: data?.questionIndex });

    if (!userId || !data?.battleId) {
      return { ok: false, status: 400, error: 'Missing battleId or authenticated user.' };
    }

    let shouldConclude = false;
    let outcome: { ok: true; evaluation: any } | { ok: false; status: number; error: string } = {
      ok: false,
      status: 500,
      error: 'Evaluation failed.'
    };

    await this.withBattleLock(data.battleId, async () => {
      const battle = await this.getBattle(data.battleId);
      if (!battle) {
        logger.warn('SESSION_VALIDATION_FAILED', { userId, battleId: data.battleId, reason: 'not_found' });
        outcome = { ok: false, status: 404, error: 'Battle session not found or expired.' };
        return;
      }

      if (battle.status !== 'ACTIVE' || battle.concluded) {
        logger.warn('SESSION_VALIDATION_FAILED', { userId, battleId: data.battleId, reason: battle.status });
        outcome = { ok: false, status: 409, error: 'Battle is no longer active.' };
        return;
      }

      const player = battle.players[userId];
      if (!player) {
        logger.warn('SESSION_VALIDATION_FAILED', { userId, battleId: data.battleId, reason: 'not_enrolled' });
        outcome = { ok: false, status: 403, error: 'Player not enrolled in this battle.' };
        return;
      }

      const qIndex = data.questionIndex;
      if (typeof qIndex !== 'number' || qIndex < 0 || qIndex >= battle.questions.length) {
        logger.warn('SESSION_VALIDATION_FAILED', { userId, battleId: data.battleId, reason: 'invalid_question_index', qIndex });
        outcome = { ok: false, status: 400, error: 'Invalid question index.' };
        return;
      }

      logger.info('SESSION_VALIDATION_OK', { userId, battleId: data.battleId, qIndex });

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
        const cachedPayload = {
          questionIndex: qIndex,
          selectedOption: prevSub.selectedOption,
          isCorrect: prevSub.isCorrect,
          score: player.score,
          pointsAwarded: prevSub.points,
          explanation: authoritativeQuestion.explanation || '',
          correctOption: displayedCorrectOption !== -1 ? displayedCorrectOption : authoritativeQuestion.correctOption,
          nextQuestionIndex: player.progressIndex,
          totalQuestions: battle.totalQuestions
        };
        if (replySocket) replySocket.emit('answer_evaluated', cachedPayload);
        outcome = { ok: true, evaluation: cachedPayload };
        return;
      }

      const isTimeout = data.selectedOption === -1;
      const originalSelectedOption = isTimeout
        ? -1
        : (mapping && Array.isArray(mapping) && typeof mapping[data.selectedOption] === 'number'
          ? mapping[data.selectedOption]
          : data.selectedOption);

      const isCorrect = !isTimeout && originalSelectedOption === authoritativeQuestion.correctOption;

      const timeLimitMs = (battle.timeLimitPerQuestion || 30) * 1000;
      const safeResponseMs = typeof data.responseTimeMs === 'number' && data.responseTimeMs > 0
        ? Math.min(timeLimitMs, Math.max(100, data.responseTimeMs))
        : 5000;

      const scoreResult = ScoreCalculator.calculateQuestionScore({
        correct: isCorrect,
        responseTimeMs: safeResponseMs,
        timeLimitMs,
        difficulty: 'Medium'
      });

      const pointsAwarded = scoreResult.pointsAwarded;

      player.score += pointsAwarded;
      player.progressIndex = Math.max(player.progressIndex || 0, qIndex + 1);
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
      logger.info('DATABASE_WRITE_OK', { battleId: data.battleId, userId, score: player.score, progressIndex: player.progressIndex });

      const evaluationPayload = {
        questionIndex: qIndex,
        selectedOption: data.selectedOption,
        isCorrect,
        score: player.score,
        pointsAwarded,
        explanation: authoritativeQuestion.explanation || '',
        correctOption: displayedCorrectOption !== -1 ? displayedCorrectOption : authoritativeQuestion.correctOption,
        nextQuestionIndex: player.progressIndex,
        totalQuestions: battle.totalQuestions
      };

      if (replySocket) {
        replySocket.emit('answer_evaluated', evaluationPayload);
      }

      // Broadcast synchronized progress ONLY to opponent
      const stepPayload = {
        uid: userId,
        score: player.score,
        progressIndex: player.progressIndex,
        finished: player.finished
      };
      if (replySocket && typeof replySocket.to === 'function') {
        replySocket.to(data.battleId).emit('step_update', stepPayload);
      } else if (this.io) {
        this.io.of('/battle').to(data.battleId).emit('step_update', stepPayload);
      }

      shouldConclude = Object.values(battle.players).every(p => p.finished);
      outcome = { ok: true, evaluation: evaluationPayload };
      logger.info('RESPONSE_RETURNED', { battleId: data.battleId, userId, qIndex, nextQuestionIndex: player.progressIndex });
    });

    if (shouldConclude) {
      logger.info('All players completed questions. Concluding match immediately.', { battleId: data.battleId });
      await this.concludeBattle(data.battleId, 'all_players_finished');
    }

    return outcome;
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
          battleRating: userData.battleRating || GAME_CONFIG.elo.startingRating || 1000,
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
      const topic = roomData.settings?.topic || undefined;

      let questions: Question[] = [];
      try {
        questions = await QuestionService.selectBattleQuestions(category, questionsCount, difficulty, topic);
      } catch (err: any) {
        logger.error('Failed to select battle questions for custom room', { roomId, error: err.message });
        socket.emit('battle_error', { message: err.message || 'Failed to select battle questions.' });
        return;
      }
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

      await Promise.all(uids.map(uid => this.setActiveBattleLock(uid, roomId)));
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

          // Persist synchronized Assessment History entries for both players
          const completedAt = new Date().toISOString();
          await Promise.all([
            AssessmentHistoryService.recordCompletedAssessment({
              assessmentId: battleId,
              userId: p1.userId,
              type: 'battle',
              title: `1v1 Battle vs ${p2.displayName || 'Peer Candidate'}`,
              category: battle.battleType,
              topic: '1v1 Competitive',
              difficulty: 'Medium',
              totalQuestions: battle.totalQuestions,
              correctAnswers: Object.values(p1.submissions || {}).filter((s: any) => s.isCorrect).length,
              incorrectAnswers: battle.totalQuestions - Object.values(p1.submissions || {}).filter((s: any) => s.isCorrect).length,
              accuracy: battle.totalQuestions > 0 ? Math.round((Object.values(p1.submissions || {}).filter((s: any) => s.isCorrect).length / battle.totalQuestions) * 100) : 0,
              score: resultPackage.playerA.score,
              xpEarned: resultPackage.playerA.xp.earned,
              completedAt,
              durationSeconds: Math.round((Date.now() - (battle.battleStartedAt || battle.createdAt || Date.now())) / 1000),
              opponentName: p2.displayName || 'Peer Candidate',
              opponentAvatar: p2.photoURL || '',
              opponentScore: resultPackage.playerB.score,
              winnerId: resultPackage.winnerId,
              isDraw: resultPackage.isDraw,
              eloChange: resultPackage.playerA.elo.change
            }),
            AssessmentHistoryService.recordCompletedAssessment({
              assessmentId: battleId,
              userId: p2.userId,
              type: 'battle',
              title: `1v1 Battle vs ${p1.displayName || 'Peer Candidate'}`,
              category: battle.battleType,
              topic: '1v1 Competitive',
              difficulty: 'Medium',
              totalQuestions: battle.totalQuestions,
              correctAnswers: Object.values(p2.submissions || {}).filter((s: any) => s.isCorrect).length,
              incorrectAnswers: battle.totalQuestions - Object.values(p2.submissions || {}).filter((s: any) => s.isCorrect).length,
              accuracy: battle.totalQuestions > 0 ? Math.round((Object.values(p2.submissions || {}).filter((s: any) => s.isCorrect).length / battle.totalQuestions) * 100) : 0,
              score: resultPackage.playerB.score,
              xpEarned: resultPackage.playerB.xp.earned,
              completedAt,
              durationSeconds: Math.round((Date.now() - (battle.battleStartedAt || battle.createdAt || Date.now())) / 1000),
              opponentName: p1.displayName || 'Peer Candidate',
              opponentAvatar: p1.photoURL || '',
              opponentScore: resultPackage.playerA.score,
              winnerId: resultPackage.winnerId,
              isDraw: resultPackage.isDraw,
              eloChange: resultPackage.playerB.elo.change
            })
          ]);
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

      // 5. Direct Socket Dispatches & Room Fallback
      if (this.io) {
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
      }

      logger.info('Battle finalization broadcast completed', { battleId, winnerId: resultPackage.winnerId });
    } finally {
      // Release per-player active battle locks upon battle conclusion
      try {
        const finalBattle = await this.getBattle(battleId);
        if (finalBattle?.players) {
          await Promise.all(Object.keys(finalBattle.players).map(uid => this.clearActiveBattleLock(uid)));
        }
      } catch {
        // Non-fatal
      }
      this.concludingBattles.delete(battleId);
    }
  }

  /**
   * Cleanup expired temporary matchmaking queue tickets & expired/completed temporary battle rooms.
   * Preserves permanent battleHistory and user statistics.
   */
  public static async cleanupExpiredMatchmakingAndRooms(): Promise<{ prunedQueueTickets: number; cleanedRooms: number }> {
    let prunedQueueTickets = 0;
    let cleanedRooms = 0;

    // 1. Prune expired queue tickets
    const category = 'quantitative_aptitude';
    const queueKey = this.getMatchmakingQueueKey(category);
    try {
      const rawQueue = await redisClient.smembers(queueKey);
      const now = Date.now();
      for (const raw of rawQueue) {
        try {
          const item = JSON.parse(raw);
          if (!item?.userId || now - (item.joinedAt || 0) > this.QUEUE_TICKET_TTL_MS) {
            await redisClient.srem(queueKey, raw);
            prunedQueueTickets++;
          }
        } catch {
          await redisClient.srem(queueKey, raw);
          prunedQueueTickets++;
        }
      }
    } catch {
      // Ignore Redis errors
    }

    // 2. Clean up expired or old completed temporary battleRooms (24h retention for completed rooms)
    try {
      if (db) {
        const snap = await db.collection('battleRooms').get();
        const nowMs = Date.now();
        const retentionMs = 24 * 60 * 60 * 1000;
        for (const doc of snap.docs) {
          const d = doc.data() || {};
          const expMs = d.expirationTime ? new Date(d.expirationTime).getTime() : 0;
          const completedMs = d.completedAt ? new Date(d.completedAt).getTime() : 0;
          const isExpiredWaiting = (d.status === 'waiting' || d.status === 'expired') && expMs > 0 && expMs <= nowMs;
          const isOldCompleted = d.status === 'completed' && completedMs > 0 && (nowMs - completedMs > retentionMs);
          if (isExpiredWaiting || isOldCompleted) {
            await db.collection('battleRooms').doc(doc.id).delete();
            cleanedRooms++;
          }
        }
      }
    } catch (err: any) {
      logger.warn('Failed to cleanup temporary battleRooms', { error: err.message });
    }

    return { prunedQueueTickets, cleanedRooms };
  }
}

export default BattleEngine;
