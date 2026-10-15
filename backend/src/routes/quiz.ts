import { Router } from 'express';
import { verifyToken, optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { QuestionService } from '../services/QuestionService';
import { db } from '../config/firebase';
import { z } from 'zod';
import { calculateLevelFromXP, LevelCalculator, syncMissionsState, processMissionProgress, checkAndUnlockAchievements, updateDailyStreak } from '../utils/gamification';
import { checkAndFulfillReferral } from '../services/referralService';
import { calculatePlacementReadiness } from '../utils/readiness';

import { supabase } from '../config/supabase';

const router = Router();

/**
 * Resolves verified explanation or reliable fallback text
 */
export function resolveQuestionExplanation(q: any, correctOptionText?: string): string {
  if (q.explanation && typeof q.explanation === 'string' && q.explanation.trim().length > 0 && q.explanation.trim() !== 'Explanation not available for this question yet') {
    return q.explanation.trim();
  }
  if (q.solution && typeof q.solution === 'string' && q.solution.trim().length > 0) {
    return q.solution.trim();
  }
  if (q.answer_explanation && typeof q.answer_explanation === 'string' && q.answer_explanation.trim().length > 0) {
    return q.answer_explanation.trim();
  }
  if (correctOptionText && typeof correctOptionText === 'string' && correctOptionText.trim().length > 0) {
    return `The correct answer is "${correctOptionText.trim()}". Standard assessment guidelines and rules apply to this question.`;
  }
  return 'Explanation not available for this question yet';
}

/**
 * Enriches question records with verified explanations from Supabase if missing
 */
export async function enrichQuestionsWithExplanations(questions: any[]): Promise<any[]> {
  const missing = questions.filter(q => !q.explanation || typeof q.explanation !== 'string' || q.explanation.trim().length === 0);
  if (missing.length === 0) {
    return questions.map(q => ({
      ...q,
      explanation: resolveQuestionExplanation(q)
    }));
  }

  const ids = missing.map(q => q.id).filter(Boolean);
  if (ids.length > 0 && supabase) {
    try {
      // Escape or quote IDs cleanly for PostgREST
      const formattedIds = ids.map(id => String(id).replace(/[",]/g, '')).filter(Boolean);
      if (formattedIds.length > 0) {
        const { data } = await supabase
          .from('questions')
          .select('id, question_id, explanation, correct_answer')
          .or(`id.in.(${formattedIds.join(',')}),question_id.in.(${formattedIds.join(',')})`);

        if (data && data.length > 0) {
          const expMap = new Map<string, string>();
          for (const row of data) {
            if (row.explanation && row.explanation.trim().length > 0) {
              if (row.id) expMap.set(String(row.id), row.explanation.trim());
              if (row.question_id) expMap.set(String(row.question_id), row.explanation.trim());
            }
          }
          return questions.map(q => ({
            ...q,
            explanation: q.explanation?.trim() || (q.id ? expMap.get(String(q.id)) : undefined) || resolveQuestionExplanation(q)
          }));
        }
      }
    } catch (err) {
      console.warn('[QUIZ API] Supabase fallback explanation lookup failed:', err);
    }
  }

  return questions.map(q => ({
    ...q,
    explanation: resolveQuestionExplanation(q)
  }));
}

/**
 * Maps question records to detailed review payload including canonical correct answer and user submission
 */
export function formatReviewQuestions(questions: any[], userAnswers: Record<string, any> = {}): any[] {
  return questions.map((q: any, idx: number) => {
    const submittedVal = userAnswers[String(idx)] ?? userAnswers[idx];
    const isAnswered = typeof submittedVal === 'number' && submittedVal >= 0;

    // Resolve 0-based correct option index across different schema variations
    const correctIdx = typeof q.correctOptionIndex === 'number'
      ? q.correctOptionIndex
      : typeof q.correctOption === 'number'
      ? q.correctOption
      : (typeof q.correct_option === 'number' ? q.correct_option : undefined);

    let correctOptionText = '';
    if (Array.isArray(q.options) && typeof correctIdx === 'number' && q.options[correctIdx] !== undefined) {
      correctOptionText = String(q.options[correctIdx]);
    } else if (q.correctAnswer && typeof q.correctAnswer === 'string' && q.correctAnswer.trim().length > 0) {
      const trimmed = q.correctAnswer.trim();
      if (['A', 'B', 'C', 'D'].includes(trimmed.toUpperCase()) && Array.isArray(q.options) && q.options[trimmed.toUpperCase().charCodeAt(0) - 65]) {
        correctOptionText = String(q.options[trimmed.toUpperCase().charCodeAt(0) - 65]);
      } else {
        correctOptionText = trimmed;
      }
    } else if (q.correctOptionText && typeof q.correctOptionText === 'string') {
      correctOptionText = q.correctOptionText;
    } else if (q.correct_answer && typeof q.correct_answer === 'string') {
      const trimmed = q.correct_answer.trim();
      if (['A', 'B', 'C', 'D'].includes(trimmed.toUpperCase()) && Array.isArray(q.options) && q.options[trimmed.toUpperCase().charCodeAt(0) - 65]) {
        correctOptionText = String(q.options[trimmed.toUpperCase().charCodeAt(0) - 65]);
      } else {
        correctOptionText = trimmed;
      }
    }

    let userOptionText: string | null = null;
    if (isAnswered && Array.isArray(q.options) && q.options[submittedVal] !== undefined) {
      userOptionText = String(q.options[submittedVal]);
    } else if (isAnswered) {
      userOptionText = String(submittedVal);
    }

    const isCorrect = isAnswered && (
      (typeof correctIdx === 'number' && submittedVal === correctIdx) ||
      (Boolean(correctOptionText) && userOptionText !== null && correctOptionText.trim().toLowerCase() === userOptionText.trim().toLowerCase())
    );

    const explanation = resolveQuestionExplanation(q, correctOptionText);

    return {
      id: q.id,
      questionIndex: idx,
      questionText: q.questionText || q.question || '',
      options: q.options || [],
      correctOptionIndex: correctIdx,
      correctOption: correctIdx,
      correctAnswer: correctOptionText,
      correctOptionText,
      userAnswerIndex: isAnswered ? submittedVal : null,
      userAnswerText: userOptionText,
      isAnswered,
      isCorrect,
      explanation
    };
  });
}

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

    // Sanitize questions for client: do not leak answer key (correctOptionIndex) or explanations before submission
    const sanitizedQuestions = quizData.questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      options: q.options
    }));

    const clientQuizPayload = {
      id: docRef.id,
      quizId: docRef.id,
      userId,
      category,
      difficulty,
      language,
      company: quizData.company,
      matchedTopicCount,
      requestedCount,
      questions: sanitizedQuestions,
      createdAt: quizData.createdAt
    };

    res.json({
      ...clientQuizPayload,
      quiz: clientQuizPayload
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

    // Server-Authoritative Evaluation strictly against database questions
    let calculatedCorrect = 0;
    if (payload.answers && typeof payload.answers === 'object') {
      quizData.questions.forEach((q: any, idx: number) => {
        const submitted = payload.answers![String(idx)] ?? payload.answers![idx];
        const correctIdx = typeof q.correctOptionIndex === 'number'
          ? q.correctOptionIndex
          : typeof q.correctOption === 'number'
          ? q.correctOption
          : undefined;
        if (typeof submitted === 'number' && typeof correctIdx === 'number' && submitted === correctIdx) {
          calculatedCorrect++;
        }
      });
    } else {
      // If client attempts to omit answers dictionary, score is strictly 0
      calculatedCorrect = 0;
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

    const userAnswers = payload.answers || {};
    const submittedAt = new Date().toISOString();

    const enrichedQuestions = await enrichQuestionsWithExplanations(quizData.questions || []);
    const reviewQuestions = formatReviewQuestions(enrichedQuestions, userAnswers);

    if (!req.user) {
      // Guest submit: update quiz doc results, user answers, and return reviewQuestions
      await quizDocRef.update({
        results,
        userAnswers,
        submittedAt
      });
      return res.json({
        success: true,
        results,
        reviewQuestions,
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

      transaction.update(quizDocRef, {
        results,
        userAnswers,
        submittedAt
      });
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
      reviewQuestions,
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

/**
 * GET /:quizId/review and GET /:quizId
 * Authoritative review endpoint for completed assessments
 * Enforces ownership and completion checks on the backend
 */
router.get(['/:quizId/review', '/:quizId'], optionalAuth, async (req: AuthenticatedRequest, res) => {
  const { quizId } = req.params;

  try {
    const quizDocRef = db.collection('quizzes').doc(quizId);
    const quizDoc = await quizDocRef.get();

    if (!quizDoc.exists) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const quizData = quizDoc.data()!;

    // Security check 1: Assessment MUST be completed before review can be accessed
    if (!quizData.results) {
      return res.status(403).json({ error: 'Cannot review an active assessment before submission' });
    }

    // Security check 2: Ownership check
    // Allow if guest assessment or matching authenticated user
    if (req.user && quizData.userId && quizData.userId !== req.user.uid && !quizData.userId.startsWith('guest_')) {
      return res.status(403).json({ error: 'Forbidden: Access denied to this assessment review' });
    }

    const userAnswers = quizData.userAnswers || {};
    const enrichedQuestions = await enrichQuestionsWithExplanations(quizData.questions || []);
    const reviewQuestions = formatReviewQuestions(enrichedQuestions, userAnswers);

    return res.json({
      success: true,
      quizId,
      category: quizData.category,
      difficulty: quizData.difficulty,
      results: quizData.results,
      userAnswers,
      reviewQuestions,
      questions: reviewQuestions,
      createdAt: quizData.createdAt,
      submittedAt: quizData.submittedAt || null
    });
  } catch (error) {
    console.error('[QUIZ API] Error retrieving assessment review:', error);
    res.status(500).json({ error: 'Failed to retrieve assessment review' });
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
