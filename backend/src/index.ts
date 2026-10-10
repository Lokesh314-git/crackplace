import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import dotenv from 'dotenv';
import { verifyToken, AuthenticatedRequest, socketAuthMiddleware } from './middleware/auth';
import { standardApiLimiter, strictAuthLimiter, aiLimiter, socketRateLimit } from './middleware/rateLimiter';
import { db } from './config/firebase';
import { redisClient, pubClient, subClient, isRedisAvailable } from './config/redis';
import { BattleEngine } from './services/BattleEngine';
import { QuestionService } from './services/QuestionService';
import { AIService } from './services/AIService';
import { 
  getXpRequiredForLevel, 
  calculateLevelFromXp, 
  calculateLevelFromXP,
  calculateLevelProgress,
  LevelCalculator,
  syncMissionsState, 
  checkAndUnlockAchievements,
  rollLuckySpin,
  openMysteryBoxLoot,
  calculateElo,
  processMissionProgress
} from './utils/gamification';
import { XpTransactionService } from './services/XpTransactionService';
import { COSMETICS_CATALOG, checkIsLegendaryPlayer } from './utils/cosmetics';
import { resolveUserAvatar, getAvatarImageUrl, getUserAvatarUrl } from './utils/avatarResolver';
import quizRouter from './routes/quiz';
import codingRouter from './routes/coding';
import interviewRouter from './routes/interview';
import studyRouter from './routes/study';
import invitePromoteRouter from './routes/invitePromote';
import logger from './utils/logger';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '*')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Enable CORS
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(standardApiLimiter);

import { adminUsersRouter } from './routes/adminUsers';
import { adminQuestionsRouter } from './routes/adminQuestions';

// Mount Modular Routers
app.use('/api/quiz', quizRouter);
app.use('/api/coding', codingRouter);
app.use('/api/interview', interviewRouter);
app.use('/api/study', studyRouter);
app.use('/api/invite-promote', invitePromoteRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/admin/questions', adminQuestionsRouter);

// ----------------------------------------------------
// Health & Readiness Probes (Phase 21 & 47)
// ----------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString() 
  });
});

app.get('/ready', async (req, res) => {
  const dependencies: { [key: string]: string } = {};
  let isReady = true;

  // 1. Check Redis
  try {
    const ping = await redisClient.ping();
    dependencies.redis = ping === 'PONG' ? 'UP' : 'DEGRADED';
  } catch {
    dependencies.redis = isRedisAvailable ? 'DOWN' : 'MOCK_ACTIVE';
  }

  // 2. Check Database / Firebase
  try {
    await db.collection('questions').limit(1).get();
    dependencies.database = 'UP';
  } catch {
    dependencies.database = 'DEGRADED';
  }

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'READY' : 'NOT_READY',
    dependencies,
    timestamp: new Date().toISOString()
  });
});

