import { QuestionService } from '../services/QuestionService';
import { Question } from '../types/question';

describe('Question System & Ingestion Suite', () => {
  it('should compute identical hashes for identical questions regardless of casing and spacing', () => {
    const q1 = 'What is the time complexity of binary search?';
    const opts1 = ['O(1)', 'O(log N)', 'O(N)', 'O(N^2)'];

    const q2 = '  what IS the time COMPLEXITY of binary search?  ';
    const opts2 = ['O(log n)  ', 'O(1)', 'O(n^2)', 'O(N)'];

    const hash1 = QuestionService.computeQuestionHash(q1, opts1);
    const hash2 = QuestionService.computeQuestionHash(q2, opts2);

    expect(hash1).toBe(hash2);
  });

  it('should validate and reject malformed question schemas', () => {
    // Missing question prompt
    const invalid1 = QuestionService.validateQuestion({
      question: '',
      options: ['A', 'B'],
      correctOption: 0
    });
    expect(invalid1.valid).toBe(false);

    // Duplicate options
    const invalid2 = QuestionService.validateQuestion({
      question: 'Valid question prompt?',
      options: ['Option 1', 'Option 1', 'Option 2'],
      correctOption: 0
    });
    expect(invalid2.valid).toBe(false);

    // Invalid correctOption index
    const invalid3 = QuestionService.validateQuestion({
      question: 'Valid question prompt?',
      options: ['Option 1', 'Option 2'],
      correctOption: 5
    });
    expect(invalid3.valid).toBe(false);

    // Valid question
    const valid = QuestionService.validateQuestion({
      question: 'What is a process control block (PCB)?',
      options: ['Hardware bus', 'Data structure representing a process', 'Compiler pass', 'Network socket'],
      correctOption: 1
    });
    expect(valid.valid).toBe(true);
  });

  it('should deterministically map categories from dataset subjects', () => {
    expect(QuestionService.mapCategory('college_computer_science', 'mmlu').category).toBe('DSA');
    expect(QuestionService.mapCategory('elementary_mathematics', 'mmlu').category).toBe('Aptitude');
    expect(QuestionService.mapCategory('formal_logic', 'mmlu').category).toBe('Reasoning');
    expect(QuestionService.mapCategory('context_activity', 'hellaswag').category).toBe('Reasoning');
  });

  it('should sanitize questions for client transmission without leaking answers', () => {
    const questions: Question[] = [
      {
        id: 'q1',
        source: 'curated',
        category: 'DSA',
        topic: 'Complexity',
        difficulty: 'easy',
        question: 'Sample question text',
        options: ['A', 'B', 'C', 'D'],
        correctOption: 2,
        explanation: 'Secret explanation with answer C',
        active: true,
        importedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const sanitized = QuestionService.sanitizeForClient(questions);
    expect(sanitized.length).toBe(1);
    expect(sanitized[0]).toHaveProperty('id');
    expect(sanitized[0]).toHaveProperty('questionText');
    expect(sanitized[0]).toHaveProperty('options');
    expect((sanitized[0] as any).correctOption).toBeUndefined();
    expect((sanitized[0] as any).explanation).toBeUndefined();
  });
});
