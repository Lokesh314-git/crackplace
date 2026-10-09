import crypto from 'crypto';
import { Question, SanitizedQuestion } from '../types/question';
import { supabase } from '../config/supabase';
import { redisClient } from '../config/redis';
import logger from '../utils/logger';

export interface PlayerQuestionPackage {
  sanitizedQuestions: SanitizedQuestion[];
  optionMappings: { [qIndex: number]: number[] };
}

export class QuestionService {
  /**
   * Subject aliases to standardized database slug mapping
   */
  public static normalizeSubjectSlug(category: string): string {
    const s = (category || '').toLowerCase().trim().replace(/[\s-]+/g, '_');

    if (s.includes('aptitude') || s.includes('quant') || s.includes('math') || s.includes('arithmetic')) {
      return 'quantitative_aptitude';
    }
    if (s.includes('dsa') || s.includes('data_structure') || s.includes('algorithm') || s.includes('programming') || s.includes('java') || s.includes('python')) {
      return 'dsa';
    }
    if (s.includes('dbms') || s.includes('database') || s.includes('sql')) {
      return 'dbms';
    }
    if (s.includes('os') || s.includes('operating_system') || s.includes('linux')) {
      return 'operating_system';
    }
    if (s.includes('network') || s.includes('cn') || s.includes('telecom')) {
      return 'computer_network';
    }
    if (s.includes('reasoning') || s.includes('logic') || s.includes('puzzle')) {
      return 'logical_reasoning';
    }
    if (s.includes('verbal') || s.includes('english') || s.includes('grammar') || s.includes('reading')) {
      return 'verbal_ability';
    }
    if (s.includes('hr') || s.includes('behavioral') || s.includes('interview')) {
      return 'hr_behavioral';
    }

    return s || 'dsa';
  }

  /**
   * Deterministic SHA-256 hash for duplicate detection
   */
  public static computeQuestionHash(text: string, options: string[]): string {
    const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedOptions = options.map(o => o.toLowerCase().replace(/\s+/g, ' ').trim()).sort().join('|');
    return crypto.createHash('sha256').update(`${normalizedText}:::${normalizedOptions}`).digest('hex');
  }

  /**
   * Validate question schema and integrity
   */
  public static validateQuestion(q: { question?: string; options?: string[]; correctOption?: number }): { valid: boolean; reason?: string } {
    if (!q.question || typeof q.question !== 'string' || q.question.trim().length === 0) {
      return { valid: false, reason: 'Empty or invalid question prompt' };
    }
    if (!Array.isArray(q.options) || q.options.length < 2) {
      return { valid: false, reason: 'Must have at least 2 options' };
    }
    // Check for duplicate options
    const unique = new Set(q.options.map(o => String(o).trim().toLowerCase()));
    if (unique.size !== q.options.length) {
      return { valid: false, reason: 'Duplicate options detected' };
    }
    if (typeof q.correctOption !== 'number' || q.correctOption < 0 || q.correctOption >= q.options.length) {
      return { valid: false, reason: 'Invalid correctOption index' };
    }
    return { valid: true };
  }

  /**
   * Maps dataset subject names to placement subjects
   */
  public static mapCategory(datasetSubject: string, source: string): { category: string; topic: string } {
    const s = (datasetSubject || '').toLowerCase();
    if (s.includes('math') || s.includes('calculus') || s.includes('algebra') || s.includes('arithmetic') || s.includes('quant')) {
      return { category: 'Aptitude', topic: 'Mathematics' };
    }
    if (s.includes('computer') || s.includes('algo') || s.includes('programming') || s.includes('_cs') || s.startsWith('cs_') || s === 'cs') {
      return { category: 'DSA', topic: 'Computer Science' };
    }
    if (s.includes('logic') || s.includes('puzzle') || s.includes('reason') || source === 'hellaswag') {
      return { category: 'Reasoning', topic: 'Logical Reasoning' };
    }
    return { category: 'DSA', topic: 'General' };
  }

  /**
   * Classifies difficulty level based on text and complexity
   */
  public static classifyDifficulty(text: string, options?: string[], category?: string): 'easy' | 'medium' | 'hard' {
    const len = (text || '').length;
    if (len > 250) return 'hard';
    if (len > 120) return 'medium';
    return 'easy';
  }

