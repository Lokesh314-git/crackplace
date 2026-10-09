import { Router } from 'express';
import { verifyToken, AuthenticatedRequest } from '../middleware/auth';
import { AIService } from '../services/AIService';
import { db } from '../config/firebase';
import { z } from 'zod';
import crypto from 'crypto';
import { calculateLevelFromXP, calculateLevelProgress, LevelCalculator, syncMissionsState, processMissionProgress, checkAndUnlockAchievements, updateDailyStreak } from '../utils/gamification';
import { calculatePlacementReadiness } from '../utils/readiness';
import { XpTransactionService } from '../services/XpTransactionService';
import { checkAndFulfillReferral } from '../services/referralService';

const router = Router();

const startInterviewSchema = z.object({
  dreamCompany: z.string().default('Google'),
  role: z.string().default('Software Engineer')
});

// 1. Start Mock HR Interview
router.post('/start', verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parseResult = startInterviewSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid parameters', details: parseResult.error.format() });
  }

  const { dreamCompany, role } = parseResult.data;

  try {
    // Fetch student profile info for context
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    const college = userData?.college || 'University';
    const department = userData?.department || 'Computer Science';
    const year = userData?.year || 3;

    const systemPrompt = `You are a professional HR director at ${dreamCompany} interviewing a candidate for a ${role} position.`;
    const prompt = `Start a professional mock interview for a candidate who is a ${year} year student studying ${department} at ${college}.
Ask exactly one typical behavior-based or HR interview question. Keep it concise, engaging, and realistic. 
Return the output in a clean JSON format.

JSON Schema:
{
  "question": "The interview question text"
}`;

    console.log(`[INTERVIEW API] Starting interview session for user ${req.user.uid}`);
    const result = await AIService.generateJSON(prompt, systemPrompt);

    res.json({
      question: result.question,
      chatHistory: [
        { role: 'assistant', content: result.question }
      ]
    });
  } catch (error) {
    console.error('[INTERVIEW API] Start failed:', error);
    res.status(500).json({ error: 'Failed to initiate interview. Try again.' });
  }
});

// 2. Respond and evaluate
const respondSchema = z.object({
  dreamCompany: z.string().default('Google'),
  chatHistory: z.array(z.object({
    role: z.enum(['assistant', 'user']),
    content: z.string()
  })),
  userAnswer: z.string()
});

