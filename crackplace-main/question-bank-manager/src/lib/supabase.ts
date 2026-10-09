import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Question } from '../types';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseAnonKey.includes('your-supabase-anon-public-key')
);

// Primary Supabase Client (Only uses safe public anon key, NEVER service role key)
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

/**
 * Initial 3 sample records for local development sandbox mode
 */
export const INITIAL_DEV_SAMPLE_QUESTIONS: Question[] = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    question_id: 'QA0001',
    subject: 'quantitative_aptitude',
    topic: 'Percentages',
    subtopic: 'Basic Percentage',
    difficulty: 'Easy',
    question_type: 'MCQ',
    question: 'A candidate scores 450 marks out of 600 in an assessment. What is their percentage?',
    option_a: '70%',
    option_b: '75%',
    option_c: '80%',
    option_d: '85%',
    correct_answer: 'B',
    explanation: 'Percentage = (450 / 600) * 100 = 0.75 * 100 = 75%.',
    source: 'Sample Data',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    question_id: 'DSA0001',
    subject: 'dsa',
    topic: 'Arrays',
    subtopic: 'Time Complexity',
    difficulty: 'Medium',
    question_type: 'MCQ',
    question: 'What is the average time complexity of searching an element in a balanced Binary Search Tree (BST)?',
    option_a: 'O(1)',
    option_b: 'O(log N)',
    option_c: 'O(N)',
    option_d: 'O(N log N)',
    correct_answer: 'B',
    explanation: 'In a balanced BST, half of the remaining subtrees are discarded at each step, yielding O(log N) lookup time.',
    source: 'Sample Data',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    question_id: 'HR0001',
    subject: 'hr_behavioral',
    topic: 'Situational & Leadership',
    subtopic: 'Conflict Resolution',
    difficulty: 'Medium',
    question_type: 'INTERVIEW',
    question: 'Describe a situation where you had a disagreement with a project team member. How did you resolve it using the STAR technique?',
    option_a: null,
    option_b: null,
    option_c: null,
    option_d: null,
    correct_answer: null,
    explanation: 'Structure response with Situation (context), Task (goal), Action (objective listening & common ground), and Result (successful consensus & delivery).',
    source: 'Sample Data',
    created_at: new Date(Date.now() - 10800000).toISOString(),
    updated_at: new Date(Date.now() - 10800000).toISOString()
  }
];
