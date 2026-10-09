import { Router } from 'express';
import { verifyToken, AuthenticatedRequest } from '../middleware/auth';
import { AIService } from '../services/AIService';
import { db } from '../config/firebase';
import { z } from 'zod';
import { calculateLevelFromXP, calculateLevelProgress, LevelCalculator, syncMissionsState, processMissionProgress, checkAndUnlockAchievements, updateDailyStreak } from '../utils/gamification';
import { calculatePlacementReadiness } from '../utils/readiness';
import { XpTransactionService } from '../services/XpTransactionService';

const router = Router();

const generateCodingSchema = z.object({
  category: z.string().default('Arrays'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('easy')
});

interface TestCase {
  input: string;
  output: string;
  explanation?: string;
}

interface CodingProblem {
  title: string;
  description: string;
  constraints: string[];
  inputFormat: string;
  outputFormat: string;
  sampleCases: TestCase[];
  hiddenCases: TestCase[];
  starterCode: {
    python: string;
    java: string;
    javascript: string;
    cpp: string;
  };
}

// 1. Generate coding challenge
router.post('/generate', verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parseResult = generateCodingSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid parameters', details: parseResult.error.format() });
  }

  const { category, difficulty } = parseResult.data;

  try {
    const systemPrompt = `You are a Google/Meta software engineer interviewer. Your task is to output coding challenges in raw JSON format.`;
    const prompt = `Generate a coding problem for the category "${category}" with "${difficulty}" difficulty.
The output MUST be a single raw JSON object conforming strictly to the schema below.

JSON Schema:
{
  "title": "Problem Title",
  "description": "Clear and detailed problem description, using markdown for code blocks or math formatting.",
  "constraints": ["Constraint 1 (e.g. 1 <= nums.length <= 10^5)", "Constraint 2"],
  "inputFormat": "Description of input format",
  "outputFormat": "Description of output format",
  "sampleCases": [
    { "input": "sample input", "output": "sample output", "explanation": "optional explanation of sample case" }
  ],
  "hiddenCases": [
    { "input": "hidden case 1", "output": "expected output 1" },
    { "input": "hidden case 2", "output": "expected output 2" },
    { "input": "hidden case 3", "output": "expected output 3" }
  ],
  "starterCode": {
    "python": "starter code string (e.g. def solve(self, ...):\\n    pass)",
    "java": "starter code string (e.g. class Solution {\\n    public ...\\n})",
    "javascript": "starter code string (e.g. function solve(...) {\\n\\n})",
    "cpp": "starter code string (e.g. class Solution {\\npublic:\\n    ...\\n};)"
  }
}`;

    console.log(`[CODING API] Requesting coding problem for category ${category} (${difficulty})`);
    const problem = await AIService.generateJSON<CodingProblem>(prompt, systemPrompt);

    // Validate and automatically repair generated starter code templates
    const verifiedStarterCode = validateAndRepairStarterCode(problem.starterCode, problem.title);

    // Save problem session details to Firestore (without revealing hidden cases directly to frontend)
    const problemData = {
      userId: req.user.uid,
      category,
      difficulty,
      title: problem.title,
      description: problem.description,
      constraints: problem.constraints,
      inputFormat: problem.inputFormat,
      outputFormat: problem.outputFormat,
      sampleCases: problem.sampleCases,
      hiddenCases: problem.hiddenCases, // cached securely in Firestore
      starterCode: verifiedStarterCode,
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('coding_problems').add(problemData);

    // Return to client, omitting hiddenCases to prevent front-end cheat-inspecting
    const { hiddenCases, ...clientProblem } = problemData;
    
    res.json({
      problemId: docRef.id,
      ...clientProblem
    });
  } catch (error) {
    console.error('[CODING API] Generation failed:', error);
    res.status(500).json({ error: 'AI Coding Generator failed. Try again.' });
  }
});

// 2. Run code against test cases (using Kimi K2.6 model code simulation)
const runCodeSchema = z.object({
  problemId: z.string(),
  code: z.string(),
  language: z.enum(['python', 'java', 'javascript', 'cpp']),
  submit: z.boolean().optional().default(false)
});

