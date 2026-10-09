import { QuestionInsert, QuestionDifficulty, QuestionType } from '../types';
import { DEFAULT_SUBJECTS } from '../constants/subjects';

/**
 * Normalizes text by trimming, collapsing multiple consecutive whitespaces, and normalizing punctuation
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");
}

/**
 * Generates normalized string for duplicate detection comparison (case-insensitive, whitespace-collapsed)
 */
export function getDuplicateFingerprint(text: string): string {
  return normalizeText(text).toLowerCase();
}

/**
 * Generate a cryptographically strong UUID (browser-native or fallback)
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate standard human-readable Question ID (e.g., QA0001, DSA0042)
 */
export function generateQuestionId(subjectSlug: string, nextIndex: number): string {
  const subjectMeta = DEFAULT_SUBJECTS.find(s => s.slug === subjectSlug);
  const prefix = subjectMeta ? subjectMeta.code_prefix : subjectSlug.toUpperCase().slice(0, 3);
  return `${prefix}${String(nextIndex).padStart(4, '0')}`;
}

/**
 * Normalizes a raw question object or CSV row into a sanitized QuestionInsert payload
 */
export function normalizeQuestionInput(raw: any, subjectPrefixIndex: number = 1): QuestionInsert {
  const subject = normalizeText(raw.subject || 'quantitative_aptitude').toLowerCase().replace(/\s+/g, '_');
  
  let difficulty: QuestionDifficulty = 'Medium';
  const rawDiff = normalizeText(raw.difficulty).toLowerCase();
  if (rawDiff === 'easy') difficulty = 'Easy';
  else if (rawDiff === 'hard') difficulty = 'Hard';
  else if (rawDiff === 'medium') difficulty = 'Medium';

  let questionType: QuestionType = 'MCQ';
  const rawType = normalizeText(raw.question_type).toUpperCase();
  if (rawType === 'INTERVIEW' || rawType === 'HR' || rawType === 'SUBJECTIVE') {
    questionType = 'INTERVIEW';
  }

  const questionId = normalizeText(raw.question_id) || generateQuestionId(subject, subjectPrefixIndex);

  let correctAnswer = normalizeText(raw.correct_answer).toUpperCase();
  if (questionType === 'MCQ') {
    if (['A', 'B', 'C', 'D'].includes(correctAnswer)) {
      // standard letter
    } else if (['1', '2', '3', '4'].includes(correctAnswer)) {
      const map: Record<string, string> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
      correctAnswer = map[correctAnswer];
    } else {
      // Match option text if full text was provided
      const optA = normalizeText(raw.option_a);
      const optB = normalizeText(raw.option_b);
      const optC = normalizeText(raw.option_c);
      const optD = normalizeText(raw.option_d);
      if (optA && correctAnswer.toLowerCase() === optA.toLowerCase()) correctAnswer = 'A';
      else if (optB && correctAnswer.toLowerCase() === optB.toLowerCase()) correctAnswer = 'B';
      else if (optC && correctAnswer.toLowerCase() === optC.toLowerCase()) correctAnswer = 'C';
      else if (optD && correctAnswer.toLowerCase() === optD.toLowerCase()) correctAnswer = 'D';
    }
  }

  return {
    question_id: questionId,
    subject,
    topic: normalizeText(raw.topic) || null,
    subtopic: normalizeText(raw.subtopic) || null,
    difficulty,
    question_type: questionType,
    question: normalizeText(raw.question),
    option_a: questionType === 'MCQ' ? normalizeText(raw.option_a) || null : null,
    option_b: questionType === 'MCQ' ? normalizeText(raw.option_b) || null : null,
    option_c: questionType === 'MCQ' ? normalizeText(raw.option_c) || null : null,
    option_d: questionType === 'MCQ' ? normalizeText(raw.option_d) || null : null,
    correct_answer: questionType === 'MCQ' ? correctAnswer : normalizeText(raw.correct_answer) || null,
    explanation: normalizeText(raw.explanation) || null,
    source: normalizeText(raw.source) || 'Manual Entry'
  };
}
