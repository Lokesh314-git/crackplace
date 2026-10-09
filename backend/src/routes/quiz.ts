import { Router } from 'express';
import { verifyToken, optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { QuestionService } from '../services/QuestionService';
import { db } from '../config/firebase';
import { z } from 'zod';
import { calculateLevelFromXP, LevelCalculator, syncMissionsState, processMissionProgress, checkAndUnlockAchievements, updateDailyStreak } from '../utils/gamification';
import { checkAndFulfillReferral } from '../services/referralService';
import { calculatePlacementReadiness } from '../utils/readiness';

const router = Router();

const generateQuizSchema = z.object({
  category: z.string(),
  topic: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('medium'),
  count: z.number().min(5).max(50).default(10),
  language: z.string().default('English'),
  company: z.string().optional()
});

/**
 * Generate/Retrieve Quiz using Supabase as the Single Source of Truth
 */
router.post('/generate', optionalAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.uid || `guest_${Date.now()}`;

  const parseResult = generateQuizSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid parameters', details: parseResult.error.format() });
  }

  const { category, topic, difficulty, count, language, company } = parseResult.data;

  try {
    console.log(`[QUIZ API] Loading practice quiz from Supabase Question Bank: ${category} (topic: ${topic || 'all'}, diff: ${difficulty}), count: ${count}`);

    // Retrieve authoritative questions from Supabase with flexible topic/difficulty matching
    const { questions, matchedTopicCount, requestedCount } = await QuestionService.getPracticeQuestions({
      category,
      count,
      preferredDifficulty: difficulty,
      topic
    });

    if (!questions || questions.length === 0) {
      return res.status(404).json({ error: 'No questions found matching your filter criteria. Please try another topic or difficulty.' });
    }

    // Shuffle options independently for this assessment attempt while keeping correctOptionIndex synchronized
    const shuffledQuestions = questions.map(q => QuestionService.shuffleQuestionOptions(q));

    const quizData = {
      userId,
      category,
      difficulty,
      language,
      company: company || 'General',
      matchedTopicCount,
      requestedCount,
      questions: shuffledQuestions.map((q) => ({
        id: q.id,
        questionText: q.question,
        options: q.options,
        correctOptionIndex: q.correctOption,
        explanation: q.explanation || ''
      })),
      results: null,
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('quizzes').add(quizData);

    res.json({
      id: docRef.id,
      quizId: docRef.id,
      quiz: {
        id: docRef.id,
        ...quizData
      },
      ...quizData
    });
  } catch (error: any) {
    console.error('[QUIZ API] Question retrieval failed:', error);
    res.status(500).json({ error: 'Unable to load quiz from Question Bank. Please try again.' });
  }
});

// Update quiz score upon completion
const updateQuizSchema = z.object({
  correctAnswers: z.number().optional(),
  timeTakenSeconds: z.number().optional(),
  answers: z.record(z.string(), z.number()).optional(),
  timeSpentSeconds: z.number().optional()
});

