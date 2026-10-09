import { supabase, isSupabaseConfigured } from '../config/supabase';
import { SUBJECTS, SUBJECT_LIST, normalizeSubjectSlug } from '../constants/subjects';

export interface SupabaseQuestion {
  id: string;
  question_id: string;
  subject: string;
  topic: string;
  subtopic?: string | null;
  difficulty: string;
  question_type: string;
  question: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer?: string | null;
  explanation?: string | null;
  source?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PracticeQuestion {
  id: string;
  questionId: string;
  subject: string;
  topic: string;
  subtopic?: string;
  difficulty: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
}

export interface QuestionFilterOptions {
  subject?: string;
  topic?: string;
  subtopic?: string;
  difficulty?: string;
  limit?: number;
  offset?: number;
}

export interface RandomQuestionParams {
  subject?: string;
  topic?: string;
  difficulty?: string;
  limit?: number;
}

// Convert letter ('A', 'B', 'C', 'D' or 1-indexed / 0-indexed or text) to 0-3 index
export function letterToIndex(letter?: string | null, options: string[] = []): number {
  if (!letter) return 0;
  const raw = String(letter).trim();
  const upper = raw.toUpperCase();
  if (upper === 'A') return 0;
  if (upper === 'B') return 1;
  if (upper === 'C') return 2;
  if (upper === 'D') return 3;

  const match = upper.match(/^(?:OPTION\s+|CHOICE\s+|ANSWER\s+)?[\(\[\{]?([A-D])[\)\]\}]?\.?$/i);
  if (match && match[1]) {
    return match[1].toUpperCase().charCodeAt(0) - 65;
  }

  if (raw === '0') return 0;
  if (raw === '1') return 0;
  if (raw === '2') return 1;
  if (raw === '3') return 2;
  if (raw === '4') return 3;

  // Match against options text
  const normRaw = raw.toLowerCase().replace(/\s+/g, ' ');
  for (let i = 0; i < options.length; i++) {
    const optNorm = (options[i] || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (optNorm && (optNorm === normRaw || optNorm.startsWith(normRaw) || normRaw.startsWith(optNorm))) {
      return i;
    }
  }

  return 0;
}

// Safely shuffle options for a practice question while updating correctOptionIndex
export function shufflePracticeOptions(q: PracticeQuestion): PracticeQuestion {
  if (!q.options || q.options.length < 2) return q;

  const originalCorrectIndex = typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0;
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
    correctOptionIndex: newCorrectIndex !== -1 ? newCorrectIndex : 0
  };
}

// Map Supabase DB Row to Frontend PracticeQuestion model
export function mapSupabaseToPractice(row: SupabaseQuestion): PracticeQuestion {
  const options: string[] = [];
  if (row.option_a) options.push(row.option_a);
  if (row.option_b) options.push(row.option_b);
  if (row.option_c) options.push(row.option_c);
  if (row.option_d) options.push(row.option_d);

  // If fewer than 4 options in explicit columns, fallback to empty strings if needed
  while (options.length < 4 && row.question_type === 'MCQ') {
    options.push(`Option ${options.length + 1}`);
  }

  const correctIndex = letterToIndex(row.correct_answer, options);

  return {
    id: row.id,
    questionId: row.question_id || row.id,
    subject: row.subject,
    topic: row.topic || 'General',
    subtopic: row.subtopic || undefined,
    difficulty: row.difficulty || 'Medium',
    questionText: row.question,
    options,
    correctOptionIndex: correctIndex,
    explanation: row.explanation || undefined
  };
}

class QuestionService {
  /**
   * Get all supported subjects metadata
   */
  getSubjects() {
    return SUBJECT_LIST;
  }

  /**
   * Get unique topics for a subject from Supabase
   */
  async getTopics(subjectSlug: string): Promise<string[]> {
    const normSlug = normalizeSubjectSlug(subjectSlug);
    const defaultTopics = SUBJECTS[normSlug]?.defaultTopics || [];

    if (!isSupabaseConfigured) {
      return defaultTopics;
    }

    try {
      const { data, error } = await supabase
        .from('questions')
        .select('topic')
        .eq('subject', normSlug)
        .order('topic');

      if (error || !data || data.length === 0) {
        return defaultTopics;
      }

      const dbTopics = data.map((d: any) => d.topic).filter(Boolean);
      const combined = Array.from(new Set([...dbTopics, ...defaultTopics])).sort((a, b) => a.localeCompare(b));
      return combined.length > 0 ? combined : defaultTopics;
    } catch (err) {
      console.warn('[QuestionService] Failed to fetch topics, using defaults:', err);
      return defaultTopics;
    }
  }

