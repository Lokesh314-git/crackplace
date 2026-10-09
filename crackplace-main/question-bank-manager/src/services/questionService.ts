import { supabase, isSupabaseConfigured, INITIAL_DEV_SAMPLE_QUESTIONS } from '../lib/supabase';
import {
  Question,
  QuestionInsert,
  QuestionUpdate,
  QuestionFilters,
  PaginatedResult,
  DashboardStats,
  Subject,
  SubjectInsert,
  StudentSafeQuestion,
  QuestionDifficulty
} from '../types';
import { DEFAULT_SUBJECTS } from '../constants/subjects';
import { normalizeText, generateUUID } from '../utils/normalization';

// Local storage key for sandbox mode when Supabase credentials aren't yet populated
const SANDBOX_STORAGE_KEY = 'crackplace_sandbox_questions_v1';
const SANDBOX_SUBJECTS_KEY = 'crackplace_sandbox_subjects_v1';

// In-memory fallback dataset helper
function getSandboxQuestions(): Question[] {
  try {
    const raw = localStorage.getItem(SANDBOX_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(INITIAL_DEV_SAMPLE_QUESTIONS));
      return [...INITIAL_DEV_SAMPLE_QUESTIONS];
    }
    return JSON.parse(raw);
  } catch {
    return [...INITIAL_DEV_SAMPLE_QUESTIONS];
  }
}

function saveSandboxQuestions(questions: Question[]) {
  try {
    localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(questions));
  } catch (err) {
    console.error('Failed to save to local sandbox', err);
  }
}

