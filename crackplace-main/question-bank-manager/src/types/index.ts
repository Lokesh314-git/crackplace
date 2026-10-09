export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';
export type QuestionType = 'MCQ' | 'INTERVIEW';
export type CorrectAnswerOption = 'A' | 'B' | 'C' | 'D';

export interface Question {
  id: string; // UUID primary key
  question_id: string; // Human-readable ID (e.g., QA0001, DSA0001)
  subject: string; // Subject slug (e.g., 'dsa', 'quantitative_aptitude')
  topic: string | null;
  subtopic: string | null;
  difficulty: QuestionDifficulty;
  question_type: QuestionType;
  question: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string | null; // 'A', 'B', 'C', 'D' or detailed answer
  explanation: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export type QuestionInsert = Omit<Question, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type QuestionUpdate = Partial<QuestionInsert>;

export interface StudentSafeQuestion {
  id: string;
  question_id: string;
  subject: string;
  topic: string | null;
  difficulty: QuestionDifficulty;
  question_type: QuestionType;
  question: string;
  options: {
    A: string | null;
    B: string | null;
    C: string | null;
    D: string | null;
  };
}

export interface Subject {
  id: string;
  slug: string;
  name: string;
  code_prefix: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  question_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SubjectInsert {
  slug: string;
  name: string;
  code_prefix: string;
  description?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface QuestionFilters {
  subject?: string;
  topic?: string;
  difficulty?: QuestionDifficulty | 'all';
  question_type?: QuestionType | 'all';
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'question_id' | 'difficulty' | 'subject';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
  totalQuestions: number;
  totalSubjects: number;
  bySubject: Record<string, number>;
  byDifficulty: {
    Easy: number;
    Medium: number;
    Hard: number;
  };
  byType: {
    MCQ: number;
    INTERVIEW: number;
  };
  recentQuestions: Question[];
}

export interface CSVRow {
  id?: string;
  question_id?: string;
  subject?: string;
  topic?: string;
  subtopic?: string;
  difficulty?: string;
  question_type?: string;
  question?: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer?: string;
  explanation?: string;
  source?: string;
  [key: string]: any;
}

export type RowValidationStatus = 'valid' | 'invalid' | 'duplicate' | 'warning';

export interface ValidatedCSVRow {
  rowIndex: number;
  raw: CSVRow;
  normalized?: QuestionInsert;
  status: RowValidationStatus;
  errors: string[];
  warnings: string[];
}

export interface CSVValidationSummary {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  warningCount: number;
  rows: ValidatedCSVRow[];
  headers: string[];
  missingRequiredHeaders: string[];
}

export interface CSVImportProgress {
  totalToImport: number;
  processedCount: number;
  successfulCount: number;
  failedCount: number;
  currentBatch: number;
  totalBatches: number;
  status: 'idle' | 'parsing' | 'validating' | 'importing' | 'completed' | 'error';
  errorMessage?: string;
}