router.post('/run', verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parseResult = runCodeSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid compilation parameters', details: parseResult.error.format() });
  }

  const { problemId, code, language, submit = false } = parseResult.data;

  try {
    const problemDoc = await db.collection('coding_problems').doc(problemId).get();
    if (!problemDoc.exists) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    const problemData = problemDoc.data() as CodingProblem;

    // Combine sample and hidden cases for evaluation
    const allCases = [...problemData.sampleCases, ...problemData.hiddenCases];

    const systemPrompt = `You are a high-performance code compiler and test-case runner. Your job is to simulate code execution and output JSON results.`;
    const prompt = `Review the following ${language} code written to solve the challenge "${problemData.title}".
Problem Constraints: ${JSON.stringify(problemData.constraints)}

Code Submitted:
\`\`\`${language}
${code}
\`\`\`

Evaluate this code against these test cases:
${JSON.stringify(allCases)}

Determine if the code compiles, executes within constraints, and handles all cases correctly.
Return ONLY a raw JSON object conforming strictly to the schema below.

JSON Schema:
{
  "passed": true | false (true only if ALL test cases pass),
  "output": "stdout logs of the execution",
  "error": "compilation or runtime error text, or null if successful",
  "testCaseResults": [
    {
      "input": "input evaluated",
      "expected": "expected output",
      "actual": "actual output produced by code",
      "passed": true | false
    }
  ]
}`;

    console.log(`[CODING API] Simulating execution for problem: ${problemData.title} in ${language}`);
    const result = await AIService.generateJSON(prompt, systemPrompt);

    // If passed, award user coins/XP and update problem count
    let rewards = { xp: 0, coins: 0 };
    const problemDocRef = db.collection('coding_problems').doc(problemId);

    if (result.passed) {
      if (submit) {
        let leveledUp = false;
        let newLevel = 1;
        let newlyUnlockedAchievements: any[] = [];
        const userDocRef = db.collection('users').doc(req.user.uid);

        try {
          await db.runTransaction(async (transaction: any) => {
            const problemSnap = await transaction.get(problemDocRef);
            if (!problemSnap.exists) {
              throw new Error('Problem not found');
            }

            const problemData = problemSnap.data()!;
            if (problemData.solved) {
              // Already solved, do not award rewards again!
              rewards.xp = 0;
              rewards.coins = 0;
              return;
            }

            const difficulty = problemData.difficulty || 'easy';
            let baseXp = 20;
            let baseCoins = 10;
            if (difficulty === 'medium') {
              baseXp = 40;
              baseCoins = 20;
            } else if (difficulty === 'hard') {
              baseXp = 70;
              baseCoins = 35;
            }

            let bonusXp = 0;
            const currentRunCount = problemData.runCount || 0;
            if (currentRunCount === 0) {
              // First Try Success Bonus: +15 XP
              bonusXp = 15;
            }

            rewards.xp = baseXp + bonusXp;
            rewards.coins = baseCoins;

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

            // 1. Authoritatively evaluate coding challenge base XP reward
            const baseEval = LevelCalculator.evaluateXpReward({
              currentXp: oldXp,
              xpEarned: rewards.xp,
              userId: req.user!.uid,
              source: 'coding',
              referenceId: problemId
            });

            const currentCoins = (userData.coins || 0) + rewards.coins;
            newLevel = baseEval.levelAfter;
            if (baseEval.leveledUp) {
              leveledUp = true;
            }

            const totalQuestionsSolved = (userData.stats?.totalQuestionsSolved || 0) + 1;
            const subjectPerformance = userData.stats?.subjectPerformance || {};
            const category = problemData.category || 'DSA';
            const categoryStats = subjectPerformance[category] || { attempted: 0, correct: 0 };
            subjectPerformance[category] = {
              attempted: categoryStats.attempted + 1,
              correct: categoryStats.correct + 1
            };
            
            const placementReadinessScore = calculatePlacementReadiness({
              ...userData,
              level: newLevel,
              stats: {
                ...(userData.stats || {}),
                totalQuestionsSolved,
                subjectPerformance
              }
            });

            // Increment missions progress
            const tempMissions = userData.missionsState || {};
            const syncedMissions = syncMissionsState(tempMissions, new Date());
            const r1 = processMissionProgress(syncedMissions, 'coding_completed', 1);
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
                referenceId: `coding_ach_${problemId}`
              });

              finalEval = achEval;
              newLevel = achEval.levelAfter;
              if (achEval.levelAfter > oldLevel) {
                leveledUp = true;
              }

              // Record achievement XP transaction
              const achTxKey = `achievement_coding_ach_${problemId}_${req.user!.uid}`;
              transaction.set(db.collection('xpTransactions').doc(achTxKey), achEval.transaction);
            }

            // Record base coding challenge XP transaction
            const codingTxKey = `coding_${problemId}_${req.user!.uid}`;
            transaction.set(db.collection('xpTransactions').doc(codingTxKey), baseEval.transaction);

            // Mark problem as solved and increment runCount
            transaction.update(problemDocRef, {
              solved: true,
              runCount: currentRunCount + 1
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
        } catch (err) {
          console.error('[CODING API] Transaction update failed:', err);
        }
      } else {
        // Just increment runCount for run code simulation
        try {
          await db.runTransaction(async (transaction: any) => {
            const problemSnap = await transaction.get(problemDocRef);
            if (problemSnap.exists) {
              const currentRunCount = problemSnap.data()!.runCount || 0;
              transaction.update(problemDocRef, { runCount: currentRunCount + 1 });
            }
          });
        } catch (err) {
          console.error('[CODING API] Failed to increment runCount:', err);
        }
      }
    } else {
      // Failed run: increment runCount
      try {
        await db.runTransaction(async (transaction: any) => {
          const problemSnap = await transaction.get(problemDocRef);
          if (problemSnap.exists) {
            const currentRunCount = problemSnap.data()!.runCount || 0;
            transaction.update(problemDocRef, { runCount: currentRunCount + 1 });
          }
        });
      } catch (err) {
        console.error('[CODING API] Failed to increment runCount on fail:', err);
      }
    }

    res.json({
      ...result,
      rewards
    });
  } catch (error) {
    console.error('[CODING API] Execution simulation failed:', error);
    res.status(500).json({ error: 'Code execution simulation failed. Please try again.' });
  }
});

