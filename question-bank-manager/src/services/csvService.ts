import Papa from 'papaparse';
import {
  ValidatedCSVRow,
  CSVValidationSummary,
  Question
} from '../types';
import { validateCSVRow } from '../utils/validation';
import { normalizeText } from '../utils/normalization';

export const CSV_EXPECTED_HEADERS = [
  'subject',
  'topic',
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_answer',
  'explanation',
  'difficulty',
  'marks',
  'negative_marks',
  'tags'
];

export const csvService = {
  /**
   * Parse CSV File and run multi-stage validation pipeline
   */
  async parseAndValidate(
    file: File,
    defaultSubject?: string,
    defaultTopic?: string,
    onProgress?: (progress: number) => void
  ): Promise<CSVValidationSummary> {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h) => h.trim().toLowerCase(),
        complete: async (results) => {
          try {
            const rawHeaders = results.meta.fields || [];
            const rows = results.data;

            // Check missing mandatory headers
            // We require either defaultSubject or subject in CSV
            const requiredHeaders = ['question', 'difficulty'];
            const missingRequiredHeaders = requiredHeaders.filter((req) => !rawHeaders.includes(req));
            if (!defaultSubject && !rawHeaders.includes('subject')) {
                missingRequiredHeaders.push('subject');
            }

            const validatedRows: ValidatedCSVRow[] = [];
            const seenQuestionIds = new Set<string>();
            const seenQuestionTexts = new Set<string>();

            let validCount = 0;
            let invalidCount = 0;
            let duplicateCount = 0;
            let warningCount = 0;

            const total = rows.length;

            for (let i = 0; i < total; i++) {
              const rawRow = rows[i];
              // Validate schema & values
              const validation = validateCSVRow(
                rawRow, 
                i + 1, 
                new Set(), 
                seenQuestionIds, 
                new Set(), 
                seenQuestionTexts, 
                undefined,
                defaultSubject,
                defaultTopic
              );

              // Check for intra-CSV duplicates
              const qId = (rawRow.id || rawRow.question_id || '').trim().toUpperCase();
              const normText = normalizeText(rawRow.question || '');

              let isDuplicate = false;
              if (qId && seenQuestionIds.has(qId)) {
                isDuplicate = true;
                validation.status = 'duplicate';
                validation.errors.push(`Duplicate Question ID "${qId}" within this CSV file (already found earlier in row).`);
              } else if (qId) {
                seenQuestionIds.add(qId);
              }

              if (normText && seenQuestionTexts.has(normText)) {
                if (!isDuplicate) {
                  validation.warnings.push('Similar question text already found in an earlier row in this CSV.');
                }
              } else if (normText) {
                seenQuestionTexts.add(normText);
              }

              // Update counters
              if (validation.status === 'valid') validCount++;
              else if (validation.status === 'invalid') invalidCount++;
              else if (validation.status === 'duplicate') duplicateCount++;
              if (validation.warnings.length > 0) warningCount++;

              validatedRows.push(validation);

              if (onProgress && i % 100 === 0) {
                onProgress(Math.round(((i + 1) / total) * 100));
              }
            }

            resolve({
              totalRows: total,
              validCount,
              invalidCount,
              duplicateCount,
              warningCount,
              rows: validatedRows,
              headers: rawHeaders,
              missingRequiredHeaders
            });
          } catch (err) {
            reject(err);
          }
        },
        error: (error) => {
          reject(new Error(`CSV Parsing Failed: ${error.message}`));
        }
      });
    });
  },

  /**
   * Generate and trigger download for a blank CSV template
   */
  downloadTemplate() {
    const csvContent = CSV_EXPECTED_HEADERS.join(',') + '\n';
    this.triggerDownload(csvContent, 'crackplace_question_template.csv', 'text/csv;charset=utf-8;');
  },

  /**
   * Generate and trigger download for an example CSV template populated with sample rows
   */
  downloadSampleCSV() {
    const sampleRows = [
      {
        subject: 'quantitative_aptitude',
        topic: 'Percentages',
        question: 'What is 20% of 100?',
        option_a: '10',
        option_b: '20',
        option_c: '30',
        option_d: '40',
        correct_answer: 'B',
        explanation: '20% of 100 = (20/100) * 100 = 20.',
        difficulty: 'Easy',
        marks: '1',
        negative_marks: '0',
        tags: 'basic,math'
      },
      {
        subject: 'dsa',
        topic: 'Arrays',
        question: 'What is the average time complexity of searching in a Hash Table with good hash distribution?',
        option_a: 'O(1)',
        option_b: 'O(log N)',
        option_c: 'O(N)',
        option_d: 'O(N^2)',
        correct_answer: 'A',
        explanation: 'Direct key hashing enables constant average time lookup O(1).',
        difficulty: 'Medium',
        marks: '2',
        negative_marks: '0.5',
        tags: 'data_structures,hashing'
      }
    ];

    const csv = Papa.unparse(sampleRows, { columns: CSV_EXPECTED_HEADERS });
    this.triggerDownload(csv, 'crackplace_sample_questions.csv', 'text/csv;charset=utf-8;');
  },

  /**
   * Export an array of Questions to CSV
   */
  exportQuestionsToCSV(questions: Question[], filename = 'crackplace_questions_export.csv') {
    const mapped = questions.map((q: any) => ({
      subject: q.subject,
      topic: q.topic || '',
      question: q.question,
      option_a: q.option_a || '',
      option_b: q.option_b || '',
      option_c: q.option_c || '',
      option_d: q.option_d || '',
      correct_answer: q.correct_answer || '',
      explanation: q.explanation || '',
      difficulty: q.difficulty,
      marks: q.marks || '',
      negative_marks: q.negative_marks || '',
      tags: q.tags || ''
    }));

    const csv = Papa.unparse(mapped, { columns: CSV_EXPECTED_HEADERS });
    this.triggerDownload(csv, filename, 'text/csv;charset=utf-8;');
  },

  /**
   * Export Validation Error Report for rows that failed verification
   */
  downloadErrorReport(summary: CSVValidationSummary) {
    const errorRows = summary.rows
      .filter((r) => r.status === 'invalid' || r.status === 'duplicate')
      .map((r) => ({
        row_number: r.rowIndex,
        question_id: r.raw.id || r.raw.question_id || '',
        subject: r.raw.subject || '',
        status: r.status,
        errors: r.errors.join(' | '),
        warnings: r.warnings.join(' | '),
        question_preview: (r.raw.question || '').slice(0, 80)
      }));

    if (errorRows.length === 0) {
      alert('No errors to export! All rows in this CSV are valid.');
      return;
    }

    const csv = Papa.unparse(errorRows);
    this.triggerDownload(csv, 'crackplace_import_error_report.csv', 'text/csv;charset=utf-8;');
  },

  /**
   * Browser file download utility
   */
  triggerDownload(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