// ----------------------------------------------------
// Core Auth & Profile Verification
// ----------------------------------------------------
app.post('/api/auth/verify', strictAuthLimiter, verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const userDocRef = db.collection('users').doc(req.user.uid);
  
  try {
    const tzOffset = 5.5 * 60 * 60 * 1000; // IST Timezone (UTC+5:30)
    const todayStr = new Date(Date.now() + tzOffset).toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() + tzOffset - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    let loginRewardClaimed: any = null;
    let leveledUp = false;
    let oldLevel = 1;
    let newLevel = 1;
    let newlyUnlockedAchievements: any[] = [];

    await db.runTransaction(async (transaction: any) => {
      const userDoc = await transaction.get(userDocRef);
      let userData: any;
      
      if (!userDoc.exists) {
        const defaultResolved = resolveUserAvatar({ uid: req.user!.uid });
        userData = {
          uid: req.user!.uid,
          email: req.user!.email || 'student@crackplace.ai',
          displayName: req.user!.name || 'Anonymous',
          photoURL: defaultResolved.url,
          equippedAvatar: defaultResolved.id,
          unlockedAvatars: [defaultResolved.id],
          role: 'student',
          college: '',
          department: '',
          year: 1,
          dreamCompany: '',
          skills: [],
          bio: '',
          xp: 0,
          coins: 100,
          level: 1,
          battleRating: 1000,
          dailyStreak: 0,
          longestStreak: 0,
          lastActiveDate: '',
          lastLoginRewardClaimedDate: '',
          loginStreakCount: 0,
          stats: {
            totalQuestionsSolved: 0,
            totalBattlesWon: 0,
            totalMockTests: 0
          },
          unlockedAchievements: [],
          missionsState: syncMissionsState({}, new Date()),
          createdAt: new Date().toISOString()
        };
        transaction.set(userDocRef, userData);
      } else {
        userData = userDoc.data();
      }
      
      const lastActiveDate = userData.lastActiveDate || '';
      const lastLoginRewardClaimedDate = userData.lastLoginRewardClaimedDate || '';
      let loginStreakCount = userData.loginStreakCount || 0;
      let xp = userData.xp || 0;
      let coins = userData.coins || 0;
      oldLevel = userData.level || 1;
      
      let updatedFields: any = {};

      // Ensure backwards compatibility and auto-recovery for existing users missing avatar data
      if (!userData.unlockedAvatars || !Array.isArray(userData.unlockedAvatars) || userData.unlockedAvatars.length === 0) {
        userData.unlockedAvatars = ['avatar_starter'];
        updatedFields.unlockedAvatars = ['avatar_starter'];
      }
      if (!userData.equippedAvatar) {
        const resolved = resolveUserAvatar(userData);
        userData.equippedAvatar = resolved.id;
        userData.photoURL = resolved.url;
        updatedFields.equippedAvatar = resolved.id;
        updatedFields.photoURL = resolved.url;
      }
      
      // Sync missions state
      const currentMissions = userData.missionsState || {};
      const missionsState = syncMissionsState(currentMissions, new Date());
      updatedFields.missionsState = missionsState;
      
      // 1. Reset streak count if missed a learning day
      if (lastActiveDate && lastActiveDate !== yesterdayStr && lastActiveDate !== todayStr) {
        updatedFields.dailyStreak = 0;
      }
      
      // 2. Claim daily login reward if not claimed today
      if (lastLoginRewardClaimedDate !== todayStr) {
        if (lastLoginRewardClaimedDate === yesterdayStr) {
          loginStreakCount = (loginStreakCount % 7) + 1;
        } else {
          loginStreakCount = 1;
        }
        
        let rewardXp = 5;
        let rewardCoins = 2;
        if (loginStreakCount === 7) {
          rewardXp = 100;
          rewardCoins = 50;
        }
        
        const loginEval = LevelCalculator.evaluateXpReward({
          currentXp: xp,
          xpEarned: rewardXp,
          userId: req.user!.uid,
          source: 'daily_login',
          referenceId: `daily_${todayStr}`
        });

        xp = loginEval.xpAfter;
        coins += rewardCoins;
        newLevel = loginEval.levelAfter;
        
        updatedFields.xp = xp;
        updatedFields.totalXp = xp;
        updatedFields.coins = coins;
        updatedFields.level = newLevel;
        updatedFields.lastLoginRewardClaimedDate = todayStr;
        updatedFields.loginStreakCount = loginStreakCount;
        
        if (loginEval.leveledUp) {
          leveledUp = true;
        }
        
        loginRewardClaimed = {
          day: loginStreakCount,
          xp: rewardXp,
          coins: rewardCoins
        };

        // Record daily login XP transaction in batch
        const loginTxKey = `daily_login_daily_${todayStr}_${req.user!.uid}`;
        transaction.set(db.collection('xpTransactions').doc(loginTxKey), loginEval.transaction);
      }
      
      // 3. Process achievements
      const userStatsObj = {
        xp,
        totalXp: xp,
        coins,
        level: newLevel,
        dailyStreak: userData.dailyStreak || 0,
        longestStreak: userData.longestStreak || 0,
        placementReadinessScore: Number(userData.placementReadinessScore || 0),
        stats: userData.stats || {},
        unlockedAchievements: userData.unlockedAchievements || []
      };
      
      const achDetails = checkAndUnlockAchievements(userStatsObj);
      if (achDetails.newlyUnlocked.length > 0) {
        coins += achDetails.coinsGranted;
        
        const achEval = LevelCalculator.evaluateXpReward({
          currentXp: xp,
          xpEarned: achDetails.xpGranted,
          userId: req.user!.uid,
          source: 'achievement',
          referenceId: `ach_verify_${Date.now()}`
        });

        xp = achEval.xpAfter;
        newLevel = achEval.levelAfter;
        if (achEval.levelAfter > oldLevel) {
          leveledUp = true;
        }
        
        updatedFields.xp = xp;
        updatedFields.totalXp = xp;
        updatedFields.coins = coins;
        updatedFields.level = newLevel;
        updatedFields.unlockedAchievements = achDetails.unlockedList;
        newlyUnlockedAchievements = achDetails.newlyUnlocked;

        // Record achievement XP transaction in batch
        const achTxKey = `achievement_verify_${Date.now()}_${req.user!.uid}`;
        transaction.set(db.collection('xpTransactions').doc(achTxKey), achEval.transaction);
      }
      
      if (Object.keys(updatedFields).length > 0) {
        transaction.update(userDocRef, updatedFields);
      }
    });
    
    // Create notifications for level up / reward outside transaction
    if (leveledUp) {
      const notifRef = db.collection('notifications').doc();
      await notifRef.set({
        userId: req.user.uid,
        type: 'level_up',
        title: 'Level Up! 🎉',
        message: `Congratulations! You leveled up to Level ${newLevel}!`,
        createdAt: new Date().toISOString(),
        read: false
      });
    }

    if (loginRewardClaimed) {
      const notifRef = db.collection('notifications').doc();
      await notifRef.set({
        userId: req.user.uid,
        type: 'login_reward',
        title: `Day ${loginRewardClaimed.day} Reward Claimed! 🪙`,
        message: `Awarded +${loginRewardClaimed.xp} XP and +${loginRewardClaimed.coins} Coins!`,
        createdAt: new Date().toISOString(),
        read: false
      });
    }

    const freshUserDoc = await userDocRef.get();
    res.json({ 
      message: 'Authentication valid', 
      profile: freshUserDoc.data(),
      loginRewardClaimed
    });
  } catch (error) {
    logger.error('Error fetching user profile in verify route', { error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------------------------------------------
// Server-Authoritative Leaderboard (Global & Weekly Sprint)
// ----------------------------------------------------
app.get('/api/leaderboard', verifyToken, async (req: AuthenticatedRequest, res) => {
  const rankingType = req.query.type === 'weekly' ? 'weekly' : 'global';
  const limitCount = Math.min(100, Math.max(1, Number(req.query.limit) || 100));
  const cacheKey = `leaderboard:${rankingType}:${limitCount}`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
  } catch (err) {
    // Ignore redis read error and fallback to live authoritative DB query
  }

  try {
    const snapshot = await db.collection('users').get();
    const userMap = new Map<string, any>();

    snapshot.forEach((doc: any) => {
      const data = doc.data();
      const uid = doc.id;

      // Filter out test fixtures, demo accounts, and bots
      if (
        data.isTest ||
        data.isDemo ||
        data.environment === 'test' ||
        uid.startsWith('user_test_') ||
        uid.startsWith('user_host_') ||
        uid.startsWith('user_guest_') ||
        uid.startsWith('user_third_')
      ) {
        return;
      }

      const rawXp = Number(data.xp ?? data.totalXp ?? 0);
      const computedLevel = calculateLevelFromXP(rawXp);
      const battleRating = Number(data.battleRating ?? data.eloRating ?? 1200);

      const resolvedAvatar = resolveUserAvatar(data);

      userMap.set(uid, {
        uid,
        displayName: data.displayName || 'Cadet',
        photoURL: resolvedAvatar.url,
        equippedAvatar: resolvedAvatar.id,
        level: computedLevel,
        battleRating,
        xp: rawXp,
        totalXp: rawXp,
        weeklyXp: 0,
        equippedRing: data.equippedRing || null,
        equippedFrame: data.equippedFrame || null,
        equippedTitle: data.equippedTitle || null,
        college: data.college || null,
        isLegendaryPlayer: checkIsLegendaryPlayer({ ...data, equippedAvatar: data.equippedAvatar || resolvedAvatar.id })
      });
    });

    // If Weekly Sprint ranking is requested, compute weekly earned XP from transactions
    if (rankingType === 'weekly' && userMap.size > 0) {
      const now = new Date();
      const day = now.getUTCDay(); // 0 is Sunday, 1 is Monday
      const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff, 0, 0, 0, 0));
      const startOfWeekIso = startOfWeek.toISOString();

      try {
        const txSnap = await db.collection('xpTransactions')
          .where('createdAt', '>=', startOfWeekIso)
          .get();

        if (txSnap && !txSnap.empty) {
          txSnap.forEach((txDoc: any) => {
            const txData = txDoc.data();
            const u = userMap.get(txData.userId);
            if (u) {
              u.weeklyXp = (u.weeklyXp || 0) + Number(txData.xpEarned || 0);
            }
          });
        }
      } catch (txErr) {
        logger.warn('Weekly XP transactions query failed, falling back to profile XP sort', { error: String(txErr) });
      }
    }

    const rankList = Array.from(userMap.values());

    // Deterministic sorting rules
    if (rankingType === 'weekly') {
      rankList.sort((a, b) => {
        if (b.weeklyXp !== a.weeklyXp) return (b.weeklyXp || 0) - (a.weeklyXp || 0);
        if (b.battleRating !== a.battleRating) return b.battleRating - a.battleRating;
        if (b.xp !== a.xp) return b.xp - a.xp;
        return a.uid.localeCompare(b.uid);
      });
    } else {
      rankList.sort((a, b) => {
        if (b.battleRating !== a.battleRating) return b.battleRating - a.battleRating;
        if (b.xp !== a.xp) return b.xp - a.xp;
        return a.uid.localeCompare(b.uid);
      });
    }

    // Attach 1-based rank dynamically
    const rankedUsers = rankList.slice(0, limitCount).map((user, idx) => ({
      ...user,
      rank: idx + 1
    }));

    // Cache results in Redis for 60 seconds
    try {
      await redisClient.set(cacheKey, JSON.stringify(rankedUsers), 'EX', 60);
    } catch {
      // Safe ignore
    }

    return res.json(rankedUsers);
  } catch (error: any) {
    logger.error('Failed to load authoritative leaderboard rankings', { error: error.message });
    return res.status(500).json({ error: 'Unable to load rankings. Please try again.', code: 'LEADERBOARD_ERROR' });
  }
});

// ----------------------------------------------------
// Public Profile Route
// ----------------------------------------------------
app.get('/api/profile/:uid/public', verifyToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { uid } = req.params;
    if (!uid) {
      return res.status(400).json({ error: 'UID is required' });
    }

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const data = userDoc.data() || {};
    const rawXp = Number(data.xp || 0);
    const computedLevel = calculateLevelFromXP(rawXp);
    const battleRating = Number(data.battleRating ?? data.eloRating ?? 1200);
    const resolvedAvatar = resolveUserAvatar(data);

    const publicProfile = {
      uid,
      displayName: data.displayName || 'Anonymous',
      photoURL: resolvedAvatar.url,
      equippedAvatar: resolvedAvatar.id,
      level: computedLevel,
      xp: rawXp,
      battleRating,
      dailyStreak: Number(data.dailyStreak || 0),
      placementReadinessScore: Number(data.placementReadinessScore || 0),
      dreamCompany: data.dreamCompany || '',
      college: data.college || '',
      coins: Number(data.coins || 0),
      isLegendaryPlayer: checkIsLegendaryPlayer({ ...data, equippedAvatar: data.equippedAvatar || resolvedAvatar.id })
    };

    return res.json(publicProfile);
  } catch (error: any) {
    logger.error('Failed to load public profile', { error: error.message });
    return res.status(500).json({ error: 'Unable to load profile.' });
  }
});


