import { supabase } from '../lib/supabase';
import {
  Question,
  QuestionInsert,
  QuestionUpdate,
  QuestionFilters,
  PaginatedResult,
  DashboardStats,
  Subject,
  SubjectInsert,
  TopicStat,
  SubtopicStat
} from '../types';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://crackplace-backend-lfs5.onrender.com';

interface TopicStatCacheItem {
  stats: TopicStat[];
  timestamp: number;
}
const topicStatsCache = new Map<string, TopicStatCacheItem>();
const CACHE_TTL_MS = 60 * 1000;

export const clearTopicStatsCache = () => {
  topicStatsCache.clear();
};

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
      if (filters.subtopic) query.append('subtopic', filters.subtopic);
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
      if (filters.subtopic && filters.subtopic !== 'all') {
        query = query.ilike('subtopic', `%${filters.subtopic}%`);
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
      const created = await fetchWithAuth(`/api/admin/questions`, {
        method: 'POST',
        body: JSON.stringify(insertData)
      });
      clearTopicStatsCache();
      return created;
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
      clearTopicStatsCache();
      return data as Question;
    }
  },

  async updateQuestion(id: string, updates: QuestionUpdate): Promise<Question> {
    try {
      const updated = await fetchWithAuth(`/api/admin/questions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      clearTopicStatsCache();
      return updated;
    } catch (err: any) {
      console.warn(`Backend updateQuestion unavailable (${err.message}). Falling back to direct Supabase query.`);
      const { data, error } = await supabase
        .from('questions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update question: ${error.message}`);
      clearTopicStatsCache();
      return data as Question;
    }
  },

  async deleteQuestion(id: string): Promise<boolean> {
    try {
      await fetchWithAuth(`/api/admin/questions/${id}`, {
        method: 'DELETE'
      });
      clearTopicStatsCache();
      return true;
    } catch (err: any) {
      console.warn(`Backend deleteQuestion unavailable (${err.message}). Falling back to direct Supabase query.`);
      const { error } = await supabase.from('questions').delete().eq('id', id);
      if (error) throw new Error(`Failed to delete question: ${error.message}`);
      clearTopicStatsCache();
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
      clearTopicStatsCache();
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

      clearTopicStatsCache();
      return { inserted: insertedCount, errors };
    }
  },

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      return await fetchWithAuth(`/api/admin/questions/dashboard-stats`);
    } catch (err: any) {
      console.warn(`Backend getDashboardStats unavailable (${err.message}). Falling back to direct Supabase query.`);
      const { count: totalQuestions } = await supabase.from('questions').select('*', { count: 'exact', head: true });

      const subjects = await this.getSubjects();
      const bySubject: Record<string, number> = {};
      for (const s of subjects) {
        bySubject[s.slug] = s.question_count || 0;
      }

      const byDifficulty: { Easy: number; Medium: number; Hard: number } = { Easy: 0, Medium: 0, Hard: 0 };
      await Promise.all((['Easy', 'Medium', 'Hard'] as const).map(async (diff) => {
        const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('difficulty', diff);
        byDifficulty[diff] = count || 0;
      }));

      const byType: { MCQ: number; INTERVIEW: number } = { MCQ: 0, INTERVIEW: 0 };
      await Promise.all((['MCQ', 'INTERVIEW'] as const).map(async (qType) => {
        const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('question_type', qType);
        byType[qType] = count || 0;
      }));

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

      const mapped = await Promise.all(
        baseSubjects.map(async (sub) => {
          const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', sub.slug);
          const stats = await this.getTopicStats(sub.slug);
          return {
            ...sub,
            question_count: count || 0,
            topic_count: stats.length
          };
        })
      );
      return mapped;
    }
  },

  async getTopics(subjectSlug: string): Promise<string[]> {
    try {
      const stats = await this.getTopicStats(subjectSlug);
      return stats.map(s => s.name);
    } catch (err: any) {
      console.warn(`Backend getTopics unavailable (${err.message}). Falling back to direct query.`);
      return [];
    }
  },

  async getTopicStats(subjectSlug: string, forceRefresh = false): Promise<TopicStat[]> {
    if (!forceRefresh) {
      const cached = topicStatsCache.get(subjectSlug);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.stats;
      }
    }

    // 1. Try Backend API
    try {
      const res = await fetchWithAuth(`/api/admin/questions/subjects/${subjectSlug}/topic-stats?force=${forceRefresh}`);
      if (Array.isArray(res) && res.length > 0) {
        topicStatsCache.set(subjectSlug, { stats: res, timestamp: Date.now() });
        return res;
      }
    } catch {
      // Backend not available or failed, fall back to direct Supabase
    }

    // 2. Try Supabase RPC get_subject_topic_stats
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_subject_topic_stats', {
        p_subject: subjectSlug
      });
      if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
        const stats: TopicStat[] = rpcData.map((d: any) => ({
          name: d.name,
          question_count: Number(d.question_count)
        }));
        topicStatsCache.set(subjectSlug, { stats, timestamp: Date.now() });
        return stats;
      }
    } catch {
      // RPC not yet applied, fallback to high-speed skip-scan
    }

    // 3. Fallback: Indexed skip-scan to discover ALL distinct topics without downloading 30k rows
    try {
      const topics: string[] = [];
      let lastTopic: string | null = null;
      while (true) {
        let q = supabase
          .from('questions')
          .select('topic')
          .eq('subject', subjectSlug)
          .not('topic', 'is', null)
          .neq('topic', '')
          .order('topic', { ascending: true })
          .limit(1);

        if (lastTopic) {
          q = q.gt('topic', lastTopic);
        }
        const { data, error } = await q;
        if (error || !data || data.length === 0) break;
        const foundTopic = data[0].topic;
        if (!foundTopic) break;
        lastTopic = foundTopic;
        topics.push(foundTopic);
      }

      // Check if there are questions where topic is missing but subtopic is present
      let lastSubtopic: string | null = null;
      while (true) {
        let q = supabase
          .from('questions')
          .select('subtopic')
          .eq('subject', subjectSlug)
          .or('topic.is.null,topic.eq.""')
          .not('subtopic', 'is', null)
          .neq('subtopic', '')
          .order('subtopic', { ascending: true })
          .limit(1);

        if (lastSubtopic) {
          q = q.gt('subtopic', lastSubtopic);
        }
        const { data, error } = await q;
        if (error || !data || data.length === 0) break;
        const foundSubtopic = data[0].subtopic;
        if (!foundSubtopic) break;
        lastSubtopic = foundSubtopic;
        if (!topics.includes(foundSubtopic)) {
          topics.push(foundSubtopic);
        }
      }

      // Exact count using parallel HEAD requests (0-byte payload per topic)
      const stats = await Promise.all(
        topics.map(async (name) => {
          const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('subject', subjectSlug)
            .or(`topic.eq."${name}",and(topic.is.null,subtopic.eq."${name}"),and(topic.eq."",subtopic.eq."${name}")`);
          return { name, question_count: count || 0 };
        })
      );

      const sorted = stats.sort((a, b) => a.name.localeCompare(b.name));
      topicStatsCache.set(subjectSlug, { stats: sorted, timestamp: Date.now() });
      return sorted;
    } catch (err: any) {
      console.error(`Failed to fetch topic stats: ${err.message}`);
      return [];
    }
  },

  async getSubtopicStats(subjectSlug: string, topicName: string): Promise<SubtopicStat[]> {
    // 1. Try Supabase RPC
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_subject_subtopic_stats', {
        p_subject: subjectSlug,
        p_topic: topicName
      });
      if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
        return rpcData.map((d: any) => ({
          name: d.subtopic,
          question_count: Number(d.question_count)
        }));
      }
    } catch {
      // Fallback
    }

    // 2. Skip-scan fallback for subtopics under a topic
    try {
      const subtopics: string[] = [];
      let lastSubtopic: string | null = null;
      while (true) {
        let q = supabase
          .from('questions')
          .select('subtopic')
          .eq('subject', subjectSlug)
          .eq('topic', topicName)
          .not('subtopic', 'is', null)
          .neq('subtopic', '')
          .order('subtopic', { ascending: true })
          .limit(1);

        if (lastSubtopic) {
          q = q.gt('subtopic', lastSubtopic);
        }
        const { data, error } = await q;
        if (error || !data || data.length === 0) break;
        const foundSubtopic = data[0].subtopic;
        if (!foundSubtopic) break;
        lastSubtopic = foundSubtopic;
        subtopics.push(foundSubtopic);
      }

      const results = await Promise.all(
        subtopics.map(async (name) => {
          const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('subject', subjectSlug)
            .eq('topic', topicName)
            .eq('subtopic', name);
          return { name, question_count: count || 0 };
        })
      );

      return results.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err: any) {
      console.error(`Failed to fetch subtopics for topic ${topicName}:`, err);
      return [];
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
