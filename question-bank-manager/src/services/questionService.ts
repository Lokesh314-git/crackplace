import { supabase } from '../lib/supabase';
import {
  Question,
  QuestionInsert,
  QuestionUpdate,
  QuestionFilters,
  PaginatedResult,
  DashboardStats,
  Subject,
  SubjectInsert
} from '../types';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://crackplace-backend-lfs5.onrender.com';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  if (!token) {
    throw new Error('No authentication token found. Please sign in again.');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };
  
  let response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (error: any) {
    throw new Error(`Network error: Failed to connect to backend (${API_URL}). Details: ${error.message}`);
  }
  
  if (!response.ok) {
    let errText = '';
    try {
      const textData = await response.text();
      try {
        const errData = JSON.parse(textData);
        errText = errData.error || errData.message || JSON.stringify(errData);
      } catch {
        if (textData.includes('<pre>')) {
          const match = textData.match(/<pre>([\s\S]*?)<\/pre>/i);
          errText = match ? match[1].trim() : `Server error (${response.status} ${response.statusText})`;
        } else if (textData.startsWith('<!DOCTYPE') || textData.startsWith('<html')) {
          errText = `Server error (${response.status} ${response.statusText})`;
        } else {
          errText = textData;
        }
      }
    } catch {
      errText = response.statusText || 'Unknown error';
    }
    throw new Error(errText);
  }
  
  return response.json();
}