// ----------------------------------------------------
// Missions, Cosmetics & Store Routes
// ----------------------------------------------------
app.post('/api/auth/missions/claim', strictAuthLimiter, verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { missionId } = req.body;
  if (!missionId) return res.status(400).json({ error: 'missionId is required' });

  const userDocRef = db.collection('users').doc(req.user.uid);
  try {
    let claimedXp = 0;
    let claimedCoins = 0;
    let leveledUp = false;
    let newLevel = 1;

    await db.runTransaction(async (transaction: any) => {
      const userDoc = await transaction.get(userDocRef);
      if (!userDoc.exists) throw new Error('User profile not found');
      const userData = userDoc.data();
      const missionsState = { ...(userData.missionsState || {}) };
      
      let missionFound = false;
      const claimFromList = (list: any[]) => {
        if (!list) return [];
        return list.map(m => {
          if (m.id === missionId) {
            if (m.claimed) throw new Error('Mission reward already claimed');
            if (!m.completed) throw new Error('Mission not completed yet');
            m.claimed = true;
            claimedXp = m.xpReward;
            claimedCoins = m.coinReward;
            missionFound = true;
          }
          return m;
        });
      };

      missionsState.dailyMissions = claimFromList(missionsState.dailyMissions);
      missionsState.weeklyMissions = claimFromList(missionsState.weeklyMissions);
      missionsState.monthlyMissions = claimFromList(missionsState.monthlyMissions);

      if (!missionFound) throw new Error('Mission not found');

      const oldXp = Number(userData.xp ?? userData.totalXp ?? 0);
      const missionEval = LevelCalculator.evaluateXpReward({
        currentXp: oldXp,
        xpEarned: claimedXp,
        userId: req.user!.uid,
        source: 'mission',
        referenceId: missionId
      });

      const currentCoins = (userData.coins || 0) + claimedCoins;
      newLevel = missionEval.levelAfter;
      if (missionEval.leveledUp) leveledUp = true;

      // Record mission XP transaction in batch
      const missionTxKey = `mission_${missionId}_${req.user!.uid}`;
      transaction.set(db.collection('xpTransactions').doc(missionTxKey), missionEval.transaction);

      transaction.update(userDocRef, {
        xp: missionEval.xpAfter,
        totalXp: missionEval.xpAfter,
        coins: currentCoins,
        level: missionEval.levelAfter,
        missionsState
      });
    });

    const freshUserDoc = await userDocRef.get();
    res.json({
      message: 'Mission claimed successfully',
      claimedXp,
      claimedCoins,
      profile: freshUserDoc.data()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to claim mission.' });
  }
});

app.post('/api/auth/store/buy', strictAuthLimiter, verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { itemId } = req.body;
  if (!itemId) return res.status(400).json({ error: 'itemId is required' });

  const item = COSMETICS_CATALOG.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  if (item.isFree || item.cost === 0) {
    return res.status(400).json({ error: 'Free items do not need to be purchased' });
  }

  const userDocRef = db.collection('users').doc(req.user.uid);
  try {
    let alreadyOwned = false;
    await db.runTransaction(async (transaction: any) => {
      const userDoc = await transaction.get(userDocRef);
      if (!userDoc.exists) throw new Error('Profile not found');
      const userData = userDoc.data()!;

      let fieldName = '';
      if (item.category === 'avatar') fieldName = 'unlockedAvatars';
      else if (item.category === 'ring') fieldName = 'unlockedRings';
      else if (item.category === 'frame') fieldName = 'unlockedFrames';
      else if (item.category === 'background') fieldName = 'unlockedBackgrounds';
      else if (item.category === 'title') fieldName = 'unlockedTitles';
      else if (item.category === 'theme') fieldName = 'unlockedThemes';
      else if (item.category === 'emote') fieldName = 'unlockedEmotes';
      else if (item.category === 'sticker') fieldName = 'unlockedStickers';

      const unlockedList = userData[fieldName] || [];
      if (unlockedList.includes(item.id)) {
        alreadyOwned = true;
        throw new Error('Item already purchased');
      }

      const coins = userData.coins || 0;
      if (coins < item.cost) throw new Error('Insufficient coins balance');

      transaction.update(userDocRef, {
        coins: coins - item.cost,
        [fieldName]: [...unlockedList, item.id]
      });
    });

    const freshUserDoc = await userDocRef.get();
    res.json({ message: `Successfully purchased ${item.name}!`, profile: freshUserDoc.data() });
  } catch (error: any) {
    const status = (error.message === 'Item already purchased' || error.message === 'Insufficient coins balance') ? 400 : 500;
    res.status(status).json({ error: error.message || 'Purchase failed.' });
  }
});

