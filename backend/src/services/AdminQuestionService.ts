import { supabase } from '../config/supabase';

export interface QuestionInsert {
  question_id: string;
  subject: string;
  topic?: string;
  subtopic?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  question_type: 'MCQ' | 'INTERVIEW';
  question: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer?: string;
  explanation?: string;
  source?: string;
}

export interface QuestionUpdate extends Partial<QuestionInsert> {
  updated_at?: string;
}

export class AdminQuestionService {
  static async getQuestions(filters: any) {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(10, filters.pageSize || 20));
    const offset = (page - 1) * pageSize;

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
      query = query.or(`question_id.ilike.%${term}%,question.ilike.%${term}%,topic.ilike.%${term}%,subtopic.ilike.%${term}%`);
    }

    const sortBy = filters.sortBy || 'created_at';
    const isAscending = filters.sortOrder === 'asc';
    query = query.order(sortBy, { ascending: isAscending });
    query = query.range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;
    if (error) throw new Error(`Failed to fetch questions: ${error.message}`);

    return {
      data: data || [],
      count: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize) || 1
    };
  }

  static async getQuestionById(id: string) {
    const { data, error } = await supabase.from('questions').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Error fetching question by ID: ${error.message}`);
    }
    return data;
  }

  static async createQuestion(insertData: QuestionInsert) {
    const formatted = {
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
      subtopic: insertData.subtopic ? insertData.subtopic.trim() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('questions').insert(formatted).select().single();
    if (error) {
      if (error.code === '23505') throw new Error(`A question with ID "${formatted.question_id}" already exists.`);
      throw new Error(`Failed to create question: ${error.message}`);
    }
    return data;
  }

  static async updateQuestion(id: string, updates: QuestionUpdate) {
    const sanitized: any = { ...updates, updated_at: new Date().toISOString() };
    if (sanitized.question_id) sanitized.question_id = sanitized.question_id.trim().toUpperCase();
    if (sanitized.question) sanitized.question = sanitized.question.trim();
    if (sanitized.correct_answer) sanitized.correct_answer = sanitized.correct_answer.trim().toUpperCase();

    const { data, error } = await supabase.from('questions').update(sanitized).eq('id', id).select().single();
    if (error) {
      if (error.code === '23505') throw new Error(`Question ID is already used.`);
      throw new Error(`Failed to update question: ${error.message}`);
    }
    return data;
  }

  static async deleteQuestion(id: string) {
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete question: ${error.message}`);
    return true;
  }

  static async bulkInsertQuestions(questions: QuestionInsert[], onConflictOption: 'skip' | 'update' = 'skip') {
    let inserted = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 500;
    const total = questions.length;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = questions.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      
      const formattedBatch = batch.map(insertData => ({
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
        subtopic: insertData.subtopic ? insertData.subtopic.trim() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      try {
        const { error } = await supabase.from('questions').upsert(formattedBatch, {
          onConflict: 'question_id',
          ignoreDuplicates: onConflictOption === 'skip'
        });
        if (error) {
          errors.push(`Batch #${batchNum} failed: ${error.message}`);
        } else {
          inserted += batch.length;
        }
      } catch (err: any) {
        errors.push(`Batch #${batchNum} exception: ${err.message}`);
      }
    }
    return { inserted, errors };
  }

  static async getDashboardStats() {
    // 1. Total count
    const { count: totalQuestions, error: countErr } = await supabase.from('questions').select('*', { count: 'exact', head: true });
    if (countErr) throw countErr;

    // 2. Fetch subjects list
    const subjects = await this.getSubjects();
    const bySubject: Record<string, number> = {};
    subjects.forEach((s: any) => (bySubject[s.slug] = 0));

    // 3. Count by subjects
    for (const s of subjects) {
      const { count, error } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', s.slug);
      if (!error && count !== null) bySubject[s.slug] = count;
    }

    // 4. Count by difficulty
    const byDifficulty = { Easy: 0, Medium: 0, Hard: 0 };
    for (const diff of ['Easy', 'Medium', 'Hard'] as const) {
      const { count, error } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('difficulty', diff);
      if (!error && count !== null) byDifficulty[diff] = count;
    }

    // 5. Count by question_type
    const byType = { MCQ: 0, INTERVIEW: 0 };
    for (const qType of ['MCQ', 'INTERVIEW'] as const) {
      const { count, error } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('question_type', qType);
      if (!error && count !== null) byType[qType] = count;
    }

    // 6. Recent 5 questions
    const { data: recent } = await supabase.from('questions').select('*').order('created_at', { ascending: false }).limit(5);

    return {
      totalQuestions: totalQuestions || 0,
      totalSubjects: subjects.length,
      bySubject,
      byDifficulty,
      byType,
      recentQuestions: recent || []
    };
  }

  static async getSubjects() {
    const { data: subjects, error } = await supabase.from('subjects').select('*').order('display_order', { ascending: true });
    if (error) {
      // return default subjects if table is not accessible
      return [
        { id: '1', slug: 'quantitative_aptitude', name: 'Quantitative Aptitude', code_prefix: 'QA', is_active: true },
        { id: '2', slug: 'dsa', name: 'DSA & Programming', code_prefix: 'DSA', is_active: true },
        { id: '3', slug: 'dbms', name: 'DBMS', code_prefix: 'DBMS', is_active: true },
        { id: '4', slug: 'operating_system', name: 'Operating System', code_prefix: 'OS', is_active: true },
        { id: '5', slug: 'computer_network', name: 'Computer Network', code_prefix: 'CN', is_active: true },
        { id: '6', slug: 'logical_reasoning', name: 'Logical Reasoning', code_prefix: 'LR', is_active: true },
        { id: '7', slug: 'verbal_ability', name: 'Verbal Ability', code_prefix: 'VA', is_active: true },
        { id: '8', slug: 'hr_behavioral', name: 'HR & Behavioral', code_prefix: 'HR', is_active: true }
      ];
    }

    const mapped: any[] = [];
    for (const sub of subjects || []) {
      const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', sub.slug);
      mapped.push({ ...sub, question_count: count || 0 });
    }
    return mapped;
  }

  static async getTopics(subjectSlug: string) {
    const { data, error } = await supabase
      .from('questions')
      .select('topic')
      .eq('subject', subjectSlug)
      .not('topic', 'is', null)
      .neq('topic', '');
      
    if (error) {
       console.error(`Failed to fetch topics: ${error.message}`);
       return [];
    }
    
    const uniqueTopics = Array.from(new Set(data.map((q: any) => q.topic))).sort();
    return uniqueTopics;
  }

  static async createSubject(subject: any) {
    const newSubject = {
      ...subject,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('subjects').insert(newSubject).select().single();
    if (error) throw new Error(`Failed to create subject: ${error.message}`);
    return data;
  }

  static async updateSubject(id: string, updates: any) {
    const { data, error } = await supabase.from('subjects').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update subject: ${error.message}`);
    return data;
  }

  static async deleteSubject(id: string) {
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete subject: ${error.message}`);
    return true;
  }
}
