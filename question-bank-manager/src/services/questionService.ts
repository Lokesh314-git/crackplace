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
        errText = textData;
      }
    } catch (e: any) {
      errText = response.statusText || 'Unknown error';
    }
    throw new Error(errText);
  }
  
  return response.json();
}

export const questionService = {
  async getQuestions(filters: QuestionFilters = {}): Promise<PaginatedResult<Question>> {
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
    
    return fetchWithAuth(`/api/admin/questions?${query.toString()}`);
  },

  async getQuestionById(id: string): Promise<Question | null> {
    try {
      return await fetchWithAuth(`/api/admin/questions/${id}`);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  },

  async createQuestion(insertData: QuestionInsert): Promise<Question> {
    return fetchWithAuth(`/api/admin/questions`, {
      method: 'POST',
      body: JSON.stringify(insertData)
    });
  },

  async updateQuestion(id: string, updates: QuestionUpdate): Promise<Question> {
    return fetchWithAuth(`/api/admin/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  async deleteQuestion(id: string): Promise<boolean> {
    await fetchWithAuth(`/api/admin/questions/${id}`, {
      method: 'DELETE'
    });
    return true;
  },

  async bulkInsertQuestions(
    questions: QuestionInsert[],
    onBatchProgress?: (processed: number, total: number) => void,
    onConflictOption: 'skip' | 'update' = 'skip'
  ): Promise<{ inserted: number; errors: string[] }> {
    // If there are many questions, we could chunk it on the frontend or let backend handle it
    // The backend `AdminQuestionService` already does batch processing (BATCH_SIZE = 500)
    // We can just send everything to the backend if it's within reasonable payload limits.
    const result = await fetchWithAuth(`/api/admin/questions/bulk`, {
      method: 'POST',
      body: JSON.stringify({ questions, onConflictOption })
    });
    
    if (onBatchProgress) {
      onBatchProgress(questions.length, questions.length);
    }
    
    return result;
  },

  async getDashboardStats(): Promise<DashboardStats> {
    return fetchWithAuth(`/api/admin/questions/dashboard-stats`);
  },

  async getSubjects(): Promise<Subject[]> {
    return fetchWithAuth(`/api/admin/questions/subjects`);
  },

  async getTopics(subjectSlug: string): Promise<string[]> {
    return fetchWithAuth(`/api/admin/questions/subjects/${subjectSlug}/topics`);
  },

  async getTopicStats(subjectSlug: string): Promise<{ name: string; question_count: number }[]> {
    return fetchWithAuth(`/api/admin/questions/subjects/${subjectSlug}/topic-stats`);
  },

  async createSubject(subject: SubjectInsert): Promise<Subject> {
    return fetchWithAuth(`/api/admin/questions/subjects`, {
      method: 'POST',
      body: JSON.stringify(subject)
    });
  },

  async updateSubject(id: string, updates: Partial<SubjectInsert>): Promise<Subject> {
    return fetchWithAuth(`/api/admin/questions/subjects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  async deleteSubject(id: string): Promise<boolean> {
    await fetchWithAuth(`/api/admin/questions/subjects/${id}`, {
      method: 'DELETE'
    });
    return true;
  }
};