app.post('/api/auth/profile/equip', verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { category, itemId } = req.body;
  if (!category || itemId === undefined) {
    return res.status(400).json({ error: 'category and itemId are required' });
  }

  const validCategories = ['avatar', 'ring', 'frame', 'background', 'title', 'theme', 'emote', 'entrance', 'victory'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid cosmetic category' });
  }

  const isUnequip = itemId === null || itemId === '';
  const userDocRef = db.collection('users').doc(req.user.uid);

  try {
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Profile not found' });
    const userData = userDoc.data()!;

    let equipField = '';
    let fieldName = '';
    if (category === 'avatar') { equipField = 'equippedAvatar'; fieldName = 'unlockedAvatars'; }
    else if (category === 'ring') { equipField = 'equippedRing'; fieldName = 'unlockedRings'; }
    else if (category === 'frame') { equipField = 'equippedFrame'; fieldName = 'unlockedFrames'; }
    else if (category === 'background') { equipField = 'equippedBackground'; fieldName = 'unlockedBackgrounds'; }
    else if (category === 'title') { equipField = 'equippedTitle'; fieldName = 'unlockedTitles'; }
    else if (category === 'theme') { equipField = 'equippedTheme'; fieldName = 'unlockedThemes'; }
    else if (category === 'emote') { equipField = 'equippedEmote'; fieldName = 'unlockedEmotes'; }
    else if (category === 'entrance') { equipField = 'equippedEntrance'; fieldName = 'unlockedEntrances'; }
    else if (category === 'victory') { equipField = 'equippedVictory'; fieldName = 'unlockedVictories'; }

    const updates: any = {};

    if (category === 'avatar') {
      if (isUnequip) {
        const resolved = resolveUserAvatar({ ...userData, equippedAvatar: null });
        updates.equippedAvatar = resolved.id;
        updates.photoURL = resolved.url;
      } else {
        const item = COSMETICS_CATALOG.find(i => i.id === itemId && i.category === 'avatar');
        if (!item) {
          return res.status(404).json({ error: 'Avatar not found in catalog' });
        }
        const isFree = item.isFree === true || item.cost === 0;
        const ownedList = userData.unlockedAvatars || [];
        if (!isFree && !ownedList.includes(item.id)) {
          return res.status(403).json({ error: 'You do not own this avatar' });
        }
        updates.equippedAvatar = item.id;
        updates.photoURL = getAvatarImageUrl(item.visual, item.visual);
      }
    } else {
      if (isUnequip) {
        updates[equipField] = null;
      } else {
        const item = COSMETICS_CATALOG.find(i => i.id === itemId && i.category === category);
        if (!item) {
          return res.status(404).json({ error: 'Item not found in catalog' });
        }
        const isFree = item.isFree === true || item.cost === 0;
        const ownedList = userData[fieldName] || [];
        if (!isFree && !ownedList.includes(item.id)) {
          return res.status(403).json({ error: 'You do not own this item' });
        }
        updates[equipField] = item.id;
      }
    }

    await userDocRef.update(updates);
    const freshUserDoc = await userDocRef.get();
    res.json({ message: isUnequip ? 'Cosmetic unequipped.' : 'Cosmetic equipped!', profile: freshUserDoc.data() });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Equip failed.' });
  }
});