// 3. AI Code Review
router.post('/review', verifyToken, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parseResult = runCodeSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid parameters', details: parseResult.error.format() });
  }

  const { problemId, code, language } = parseResult.data;

  try {
    const problemDoc = await db.collection('coding_problems').doc(problemId).get();
    if (!problemDoc.exists) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    const problemData = problemDoc.data() as CodingProblem;

    const systemPrompt = `You are a principal software engineer and expert code reviewer. You output review reports in raw JSON.`;
    const prompt = `Review this code for problem "${problemData.title}".
Problem description: ${problemData.description}
Constraints: ${JSON.stringify(problemData.constraints)}

Code Submitted:
\`\`\`${language}
${code}
\`\`\`

Perform static analysis. Estimate time/space complexity, grade readability and optimization, and provide advice.
Return ONLY a raw JSON object conforming strictly to the schema below.

JSON Schema:
{
  "timeComplexity": "O(N) | O(log N) etc",
  "spaceComplexity": "O(1) | O(N) etc",
  "qualityScore": number (1-100),
  "readabilityComments": "feedback on naming, structure, formatting",
  "optimizationComments": "feedback on efficiency, redundant calculations, memory allocations",
  "optimalSolutionExplanation": "brief description of how to solve this optimally",
  "editorialCode": "fully written optimal solution code in this language"
}`;

    console.log(`[CODING API] Performing AI Code Review for problem: ${problemData.title}`);
    const review = await AIService.generateJSON(prompt, systemPrompt);

    res.json(review);
  } catch (error) {
    console.error('[CODING API] Review failed:', error);
    res.status(500).json({ error: 'AI Code Review failed. Please try again.' });
  }
});

