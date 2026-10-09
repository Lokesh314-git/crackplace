import { Router } from 'express';
import { verifyToken, AuthenticatedRequest } from '../middleware/auth';
import { AIService } from '../services/AIService';
import { db } from '../config/firebase';
import { z } from 'zod';
import { calculateLevelFromXP, calculateLevelProgress, LevelCalculator, syncMissionsState, processMissionProgress, checkAndUnlockAchievements, updateDailyStreak } from '../utils/gamification';
import { calculatePlacementReadiness } from '../utils/readiness';
import { XpTransactionService } from '../services/XpTransactionService';

const router = Router();

const generateNotesSchema = z.object({
  category: z.string(),
  topic: z.string(),
  subtopic: z.string().optional().default(''),
  depth: z.enum(['cheat_sheet', 'detailed'])
});

interface MCQSelfTestQuestion {
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

interface StudyNotesResponse {
  title: string;
  summary: string;
  notesMarkdown: string;
  questions: MCQSelfTestQuestion[];
}

// Validates and repairs missing properties or structures from the AI response
function validateAndNormalizeResponse(raw: any, category: string, topic: string, subtopic: string): StudyNotesResponse {
  const obj = (raw && typeof raw === 'object') ? raw : {};

  // 1. title
  let title = obj.title;
  if (!title || typeof title !== 'string' || title.trim() === '') {
    title = `Study Guide: ${topic}${subtopic ? ' - ' + subtopic : ''}`;
  }

  // 2. summary
  let summary = obj.summary;
  if (!summary || typeof summary !== 'string' || summary.trim() === '') {
    summary = `Key takeaways and core concepts for ${topic}.`;
  }

  // 3. content / notesMarkdown
  let content = obj.content || obj.notesMarkdown;
  if (!content || typeof content !== 'string' || content.trim() === '') {
    content = `# ${title}\n\nNo detailed notes were provided.`;
  }

  // 4. quiz / questions
  const rawQuestions = Array.isArray(obj.quiz) ? obj.quiz : (Array.isArray(obj.questions) ? obj.questions : []);
  const questions: MCQSelfTestQuestion[] = [];

  for (let i = 0; i < 3; i++) {
    const rq = rawQuestions[i] || {};
    const questionText = typeof rq.questionText === 'string' && rq.questionText.trim() !== ''
      ? rq.questionText
      : `Self-test question about ${topic} concept #${i + 1}`;
    
    let options = Array.isArray(rq.options) ? rq.options.map(String) : [];
    if (options.length < 4) {
      const defaultOptions = ['Option A', 'Option B', 'Option C', 'Option D'];
      options = [...options, ...defaultOptions.slice(options.length)].slice(0, 4);
    } else if (options.length > 4) {
      options = options.slice(0, 4);
    }

    let correctOptionIndex = Number(rq.correctOptionIndex);
    if (isNaN(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex > 3) {
      correctOptionIndex = 0;
    }

    const explanation = typeof rq.explanation === 'string' && rq.explanation.trim() !== ''
      ? rq.explanation
      : `Review the study notes content above for the explanation of this question.`;

    questions.push({
      questionText,
      options,
      correctOptionIndex,
      explanation
    });
  }

  return {
    title,
    summary,
    notesMarkdown: content,
    questions
  };
}

// Generate new study notes using AI and save to Firestore (or load from cache)
router.post('/notes/generate', verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parseResult = generateNotesSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid parameters', details: parseResult.error.format() });
  }

  const { category, topic, subtopic, depth } = parseResult.data;

  try {
    // 1. Caching: Look up if identical notes are already saved in the user's study locker
    const existingNotesSnapshot = await db.collection('studyNotes')
      .where('uid', '==', req.user.uid)
      .where('category', '==', category)
      .where('topic', '==', topic)
      .get();

    const existingNotes: any[] = [];
    existingNotesSnapshot.forEach((doc: any) => {
      existingNotes.push(doc.data());
    });

    const targetSubtopic = (subtopic || 'Overview').toLowerCase().trim();
    const cachedNote = existingNotes.find(note => {
      const noteSubtopic = (note.subtopic || 'Overview').toLowerCase().trim();
      // If note has depth property stored, compare it; otherwise match if we want to default it
      const matchesDepth = note.depth ? note.depth === depth : true;
      return noteSubtopic === targetSubtopic && matchesDepth;
    });

    if (cachedNote) {
      console.log(`[STUDY NOTES] Cache hit for topic: ${topic}, depth: ${depth}. Returning cached note.`);
      return res.json({ message: 'Study note retrieved from cache', note: cachedNote });
    }

    const systemPrompt = `You are an elite technical placement trainer and computer science professor. 
Your goal is to generate exceptionally structured, detailed study notes/cheat sheets and matching review questions in strict raw JSON format.
Ensure you return ONLY valid JSON. Do not include explanations before or after the JSON payload. Do not wrap JSON inside markdown code blocks.`;

    const detailInstruction = depth === 'cheat_sheet' 
      ? 'A quick reference cheat sheet containing key summary definitions, syntax, time complexity, and core formulas.'
      : 'A detailed conceptual guide explaining architecture, edge cases, implementation patterns, step-by-step algorithms, and clear examples.';

    const prompt = `Create comprehensive placement study notes for:
Topic: "${topic}"
Category: "${category}" (e.g., DSA, DBMS, Operating Systems, Aptitude)
Subtopic focus: "${subtopic || 'General Overview'}"
Format style: ${detailInstruction}

The notes content MUST use clean Markdown (headers, tables, lists, bold highlights, blockquotes, code blocks with syntax highlighting language markers like javascript or cpp) and be returned under "content".

Also, compile a summary of the notes under "summary".
And compile exactly 3 multiple choice questions (MCQs) to self-test understanding of this note, returned under "quiz". Each question must have exactly 4 choices, a correctOptionIndex, and a brief explanation.

Output the result strictly as a single JSON object matching this schema:
{
  "title": "Title of the study note (e.g., Master Binary Search)",
  "summary": "Concise summary of the topic",
  "content": "Full notes text in Markdown format with headers, lists, code, and tables",
  "quiz": [
    {
      "questionText": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOptionIndex": 0,
      "explanation": "Brief explanation"
    }
  ]
}`;

    let aiResult: any;
    let generateSuccess = false;

    // Call 1
    try {
      console.log('[STUDY NOTES] First AI generation attempt...');
      aiResult = await AIService.generateJSON(prompt, systemPrompt);
      generateSuccess = true;
    } catch (firstErr: any) {
      console.warn('[STUDY NOTES] First AI generation attempt failed:', firstErr.message || firstErr);
      
      // Call 2 (Retry automatically once)
      try {
        console.log('[STUDY NOTES] Retrying AI generation (Attempt 2)...');
        aiResult = await AIService.generateJSON(prompt, systemPrompt);
        generateSuccess = true;
      } catch (secondErr: any) {
        console.error('[STUDY NOTES] Second AI generation attempt failed:', secondErr.message || secondErr);
        
        // Call 3 (Attempt JSON extraction on a direct text call as last resort)
        try {
          console.log('[STUDY NOTES] Attempting direct text call and desperate JSON extraction...');
          const rawText = await AIService.generateText(prompt + '\nReturn ONLY a raw JSON string.', systemPrompt);
          aiResult = AIService.cleanAndParseJSON(rawText);
          generateSuccess = true;
        } catch (extractionErr: any) {
          console.error('[STUDY NOTES] Desperate JSON extraction failed:', extractionErr.message || extractionErr);
          throw new Error('AI failed to return valid JSON structures after multiple recovery attempts.');
        }
      }
    }

    const normalized = validateAndNormalizeResponse(aiResult, category, topic, subtopic);

    const noteId = `note_${Date.now()}`;
    const newNote = {
      noteId,
      uid: req.user.uid,
      category,
      topic,
      subtopic: subtopic || 'Overview',
      title: normalized.title,
      summary: normalized.summary,
      content: normalized.notesMarkdown,
      questions: normalized.questions,
      depth,
      isFavorite: false,
      createdTime: new Date().toISOString()
    };

    // Save to Firestore
    await db.collection('studyNotes').doc(noteId).set(newNote);

    res.json({ message: 'Study note generated successfully', note: newNote });
  } catch (error: any) {
    console.error('Study notes generation failed:', error);
    res.status(500).json({ error: error.message || 'Failed to generate study notes.' });
  }
});