app.post('/api/auth/profile/update', verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const userDocRef = db.collection('users').doc(req.user.uid);

  try {
    const {
      displayName,
      username,
      bio,
      college,
      degree,
      department,
      year,
      graduationYear,
      semester,
      careerGoal,
      dreamCompany,
      preferredRole,
      country,
      state,
      city,
      linkedin,
      github,
      portfolio,
      leetcode,
      hackerrank,
      codeforces
    } = req.body;

    const updates: any = { updatedAt: new Date().toISOString() };

    if (displayName !== undefined && displayName !== null) {
      updates.displayName = String(displayName).slice(0, 50).trim();
    }
    if (username !== undefined && username !== null) {
      const cleanUser = String(username).slice(0, 30).trim();
      updates.username = cleanUser;
      updates.usernameLower = cleanUser.toLowerCase();
    }
    if (bio !== undefined && bio !== null) {
      updates.bio = String(bio).slice(0, 200).trim();
    }
    if (college !== undefined && college !== null) {
      updates.college = String(college).slice(0, 100).trim();
    }
    if (degree !== undefined && degree !== null) {
      updates.degree = String(degree).slice(0, 100).trim();
    }
    if (department !== undefined && department !== null) {
      updates.department = String(department).slice(0, 100).trim();
    }
    if (year !== undefined && year !== null) {
      updates.year = Number(year) || 1;
    }
    if (graduationYear !== undefined && graduationYear !== null) {
      updates.graduationYear = String(graduationYear).slice(0, 20).trim();
    }
    if (semester !== undefined && semester !== null) {
      updates.semester = String(semester).slice(0, 20).trim();
    }
    if (careerGoal !== undefined && careerGoal !== null) {
      updates.careerGoal = String(careerGoal).slice(0, 100).trim();
    }
    if (dreamCompany !== undefined && dreamCompany !== null) {
      updates.dreamCompany = String(dreamCompany).slice(0, 100).trim();
    }
    if (preferredRole !== undefined && preferredRole !== null) {
      updates.preferredRole = String(preferredRole).slice(0, 100).trim();
    }
    if (country !== undefined && country !== null) {
      updates.country = String(country).slice(0, 50).trim();
    }
    if (state !== undefined && state !== null) {
      updates.state = String(state).slice(0, 50).trim();
    }
    if (city !== undefined && city !== null) {
      updates.city = String(city).slice(0, 50).trim();
    }
    if (linkedin !== undefined && linkedin !== null) {
      updates.linkedin = String(linkedin).slice(0, 150).trim();
    }
    if (github !== undefined && github !== null) {
      updates.github = String(github).slice(0, 150).trim();
    }
    if (portfolio !== undefined && portfolio !== null) {
      updates.portfolio = String(portfolio).slice(0, 150).trim();
    }
    if (leetcode !== undefined && leetcode !== null) {
      updates.leetcode = String(leetcode).slice(0, 50).trim();
    }
    if (hackerrank !== undefined && hackerrank !== null) {
      updates.hackerrank = String(hackerrank).slice(0, 50).trim();
    }
    if (codeforces !== undefined && codeforces !== null) {
      updates.codeforces = String(codeforces).slice(0, 50).trim();
    }

    const userSnap = await userDocRef.get();
    const existingData = userSnap.exists ? (userSnap.data() || {}) : {};
    const mergedData = { ...existingData, ...updates };

    let xpRewardGranted = false;
    let leveledUp = false;
    let newLevel = mergedData.level || 1;

    // Check if user qualifies for +20 XP profile completion reward
    const hasAcademic = Boolean(mergedData.college && mergedData.degree && mergedData.department);
    const hasCareer = Boolean(mergedData.careerGoal || mergedData.dreamCompany || mergedData.preferredRole);
    const hasSocial = Boolean(mergedData.github || mergedData.linkedin || mergedData.portfolio);

    if (hasAcademic && hasCareer && hasSocial && !existingData.profileCompletedXPClaimed) {
      updates.profileCompletedXPClaimed = true;
      const currentXp = Number(existingData.xp ?? existingData.totalXp ?? 0);
      const evalRes = LevelCalculator.evaluateXpReward({
        currentXp,
        xpEarned: 20,
        userId: req.user.uid,
        source: 'achievement',
        referenceId: `profile_reward_${req.user.uid}`
      });

      updates.xp = evalRes.xpAfter;
      updates.totalXp = evalRes.xpAfter;
      updates.level = evalRes.levelAfter;
      xpRewardGranted = true;
      leveledUp = evalRes.leveledUp;
      newLevel = evalRes.levelAfter;

      await db.collection('xpTransactions').doc(`profile_reward_${req.user.uid}`).set(evalRes.transaction);
    }

    await userDocRef.set(updates, { merge: true });
    const freshUserDoc = await userDocRef.get();
    res.json({
      message: 'Profile updated successfully.',
      profile: freshUserDoc.data(),
      xpRewardGranted,
      leveledUp,
      newLevel
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update profile.' });
  }
});

app.post('/api/auth/lucky-spin', strictAuthLimiter, verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const userDocRef = db.collection('users').doc(req.user.uid);

  try {
    let sector: any;
    let spinEval: any;
    await db.runTransaction(async (transaction: any) => {
      const userDoc = await transaction.get(userDocRef);
      if (!userDoc.exists) throw new Error('Profile not found');
      const userData = userDoc.data()!;

      sector = rollLuckySpin();
      const oldXp = Number(userData.xp ?? userData.totalXp ?? 0);
      const earnedXp = sector.type === 'xp' ? sector.value : 0;

      spinEval = LevelCalculator.evaluateXpReward({
        currentXp: oldXp,
        xpEarned: earnedXp,
        userId: req.user!.uid,
        source: 'lucky_spin',
        referenceId: `spin_${Date.now()}`
      });

      let coins = (userData.coins || 0) + (sector.type === 'coins' ? sector.value : 0);
      let mysteryBoxes = (userData.mysteryBoxes || 0) + (sector.type === 'mystery_box' ? sector.value : 0);

      if (earnedXp > 0) {
        const spinTxKey = `lucky_spin_spin_${Date.now()}_${req.user!.uid}`;
        transaction.set(db.collection('xpTransactions').doc(spinTxKey), spinEval.transaction);
      }

      transaction.update(userDocRef, {
        xp: spinEval.xpAfter,
        totalXp: spinEval.xpAfter,
        coins,
        level: spinEval.levelAfter,
        mysteryBoxes
      });
    });

    const fresh = await userDocRef.get();
    res.json({ message: `You won: ${sector.label}`, sector, profile: fresh.data() });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Spin failed.' });
  }
});