  /**
   * Resolve correct answer index from raw database answer column
   */
  public static resolveCorrectOptionIndex(correctAnswerRaw: any, options: string[]): number {
    if (correctAnswerRaw === undefined || correctAnswerRaw === null) return 0;
    const raw = String(correctAnswerRaw).trim();
    if (!raw) return 0;

    const upper = raw.toUpperCase();
    if (upper === 'A') return 0;
    if (upper === 'B') return 1;
    if (upper === 'C') return 2;
    if (upper === 'D') return 3;

    // Pattern matching e.g. "Option A", "A)", "(B)", "Choice C", "[D]"
    const match = upper.match(/^(?:OPTION\s+|CHOICE\s+|ANSWER\s+)?[\(\[\{]?([A-D])[\)\]\}]?\.?$/i);
    if (match && match[1]) {
      return match[1].toUpperCase().charCodeAt(0) - 65;
    }

    if (raw === '0') return 0;
    if (raw === '1') return 0;
    if (raw === '2') return 1;
    if (raw === '3') return 2;
    if (raw === '4') return 3;

    // Exact or normalized match against options text
    const normRaw = raw.toLowerCase().replace(/\s+/g, ' ');
    for (let i = 0; i < options.length; i++) {
      const optNorm = (options[i] || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (optNorm && (optNorm === normRaw || optNorm.startsWith(normRaw) || normRaw.startsWith(optNorm))) {
        return i;
      }
    }

    return 0;
  }

  /**
   * Shuffles options positions safely while re-mapping the correctOption index
   */
  public static shuffleQuestionOptions(q: Question): Question {
    if (!q.options || q.options.length < 2) return q;

    const originalCorrectIndex = typeof q.correctOption === 'number' ? q.correctOption : 0;
    const items = q.options.map((opt, idx) => ({
      opt,
      isCorrect: idx === originalCorrectIndex
    }));

    // Fisher-Yates shuffle
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    const newOptions = items.map(x => x.opt);
    const newCorrectIndex = items.findIndex(x => x.isCorrect);

    return {
      ...q,
      options: newOptions,
      correctOption: newCorrectIndex !== -1 ? newCorrectIndex : 0
    };
  }

  /**
   * Generates an independent shuffled question package for a specific player.
   * For each question, creates a random permutation of option indices [0..N-1].
   * mapping[displayedIndex] = originalIndex
   */
  public static generatePlayerQuestionPackage(questions: Question[]): PlayerQuestionPackage {
    const sanitizedQuestions: SanitizedQuestion[] = [];
    const optionMappings: { [qIndex: number]: number[] } = {};

    questions.forEach((q, qIndex) => {
      const numOptions = q.options.length;
      // mapping[displayedIndex] = originalIndex
      const indices = Array.from({ length: numOptions }, (_, i) => i);

      // Fisher-Yates shuffle of displayed option positions
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      optionMappings[qIndex] = indices;
      const shuffledOptions = indices.map(origIdx => q.options[origIdx]);

      sanitizedQuestions.push({
        id: q.id,
        questionIndex: qIndex,
        questionText: q.question,
        options: shuffledOptions,
        category: q.category,
        difficulty: q.difficulty
      });
    });

    return {
      sanitizedQuestions,
      optionMappings
    };
  }

  /**
   * Map Supabase DB Row to Application Question Model
   */
  public static mapDbRowToQuestion(row: any): Question {
    const options = [
      row.option_a || '',
      row.option_b || '',
      row.option_c || '',
      row.option_d || ''
    ].filter(Boolean);

    const safeOptions = options.length >= 2 ? options : ['Option A', 'Option B', 'Option C', 'Option D'];
    const correctOption = this.resolveCorrectOptionIndex(row.correct_answer, safeOptions);

    const diff = (row.difficulty || 'Medium').toLowerCase();
    const normalizedDifficulty: 'easy' | 'medium' | 'hard' = 
      diff === 'easy' ? 'easy' : diff === 'hard' ? 'hard' : 'medium';

    return {
      id: row.question_id || row.id,
      source: (row.source as any) || 'curated',
      sourceQuestionId: row.question_id,
      category: row.subject,
      topic: row.topic || 'General',
      subtopic: row.subtopic || undefined,
      difficulty: normalizedDifficulty,
      question: row.question,
      options: safeOptions,
      correctOption,
      explanation: row.explanation || undefined,
      active: true,
      importedAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString()
    };
  }

  /**
   * Practice Questions Retrieval Engine
   * Retrieves authoritative questions from Supabase for all 8 placement subjects with flexible topic and difficulty filters.
   */
  public static async getPracticeQuestions(params: {
    category: string;
    count?: number;
    preferredDifficulty?: string;
    topic?: string;
  }): Promise<{ questions: Question[]; matchedTopicCount: number; requestedCount: number }> {
    const count = Math.max(1, params.count || 10);
    const subjectSlug = this.normalizeSubjectSlug(params.category);
    const diffUpper = (params.preferredDifficulty || 'medium').charAt(0).toUpperCase() + (params.preferredDifficulty || 'medium').slice(1).toLowerCase();
    const isMixed = !params.preferredDifficulty || params.preferredDifficulty.toLowerCase() === 'mixed' || params.preferredDifficulty.toLowerCase() === 'all';
    const topicRaw = params.topic && params.topic.trim() !== '' && params.topic !== 'All' ? params.topic.trim() : null;

    const uniqueMap = new Map<string, Question>();
    let matchedTopicCount = 0;

    try {
      // 1. If a specific topic is requested, query with topic matching
      if (topicRaw) {
        // Attempt exact and ilike match (handling & vs and)
        const topicNormAlt = topicRaw.includes('&') 
          ? topicRaw.replace(/&/g, 'and') 
          : topicRaw.includes(' and ') 
          ? topicRaw.replace(/\sand\s/gi, ' & ') 
          : topicRaw;

        let topicQuery = supabase
          .from('questions')
          .select('*')
          .eq('subject', subjectSlug);

        // Filter difficulty if specified
        if (!isMixed && ['Easy', 'Medium', 'Hard'].includes(diffUpper)) {
          topicQuery = topicQuery.ilike('difficulty', diffUpper);
        }

        // Try ILIKE with exact or variant
        topicQuery = topicQuery.or(`topic.ilike.%${topicRaw}%,topic.ilike.%${topicNormAlt}%`);

        const { data: topicData, error: topicError } = await topicQuery.limit(count * 3);

        if (!topicError && Array.isArray(topicData) && topicData.length > 0) {
          const shuffledTopic = [...topicData].sort(() => 0.5 - Math.random());
          for (const row of shuffledTopic) {
            const q = this.mapDbRowToQuestion(row);
            if (!uniqueMap.has(q.id)) {
              uniqueMap.set(q.id, q);
            }
            if (uniqueMap.size >= count) break;
          }
          matchedTopicCount = uniqueMap.size;
        }
      }

      // 2. If no topic filter OR topic filter returned fewer than requested count, fetch from broader subject
      if (uniqueMap.size < count) {
        let generalQuery = supabase
          .from('questions')
          .select('*')
          .eq('subject', subjectSlug);

        if (!isMixed && ['Easy', 'Medium', 'Hard'].includes(diffUpper) && uniqueMap.size === 0) {
          generalQuery = generalQuery.ilike('difficulty', diffUpper);
        }

        const { data: generalData, error: generalError } = await generalQuery.limit(count * 4);

        if (!generalError && Array.isArray(generalData) && generalData.length > 0) {
          const shuffledGen = [...generalData].sort(() => 0.5 - Math.random());
          for (const row of shuffledGen) {
            const q = this.mapDbRowToQuestion(row);
            if (!uniqueMap.has(q.id)) {
              uniqueMap.set(q.id, q);
            }
            if (uniqueMap.size >= count) break;
          }
        }
      }
    } catch (err: any) {
      logger.error('[QuestionService] Practice query error', { error: err.message, subjectSlug });
    }

    // 3. Guaranteed Emergency Fallback if Supabase was unreachable
    if (uniqueMap.size === 0) {
      const fallbacks = this.getCuratedFallbackQuestions(subjectSlug);
      for (const q of fallbacks) {
        if (!uniqueMap.has(q.id)) {
          uniqueMap.set(q.id, q);
        }
        if (uniqueMap.size >= count) break;
      }
    }

    const questions = Array.from(uniqueMap.values());
    return {
      questions,
      matchedTopicCount: matchedTopicCount || questions.length,
      requestedCount: count
    };
  }

  /**
   * Select questions from Supabase PostgreSQL (Single Source of Truth)
   * Guaranteed identical authoritative question set selection for match sessions.
   */
  public static async selectBattleQuestions(
    category: string,
    count: number = 5,
    preferredDifficulty: string = 'Medium',
    topic?: string
  ): Promise<Question[]> {
    const practiceResult = await this.getPracticeQuestions({
      category,
      count,
      preferredDifficulty,
      topic
    });
    return practiceResult.questions.slice(0, count);
  }

  /**
   * Question bank distribution analysis diagnostic
   */
  public static async validateQuestionBankDistribution(): Promise<{
    totalQuestions: number;
    distribution: { A: number; B: number; C: number; D: number; other: number };
    issuesCount: number;
    issues: string[];
  }> {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('id, question_id, subject, question, option_a, option_b, option_c, option_d, correct_answer');

      if (error || !data) {
        return {
          totalQuestions: 0,
          distribution: { A: 0, B: 0, C: 0, D: 0, other: 0 },
          issuesCount: 0,
          issues: [error?.message || 'Failed to query database']
        };
      }

      const distribution = { A: 0, B: 0, C: 0, D: 0, other: 0 };
      const issues: string[] = [];

      for (const row of data) {
        const ans = String(row.correct_answer || '').trim().toUpperCase();
        if (ans === 'A') distribution.A++;
        else if (ans === 'B') distribution.B++;
        else if (ans === 'C') distribution.C++;
        else if (ans === 'D') distribution.D++;
        else distribution.other++;

        const options = [row.option_a, row.option_b, row.option_c, row.option_d].filter(Boolean);
        if (options.length < 2) {
          issues.push(`Question ${row.question_id || row.id} has fewer than 2 valid options.`);
        }
      }

      return {
        totalQuestions: data.length,
        distribution,
        issuesCount: issues.length,
        issues: issues.slice(0, 50)
      };
    } catch (err: any) {
      return {
        totalQuestions: 0,
        distribution: { A: 0, B: 0, C: 0, D: 0, other: 0 },
        issuesCount: 1,
        issues: [err.message]
      };
    }
  }