// Retrieve all saved study notes for the active user
router.get('/notes', verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const notesSnapshot = await db.collection('studyNotes')
      .where('uid', '==', req.user.uid)
      .get();

    const notesList: any[] = [];
    notesSnapshot.forEach((doc: any) => {
      notesList.push(doc.data());
    });

    // Sort by createdTime descending
    notesList.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

    res.json({ notes: notesList });
  } catch (error: any) {
    console.error('Failed to fetch study notes:', error);
    res.status(500).json({ error: 'Failed to retrieve study notes.' });
  }
});

// Toggle favorite state
router.post('/notes/:noteId/favorite', verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { noteId } = req.params;

  try {
    const noteRef = db.collection('studyNotes').doc(noteId);
    const noteDoc = await noteRef.get();

    if (!noteDoc.exists) {
      return res.status(404).json({ error: 'Study note not found' });
    }

    const noteData = noteDoc.data()!;
    if (noteData.uid !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const newFavState = !noteData.isFavorite;
    await noteRef.update({ isFavorite: newFavState });

    res.json({ message: 'Favorite state updated', isFavorite: newFavState });
  } catch (error: any) {
    console.error('Failed to toggle note favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite.' });
  }
});

// Delete a study note
router.delete('/notes/:noteId', verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { noteId } = req.params;

  try {
    const noteRef = db.collection('studyNotes').doc(noteId);
    const noteDoc = await noteRef.get();

    if (!noteDoc.exists) {
      return res.status(404).json({ error: 'Study note not found' });
    }

    const noteData = noteDoc.data()!;
    if (noteData.uid !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await noteRef.delete();

    res.json({ message: 'Study note deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete study note:', error);
    res.status(500).json({ error: 'Failed to delete study note.' });
  }
});

// Complete a study note (self-test quiz completed) to earn +10 XP
router.post('/notes/:noteId/complete', verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { noteId } = req.params;

  try {
    const noteRef = db.collection('studyNotes').doc(noteId);
    const userDocRef = db.collection('users').doc(req.user.uid);

    let leveledUp = false;
    let newLevel = 1;
    let newlyUnlockedAchievements: any[] = [];
    const rewards = { xp: 10, coins: 5 };

    await db.runTransaction(async (transaction: any) => {
      const noteDocSnapshot = await transaction.get(noteRef);
      if (!noteDocSnapshot.exists) {
        throw new Error('Study note not found');
      }

      const noteData = noteDocSnapshot.data()!;
      if (noteData.uid !== req.user!.uid) {
        throw new Error('Forbidden: Access denied');
      }

      if (noteData.completed) {
        // Exploit prevention: already completed
        throw new Error('Study note already completed');
      }

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

      // 1. Authoritatively evaluate study notes base XP reward
      const baseEval = LevelCalculator.evaluateXpReward({
        currentXp: oldXp,
        xpEarned: rewards.xp,
        userId: req.user!.uid,
        source: 'study_notes',
        referenceId: noteId
      });

      const currentCoins = (userData.coins || 0) + rewards.coins;
      newLevel = baseEval.levelAfter;
      if (baseEval.leveledUp) {
        leveledUp = true;
      }

      // Increment stats
      const totalQuestionsSolved = userData.stats?.totalQuestionsSolved || 0;
      const placementReadinessScore = calculatePlacementReadiness({
        ...userData,
        level: newLevel
      });

      // Increment missions progress
      const tempMissions = userData.missionsState || {};
      const syncedMissions = syncMissionsState(tempMissions, new Date());
      const r1 = processMissionProgress(syncedMissions, 'xp_earned', rewards.xp);
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
          totalQuestionsSolved,
          totalMockTests: userData.stats?.totalMockTests || 0,
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
          referenceId: `study_ach_${noteId}`
        });

        finalEval = achEval;
        newLevel = achEval.levelAfter;
        if (achEval.levelAfter > oldLevel) {
          leveledUp = true;
        }

        // Record achievement XP transaction
        const achTxKey = `achievement_study_ach_${noteId}_${req.user!.uid}`;
        transaction.set(db.collection('xpTransactions').doc(achTxKey), achEval.transaction);
      }

      // Record base study notes XP transaction
      const studyTxKey = `study_notes_${noteId}_${req.user!.uid}`;
      transaction.set(db.collection('xpTransactions').doc(studyTxKey), baseEval.transaction);

      transaction.update(noteRef, { completed: true });
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
        unlockedAchievements: unlockedAchievementsList
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

    const updatedUserDoc = await userDocRef.get();
    res.json({
      message: 'Study notes completed successfully',
      rewards,
      profile: updatedUserDoc.data()
    });

  } catch (error: any) {
    console.error('[STUDY API] Completion failed:', error);
    res.status(500).json({ error: error.message || 'Failed to complete study note.' });
  }
});

export default router;