app.post('/api/auth/mystery-box/open', strictAuthLimiter, verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const userDocRef = db.collection('users').doc(req.user.uid);

  try {
    let loot: any;
    let boxEval: any;
    await db.runTransaction(async (transaction: any) => {
      const userDoc = await transaction.get(userDocRef);
      if (!userDoc.exists) throw new Error('Profile not found');
      const userData = userDoc.data()!;
      if ((userData.mysteryBoxes || 0) < 1) throw new Error('No mystery boxes remaining.');

      loot = openMysteryBoxLoot();
      const oldXp = Number(userData.xp ?? userData.totalXp ?? 0);
      const earnedXp = loot.type === 'xp' ? loot.value : 0;

      boxEval = LevelCalculator.evaluateXpReward({
        currentXp: oldXp,
        xpEarned: earnedXp,
        userId: req.user!.uid,
        source: 'mystery_box',
        referenceId: `box_${Date.now()}`
      });

      let coins = (userData.coins || 0) + (loot.type === 'coins' ? loot.value : 0);
      const unlockedFrames = userData.unlockedFrames || [];
      if (loot.type === 'frame' && !unlockedFrames.includes(loot.value)) {
        unlockedFrames.push(loot.value);
      }

      if (earnedXp > 0) {
        const boxTxKey = `mystery_box_box_${Date.now()}_${req.user!.uid}`;
        transaction.set(db.collection('xpTransactions').doc(boxTxKey), boxEval.transaction);
      }

      transaction.update(userDocRef, {
        xp: boxEval.xpAfter,
        totalXp: boxEval.xpAfter,
        coins,
        level: boxEval.levelAfter,
        mysteryBoxes: userData.mysteryBoxes - 1,
        unlockedFrames
      });
    });

    const fresh = await userDocRef.get();
    res.json({ message: `Revealed: ${loot.label}`, loot, profile: fresh.data() });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Box opening failed.' });
  }
});

// ----------------------------------------------------
// XP & Level History / Audit Endpoints
// ----------------------------------------------------
app.get('/api/auth/xp/transactions', verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const transactions = await XpTransactionService.getUserTransactions(req.user.uid, 50);
    res.json({ transactions });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch XP transactions' });
  }
});