router.post('/respond', verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parseResult = respondSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid parameters', details: parseResult.error.format() });
  }

  const { dreamCompany, chatHistory, userAnswer } = parseResult.data;
  
  // Track interview depth: typically 3-4 questions total
  const userResponsesCount = chatHistory.filter(c => c.role === 'user').length + 1;
  const isFinal = userResponsesCount >= 3; // 3 rounds of questions

  try {
    const systemPrompt = `You are an HR director at ${dreamCompany} evaluating a candidate's response.`;
    
    let prompt = `Evaluate the candidate's last answer in the following dialogue context:
---
Dialogue History:
${JSON.stringify(chatHistory)}
Candidate's Last Answer: "${userAnswer}"
---

Evaluate the answer. Review metrics like completeness, grammar, professionalism, and mapping to the STAR method (Situation, Task, Action, Result).
Also, determine if the interview is finished (isFinal is ${isFinal}).
If finished, compile a final scorecard summary.
If NOT finished, formulate the next typical behavior question.

Return ONLY a raw JSON object conforming strictly to the schema below.

JSON Schema:
{
  "finished": ${isFinal},
  "nextQuestion": "The next interview question text, or null if finished",
  "evaluation": {
    "score": number (1-100 representing rating for this answer),
    "feedback": "specific suggestions on structure or communication details",
    "improvedAnswer": "a model answer showing how to formulate it much better"
  },
  "finalScorecard": {
    "overallScore": number (1-100, only if finished, null otherwise),
    "grammarRating": number (1-100, only if finished),
    "completenessRating": number (1-100, only if finished),
    "clarityRating": number (1-100, only if finished),
    "professionalismRating": number (1-100, only if finished),
    "starMethodScore": number (1-100, rating for STAR method compliance, only if finished),
    "overallFeedback": "final concluding summary of candidate performance, only if finished"
  }
}`;

    console.log(`[INTERVIEW API] Processing round ${userResponsesCount} (isFinal: ${isFinal})`);
    const result = await AIService.generateJSON(prompt, systemPrompt);

    // If finished, calculate and award XP and Coins
    let rewards = { xp: 0, coins: 0 };
    if (result.finished && result.finalScorecard) {
      const overall = result.finalScorecard.overallScore || 70;

      // Generate a unique hash of the dialogue context to prevent duplicate claims
      const serializedDialogue = JSON.stringify(chatHistory.map(c => ({ role: c.role, content: c.content })) + userAnswer);
      const dialogueHash = crypto.createHash('sha256').update(serializedDialogue).digest('hex');

      // Check if hash already exists in mock_interviews collection
      const dupQuery = await db.collection('mock_interviews')
        .where('userId', '==', req.user.uid)
        .where('dialogueHash', '==', dialogueHash)
        .get();

      if (!dupQuery.empty) {
        // Dialogue already submitted! No rewards, just return the result with 0 rewards.
        rewards.xp = 0;
        rewards.coins = 0;
      } else {
        rewards.xp = 25;
        rewards.coins = 10;

        // Save history record in Firestore
        const interviewSession = {
          userId: req.user.uid,
          dreamCompany,
          chatHistory: [...chatHistory, { role: 'user', content: userAnswer }],
          scorecard: result.finalScorecard,
          dialogueHash,
          createdAt: new Date().toISOString()
        };

        await db.collection('mock_interviews').add(interviewSession);

        // Update User Level, XP, Coins and readiness index
        const userDocRef = db.collection('users').doc(req.user.uid);
        let leveledUp = false;
        let newLevel = 1;
        let newlyUnlockedAchievements: any[] = [];

        try {
          await db.runTransaction(async (transaction: any) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists) return;

            const userData = userDoc.data()!;

            // Calculate streak triggers
            const streakResult = updateDailyStreak(userData.dailyStreak || 0, userData.longestStreak || 0, userData.lastActiveDate || '');
            const dailyStreak = streakResult.dailyStreak;
            const longestStreak = streakResult.longestStreak;
            const lastActiveDate = streakResult.lastActiveDate;

            const oldXp = Number(userData.xp ?? userData.totalXp ?? 0);
            const oldLevel = calculateLevelFromXP(oldXp);

            // 1. Authoritatively evaluate HR interview base XP reward
            const baseEval = LevelCalculator.evaluateXpReward({
              currentXp: oldXp,
              xpEarned: rewards.xp,
              userId: req.user!.uid,
              source: 'interview',
              referenceId: dialogueHash
            });

            const currentCoins = (userData.coins || 0) + rewards.coins;
            newLevel = baseEval.levelAfter;
            if (baseEval.leveledUp) {
              leveledUp = true;
            }

            const totalMockTests = (userData.stats?.totalMockTests || 0) + 1;
            const subjectPerformance = userData.stats?.subjectPerformance || {};
            const categoryStats = subjectPerformance['HR'] || { attempted: 0, correct: 0 };
            subjectPerformance['HR'] = {
              attempted: categoryStats.attempted + 1,
              correct: categoryStats.correct + (overall / 100)
            };
            
            const placementReadinessScore = calculatePlacementReadiness({
              ...userData,
              level: newLevel,
              stats: {
                ...(userData.stats || {}),
                totalMockTests,
                subjectPerformance
              }
            });

            // Increment missions progress
            const tempMissions = userData.missionsState || {};
            const syncedMissions = syncMissionsState(tempMissions, new Date());
            const r1 = processMissionProgress(syncedMissions, 'hr_completed', 1);
            const finalMissionsState = r1.state;

            // Check achievements
            let finalEval = baseEval;
            let finalCoins = currentCoins;
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
                totalQuestionsSolved: userData.stats?.totalQuestionsSolved || 0,
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

              // Authoritatively evaluate achievement XP bonus
              const achEval = LevelCalculator.evaluateXpReward({
                currentXp: baseEval.xpAfter,
                xpEarned: achDetails.xpGranted,
                userId: req.user!.uid,
                source: 'achievement',
                referenceId: `interview_ach_${dialogueHash}`
              });

              finalEval = achEval;
              newLevel = achEval.levelAfter;
              if (achEval.levelAfter > oldLevel) {
                leveledUp = true;
              }

              // Record achievement XP transaction
              const achTxKey = `achievement_interview_ach_${dialogueHash}_${req.user!.uid}`;
              transaction.set(db.collection('xpTransactions').doc(achTxKey), achEval.transaction);
            }

            // Record base interview XP transaction
            const interviewTxKey = `interview_${dialogueHash}_${req.user!.uid}`;
            transaction.set(db.collection('xpTransactions').doc(interviewTxKey), baseEval.transaction);

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
              'stats.totalMockTests': totalMockTests,
              'stats.subjectPerformance': subjectPerformance
            });
          });

          if (leveledUp) {
            const notifRef = db.collection('notifications').doc();
            await notifRef.set({
              userId: req.user.uid,
              type: 'level_up',
              title: 'Level Up! 🎉',
              message: `Congratulations! You leveled up to Level ${newLevel}! Keep solving challenges to maximize readiness.`,
              createdAt: new Date().toISOString(),
              read: false
            });
          }

          if (newlyUnlockedAchievements.length > 0) {
            for (const ach of newlyUnlockedAchievements) {
              const notifRef = db.collection('notifications').doc();
              await notifRef.set({
                userId: req.user.uid,
                type: 'achievement',
                title: `Achievement Unlocked! ${ach.icon}`,
                message: `Unlocked "${ach.title}": ${ach.description} (Reward: +${ach.xpReward} XP, +${ach.coinReward} Coins)`,
                createdAt: new Date().toISOString(),
                read: false
              });
            }
          }
          
          // Verify referral eligibility asynchronously
          checkAndFulfillReferral(req.user.uid);
        } catch (err) {
          console.error('[INTERVIEW API] Transaction update failed:', err);
        }
      }
    }

    res.json({
      ...result,
      rewards
    });
  } catch (error) {
    console.error('[INTERVIEW API] Dialogue processing failed:', error);
    res.status(500).json({ error: 'AI failed to process interview response. Try again.' });
  }
});

export default router;