  /**
   * Sanitizes questions for client transmission by stripping correct answer indices and explanations
   * This is a critical security layer so students cannot inspect correct answers in devtools during live battles.
   */
  public static sanitizeForClient(questions: Question[]): SanitizedQuestion[] {
    return questions.map((q, idx) => ({
      id: q.id,
      questionIndex: idx,
      questionText: q.question,
      options: q.options,
      category: q.category,
      difficulty: q.difficulty
    }));
  }

  /**
   * Curated offline emergency fallback bank covering all 8 core subjects
   */
  public static getCuratedFallbackQuestions(category: string): Question[] {
    const slug = this.normalizeSubjectSlug(category);
    const now = new Date().toISOString();
    const common = {
      source: 'curated' as const,
      active: true,
      importedAt: now,
      updatedAt: now
    };

    if (slug === 'dsa') {
      return [
        {
          ...common,
          id: 'DSA0001',
          category: 'dsa',
          topic: 'Time Complexity',
          difficulty: 'easy',
          question: 'What is the average time complexity of searching an element in a Balanced Binary Search Tree?',
          options: ['O(1)', 'O(log N)', 'O(N)', 'O(N log N)'],
          correctOption: 1,
          explanation: 'In a balanced BST, the height is bounded by O(log N).'
        },
        {
          ...common,
          id: 'DSA0002',
          category: 'dsa',
          topic: 'Data Structures',
          difficulty: 'medium',
          question: 'Which data structure is primarily used in Breadth-First Search (BFS) graph traversal?',
          options: ['Stack', 'Queue', 'Priority Queue', 'Disjoint Set Union'],
          correctOption: 1,
          explanation: 'BFS explores vertices level by level using a FIFO Queue.'
        },
        {
          ...common,
          id: 'DSA0003',
          category: 'dsa',
          topic: 'Dynamic Programming',
          difficulty: 'medium',
          question: 'What is the optimal substructure property in Dynamic Programming?',
          options: [
            'A problem can be broken down into completely independent subproblems',
            'An optimal solution to the problem contains optimal solutions to subproblems',
            'The problem is solved using greedy heuristics at each step',
            'The time complexity is always O(2^N)'
          ],
          correctOption: 1,
          explanation: 'Optimal substructure implies the globally optimal solution is built from optimal subproblem solutions.'
        },
        {
          ...common,
          id: 'DSA0004',
          category: 'dsa',
          topic: 'Sorting Algorithms',
          difficulty: 'hard',
          question: 'What is the worst-case time complexity of QuickSort when the pivot is always chosen as the smallest or largest element?',
          options: ['O(N log N)', 'O(N)', 'O(N^2)', 'O(log N)'],
          correctOption: 2,
          explanation: 'Unbalanced partitions cause QuickSort to degrade to O(N^2).'
        },
        {
          ...common,
          id: 'DSA0005',
          category: 'dsa',
          topic: 'Hashing',
          difficulty: 'easy',
          question: 'What is the expected average time complexity of lookup in a Hash Table with good distribution?',
          options: ['O(1)', 'O(log N)', 'O(N)', 'O(N^2)'],
          correctOption: 0,
          explanation: 'Under uniform hashing, operations execute in amortized O(1) time.'
        }
      ];
    }

    if (slug === 'dbms') {
      return [
        {
          ...common,
          id: 'DBMS0001',
          category: 'dbms',
          topic: 'Transactions',
          difficulty: 'easy',
          question: 'Which ACID property guarantees that a transaction is either completely executed or not executed at all?',
          options: ['Atomicity', 'Consistency', 'Isolation', 'Durability'],
          correctOption: 0,
          explanation: 'Atomicity ensures all-or-nothing transaction execution.'
        },
        {
          ...common,
          id: 'DBMS0002',
          category: 'dbms',
          topic: 'Indexing',
          difficulty: 'medium',
          question: 'Why are B+ Trees preferred over B Trees for disk-based relational database indexing?',
          options: [
            'B+ Trees store all actual records at the root node',
            'All leaf nodes are linked sequentially in B+ Trees, making range queries very fast',
            'B+ Trees require zero memory locks during concurrent writes',
            'B+ Trees consume significantly fewer disk bytes than binary trees'
          ],
          correctOption: 1,
          explanation: 'B+ Trees maintain sequential linked pointers across leaf nodes.'
        },
        {
          ...common,
          id: 'DBMS0003',
          category: 'dbms',
          topic: 'Normalization',
          difficulty: 'medium',
          question: 'A table is in Boyce-Codd Normal Form (BCNF) if for every non-trivial functional dependency X -> Y:',
          options: ['Y is a prime attribute', 'X is a superkey', 'X is a foreign key', 'Y is a candidate key'],
          correctOption: 1,
          explanation: 'BCNF requires every determinant X in a non-trivial functional dependency to be a superkey.'
        },
        {
          ...common,
          id: 'DBMS0004',
          category: 'dbms',
          topic: 'SQL Joins',
          difficulty: 'easy',
          question: 'Which SQL join returns all rows from the left table and matching rows from the right table?',
          options: ['INNER JOIN', 'RIGHT OUTER JOIN', 'LEFT OUTER JOIN', 'CROSS JOIN'],
          correctOption: 2,
          explanation: 'LEFT OUTER JOIN preserves all records from the left relation.'
        },
        {
          ...common,
          id: 'DBMS0005',
          category: 'dbms',
          topic: 'Concurrency Control',
          difficulty: 'hard',
          question: 'In Two-Phase Locking (2PL), what occurs during the shrinking phase?',
          options: [
            'New shared locks are acquired',
            'Exclusive locks are upgraded',
            'Locks are released and no new locks can be acquired',
            'The transaction is forcibly rolled back'
          ],
          correctOption: 2,
          explanation: 'In the shrinking phase of 2PL, locks are progressively released.'
        }
      ];
    }

    if (slug === 'operating_system') {
      return [
        {
          ...common,
          id: 'OS0001',
          category: 'operating_system',
          topic: 'Deadlocks',
          difficulty: 'medium',
          question: 'Which of the following is NOT one of Coffman’s four necessary conditions for a deadlock?',
          options: ['Mutual Exclusion', 'Hold and Wait', 'No Preemption', 'Preemptive Priority Inversion'],
          correctOption: 3,
          explanation: 'The 4 Coffman conditions are Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait.'
        },
        {
          ...common,
          id: 'OS0002',
          category: 'operating_system',
          topic: 'Memory Management',
          difficulty: 'easy',
          question: 'What is the primary role of the Translation Lookaside Buffer (TLB)?',
          options: [
            'To store CPU cache lines',
            'To cache recent virtual-to-physical address translations for faster lookup',
            'To synchronize process scheduling queues',
            'To prevent page thrashing'
          ],
          correctOption: 1,
          explanation: 'TLB is a fast hardware associative cache for page table translation entries.'
        },
        {
          ...common,
          id: 'OS0003',
          category: 'operating_system',
          topic: 'Process Synchronization',
          difficulty: 'hard',
          question: 'What problem does the Priority Ceiling Protocol address in real-time operating systems?',
          options: ['Page fault thrashing', 'Priority Inversion', 'Segmentation fault', 'Disk fragmentation'],
          correctOption: 1,
          explanation: 'Priority Ceiling Protocol prevents unbounded priority inversion.'
        },
        {
          ...common,
          id: 'OS0004',
          category: 'operating_system',
          topic: 'Scheduling',
          difficulty: 'easy',
          question: 'Which CPU scheduling algorithm is non-preemptive and selects the process with the smallest burst time?',
          options: ['Round Robin', 'Shortest Job First (SJF)', 'Shortest Remaining Time First (SRTF)', 'Multilevel Queue'],
          correctOption: 1,
          explanation: 'Non-preemptive SJF selects the process with minimum burst time.'
        },
        {
          ...common,
          id: 'OS0005',
          category: 'operating_system',
          topic: 'Page Replacement',
          difficulty: 'medium',
          question: 'What is Belady’s Anomaly in operating systems page replacement?',
          options: [
            'Page hit ratio increases linearly with process priority',
            'Page faults increase as the number of allocated page frames increases under FIFO',
            'Page tables overflow when virtual address space exceeds RAM',
            'Memory fragmentation exceeds allocated process footprint'
          ],
          correctOption: 1,
          explanation: 'Belady\'s Anomaly occurs in FIFO where adding page frames causes more page faults.'
        }
      ];
    }

    if (slug === 'computer_network') {
      return [
        {
          ...common,
          id: 'CN0001',
          category: 'computer_network',
          topic: 'OSI Model',
          difficulty: 'easy',
          question: 'Which layer of the OSI model is responsible for end-to-end communication, flow control, and error recovery?',
          options: ['Network Layer', 'Transport Layer', 'Data Link Layer', 'Session Layer'],
          correctOption: 1,
          explanation: 'The Transport Layer (TCP/UDP) manages end-to-end flow control and reliable transmission.'
        },
        {
          ...common,
          id: 'CN0002',
          category: 'computer_network',
          topic: 'IP Addressing',
          difficulty: 'medium',
          question: 'What is the default subnet mask for a Class C IPv4 network address?',
          options: ['255.0.0.0', '255.255.0.0', '255.255.255.0', '255.255.255.255'],
          correctOption: 2,
          explanation: 'Class C addresses use 24 bits for the network identifier, giving 255.255.255.0 (/24).'
        },
        {
          ...common,
          id: 'CN0003',
          category: 'computer_network',
          topic: 'Routing Protocols',
          difficulty: 'hard',
          question: 'Which routing protocol uses the Dijkstra algorithm to calculate the shortest path tree within an autonomous system?',
          options: ['RIP', 'BGP', 'OSPF', 'EGP'],
          correctOption: 2,
          explanation: 'OSPF is a link-state protocol that uses Dijkstra\'s shortest path first algorithm.'
        }
      ];
    }

    if (slug === 'logical_reasoning') {
      return [
        {
          ...common,
          id: 'LR0001',
          category: 'logical_reasoning',
          topic: 'Series Completion',
          difficulty: 'easy',
          question: 'Complete the number series: 2, 6, 12, 20, 30, ?',
          options: ['40', '42', '44', '36'],
          correctOption: 1,
          explanation: 'Differences are +4, +6, +8, +10. Next difference is +12: 30 + 12 = 42.'
        },
        {
          ...common,
          id: 'LR0002',
          category: 'logical_reasoning',
          topic: 'Blood Relations',
          difficulty: 'easy',
          question: 'Pointing to a photograph, John says: "She is the daughter of my grandfather\'s only son." How is the girl in the photograph related to John?',
          options: ['Mother', 'Sister', 'Aunt', 'Cousin'],
          correctOption: 1,
          explanation: 'Grandfather\'s only son is John\'s father. The daughter is John\'s sister.'
        },
        {
          ...common,
          id: 'LR0003',
          category: 'logical_reasoning',
          topic: 'Direction Sense',
          difficulty: 'medium',
          question: 'A person walks 4 km North, turns right and walks 3 km. How far is he from the starting point?',
          options: ['7 km', '5 km', '6 km', '1 km'],
          correctOption: 1,
          explanation: 'sqrt(4^2 + 3^2) = 5 km.'
        },
        {
          ...common,
          id: 'LR0004',
          category: 'logical_reasoning',
          topic: 'Coding-Decoding',
          difficulty: 'easy',
          question: 'If "APPLE" is coded as "EQTPI" (+4 shift on each letter), how is "CODE" coded with the same rule?',
          options: ['GSHI', 'GSII', 'HTHI', 'GRHI'],
          correctOption: 0,
          explanation: 'C(+4)=G, O(+4)=S, D(+4)=H, E(+4)=I => GSHI.'
        },
        {
          ...common,
          id: 'LR0005',
          category: 'logical_reasoning',
          topic: 'Syllogisms',
          difficulty: 'medium',
          question: 'Statements: All dogs are mammals. All mammals are animals. Conclusion: All dogs are animals.',
          options: ['True', 'False', 'Cannot be determined', 'Partially true'],
          correctOption: 0,
          explanation: 'Transitive subset relationship: Dogs subset of Mammals subset of Animals.'
        }
      ];
    }

    if (slug === 'verbal_ability') {
      return [
        {
          ...common,
          id: 'VA0001',
          category: 'verbal_ability',
          topic: 'Sentence Correction & Grammar',
          difficulty: 'easy',
          question: 'Choose the grammatically correct sentence:',
          options: [
            'Neither the manager nor the employees was present.',
            'Neither the manager nor the employees were present.',
            'Neither the manager or the employees was present.',
            'Neither the manager nor the employees are been present.'
          ],
          correctOption: 1,
          explanation: 'In neither...nor constructions, verb agrees with the closer subject ("employees" -> "were").'
        },
        {
          ...common,
          id: 'VA0002',
          category: 'verbal_ability',
          topic: 'Vocabulary',
          difficulty: 'medium',
          question: 'What is the SYNONYM of the word "EPHEMERAL"?',
          options: ['Eternal', 'Transitory', 'Substantial', 'Enigmatic'],
          correctOption: 1,
          explanation: 'Ephemeral means lasting a very short time; transitory.'
        },
        {
          ...common,
          id: 'VA0003',
          category: 'verbal_ability',
          topic: 'Idioms & Phrases',
          difficulty: 'easy',
          question: 'What does the idiom "Bite the bullet" mean?',
          options: ['To eat something hard', 'To face a grim situation with fortitude', 'To start a fight', 'To make a mistake'],
          correctOption: 1,
          explanation: '"Bite the bullet" means accepting a difficult or unpleasant situation stoically.'
        },
        {
          ...common,
          id: 'VA0004',
          category: 'verbal_ability',
          topic: 'Vocabulary',
          difficulty: 'easy',
          question: 'What is the ANTONYM of "MITIGATE"?',
          options: ['Alleviate', 'Aggravate', 'Moderate', 'Assuage'],
          correctOption: 1,
          explanation: 'Mitigate means to lessen; aggravate means to make worse.'
        },
        {
          ...common,
          id: 'VA0005',
          category: 'verbal_ability',
          topic: 'Error Spotting',
          difficulty: 'medium',
          question: 'Identify the error in: "One of the players have been selected for national trials."',
          options: ['"One of the players"', '"have been selected"', '"for national trials"', 'No error'],
          correctOption: 1,
          explanation: 'Subject "One" is singular, so it should be "has been selected".'
        }
      ];
    }

    if (slug === 'hr_behavioral') {
      return [
        {
          ...common,
          id: 'HR0001',
          category: 'hr_behavioral',
          topic: 'STAR Method Behavioral',
          difficulty: 'easy',
          question: 'What does the acronym "STAR" stand for in behavioral interview methodology?',
          options: [
            'Strategy, Tactics, Action, Review',
            'Situation, Task, Action, Result',
            'Skills, Teamwork, Assessment, Reward',
            'Structure, Testing, Alignment, Release'
          ],
          correctOption: 1,
          explanation: 'The STAR framework structures behavioral answers into Situation, Task, Action, and Result.'
        },
        {
          ...common,
          id: 'HR0002',
          category: 'hr_behavioral',
          topic: 'Conflict Resolution',
          difficulty: 'medium',
          question: 'When asked how you handle a technical disagreement with a teammate, which approach is most effective?',
          options: [
            'Insist on your solution because you are confident',
            'Escalate immediately to the department manager',
            'Engage in data-backed evaluation of trade-offs and build consensus',
            'Ignore the conflict and work completely independently'
          ],
          correctOption: 2,
          explanation: 'Collaboration requires objective data-backed evaluation and mutual consensus.'
        },
        {
          ...common,
          id: 'HR0003',
          category: 'hr_behavioral',
          topic: 'Strengths & Weaknesses',
          difficulty: 'easy',
          question: 'What is the most professional way to address "What is your biggest weakness?" in an interview?',
          options: [
            'State that you have no weaknesses',
            'Share a genuine skill area along with concrete steps you are taking to improve it',
            'Say you work too hard and are a perfectionist',
            'Mention you dislike teamwork'
          ],
          correctOption: 1,
          explanation: 'Self-awareness combined with demonstrable self-improvement shows maturity and growth mindset.'
        },
        {
          ...common,
          id: 'HR0004',
          category: 'hr_behavioral',
          topic: 'Career Goals & Motivation',
          difficulty: 'medium',
          question: 'When asked "Why do you want to join our company?", which response is strongest?',
          options: [
            '"Because you offer high starting salary."',
            '"Because my friends applied."',
            '"I researched your engineering products and my background aligns with your scalability challenges."',
            '"I just need a placement offer to graduate."'
          ],
          correctOption: 2,
          explanation: 'Demonstrating product knowledge and connecting skills to company goals demonstrates high motivation.'
        },
        {
          ...common,
          id: 'HR0005',
          category: 'hr_behavioral',
          topic: 'Leadership & Teamwork',
          difficulty: 'medium',
          question: 'A teammate is falling behind before a deadline. What is the most constructive action?',
          options: [
            'Report them without speaking to them',
            'Reach out to understand blockers, pair-solve, and reallocate tasks if needed',
            'Do nothing as it is their personal task',
            'Take full credit for the project'
          ],
          correctOption: 1,
          explanation: 'Great teammates offer proactive support, diagnose blockers, and collaborate to ensure team success.'
        }
      ];
    }

    // Default Quantitative Aptitude
    return [
      {
        ...common,
        id: 'QA0001',
        category: 'quantitative_aptitude',
        topic: 'Time & Work',
        difficulty: 'medium',
        question: 'Pipe A can fill a tank in 6 hours and Pipe B can empty it in 8 hours. If both pipes are opened simultaneously, in how many hours will the tank be full?',
        options: ['14 hours', '20 hours', '24 hours', '12 hours'],
        correctOption: 2,
        explanation: 'Net rate = (1/6) - (1/8) = (4 - 3)/24 = 1/24. Thus, it takes 24 hours.'
      },
      {
        ...common,
        id: 'QA0002',
        category: 'quantitative_aptitude',
        topic: 'Percentages & Profit',
        difficulty: 'easy',
        question: 'An item is bought for $80 and sold for $100. What is the percentage profit?',
        options: ['20%', '25%', '15%', '30%'],
        correctOption: 1,
        explanation: 'Profit = 100 - 80 = 20. Profit percentage = (20 / 80) * 100 = 25%.'
      },
      {
        ...common,
        id: 'QA0003',
        category: 'quantitative_aptitude',
        topic: 'Speed & Distance',
        difficulty: 'medium',
        question: 'A train 150 meters long passes a pole in 15 seconds. What is the speed of the train in km/h?',
        options: ['30 km/h', '36 km/h', '45 km/h', '54 km/h'],
        correctOption: 1,
        explanation: 'Speed in m/s = 150 / 15 = 10 m/s. In km/h = 10 * (18 / 5) = 36 km/h.'
      },
      {
        ...common,
        id: 'QA0004',
        category: 'quantitative_aptitude',
        topic: 'Number System',
        difficulty: 'easy',
        question: 'What is the remainder when (7^19 + 2) is divided by 6?',
        options: ['1', '2', '3', '0'],
        correctOption: 2,
        explanation: '7 mod 6 = 1. So 7^19 mod 6 = 1^19 = 1. (1 + 2) mod 6 = 3.'
      },
      {
        ...common,
        id: 'QA0005',
        category: 'quantitative_aptitude',
        topic: 'Ratio and Proportion',
        difficulty: 'medium',
        question: 'If A:B = 2:3 and B:C = 4:5, what is A:B:C?',
        options: ['8:12:15', '2:4:5', '6:8:10', '8:10:15'],
        correctOption: 0,
        explanation: 'A:B = 8:12 and B:C = 12:15 => A:B:C = 8:12:15.'
      }
    ];
  }
}

export default QuestionService;