app.post('/api/auth/battle-room/create', strictAuthLimiter, verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  const { battleType, questionsCount, difficulty, timeLimit, isPrivate } = req.body;

  try {
    const validBattleTypes = ['Aptitude', 'DSA', 'DBMS', 'Operating Systems', 'Mixed', 'Technical', 'Reasoning', 'HR', 'Rapid Fire'];
    const sanitizedBattleType = validBattleTypes.includes(battleType) ? battleType : 'DSA';

    const validDifficulties = ['Easy', 'Medium', 'Hard', 'Mixed'];
    const sanitizedDifficulty = validDifficulties.includes(difficulty) ? difficulty : 'Medium';

    const count = Math.min(50, Math.max(3, Number(questionsCount) || 5));
    const limit = Math.min(120, Math.max(10, Number(timeLimit) || 30));

    const prefixes: { [key: string]: string } = {
      'Aptitude': 'APT', 'DSA': 'DSA', 'DBMS': 'DBM', 'Operating Systems': 'OPS', 'Mixed': 'MIX',
      'Technical': 'TEC', 'Reasoning': 'REA', 'HR': 'HRC', 'Rapid Fire': 'RAP'
    };
    const pfx = prefixes[sanitizedBattleType] || 'BAT';

    // Collision-safe room ID generation with retry loop
    let roomId = '';
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      const candidateId = `${pfx}-${rand}`;
      const existingDoc = await db.collection('battleRooms').doc(candidateId).get();
      if (!existingDoc.exists) {
        roomId = candidateId;
        break;
      }
      attempts++;
    }

    if (!roomId) {
      roomId = `${pfx}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    }

    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const userData = userDoc.exists ? userDoc.data()! : {};

    const now = new Date();
    const expiration = new Date(now.getTime() + 30 * 60 * 1000);

    const newRoom = {
      roomId,
      hostUid: req.user.uid,
      hostName: userData.displayName || 'Host Cadet',
      hostAvatar: userData.photoURL || '',
      battleType: sanitizedBattleType,
      settings: {
        questionsCount: count,
        difficulty: sanitizedDifficulty,
        timeLimit: limit,
        isPrivate: isPrivate === undefined ? true : !!isPrivate
      },
      status: 'waiting',
      createdTime: now.toISOString(),
      expirationTime: expiration.toISOString(),
      players: {
        [req.user.uid]: {
          uid: req.user.uid,
          displayName: userData.displayName || 'Host Cadet',
          photoURL: userData.photoURL || '',
          level: userData.level || 1,
          battleRating: userData.battleRating || 1200,
          ready: true,
          online: true,
          score: 0,
          progressIndex: 0,
          finished: false
        }
      }
    };

    await db.collection('battleRooms').doc(roomId).set(newRoom);
    res.json({ message: 'Battle room created', room: newRoom, roomId });
  } catch (error: any) {
    logger.error('Failed to create custom battle room', { error: error.message, userId: req.user?.uid });
    res.status(500).json({ error: error.message || 'Failed to create room.', code: 'SERVER_ERROR' });
  }
});

app.post('/api/auth/battle-room/join', strictAuthLimiter, verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });

  const rawCode = req.body.roomCode;
  if (!rawCode || typeof rawCode !== 'string') {
    return res.status(400).json({ error: 'Room code is required.', code: 'INVALID_ROOM_CODE' });
  }

  const roomCode = rawCode.trim().toUpperCase();
  if (roomCode.length < 3 || roomCode.length > 30) {
    return res.status(400).json({ error: 'Malformed room code.', code: 'MALFORMED_ROOM_CODE' });
  }

  try {
    const roomRef = db.collection('battleRooms').doc(roomCode);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ error: 'Battle room not found. Please verify the code.', code: 'ROOM_NOT_FOUND' });
    }

    const roomData = roomDoc.data()!;

    // Check expiration
    const now = Date.now();
    const expirationTime = roomData.expirationTime ? new Date(roomData.expirationTime).getTime() : 0;
    if (roomData.status === 'expired' || (expirationTime > 0 && expirationTime <= now)) {
      return res.status(410).json({ error: 'This custom room has expired.', code: 'ROOM_EXPIRED' });
    }

    // Check completed
    if (roomData.status === 'completed') {
      return res.status(400).json({ error: 'This custom challenge has already finished.', code: 'ROOM_COMPLETED' });
    }

    const players = roomData.players || {};
    const playerUids = Object.keys(players);
    const isAlreadyMember = !!players[req.user.uid];

    // Check already started if user is not already enrolled
    if ((roomData.status === 'in-progress' || roomData.status === 'ACTIVE') && !isAlreadyMember) {
      return res.status(400).json({ error: 'This battle has already started.', code: 'ROOM_ALREADY_STARTED' });
    }

    // Capacity check (max 2 players)
    if (playerUids.length >= 2 && !isAlreadyMember) {
      return res.status(400).json({ error: 'Battle room is already full (max 2 players).', code: 'ROOM_FULL' });
    }

    // If user is already in the room (e.g. host or re-joining from another tab)
    if (isAlreadyMember) {
      players[req.user.uid].online = true;
      await roomRef.update({ [`players.${req.user.uid}.online`]: true });
      return res.json({
        message: 'Reconnected to custom room',
        room: { ...roomData, players },
        roomId: roomCode,
        alreadyInRoom: true
      });
    }

    // Add opponent player to room
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const userData = userDoc.exists ? userDoc.data()! : {};

    players[req.user.uid] = {
      uid: req.user.uid,
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

    const updatedDoc = await roomRef.get();
    const updatedRoom = updatedDoc.data()!;

    // Broadcast update to anyone connected via socket
    try {
      io.of('/battle').to(roomCode).emit('lobby_updated', updatedRoom);
    } catch {
      // Safe ignore
    }

    res.json({
      message: 'Joined custom battle room successfully',
      room: updatedRoom,
      roomId: roomCode,
      alreadyInRoom: false
    });
  } catch (error: any) {
    logger.error('Failed to join custom battle room', { error: error.message, roomCode, userId: req.user.uid });
    res.status(500).json({ error: error.message || 'Failed to join battle room.', code: 'SERVER_ERROR' });
  }
});

app.get('/api/auth/battle-room/info/:roomId', verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  const rawId = req.params.roomId;
  if (!rawId) return res.status(400).json({ error: 'Room ID required', code: 'INVALID_ROOM_CODE' });
  const roomId = rawId.trim().toUpperCase();

  try {
    const roomDoc = await db.collection('battleRooms').doc(roomId).get();
    if (!roomDoc.exists) return res.status(404).json({ error: 'Lobby room not found.', code: 'ROOM_NOT_FOUND' });
    
    const roomData = roomDoc.data()!;
    const now = Date.now();
    const expirationTime = roomData.expirationTime ? new Date(roomData.expirationTime).getTime() : 0;
    if (roomData.status === 'expired' || (expirationTime > 0 && expirationTime <= now)) {
      return res.status(410).json({ error: 'Lobby room has expired.', code: 'ROOM_EXPIRED' });
    }

    res.json({ room: roomData, roomId });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get room.', code: 'SERVER_ERROR' });
  }
});

app.get('/api/auth/battle/history', verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const snap = await db.collection('battleHistory')
      .where('uids', 'array-contains', req.user.uid)
      .limit(30)
      .get();

    const historyList: any[] = [];
    const missingUserIds = new Set<string>();

    snap.forEach((doc: any) => {
      const data = doc.data();
      const record = { id: doc.id, ...data };
      historyList.push(record);

      if (Array.isArray(record.uids)) {
        record.uids.forEach((uid: string) => {
          if (!record.players || !record.players[uid]?.displayName) {
            missingUserIds.add(uid);
          }
        });
      }
    });

    // Batch fetch user details if needed for backward compatibility
    const userProfiles: Record<string, any> = {};
    if (missingUserIds.size > 0) {
      await Promise.all(
        Array.from(missingUserIds).map(async (uid) => {
          try {
            const uDoc = await db.collection('users').doc(uid).get();
            if (uDoc.exists) {
              const uData = uDoc.data();
              const avatar = resolveUserAvatar(uData);
              userProfiles[uid] = {
                displayName: uData?.displayName || 'Cadet',
                photoURL: avatar.url || uData?.photoURL || ''
              };
            }
          } catch {
            // safe ignore
          }
        })
      );
    }

    // Normalize records
    const normalized = historyList.map(rec => {
      const players: Record<string, any> = rec.players ? { ...rec.players } : {};
      const uids: string[] = rec.uids || Object.keys(rec.scores || {});

      uids.forEach(uid => {
        const existing = players[uid] || {};
        const profile = userProfiles[uid] || {};
        const score = existing.score ?? rec.scores?.[uid] ?? 0;
        const eloChange = existing.eloChange ?? rec.eloChanges?.[uid] ?? 0;

        players[uid] = {
          uid,
          displayName: existing.displayName || profile.displayName || 'Candidate',
          photoURL: existing.photoURL || profile.photoURL || '',
          score,
          eloChange
        };
      });

      return {
        ...rec,
        players,
        scores: rec.scores || Object.fromEntries(Object.entries(players).map(([uid, p]: any) => [uid, p.score])),
        eloChanges: rec.eloChanges || Object.fromEntries(Object.entries(players).map(([uid, p]: any) => [uid, p.eloChange]))
      };
    });

    // Sort newest first
    normalized.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    res.json({ history: normalized });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load history.' });
  }
});

// ----------------------------------------------------
// Real-Time Socket.IO Cluster Setup (Phase 4, 11, 18)
// ----------------------------------------------------
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 15000,
  pingInterval: 10000
});

// Connect Redis Adapter for horizontal multi-instance scaling
if (isRedisAvailable && pubClient && subClient && typeof pubClient.duplicate === 'function') {
  try {
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO Redis Adapter successfully attached for horizontal multi-instance scaling.');
  } catch (e) {
    logger.warn('Failed to bind Socket.IO Redis Adapter, running in single-node mode.');
  }
}

// Initialize Authoritative Game Engine
BattleEngine.initialize(io);

// 1. Matchmaking Namespace
const matchmakingNamespace = io.of('/matchmaking');
matchmakingNamespace.use(socketAuthMiddleware);

matchmakingNamespace.on('connection', (socket) => {
  logger.info('Socket authenticated on /matchmaking', { socketId: socket.id, userId: socket.data.userId });

  socket.on('join_lobby', async (data) => {
    if (!socketRateLimit(socket, 5)) return;
    await BattleEngine.joinMatchmaking(socket, data);
  });

  socket.on('leave_lobby', async () => {
    await BattleEngine.leaveMatchmaking(socket);
  });

  socket.on('disconnect', async () => {
    await BattleEngine.leaveMatchmaking(socket);
  });
});

// 2. Battle Combat Namespace
const battleNamespace = io.of('/battle');
battleNamespace.use(socketAuthMiddleware);

battleNamespace.on('connection', (socket) => {
  logger.info('Socket authenticated on /battle', { socketId: socket.id, userId: socket.data.userId });

  socket.on('join_room', async (data: { battleId: string; userId?: string }) => {
    if (!socketRateLimit(socket, 10)) return;
    socket.data.battleId = data.battleId;
    socket.join(data.battleId);

    // 1. Check if player is reconnecting to an active battle in Redis
    const restored = await BattleEngine.handlePlayerReconnect(socket, data.battleId);
    if (!restored) {
      // 2. Check if this is a custom battle room lobby in Firestore
      await BattleEngine.handleJoinCustomRoom(socket, data.battleId);
      socket.to(data.battleId).emit('player_joined', { userId: socket.data.userId });
    }
  });

  socket.on('toggle_ready', async (data: { battleId: string; userId?: string }) => {
    if (!socketRateLimit(socket, 10)) return;
    await BattleEngine.handleToggleReady(socket, data);
  });

  socket.on('start_battle_request', async (data: { battleId: string; userId?: string }) => {
    if (!socketRateLimit(socket, 5)) return;
    await BattleEngine.handleStartBattleRequest(socket, data);
  });

  socket.on('submit_answer', async (data: { battleId: string; questionIndex: number; selectedOption: number }) => {
    if (!socketRateLimit(socket, 8)) return;
    await BattleEngine.submitAnswer(socket, data);
  });

  socket.on('get_battle_state', async (data: { battleId?: string }) => {
    if (!socketRateLimit(socket, 15)) return;
    const targetBattleId = data?.battleId || socket.data.battleId;
    if (targetBattleId) {
      await BattleEngine.handlePlayerReconnect(socket, targetBattleId);
    }
  });

  socket.on('battle:getState', async (data: { battleId?: string }) => {
    if (!socketRateLimit(socket, 15)) return;
    const targetBattleId = data?.battleId || socket.data.battleId;
    if (targetBattleId) {
      await BattleEngine.handlePlayerReconnect(socket, targetBattleId);
    }
  });

  // Backward-compatibility hook for submit_step -> server-authoritative evaluation
  socket.on('submit_step', async (data: any) => {
    if (!socketRateLimit(socket, 8)) return;
    const selectedOption = typeof data.selectedOption === 'number' ? data.selectedOption : (data.isCorrect ? 0 : 1);
    await BattleEngine.submitAnswer(socket, {
      battleId: data.battleId,
      questionIndex: data.questionIndex - 1 >= 0 ? data.questionIndex - 1 : 0,
      selectedOption
    });
  });

  socket.on('disconnect', async () => {
    await BattleEngine.handlePlayerDisconnect(socket);
  });
});

// ----------------------------------------------------
// Optimized Periodic Database Sweeper (Phase 39)
// ----------------------------------------------------
async function runOptimizedDatabaseCleanup() {
  try {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    // Indexed sweep for expired custom battle rooms
    const staleRooms = await db.collection('battleRooms')
      .where('expirationTime', '<', thirtyMinsAgo)
      .limit(100)
      .get();

    let pruned = 0;
    staleRooms.forEach(async (doc: any) => {
      await doc.ref.delete();
      pruned++;
    });

    if (pruned > 0) {
      logger.info('Optimized database sweep pruned expired entries', { count: pruned });
    }
  } catch (err: any) {
    logger.error('Error during scheduled database sweep', { error: err.message });
  }
}

if (process.env.NODE_ENV !== 'test') {
  setInterval(runOptimizedDatabaseCleanup, 30 * 60 * 1000);
}

// ----------------------------------------------------
// Graceful Process Shutdown Handler (Phase 22 & 48)
// ----------------------------------------------------
const handleShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Performing graceful server shutdown...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      if (redisClient && typeof redisClient.quit === 'function') {
        await redisClient.quit();
      }
    } catch {
      // Safe ignore
    }
    process.exit(0);
  });

  // Force exit after 10s if dangling connections remain
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Forcing exit.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

if (process.env.NODE_ENV !== 'test') {
  server.listen(port, () => {
    logger.info(`CrackPlace AI Backend running on port ${port}`, { 
      env: process.env.NODE_ENV || 'development',
      redis: isRedisAvailable ? 'CONNECTED' : 'IN_MEMORY_SIMULATOR'
    });
  });
}

export { app, server, io };
