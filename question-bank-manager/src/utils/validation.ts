import { QuestionInsert, CSVRow, ValidatedCSVRow } from '../types';
import { normalizeQuestionInput, getDuplicateFingerprint, normalizeText } from './normalization';
import { DEFAULT_SUBJECTS } from '../constants/subjects';

export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

const VALID_DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard']);
const VALID_TYPES = new Set(['MCQ', 'INTERVIEW']);
const VALID_MCQ_ANSWERS = new Set(['A', 'B', 'C', 'D']);

export const REQUIRED_CSV_HEADERS = ['subject', 'question', 'difficulty'];

/**
 * Validates manual Add / Edit Question Form
 */
export function validateQuestionForm(
  data: Partial<QuestionInsert>,
  existingQuestionIds?: Set<string>,
  currentEditingId?: string
): FormValidationResult {
  const errors: Record<string, string> = {};

  if (!data.question_id || data.question_id.trim().length === 0) {
    errors.question_id = 'Question ID is required (e.g. QA0001, DSA0001).';
  } else if (
    existingQuestionIds &&
    existingQuestionIds.has(data.question_id.trim().toUpperCase()) &&
    data.question_id.trim().toUpperCase() !== currentEditingId?.toUpperCase()
  ) {
    errors.question_id = 'This Question ID already exists in the database.';
  }

  if (!data.subject || data.subject.trim().length === 0) {
    errors.subject = 'Subject selection is required.';
  }

  if (!data.difficulty || !VALID_DIFFICULTIES.has(data.difficulty)) {
    errors.difficulty = 'Difficulty must be Easy, Medium, or Hard.';
  }

  if (!data.question_type || !VALID_TYPES.has(data.question_type)) {
    errors.question_type = 'Question Type must be MCQ or INTERVIEW.';
  }

  if (!data.question || data.question.trim().length < 5) {
    errors.question = 'Question text must be at least 5 characters long.';
  }

  if (data.question_type === 'MCQ') {
    if (!data.option_a || data.option_a.trim().length === 0) errors.option_a = 'Option A is required for MCQ.';
    if (!data.option_b || data.option_b.trim().length === 0) errors.option_b = 'Option B is required for MCQ.';
    if (!data.option_c || data.option_c.trim().length === 0) errors.option_c = 'Option C is required for MCQ.';
    if (!data.option_d || data.option_d.trim().length === 0) errors.option_d = 'Option D is required for MCQ.';

    if (!data.correct_answer || !VALID_MCQ_ANSWERS.has(data.correct_answer.toUpperCase())) {
      errors.correct_answer = 'Correct answer for MCQ must be A, B, C, or D.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validates a single parsed CSV row
 */
export function validateCSVRow(
  raw: CSVRow,
  rowIndex: number,
  knownIdsInDb: Set<string> = new Set(),
  seenIdsInCsv: Set<string> = new Set(),
  knownTextsInDb: Set<string> = new Set(),
  seenTextsInCsv: Set<string> = new Set(),
  validSubjectSlugs?: Set<string>
): ValidatedCSVRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawQuestionText = normalizeText(raw.question || '');
  const rawQuestionId = normalizeText(raw.question_id || raw.id || '').toUpperCase();
  const rawSubject = normalizeText(raw.subject || '').toLowerCase().replace(/\s+/g, '_');
  const rawDifficulty = normalizeText(raw.difficulty || '');
  const rawType = normalizeText(raw.question_type || '').toUpperCase() || 'MCQ';

  // 1. Mandatory Fields Check
  if (!rawQuestionText || rawQuestionText.length < 5) {
    errors.push('Question text is missing or too short (min 5 characters).');
  }

  if (!rawSubject) {
    errors.push('Subject column is required.');
  } else if (validSubjectSlugs && !validSubjectSlugs.has(rawSubject)) {
    const found = DEFAULT_SUBJECTS.some((s) => s.slug === rawSubject || s.name.toLowerCase() === rawSubject);
    if (!found) {
      warnings.push(`Unknown subject identifier '${rawSubject}'. Will be registered dynamically.`);
    }
  }

  let formattedDiff = 'Medium';
  const diffLower = rawDifficulty.toLowerCase();
  if (diffLower === 'easy') formattedDiff = 'Easy';
  else if (diffLower === 'hard') formattedDiff = 'Hard';
  else if (diffLower === 'medium' || !rawDifficulty) formattedDiff = 'Medium';
  else {
    errors.push(`Invalid difficulty '${rawDifficulty}'. Must be Easy, Medium, or Hard.`);
  }

  let formattedType = 'MCQ';
  if (['INTERVIEW', 'HR', 'SUBJECTIVE'].includes(rawType)) {
    formattedType = 'INTERVIEW';
  } else if (rawType !== 'MCQ' && rawType.length > 0) {
    warnings.push(`Unrecognized question type '${rawType}'. Defaulting to MCQ.`);
  }

  // 2. MCQ Options & Answer validation
  const optA = normalizeText(raw.option_a || '');
  const optB = normalizeText(raw.option_b || '');
  const optC = normalizeText(raw.option_c || '');
  const optD = normalizeText(raw.option_d || '');
  let answer = normalizeText(raw.correct_answer || '').toUpperCase();

  if (formattedType === 'MCQ') {
    if (!optA || !optB || !optC || !optD) {
      errors.push('MCQ questions must have all four options (option_a, option_b, option_c, option_d).');
    }

    if (!answer) {
      errors.push('Correct answer is required for MCQ.');
    } else {
      if (!['A', 'B', 'C', 'D'].includes(answer)) {
        if (['1', '2', '3', '4'].includes(answer)) {
          const map: Record<string, string> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
          answer = map[answer];
        } else if (optA && answer.toLowerCase() === optA.toLowerCase()) answer = 'A';
        else if (optB && answer.toLowerCase() === optB.toLowerCase()) answer = 'B';
        else if (optC && answer.toLowerCase() === optC.toLowerCase()) answer = 'C';
        else if (optD && answer.toLowerCase() === optD.toLowerCase()) answer = 'D';
        else {
          errors.push(`Invalid correct answer '${answer}'. Must be A, B, C, or D.`);
        }
      }
    }
  }

  // 3. Duplicate checks
  let isDuplicate = false;
  const textFingerprint = getDuplicateFingerprint(rawQuestionText);

  if (rawQuestionId) {
    if (knownIdsInDb.has(rawQuestionId)) {
      isDuplicate = true;
      errors.push(`Question ID '${rawQuestionId}' already exists in the database.`);
    } else if (seenIdsInCsv.has(rawQuestionId)) {
      isDuplicate = true;
      errors.push(`Question ID '${rawQuestionId}' appears multiple times in this CSV.`);
    }
  }

  if (textFingerprint) {
    if (knownTextsInDb.has(textFingerprint)) {
      isDuplicate = true;
      errors.push('Question with identical text already exists in database.');
    } else if (seenTextsInCsv.has(textFingerprint)) {
      isDuplicate = true;
      errors.push('Duplicate question text found earlier in this CSV.');
    }
  }

  if (rawQuestionId) seenIdsInCsv.add(rawQuestionId);
  if (textFingerprint) seenTextsInCsv.add(textFingerprint);

  const normalized = normalizeQuestionInput(
    {
      ...raw,
      question_id: rawQuestionId,
      subject: rawSubject,
      difficulty: formattedDiff as any,
      question_type: formattedType as any,
      correct_answer: answer
    },
    rowIndex + 1
  );

  let status: 'valid' | 'invalid' | 'duplicate' | 'warning' = 'valid';
  if (isDuplicate) status = 'duplicate';
  else if (errors.length > 0) status = 'invalid';
  else if (warnings.length > 0) status = 'warning';

  return {
    rowIndex,
    raw,
    normalized: errors.length === 0 ? normalized : undefined,
    status,
    errors,
    warnings
  };
}
