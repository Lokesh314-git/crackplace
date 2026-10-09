export interface Question {
  id: string;
  source: 'mmlu' | 'hellaswag' | 'curated' | 'ai_generated';
  sourceQuestionId?: string;
  category: string;
  topic: string;
  subtopic?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  options: string[];
  correctOption: number;
  explanation?: string;
  sourceUrl?: string;
  license?: string;
  tags?: string[];
  active: boolean;
  importedAt: string;
  updatedAt: string;
}

export interface SanitizedQuestion {
  id: string;
  questionIndex: number;
  questionText: string;
  options: string[];
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface IngestionStats {
  imported: number;
  valid: number;
  invalid: number;
  duplicates: number;
  skipped: number;
  updated: number;
  deactivated: number;
}