router.post(['/:quizId/results', '/:quizId/submit'], optionalAuth, async (req: AuthenticatedRequest, res) => {
  const { quizId } = req.params;
  const userIdentifier = req.user?.uid || 'guest';
  console.log(`[QUIZ API] Recording results for quiz: ${quizId} for user: ${userIdentifier}`);
  const parseResult = updateQuizSchema.safeParse(req.body);
  
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid results payload', details: parseResult.error.format() });
  }

  const payload = parseResult.data;

  try {
    const quizDocRef = db.collection('quizzes').doc(quizId);
    const quizDoc = await quizDocRef.get();

    if (!quizDoc.exists) {
      console.warn(`[QUIZ API] Quiz not found in database: ${quizId}`);
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const quizData = quizDoc.data()!;
    if (req.user && quizData.userId && quizData.userId !== req.user.uid && !quizData.userId.startsWith('guest_')) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const questionCount = quizData.questions.length;

    // Server-Authoritative Evaluation if answers dictionary is provided
    let calculatedCorrect = 0;
    if (payload.answers) {
      quizData.questions.forEach((q: any, idx: number) => {
        const submitted = payload.answers![String(idx)] ?? payload.answers![idx];
        if (typeof submitted === 'number' && submitted === q.correctOptionIndex) {
          calculatedCorrect++;
        }
      });
    } else {
      calculatedCorrect = Math.min(questionCount, Math.max(0, payload.correctAnswers || 0));
    }

    const timeSpent = payload.timeSpentSeconds || payload.timeTakenSeconds || 60;
    const score = Math.round((calculatedCorrect / (questionCount || 1)) * 100);

    const baseXp = calculatedCorrect * 10;
    const hardBonus = quizData.difficulty === 'hard' ? calculatedCorrect * 20 : 0;
    const perfectBonus = calculatedCorrect === questionCount ? 50 : 0;
    const mockTestBonus = 60;

    const xpEarned = baseXp + hardBonus + perfectBonus + mockTestBonus;
    
    const baseCoins = calculatedCorrect * 5;
    const perfectCoins = calculatedCorrect === questionCount ? 25 : 0;
    const mockTestCoins = 30;
    const coinsEarned = baseCoins + perfectCoins + mockTestCoins;

    const results = {
      score,
      correctAnswers: calculatedCorrect,
      timeTakenSeconds: timeSpent,
      xpEarned,
      coinsEarned
    };

    if (!req.user) {
      // Guest submit: update quiz doc results and return
      await quizDocRef.update({ results });
      return res.json({
        success: true,
        results,
        leveledUp: false,
        newLevel: 1,
        unlockedAchievements: []
      });
    }

    const userDocRef = db.collection('users').doc(req.user.uid);
    let leveledUp = false;
    let newLevel = 1;
    let newlyUnlockedAchievements: any[] = [];
    let updatedProfile: any = null;

    await db.runTransaction(async (transaction: any) => {
      const userDoc = await transaction.get(userDocRef);
      const quizDocSnapshot = await transaction.get(quizDocRef);

      if (!quizDocSnapshot.exists) {
        throw new Error('Quiz not found');
      }

      const currentQuizData = quizDocSnapshot.data()!;
      if (currentQuizData.results !== null) {
        // Return existing recorded results
        return;
      }

      let userData: any;
      if (!userDoc.exists) {
        userData = {
          uid: req.user!.uid,
          email: req.user!.email || 'student@crackplace.ai',
          displayName: req.user!.name || 'Anonymous',
          photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${req.user!.uid}`,
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

      // Calculate streak triggers
      const streakResult = updateDailyStreak(userData.dailyStreak || 0, userData.longestStreak || 0, userData.lastActiveDate || '');
      const dailyStreak = streakResult.dailyStreak;
      const longestStreak = streakResult.longestStreak;
      const lastActiveDate = streakResult.lastActiveDate;

      const oldXp = Number(userData.xp ?? userData.totalXp ?? 0);
      const oldLevel = calculateLevelFromXP(oldXp);

      // Authoritative evaluation of XP reward
      const baseEval = LevelCalculator.evaluateXpReward({
        currentXp: oldXp,
        xpEarned,
        userId: req.user!.uid,
        source: 'quiz',
        referenceId: quizId
      });

      let finalCoins = (userData.coins || 0) + coinsEarned;
      newLevel = baseEval.levelAfter;
      if (baseEval.leveledUp) {
        leveledUp = true;
      }

      const totalQuestionsSolved = (userData.stats?.totalQuestionsSolved || 0) + questionCount;
      const totalMockTests = (userData.stats?.totalMockTests || 0) + 1;
      
      const subjectPerformance = userData.stats?.subjectPerformance || {};
      const category = currentQuizData.category || 'General';
      const categoryStats = subjectPerformance[category] || { attempted: 0, correct: 0 };
      subjectPerformance[category] = {
        attempted: categoryStats.attempted + questionCount,
        correct: categoryStats.correct + calculatedCorrect
      };

      const placementReadinessScore = calculatePlacementReadiness({
        ...userData,
        level: newLevel,
        stats: {
          ...(userData.stats || {}),
          totalQuestionsSolved,
          totalMockTests,
          subjectPerformance
        }
      });

      // Increment missions progress
      const tempMissions = userData.missionsState || {};
      const syncedMissions = syncMissionsState(tempMissions, new Date());
      const r1 = processMissionProgress(syncedMissions, 'questions_solved', questionCount);
      const r2 = processMissionProgress(r1.state, 'quiz_completed', 1);
      const finalMissionsState = r2.state;

      // Check achievements
      let finalEval = baseEval;
      let unlockedAchievementsList = userData.unlockedAchievements || [];

      const tempUserStats = {
        xp: baseEval.xpAfter,
        totalXp: baseEval.xpAfter,
        coins: finalCoins,
        level: baseEval.levelAfter,
        dailyStreak,
        longestStreak,
        placementReadinessScore,
        stats: {
          totalQuestionsSolved,
          totalMockTests,
          totalBattlesWon: userData.stats?.totalBattlesWon || 0
        },
        unlockedAchievements: unlockedAchievementsList
      };

      const achDetails = checkAndUnlockAchievements(tempUserStats);
      if (achDetails.newlyUnlocked.length > 0) {
        finalCoins += achDetails.coinsGranted;
        unlockedAchievementsList = achDetails.unlockedList;
        newlyUnlockedAchievements = achDetails.newlyUnlocked;

        const achEval = LevelCalculator.evaluateXpReward({
          currentXp: baseEval.xpAfter,
          xpEarned: achDetails.xpGranted,
          userId: req.user!.uid,
          source: 'achievement',
          referenceId: `quiz_ach_${quizId}`
        });

        finalEval = achEval;
        newLevel = achEval.levelAfter;
        if (achEval.levelAfter > oldLevel) {
          leveledUp = true;
        }

        const achTxKey = `achievement_quiz_ach_${quizId}_${req.user!.uid}`;
        transaction.set(db.collection('xpTransactions').doc(achTxKey), achEval.transaction);
      }

      const quizTxKey = `quiz_${quizId}_${req.user!.uid}`;
      transaction.set(db.collection('xpTransactions').doc(quizTxKey), baseEval.transaction);

      transaction.update(quizDocRef, { results });
      transaction.update(userDocRef, {
        xp: finalEval.xpAfter,
        totalXp: finalEval.xpAfter,
        level: finalEval.levelAfter,
        coins: finalCoins,
        dailyStreak,
        longestStreak,
        lastActiveDate,
        placementReadinessScore,
        missionsState: finalMissionsState,
        unlockedAchievements: unlockedAchievementsList,
        'stats.totalQuestionsSolved': totalQuestionsSolved,
        'stats.totalMockTests': totalMockTests,
        'stats.subjectPerformance': subjectPerformance
      });

      updatedProfile = {
        ...userData,
        xp: finalEval.xpAfter,
        totalXp: finalEval.xpAfter,
        level: finalEval.levelAfter,
        coins: finalCoins,
        dailyStreak,
        longestStreak,
        placementReadinessScore
      };
    });

    if (leveledUp) {
      const notifRef = db.collection('notifications').doc();
      await notifRef.set({
        userId: req.user.uid,
        type: 'level_up',
        title: 'Level Up! 🎉',
        message: `Congratulations! You reached Level ${newLevel}!`,
        createdAt: new Date().toISOString(),
        read: false
      });
    }

    // Verify referral eligibility asynchronously
    checkAndFulfillReferral(req.user.uid);

    res.json({
      message: 'Quiz results recorded successfully',
      results,
      profile: updatedProfile,
      xpEarned,
      coinsEarned,
      leveledUp,
      newLevel
    });
  } catch (error) {
    console.error('[QUIZ API] Result update failed:', error);
    res.status(500).json({ error: 'Failed to record quiz results.' });
  }
});

// Fetch quiz history
router.get('/history', verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const snapshot = await db.collection('quizzes')
      .where('userId', '==', req.user.uid)
      .get();

    const quizzes: any[] = [];
    snapshot.forEach((doc: any) => {
      quizzes.push({ id: doc.id, ...doc.data() });
    });

    quizzes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const recentQuizzes = quizzes.slice(0, 10);

    res.json(recentQuizzes);
  } catch (error) {
    console.error('[QUIZ API] Failed to fetch history:', error);
    res.status(500).json({ error: 'Failed to retrieve quiz history.' });
  }
});

export default router;