  /**
   * Get total question count matching filters
   */
  async getQuestionCount(filters: QuestionFilterOptions = {}): Promise<number> {
    if (!isSupabaseConfigured) return 0;

    try {
      let query = supabase.from('questions').select('id', { count: 'exact', head: true });

      if (filters.subject) {
        query = query.eq('subject', normalizeSubjectSlug(filters.subject));
      }
      if (filters.topic && filters.topic !== 'All') {
        query = query.eq('topic', filters.topic);
      }
      if (filters.difficulty && filters.difficulty.toLowerCase() !== 'all' && filters.difficulty.toLowerCase() !== 'mixed') {
        query = query.ilike('difficulty', filters.difficulty);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.error('[QuestionService] Error counting questions:', err);
      return 0;
    }
  }

  /**
   * Get a single question by its primary UUID or question_id
   */
  async getQuestionById(id: string): Promise<PracticeQuestion | null> {
    if (!isSupabaseConfigured) return null;

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      let query = supabase.from('questions').select('*');

      if (isUuid) {
        query = query.eq('id', id);
      } else {
        query = query.eq('question_id', id);
      }

      const { data, error } = await query.single();
      if (error || !data) return null;
      return mapSupabaseToPractice(data as SupabaseQuestion);
    } catch (err) {
      console.error('[QuestionService] Error fetching question by ID:', err);
      return null;
    }
  }

  /**
   * Primary filtered query to retrieve questions from Supabase
   */
  async getQuestions(filters: QuestionFilterOptions = {}): Promise<PracticeQuestion[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Question bank is currently unavailable. Please try again.');
    }

    try {
      let query = supabase.from('questions').select('*');

      if (filters.subject) {
        query = query.eq('subject', normalizeSubjectSlug(filters.subject));
      }
      if (filters.topic && filters.topic !== 'All') {
        query = query.eq('topic', filters.topic);
      }
      if (filters.subtopic) {
        query = query.eq('subtopic', filters.subtopic);
      }
      if (filters.difficulty && filters.difficulty.toLowerCase() !== 'all' && filters.difficulty.toLowerCase() !== 'mixed') {
        query = query.ilike('difficulty', filters.difficulty);
      }

      const limit = filters.limit || 10;
      query = query.limit(limit);

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + limit - 1);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message || 'Database query error');
      }

      if (!data || data.length === 0) {
        return [];
      }

      return (data as SupabaseQuestion[]).map(r => shufflePracticeOptions(mapSupabaseToPractice(r)));
    } catch (err: any) {
      console.error('[QuestionService] getQuestions error:', err);
      throw new Error(err.message || 'Question bank is currently unavailable. Please try again.');
    }
  }

  /**
   * Get random questions using Supabase RPC or randomized query
   */
  async getRandomQuestions(params: RandomQuestionParams = {}): Promise<PracticeQuestion[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Question bank is currently unavailable. Please try again.');
    }

    const normSubject = params.subject ? normalizeSubjectSlug(params.subject) : undefined;
    const limit = params.limit || 10;
    const topic = params.topic && params.topic !== 'All' ? params.topic : undefined;
    const difficulty = params.difficulty && params.difficulty.toLowerCase() !== 'all' && params.difficulty.toLowerCase() !== 'mixed' 
      ? params.difficulty 
      : undefined;

    try {
      // Attempt to invoke the PostgreSQL RPC function if installed
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_random_questions', {
        p_subject: normSubject || null,
        p_topic: topic || null,
        p_difficulty: difficulty || null,
        p_limit: limit
      });

      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        return (rpcData as SupabaseQuestion[]).map(r => shufflePracticeOptions(mapSupabaseToPractice(r)));
      }

      // Fallback query with limit if RPC not created yet
      let query = supabase.from('questions').select('*');
      if (normSubject) query = query.eq('subject', normSubject);
      if (topic) query = query.eq('topic', topic);
      if (difficulty) query = query.ilike('difficulty', difficulty);

      const { data, error } = await query.limit(Math.min(limit * 3, 50));
      if (error) throw error;

      if (!data || data.length === 0) {
        return [];
      }

      // Shuffle array locally
      const shuffled = [...data].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, limit).map(r => shufflePracticeOptions(mapSupabaseToPractice(r)));
    } catch (err: any) {
      console.error('[QuestionService] getRandomQuestions error:', err);
      throw new Error(err.message || 'Question bank is currently unavailable. Please try again.');
    }
  }

  async getQuestionsBySubject(subject: string, options: Omit<QuestionFilterOptions, 'subject'> = {}) {
    return this.getQuestions({ ...options, subject });
  }

  async getQuestionsByTopic(subject: string, topic: string, options: Omit<QuestionFilterOptions, 'subject' | 'topic'> = {}) {
    return this.getQuestions({ ...options, subject, topic });
  }

  async getQuestionsByDifficulty(subject: string, difficulty: string, options: Omit<QuestionFilterOptions, 'subject' | 'difficulty'> = {}) {
    return this.getQuestions({ ...options, subject, difficulty });
  }

  /**
   * Question bank distribution analysis diagnostic
   */
  async validateQuestionBankDistribution() {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from('questions')
      .select('id, question_id, subject, option_a, option_b, option_c, option_d, correct_answer');
    if (error || !data) return null;

    const distribution = { A: 0, B: 0, C: 0, D: 0, other: 0 };
    for (const row of data) {
      const ans = String(row.correct_answer || '').trim().toUpperCase();
      if (ans === 'A') distribution.A++;
      else if (ans === 'B') distribution.B++;
      else if (ans === 'C') distribution.C++;
      else if (ans === 'D') distribution.D++;
      else distribution.other++;
    }

    return { totalQuestions: data.length, distribution };
  }
}

export const questionService = new QuestionService();
export default questionService;