/**
 * Utility to clean, deduplicate, validate, and format starter code templates.
 * Enforces strict LeetCode-style templates and eliminates syntax errors/duplicates.
 */
export function cleanAndFormatCode(code: string, lang: string, title: string = 'solve'): string {
  if (!code || typeof code !== 'string') {
    return generateFallbackTemplate(lang, title);
  }

  let lines = code.split('\n').map(line => line.trimEnd());
  
  if (lang === 'python') {
    let cleanedLines: string[] = [];
    let seenSolutionClass = false;
    let seenMethods = new Set<string>();
    
    // Auto-inject standard imports for Python
    let imports = [
      "from typing import List, Dict, Set, Tuple, Optional, Union",
      ""
    ];
    
    for (let i = 0; i < lines.length; i++) {
      let trimmed = lines[i].trim();
      
      // Filter out duplicate or conflicting typing imports
      if (trimmed.startsWith('from typing import') || trimmed.startsWith('import typing')) {
        continue;
      }
      
      if (trimmed.startsWith('class Solution')) {
        if (seenSolutionClass) continue;
        seenSolutionClass = true;
        cleanedLines.push('class Solution:');
        continue;
      }
      
      if (trimmed.startsWith('def ')) {
        let match = trimmed.match(/def\s+(\w+)/);
        if (match) {
          let methodName = match[1];
          if (seenMethods.has(methodName)) continue;
          seenMethods.add(methodName);
        }
      }
      
      // Filter out stray standalone assignment lines that are duplicates of method vars
      if (!seenSolutionClass && (trimmed.startsWith('ans =') || trimmed.startsWith('return '))) {
        continue;
      }
      
      cleanedLines.push(lines[i]);
    }
    
    // Re-verify class Solution wrap
    if (!seenSolutionClass) {
      cleanedLines = ['class Solution:', ...cleanedLines.map(l => '    ' + l)];
    }
    
    // Format indentation level-by-level
    let formattedLines: string[] = [...imports];
    let currentIndent = 0;
    
    for (let line of cleanedLines) {
      let trimmed = line.trim();
      if (!trimmed) {
        if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        continue;
      }
      
      if (trimmed.startsWith('class Solution:')) {
        formattedLines.push('class Solution:');
        currentIndent = 4;
        continue;
      }
      
      if (trimmed.startsWith('def ')) {
        // Enforce exactly 4 spaces indent for method declaration inside Solution class
        formattedLines.push(' '.repeat(4) + trimmed);
        currentIndent = 8;
        continue;
      }
      
      // Inside method body: enforce standard 8-space indentation
      if (trimmed === 'pass') {
        formattedLines.push(' '.repeat(8) + 'pass');
        continue;
      }
      
      // Auto-correct statements outside loops or bad indent blocks
      formattedLines.push(' '.repeat(currentIndent) + trimmed);
      
      // Adjust indentation dynamically for nested control flows
      if (trimmed.endsWith(':')) {
        currentIndent = Math.min(16, currentIndent + 4);
      } else if (trimmed.startsWith('return ') || trimmed.startsWith('raise ')) {
        // Reset to method indent on return statement
        currentIndent = 8;
      }
    }
    
    // Fallback if no methods are generated
    if (seenMethods.size === 0) {
      return generateFallbackTemplate('python', title);
    }
    
    return formattedLines.join('\n').trim() + '\n';
  }
  
  if (lang === 'java' || lang === 'cpp') {
    let cleanedLines: string[] = [];
    let seenSolutionClass = false;
    
    for (let i = 0; i < lines.length; i++) {
      let trimmed = lines[i].trim();
      
      if (trimmed.startsWith('class Solution')) {
        if (seenSolutionClass) {
          // skip the duplicate class body
          let localBraces = 0;
          for (let j = i; j < lines.length; j++) {
            if (lines[j].includes('{')) localBraces++;
            if (lines[j].includes('}')) localBraces--;
            if (localBraces === 0 && j > i) {
              i = j;
              break;
            }
          }
          continue;
        }
        seenSolutionClass = true;
      }
      cleanedLines.push(lines[i]);
    }
    
    if (!seenSolutionClass) {
      return generateFallbackTemplate(lang, title);
    }
    
    // Formatting curly braces & indents
    let formattedLines: string[] = [];
    let indentLevel = 0;
    
    for (let line of cleanedLines) {
      let trimmed = line.trim();
      if (!trimmed) {
        if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        continue;
      }
      
      if (trimmed.startsWith('}')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      formattedLines.push(' '.repeat(indentLevel * 4) + trimmed);
      
      if (trimmed.endsWith('{') || trimmed.includes('{')) {
        indentLevel++;
      }
    }
    
    let output = formattedLines.join('\n');
    
    // Semicolon correction on C++ class
    if (lang === 'cpp' && !output.includes('};') && output.includes('class Solution')) {
      let lastBraceIdx = output.lastIndexOf('}');
      if (lastBraceIdx !== -1) {
        output = output.substring(0, lastBraceIdx) + '};' + output.substring(lastBraceIdx + 1);
      }
    }
    
    return output.trim() + '\n';
  }
  
  if (lang === 'javascript') {
    let formattedLines: string[] = [];
    let indentLevel = 0;
    let seenFunctions = new Set<string>();
    
    for (let line of lines) {
      let trimmed = line.trim();
      if (!trimmed) {
        if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== '') {
          formattedLines.push('');
        }
        continue;
      }
      
      // Deduplicate function signatures
      if (trimmed.startsWith('function ')) {
        let match = trimmed.match(/function\s+(\w+)/);
        if (match) {
          let funcName = match[1];
          if (seenFunctions.has(funcName)) {
            continue;
          }
          seenFunctions.add(funcName);
        }
      }
      
      if (trimmed.startsWith('}')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      formattedLines.push(' '.repeat(indentLevel * 4) + trimmed);
      
      if (trimmed.endsWith('{') || trimmed.includes('{')) {
        indentLevel++;
      }
    }
    
    return formattedLines.join('\n').trim() + '\n';
  }
  
  return code;
}

/**
 * Automatically creates clean standard LeetCode/HackerRank starter code
 * fallback templates if AI results are empty, invalid, or fail checks.
 */
function generateFallbackTemplate(lang: string, title: string): string {
  // Convert title to camelCase method name (e.g. "Single Number" -> "singleNumber")
  let methodName = title
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((word, idx) => idx === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
    
  if (!methodName) methodName = 'solve';

  switch (lang) {
    case 'python':
      return `from typing import List

class Solution:
    def ${methodName}(self, nums: List[int]) -> int:
        pass
`;
    case 'java':
      return `class Solution {
    public int ${methodName}(int[] nums) {
        return 0;
    }
}
`;
    case 'cpp':
      return `class Solution {
public:
    int ${methodName}(vector<int>& nums) {
        return 0;
    }
};
`;
    case 'javascript':
    default:
      return `/**
 * @param {number[]} nums
 * @return {number}
 */
function ${methodName}(nums) {
    return 0;
}
`;
  }
}

/**
 * Validates generated starter code templates and automatically repairs them.
 */
export function validateAndRepairStarterCode(starterCode: CodingProblem['starterCode'], title: string): CodingProblem['starterCode'] {
  const verified: CodingProblem['starterCode'] = {
    python: '',
    java: '',
    javascript: '',
    cpp: ''
  };

  verified.python = cleanAndFormatCode(starterCode?.python, 'python', title);
  verified.java = cleanAndFormatCode(starterCode?.java, 'java', title);
  verified.javascript = cleanAndFormatCode(starterCode?.javascript, 'javascript', title);
  verified.cpp = cleanAndFormatCode(starterCode?.cpp, 'cpp', title);

  return verified;
}

export default router;