function getSandboxSubjects(): Subject[] {
  try {
    const raw = localStorage.getItem(SANDBOX_SUBJECTS_KEY);
    if (!raw) {
      const initial: Subject[] = DEFAULT_SUBJECTS.map((s, idx) => ({
        id: `sub-${idx + 1}`,
        slug: s.slug,
        name: s.name,
        code_prefix: s.code_prefix,
        description: s.description,
        display_order: s.display_order || idx + 1,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      localStorage.setItem(SANDBOX_SUBJECTS_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SUBJECTS.map((s, idx) => ({
      id: `sub-${idx + 1}`,
      slug: s.slug,
      name: s.name,
      code_prefix: s.code_prefix,
      description: s.description,
      display_order: s.display_order || idx + 1,
      is_active: true
    }));
  }
}

function saveSandboxSubjects(subjects: Subject[]) {
  try {
    localStorage.setItem(SANDBOX_SUBJECTS_KEY, JSON.stringify(subjects));
  } catch (err) {
    console.error('Failed to save subjects to local sandbox', err);
  }
}

/**
 * Question Service - Pure data-access layer for Supabase PostgreSQL
 */
export const questionService = {
  /**
   * Fetch paginated and filtered questions
   */
  async getQuestions(filters: QuestionFilters = {}): Promise<PaginatedResult<Question>> {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(10, filters.pageSize || 20));
    const offset = (page - 1) * pageSize;

    if (!isSupabaseConfigured) {
      // Sandbox mode
      let list = getSandboxQuestions();

      if (filters.subject && filters.subject !== 'all') {
        list = list.filter((q) => q.subject === filters.subject);
      }
      if (filters.difficulty && filters.difficulty !== 'all') {
        list = list.filter((q) => q.difficulty === filters.difficulty);
      }
      if (filters.question_type && filters.question_type !== 'all') {
        list = list.filter((q) => q.question_type === filters.question_type);
      }
      if (filters.topic && filters.topic !== 'all') {
        list = list.filter((q) => q.topic?.toLowerCase().includes(filters.topic!.toLowerCase()));
      }
      if (filters.search && filters.search.trim()) {
        const term = filters.search.trim().toLowerCase();
        list = list.filter(
          (q) =>
            q.question_id.toLowerCase().includes(term) ||
            q.question.toLowerCase().includes(term) ||
            (q.topic && q.topic.toLowerCase().includes(term)) ||
            (q.subtopic && q.subtopic.toLowerCase().includes(term))
        );
      }

      // Sort
      const sortBy = filters.sortBy || 'created_at';
      const sortOrder = filters.sortOrder || 'desc';
      list.sort((a: any, b: any) => {
        const valA = a[sortBy] || '';
        const valB = b[sortBy] || '';
        if (sortOrder === 'asc') {
          return valA > valB ? 1 : -1;
        }
        return valA < valB ? 1 : -1;
      });

      const totalCount = list.length;
      const paginatedData = list.slice(offset, offset + pageSize);

      return {
        data: paginatedData,
        count: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize) || 1
      };
    }

    // Live Supabase query with server-side pagination & indexes
    let query = supabase.from('questions').select('*', { count: 'exact' });

    if (filters.subject && filters.subject !== 'all') {
      query = query.eq('subject', filters.subject);
    }
    if (filters.difficulty && filters.difficulty !== 'all') {
      query = query.eq('difficulty', filters.difficulty);
    }
    if (filters.question_type && filters.question_type !== 'all') {
      query = query.eq('question_type', filters.question_type);
    }
    if (filters.topic && filters.topic !== 'all') {
      query = query.ilike('topic', `%${filters.topic}%`);
    }
    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim();
      query = query.or(
        `question_id.ilike.%${term}%,question.ilike.%${term}%,topic.ilike.%${term}%,subtopic.ilike.%${term}%`
      );
    }

    const sortBy = filters.sortBy || 'created_at';
    const isAscending = filters.sortOrder === 'asc';
    query = query.order(sortBy, { ascending: isAscending });
    query = query.range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;
    if (error) {
      console.error('Error fetching questions from Supabase:', error);
      throw new Error(`Failed to fetch questions: ${error.message}`);
    }

    const totalCount = count || 0;
    return {
      data: (data as Question[]) || [],
      count: totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize) || 1
    };
  },

  /**
   * Get single question by internal UUID
   */
  async getQuestionById(id: string): Promise<Question | null> {
    if (!isSupabaseConfigured) {
      const list = getSandboxQuestions();
      return list.find((q) => q.id === id) || null;
    }

    const { data, error } = await supabase.from('questions').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw new Error(`Error fetching question by ID: ${error.message}`);
    }
    return data as Question;
  },

  /**
   * Get single question by human-readable Question ID (e.g., 'QA0001')
   */
  async getQuestionByHumanId(questionId: string): Promise<Question | null> {
    if (!isSupabaseConfigured) {
      const list = getSandboxQuestions();
      return list.find((q) => q.question_id.toLowerCase() === questionId.trim().toLowerCase()) || null;
    }

    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('question_id', questionId.trim().toUpperCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Error fetching question by question_id: ${error.message}`);
    }
    return data as Question;
  },

  /**
   * Insert a new single question
   */
  async createQuestion(insertData: QuestionInsert): Promise<Question> {
    const formatted: QuestionInsert = {
      ...insertData,
      question_id: insertData.question_id.trim().toUpperCase(),
      question: insertData.question.trim(),
      option_a: insertData.option_a ? insertData.option_a.trim() : null,
      option_b: insertData.option_b ? insertData.option_b.trim() : null,
      option_c: insertData.option_c ? insertData.option_c.trim() : null,
      option_d: insertData.option_d ? insertData.option_d.trim() : null,
      correct_answer: insertData.correct_answer ? insertData.correct_answer.trim().toUpperCase() : null,
      explanation: insertData.explanation ? insertData.explanation.trim() : null,
      source: insertData.source ? insertData.source.trim() : null,
      topic: insertData.topic ? insertData.topic.trim() : null,
      subtopic: insertData.subtopic ? insertData.subtopic.trim() : null
    };

    if (!isSupabaseConfigured) {
      const list = getSandboxQuestions();
      // Check duplicate human ID
      if (list.some((q) => q.question_id.toUpperCase() === formatted.question_id.toUpperCase())) {
        throw new Error(`Question ID "${formatted.question_id}" already exists. Please choose a unique ID.`);
      }
      const newRecord: Question = {
        ...(formatted as any),
        id: generateUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      list.unshift(newRecord);
      saveSandboxQuestions(list);
      return newRecord;
    }

    const { data, error } = await supabase.from('questions').insert(formatted).select().single();
    if (error) {
      if (error.code === '23505') {
        throw new Error(`A question with ID "${formatted.question_id}" already exists in the database.`);
      }
      throw new Error(`Failed to create question: ${error.message}`);
    }

    return data as Question;
  },

  /**
   * Update an existing question
   */
  async updateQuestion(id: string, updates: QuestionUpdate): Promise<Question> {
    const sanitized: QuestionUpdate = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    if (sanitized.question_id) sanitized.question_id = sanitized.question_id.trim().toUpperCase();
    if (sanitized.question) sanitized.question = sanitized.question.trim();
    if (sanitized.correct_answer) sanitized.correct_answer = sanitized.correct_answer.trim().toUpperCase();

    if (!isSupabaseConfigured) {
      const list = getSandboxQuestions();
      const index = list.findIndex((q) => q.id === id);
      if (index === -1) {
        throw new Error(`Question not found.`);
      }
      // Check ID conflict if changing question_id
      if (
        sanitized.question_id &&
        sanitized.question_id !== list[index].question_id &&
        list.some((q) => q.id !== id && q.question_id.toUpperCase() === sanitized.question_id!.toUpperCase())
      ) {
        throw new Error(`Question ID "${sanitized.question_id}" already exists.`);
      }

      list[index] = {
        ...list[index],
        ...sanitized,
        updated_at: new Date().toISOString()
      } as Question;

      saveSandboxQuestions(list);
      return list[index];
    }

    const { data, error } = await supabase
      .from('questions')
      .update(sanitized)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Question ID "${sanitized.question_id}" is already used by another question.`);
      }
      throw new Error(`Failed to update question: ${error.message}`);
    }

    return data as Question;
  },

  /**
   * Delete question permanently
   */
  async deleteQuestion(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
      const list = getSandboxQuestions();
      const filtered = list.filter((q) => q.id !== id);
      saveSandboxQuestions(filtered);
      return true;
    }

    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) {
      throw new Error(`Failed to delete question: ${error.message}`);
    }
    return true;
  },

  /**
   * Bulk insert questions in batches (default 500 rows per batch)
   */
  async bulkInsertQuestions(
    questions: QuestionInsert[],
    onBatchProgress?: (processed: number, total: number) => void,
    onConflictOption: 'skip' | 'update' = 'skip'
  ): Promise<{ inserted: number; errors: string[] }> {
    const total = questions.length;
    let inserted = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 500;

    if (!isSupabaseConfigured) {
      const list = getSandboxQuestions();
      const existingIds = new Set(list.map((q) => q.question_id.toUpperCase()));
      const existingNormalized = new Set(list.map((q) => normalizeText(q.question)));

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = questions.slice(i, i + BATCH_SIZE);
        for (const item of batch) {
          const humanId = item.question_id.toUpperCase();
          const normQ = normalizeText(item.question);

          if (existingIds.has(humanId) || existingNormalized.has(normQ)) {
            if (onConflictOption === 'update') {
              const idx = list.findIndex(
                (q) => q.question_id.toUpperCase() === humanId || normalizeText(q.question) === normQ
              );
              if (idx !== -1) {
                list[idx] = {
                  ...list[idx],
                  ...item,
                  updated_at: new Date().toISOString()
                } as Question;
                inserted++;
              }
            }
            // If skip, we simply don't insert
            continue;
          }

          list.push({
            ...(item as any),
            id: generateUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          existingIds.add(humanId);
          existingNormalized.add(normQ);
          inserted++;
        }

        if (onBatchProgress) {
          onBatchProgress(Math.min(i + BATCH_SIZE, total), total);
        }
      }

      saveSandboxQuestions(list);
      return { inserted, errors };
    }

    // Live Supabase Batch Insert
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = questions.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      try {
        if (onConflictOption === 'update') {
          const { error } = await supabase.from('questions').upsert(batch, {
            onConflict: 'question_id',
            ignoreDuplicates: false
          });
          if (error) {
            errors.push(`Batch #${batchNum} (rows ${i + 1}-${i + batch.length}) failed: ${error.message}`);
          } else {
            inserted += batch.length;
          }
        } else {
          // Skip duplicates mode
          const { error } = await supabase.from('questions').upsert(batch, {
            onConflict: 'question_id',
            ignoreDuplicates: true
          });
          if (error) {
            errors.push(`Batch #${batchNum} (rows ${i + 1}-${i + batch.length}) failed: ${error.message}`);
          } else {
            inserted += batch.length;
          }
        }
      } catch (err: any) {
        errors.push(`Batch #${batchNum} exception: ${err.message || 'Unknown network failure'}`);
      }

      if (onBatchProgress) {
        onBatchProgress(Math.min(i + BATCH_SIZE, total), total);
      }
    }

    return { inserted, errors };
  },

  /**
   * Fetch Dashboard Statistics from Supabase (Never hardcoded)
   */
  async getDashboardStats(): Promise<DashboardStats> {
    if (!isSupabaseConfigured) {
      const list = getSandboxQuestions();
      const subjects = getSandboxSubjects();
      const bySubject: Record<string, number> = {};
      subjects.forEach((s) => (bySubject[s.slug] = 0));

      const byDifficulty = { Easy: 0, Medium: 0, Hard: 0 };
      const byType = { MCQ: 0, INTERVIEW: 0 };

      list.forEach((q) => {
        bySubject[q.subject] = (bySubject[q.subject] || 0) + 1;
        if (byDifficulty[q.difficulty] !== undefined) {
          byDifficulty[q.difficulty]++;
        }
        if (byType[q.question_type] !== undefined) {
          byType[q.question_type]++;
        }
      });

      return {
        totalQuestions: list.length,
        totalSubjects: subjects.length,
        bySubject,
        byDifficulty,
        byType,
        recentQuestions: list.slice(0, 5)
      };
    }

    // Supabase individual aggregation queries
    try {
      // 1. Total count
      const { count: totalQuestions, error: countErr } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true });

      if (countErr) throw countErr;

      // 2. Fetch subjects list
      const subjects = await this.getSubjects();
      const bySubject: Record<string, number> = {};
      subjects.forEach((s) => (bySubject[s.slug] = 0));

      // 3. Count by subjects
      for (const s of subjects) {
        const { count, error } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('subject', s.slug);
        if (!error && count !== null) {
          bySubject[s.slug] = count;
        }
      }

      // 4. Count by difficulty
      const byDifficulty = { Easy: 0, Medium: 0, Hard: 0 };
      for (const diff of ['Easy', 'Medium', 'Hard'] as const) {
        const { count, error } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('difficulty', diff);
        if (!error && count !== null) {
          byDifficulty[diff] = count;
        }
      }

      // 5. Count by question_type
      const byType = { MCQ: 0, INTERVIEW: 0 };
      for (const qType of ['MCQ', 'INTERVIEW'] as const) {
        const { count, error } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('question_type', qType);
        if (!error && count !== null) {
          byType[qType] = count;
        }
      }

      // 6. Recent 5 questions
      const { data: recent } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        totalQuestions: totalQuestions || 0,
        totalSubjects: subjects.length,
        bySubject,
        byDifficulty,
        byType,
        recentQuestions: (recent as Question[]) || []
      };
    } catch (err: any) {
      console.error('Error computing dashboard statistics from Supabase:', err);
      throw new Error(`Failed to load dashboard metrics: ${err.message}`);
    }
  },

  /**
   * Fetch all Subjects with live question counts
   */
  async getSubjects(): Promise<Subject[]> {
    if (!isSupabaseConfigured) {
      const list = getSandboxSubjects();
      const questions = getSandboxQuestions();
      return list.map((s) => ({
        ...s,
        question_count: questions.filter((q) => q.subject === s.slug).length
      }));
    }

    const { data: subjects, error } = await supabase
      .from('subjects')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.warn('Could not fetch subjects from table, falling back to defaults:', error.message);
      return DEFAULT_SUBJECTS.map((s, idx) => ({
        id: `sub-${idx + 1}`,
        slug: s.slug,
        name: s.name,
        code_prefix: s.code_prefix,
        description: s.description,
        display_order: s.display_order || idx + 1,
        is_active: true
      }));
    }

    // Attach counts
    const mapped: Subject[] = [];
    for (const sub of (subjects as Subject[]) || []) {
      const { count } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('subject', sub.slug);

      mapped.push({
        ...sub,
        question_count: count || 0
      });
    }

    return mapped;
  },

  /**
   * Create a new subject dynamically
   */
  async createSubject(subject: SubjectInsert): Promise<Subject> {
    if (!isSupabaseConfigured) {
      const list = getSandboxSubjects();
      if (list.some((s) => s.slug === subject.slug)) {
        throw new Error(`Subject slug "${subject.slug}" already exists.`);
      }
      const newSubject: Subject = {
        ...subject,
        id: generateUUID(),
        description: subject.description || null,
        display_order: subject.display_order || list.length + 1,
        is_active: subject.is_active !== undefined ? subject.is_active : true,
        question_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      list.push(newSubject);
      saveSandboxSubjects(list);
      return newSubject;
    }

    const { data, error } = await supabase.from('subjects').insert(subject).select().single();
    if (error) {
      throw new Error(`Failed to create subject: ${error.message}`);
    }
    return data as Subject;
  },

  /**
   * Update subject
   */
  async updateSubject(id: string, updates: Partial<SubjectInsert>): Promise<Subject> {
    if (!isSupabaseConfigured) {
      const list = getSandboxSubjects();
      const index = list.findIndex((s) => s.id === id);
      if (index === -1) throw new Error('Subject not found');
      list[index] = { ...list[index], ...updates, updated_at: new Date().toISOString() };
      saveSandboxSubjects(list);
      return list[index];
    }

    const { data, error } = await supabase
      .from('subjects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update subject: ${error.message}`);
    return data as Subject;
  },

  /**
   * Delete subject
   */
  async deleteSubject(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
      const list = getSandboxSubjects();
      const filtered = list.filter((s) => s.id !== id);
      saveSandboxSubjects(filtered);
      return true;
    }

    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete subject: ${error.message}`);
    return true;
  },

  /**
   * RANDOM QUESTION SELECTION (Server/Database level)
   * Efficiently select random questions without transferring full datasets.
   */
  async getRandomQuestions(params: {
    subject: string;
    difficulty?: QuestionDifficulty;
    topic?: string;
    limit?: number;
  }): Promise<Question[]> {
    const limit = params.limit || 10;

    if (!isSupabaseConfigured) {
      let list = getSandboxQuestions().filter((q) => q.subject === params.subject);
      if (params.difficulty) list = list.filter((q) => q.difficulty === params.difficulty);
      if (params.topic) list = list.filter((q) => q.topic === params.topic);
      // Shuffle
      const shuffled = [...list].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, limit);
    }

    // Call Supabase Database RPC function `get_random_questions`
    const { data, error } = await supabase.rpc('get_random_questions', {
      p_subject: params.subject,
      p_difficulty: params.difficulty || null,
      p_topic: params.topic || null,
      p_limit: limit
    });

    if (error) {
      console.warn('RPC get_random_questions failed, falling back to indexed range query:', error.message);
      // Fallback query
      let query = supabase.from('questions').select('*').eq('subject', params.subject);
      if (params.difficulty) query = query.eq('difficulty', params.difficulty);
      if (params.topic) query = query.eq('topic', params.topic);
      const { data: fallbackData } = await query.limit(limit);
      return (fallbackData as Question[]) || [];
    }

    return (data as Question[]) || [];
  },

  /**
   * CRACKPLACE AI STUDENT PLATFORM DATA-ACCESS
   * Projection that strictly removes correct_answer & explanation
   * to protect live battle / test integrity.
   */
  async getStudentSafeQuestions(params: {
    subject: string;
    difficulty?: QuestionDifficulty;
    topic?: string;
    limit?: number;
  }): Promise<StudentSafeQuestion[]> {
    const questions = await this.getRandomQuestions(params);

    return questions.map((q) => ({
      id: q.id,
      question_id: q.question_id,
      subject: q.subject,
      topic: q.topic,
      difficulty: q.difficulty,
      question_type: q.question_type,
      question: q.question,
      options: {
        A: q.option_a,
        B: q.option_b,
        C: q.option_c,
        D: q.option_d
      }
    }));
  }
};