export const questionService = {
  async getQuestions(filters: QuestionFilters = {}): Promise<PaginatedResult<Question>> {
    try {
      const query = new URLSearchParams();
      if (filters.page) query.append('page', filters.page.toString());
      if (filters.pageSize) query.append('pageSize', filters.pageSize.toString());
      if (filters.subject) query.append('subject', filters.subject);
      if (filters.difficulty) query.append('difficulty', filters.difficulty);
      if (filters.question_type) query.append('question_type', filters.question_type);
      if (filters.topic) query.append('topic', filters.topic);
      if (filters.search) query.append('search', filters.search);
      if (filters.sortBy) query.append('sortBy', filters.sortBy);
      if (filters.sortOrder) query.append('sortOrder', filters.sortOrder);
      
      return await fetchWithAuth(`/api/admin/questions?${query.toString()}`);
    } catch (err: any) {
      console.warn(`Backend getQuestions unavailable (${err.message}). Falling back to direct Supabase query.`);
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
        data: (data as Question[]) || [],
        count: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize) || 1
      };
    }
  },

  async getQuestionById(id: string): Promise<Question | null> {
    try {
      return await fetchWithAuth(`/api/admin/questions/${id}`);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('404')) {
        return null;
      }
      const { data } = await supabase.from('questions').select('*').eq('id', id).single();
      return (data as Question) || null;
    }
  },

  async createQuestion(insertData: QuestionInsert): Promise<Question> {
    try {
      return await fetchWithAuth(`/api/admin/questions`, {
        method: 'POST',
        body: JSON.stringify(insertData)
      });
    } catch (err: any) {
      console.warn(`Backend createQuestion unavailable (${err.message}). Falling back to direct Supabase query.`);
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
      return data as Question;
    }
  },

  async updateQuestion(id: string, updates: QuestionUpdate): Promise<Question> {
    try {
      return await fetchWithAuth(`/api/admin/questions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
    } catch (err: any) {
      console.warn(`Backend updateQuestion unavailable (${err.message}). Falling back to direct Supabase query.`);
      const { data, error } = await supabase
        .from('questions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update question: ${error.message}`);
      return data as Question;
    }
  },

  async deleteQuestion(id: string): Promise<boolean> {
    try {
      await fetchWithAuth(`/api/admin/questions/${id}`, {
        method: 'DELETE'
      });
      return true;
    } catch (err: any) {
      console.warn(`Backend deleteQuestion unavailable (${err.message}). Falling back to direct Supabase query.`);
      const { error } = await supabase.from('questions').delete().eq('id', id);
      if (error) throw new Error(`Failed to delete question: ${error.message}`);
      return true;
    }
  },

  async bulkInsertQuestions(
    questions: QuestionInsert[],
    onBatchProgress?: (processed: number, total: number) => void,
    onConflictOption: 'skip' | 'update' = 'skip'
  ): Promise<{ inserted: number; errors: string[] }> {
    try {
      const result = await fetchWithAuth(`/api/admin/questions/bulk`, {
        method: 'POST',
        body: JSON.stringify({ questions, onConflictOption })
      });
      if (onBatchProgress) {
        onBatchProgress(questions.length, questions.length);
      }
      return result;
    } catch (err: any) {
      console.warn(`Backend bulkInsertQuestions unavailable (${err.message}). Falling back to direct Supabase batch insert.`);
      const BATCH_SIZE = 500;
      let insertedCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < questions.length; i += BATCH_SIZE) {
        const batch = questions.slice(i, i + BATCH_SIZE).map((q) => ({
          ...q,
          question_id: q.question_id.trim().toUpperCase(),
          question: q.question.trim(),
          option_a: q.option_a ? q.option_a.trim() : null,
          option_b: q.option_b ? q.option_b.trim() : null,
          option_c: q.option_c ? q.option_c.trim() : null,
          option_d: q.option_d ? q.option_d.trim() : null,
          correct_answer: q.correct_answer ? q.correct_answer.trim().toUpperCase() : null,
          explanation: q.explanation ? q.explanation.trim() : null,
          source: q.source ? q.source.trim() : null,
          topic: q.topic ? q.topic.trim() : null,
          subtopic: q.subtopic ? q.subtopic.trim() : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        let error: any = null;
        if (onConflictOption === 'update') {
          const res = await supabase.from('questions').upsert(batch, { onConflict: 'question_id' });
          error = res.error;
        } else {
          const res = await supabase.from('questions').insert(batch);
          error = res.error;
        }

        if (error) {
          errors.push(`Batch ${i / BATCH_SIZE + 1} error: ${error.message}`);
        } else {
          insertedCount += batch.length;
        }

        if (onBatchProgress) {
          onBatchProgress(Math.min(i + BATCH_SIZE, questions.length), questions.length);
        }
      }

      return { inserted: insertedCount, errors };
    }
  },

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      return await fetchWithAuth(`/api/admin/questions/dashboard-stats`);
    } catch (err: any) {
      console.warn(`Backend getDashboardStats unavailable (${err.message}). Falling back to direct Supabase query.`);
      const { count: totalQuestions } = await supabase.from('questions').select('*', { count: 'exact', head: true });
      const { data: allQ } = await supabase.from('questions').select('subject, difficulty, question_type');
      
      const bySubject: Record<string, number> = {};
      const byDifficulty: { Easy: number; Medium: number; Hard: number } = { Easy: 0, Medium: 0, Hard: 0 };
      const byType: { MCQ: number; INTERVIEW: number } = { MCQ: 0, INTERVIEW: 0 };

      for (const q of (allQ || [])) {
        if (q.subject) bySubject[q.subject] = (bySubject[q.subject] || 0) + 1;
        if (q.difficulty === 'Easy') byDifficulty.Easy++;
        else if (q.difficulty === 'Medium') byDifficulty.Medium++;
        else if (q.difficulty === 'Hard') byDifficulty.Hard++;

        if (q.question_type === 'MCQ') byType.MCQ++;
        else if (q.question_type === 'INTERVIEW') byType.INTERVIEW++;
      }

      const { data: recent } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        totalQuestions: totalQuestions || 0,
        totalSubjects: Object.keys(bySubject).length,
        bySubject,
        byDifficulty,
        byType,
        recentQuestions: (recent as Question[]) || []
      };
    }
  },

  async getSubjects(): Promise<Subject[]> {
    try {
      return await fetchWithAuth(`/api/admin/questions/subjects`);
    } catch (err: any) {
      console.warn(`Backend getSubjects unavailable (${err.message}). Falling back to direct Supabase query.`);
      const { data: subjects, error } = await supabase
        .from('subjects')
        .select('*')
        .order('display_order', { ascending: true });

      const baseSubjects = (error || !subjects || subjects.length === 0) ? [
        { id: '1', slug: 'quantitative_aptitude', name: 'Quantitative Aptitude', code_prefix: 'QA', is_active: true },
        { id: '2', slug: 'dsa', name: 'DSA & Programming', code_prefix: 'DSA', is_active: true },
        { id: '3', slug: 'dbms', name: 'DBMS', code_prefix: 'DBMS', is_active: true },
        { id: '4', slug: 'operating_system', name: 'Operating System', code_prefix: 'OS', is_active: true },
        { id: '5', slug: 'computer_network', name: 'Computer Network', code_prefix: 'CN', is_active: true },
        { id: '6', slug: 'logical_reasoning', name: 'Logical Reasoning', code_prefix: 'LR', is_active: true },
        { id: '7', slug: 'verbal_ability', name: 'Verbal Ability', code_prefix: 'VA', is_active: true },
        { id: '8', slug: 'hr_behavioral', name: 'HR & Behavioral', code_prefix: 'HR', is_active: true }
      ] : subjects;

      const mapped: any[] = [];
      for (const sub of baseSubjects) {
        const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', sub.slug);
        
        const { data: topicsData } = await supabase
          .from('questions')
          .select('topic')
          .eq('subject', sub.slug)
          .not('topic', 'is', null)
          .neq('topic', '');
          
        const uniqueTopics = new Set((topicsData || []).map((q: any) => q.topic)).size;
        mapped.push({ ...sub, question_count: count || 0, topic_count: uniqueTopics });
      }
      return mapped;
    }
  },

  async getTopics(subjectSlug: string): Promise<string[]> {
    try {
      return await fetchWithAuth(`/api/admin/questions/subjects/${subjectSlug}/topics`);
    } catch (err: any) {
      console.warn(`Backend getTopics unavailable (${err.message}). Falling back to direct Supabase query.`);
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
      
      return Array.from(new Set(data.map((q: any) => q.topic))).sort();
    }
  },

  async getTopicStats(subjectSlug: string): Promise<{ name: string; question_count: number }[]> {
    try {
      return await fetchWithAuth(`/api/admin/questions/subjects/${subjectSlug}/topic-stats`);
    } catch (err: any) {
      console.warn(`Backend getTopicStats unavailable (${err.message}). Falling back to direct Supabase query.`);
      const { data, error } = await supabase
        .from('questions')
        .select('topic')
        .eq('subject', subjectSlug)
        .not('topic', 'is', null)
        .neq('topic', '');
        
      if (error) {
        console.error(`Failed to fetch topic stats: ${error.message}`);
        return [];
      }
      
      const counts: Record<string, number> = {};
      for (const q of data) {
        if (q.topic) {
          counts[q.topic] = (counts[q.topic] || 0) + 1;
        }
      }
      
      return Object.entries(counts)
        .map(([name, count]) => ({ name, question_count: count }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
  },

  async createSubject(subject: SubjectInsert): Promise<Subject> {
    try {
      return await fetchWithAuth(`/api/admin/questions/subjects`, {
        method: 'POST',
        body: JSON.stringify(subject)
      });
    } catch (err: any) {
      console.warn(`Backend createSubject unavailable (${err.message}). Falling back to direct Supabase query.`);
      const newSubject = {
        ...subject,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('subjects').insert(newSubject).select().single();
      if (error) throw new Error(`Failed to create subject: ${error.message}`);
      return data as Subject;
    }
  },

  async updateSubject(id: string, updates: Partial<SubjectInsert>): Promise<Subject> {
    try {
      return await fetchWithAuth(`/api/admin/questions/subjects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
    } catch (err: any) {
      console.warn(`Backend updateSubject unavailable (${err.message}). Falling back to direct Supabase query.`);
      const { data, error } = await supabase
        .from('subjects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update subject: ${error.message}`);
      return data as Subject;
    }
  },

  async deleteSubject(id: string): Promise<boolean> {
    try {
      await fetchWithAuth(`/api/admin/questions/subjects/${id}`, {
        method: 'DELETE'
      });
      return true;
    } catch (err: any) {
      console.warn(`Backend deleteSubject unavailable (${err.message}). Falling back to direct Supabase query.`);
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) throw new Error(`Failed to delete subject: ${error.message}`);
      return true;
    }
  }
};
