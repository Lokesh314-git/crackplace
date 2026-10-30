import fs from 'fs';
import path from 'path';
import { Question } from '../types/question';
import logger from '../utils/logger';

function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;
  let cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;

  for (let i = 0; i < cleanContent.length; i++) {
    const char = cleanContent[i];
    const nextChar = cleanContent[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentVal);
        currentVal = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentVal);
        rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else if (char === '\n') {
        currentRow.push(currentVal);
        rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal);
    rows.push(currentRow);
  }
  return rows;
}

export function importQuestionsFromCSV(): {
  quantQuestions: Question[];
  dsaQuestions: Question[];
  totalImported: number;
  stats: any;
} {
  const quantPaths = [
    path.join(__dirname, '../../../../Questions & options/quantitative_aptitude_questions(5000).csv'),
    path.join(process.cwd(), '../Questions & options/quantitative_aptitude_questions(5000).csv'),
    path.join(process.cwd(), 'Questions & options/quantitative_aptitude_questions(5000).csv'),
    'D:/My projects/Loki\'s projects/CrackPlace/Questions & options/quantitative_aptitude_questions(5000).csv'
  ];

  const dsaPaths = [
    path.join(__dirname, '../../../../Questions & options/dsa_questions_dataset(5000).csv'),
    path.join(process.cwd(), '../Questions & options/dsa_questions_dataset(5000).csv'),
    path.join(process.cwd(), 'Questions & options/dsa_questions_dataset(5000).csv'),
    'D:/My projects/Loki\'s projects/CrackPlace/Questions & options/dsa_questions_dataset(5000).csv'
  ];

  let quantCsvPath = quantPaths.find(p => fs.existsSync(p));
  let dsaCsvPath = dsaPaths.find(p => fs.existsSync(p));

  if (!quantCsvPath) {
    throw new Error('quantitative_aptitude_questions(5000).csv not found in any known locations.');
  }

  const now = new Date().toISOString();
  const quantQuestions: Question[] = [];
  const quantStats: any = {
    byTopic: {} as Record<string, number>,
    bySubtopic: {} as Record<string, number>,
    byDifficulty: {} as Record<string, number>,
    trainCount: 0,
    trainMediumCount: 0
  };

  // 1. Process Quantitative Aptitude CSV
  const quantContent = fs.readFileSync(quantCsvPath, 'utf8');
  const quantRows = parseCSV(quantContent);
  const quantDataRows = quantRows.slice(1).filter(r => r.length > 6 && r[0].trim());

  console.log(`[Import] Found ${quantDataRows.length} valid rows in Quantitative Aptitude CSV.`);

  for (let idx = 0; idx < quantDataRows.length; idx++) {
    const row = quantDataRows[idx];
    const id = (row[0] || `QAP${String(idx + 1).padStart(4, '0')}`).trim();
    const rawSubject = (row[1] || 'Quantitative Aptitude').trim();
    let rawTopic = (row[2] || 'General').trim();
    let rawSubtopic = (row[3] || '').trim();
    const rawDiff = (row[4] || 'Medium').trim().toLowerCase();
    const qText = (row[6] || '').trim();
    const optA = (row[7] || '').trim();
    const optB = (row[8] || '').trim();
    const optC = (row[9] || '').trim();
    const optD = (row[10] || '').trim();
    const rawAns = (row[11] || 'A').trim().toUpperCase();
    const explanation = (row[12] || '').trim();

    if (!qText || !optA || !optB) continue;

    const options = [optA, optB, optC, optD].filter(Boolean);
    let correctOption = 0;
    if (rawAns === 'A') correctOption = 0;
    else if (rawAns === 'B') correctOption = 1;
    else if (rawAns === 'C') correctOption = 2;
    else if (rawAns === 'D') correctOption = 3;

    const difficulty: 'easy' | 'medium' | 'hard' = 
      rawDiff === 'easy' ? 'easy' : rawDiff === 'hard' ? 'hard' : 'medium';

    // Canonical mapping for Quantitative Aptitude
    let canonicalTopic = rawTopic;
    let canonicalSubtopic = rawSubtopic;
    const tags: string[] = ['quantitative_aptitude'];

    if (rawTopic === 'Trains') {
      canonicalTopic = 'Time and Speed';
      canonicalSubtopic = rawSubtopic ? `Problems on Trains - ${rawSubtopic}` : 'Problems on Trains';
      tags.push('trains', 'Problems on Trains', rawSubtopic);
      quantStats.trainCount++;
      if (difficulty === 'medium') quantStats.trainMediumCount++;
    } else if (rawTopic === 'Boats and Streams') {
      canonicalTopic = 'Time and Speed';
      canonicalSubtopic = rawSubtopic ? `Boats and Streams - ${rawSubtopic}` : 'Boats and Streams';
      tags.push('boats', 'Boats and Streams', rawSubtopic);
    } else if (rawTopic === 'Time Speed Distance') {
      canonicalTopic = 'Time and Speed';
      canonicalSubtopic = rawSubtopic || 'Speed and Distance';
      tags.push('time_speed_distance', rawSubtopic);
    } else if (rawTopic === 'Time Work' || rawTopic === 'Time and Work') {
      canonicalTopic = 'Time and Work';
      canonicalSubtopic = rawSubtopic || 'Combined Work';
      tags.push('time_and_work');
    }

    // Stats
    quantStats.byTopic[canonicalTopic] = (quantStats.byTopic[canonicalTopic] || 0) + 1;
    quantStats.bySubtopic[`${canonicalTopic} -> ${canonicalSubtopic}`] = 
      (quantStats.bySubtopic[`${canonicalTopic} -> ${canonicalSubtopic}`] || 0) + 1;
    quantStats.byDifficulty[difficulty] = (quantStats.byDifficulty[difficulty] || 0) + 1;

    quantQuestions.push({
      id,
      source: 'curated',
      sourceQuestionId: id,
      category: 'quantitative_aptitude',
      topic: canonicalTopic,
      subtopic: canonicalSubtopic,
      difficulty,
      question: qText,
      options,
      correctOption,
      explanation: explanation || undefined,
      tags,
      active: true,
      importedAt: now,
      updatedAt: now
    });
  }

  // 2. Process DSA CSV if present
  const dsaQuestions: Question[] = [];
  if (dsaCsvPath && fs.existsSync(dsaCsvPath)) {
    const dsaContent = fs.readFileSync(dsaCsvPath, 'utf8');
    const dsaRows = parseCSV(dsaContent);
    const dsaDataRows = dsaRows.slice(1).filter(r => r.length > 6 && r[0].trim());

    console.log(`[Import] Found ${dsaDataRows.length} valid rows in DSA CSV.`);

    for (let idx = 0; idx < dsaDataRows.length; idx++) {
      const row = dsaDataRows[idx];
      const id = (row[0] || `DSA${String(idx + 1).padStart(4, '0')}`).trim();
      let rawTopic = (row[2] || 'General').trim();
      let rawSubtopic = (row[3] || '').trim();
      const rawDiff = (row[4] || 'Medium').trim().toLowerCase();
      const qText = (row[6] || '').trim();
      const optA = (row[7] || '').trim();
      const optB = (row[8] || '').trim();
      const optC = (row[9] || '').trim();
      const optD = (row[10] || '').trim();
      const rawAns = (row[11] || 'A').trim().toUpperCase();
      const explanation = (row[12] || '').trim();

      if (!qText || !optA || !optB) continue;

      const options = [optA, optB, optC, optD].filter(Boolean);
      let correctOption = 0;
      if (rawAns === 'A') correctOption = 0;
      else if (rawAns === 'B') correctOption = 1;
      else if (rawAns === 'C') correctOption = 2;
      else if (rawAns === 'D') correctOption = 3;

      const difficulty: 'easy' | 'medium' | 'hard' = 
        rawDiff === 'easy' ? 'easy' : rawDiff === 'hard' ? 'hard' : 'medium';

      // Canonical mapping for DSA
      let canonicalTopic = rawTopic;
      if (rawTopic === 'Queues and Deques' || rawTopic === 'Stacks') {
        canonicalTopic = 'Stacks & Queues';
      } else if (rawTopic === 'Binary Search Trees' || rawTopic === 'Trees') {
        canonicalTopic = 'Trees & BST';
      } else if (rawTopic === 'Searching' || rawTopic === 'Sorting') {
        canonicalTopic = 'Sorting & Searching';
      } else if (rawTopic === 'Heaps and Priority Queues' || rawTopic === 'Hashing') {
        canonicalTopic = 'Heaps & Hashing';
      } else if (rawTopic === 'Recursion' || rawTopic === 'Backtracking') {
        canonicalTopic = 'Recursion & Backtracking';
      } else if (rawTopic === 'Shortest Path Algorithms' || rawTopic === 'Minimum Spanning Tree' || rawTopic === 'Disjoint Set Union') {
        canonicalTopic = 'Graphs';
      } else if (rawTopic === 'Divide and Conquer') {
        canonicalTopic = 'Dynamic Programming';
      }

      dsaQuestions.push({
        id,
        source: 'curated',
        sourceQuestionId: id,
        category: 'dsa',
        topic: canonicalTopic,
        subtopic: rawSubtopic || undefined,
        difficulty,
        question: qText,
        options,
        correctOption,
        explanation: explanation || undefined,
        tags: ['dsa', canonicalTopic],
        active: true,
        importedAt: now,
        updatedAt: now
      });
    }
  }

  return {
    quantQuestions,
    dsaQuestions,
    totalImported: quantQuestions.length + dsaQuestions.length,
    stats: quantStats
  };
}

export function buildAndPersistCuratedBank() {
  const { quantQuestions, dsaQuestions, totalImported, stats } = importQuestionsFromCSV();

  // Load existing other subjects from current bank if available
  const existingPath = path.join(__dirname, '../data/curatedQuestions.json');
  let otherQuestions: Question[] = [];
  if (fs.existsSync(existingPath)) {
    try {
      const prevBank: Question[] = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
      otherQuestions = prevBank.filter(q => q.category !== 'quantitative_aptitude' && q.category !== 'dsa');
    } catch {
      otherQuestions = [];
    }
  }

  const completeBank: Question[] = [
    ...quantQuestions,
    ...dsaQuestions,
    ...otherQuestions
  ];

  console.log(`[BuildBank] Combined Total Questions: ${completeBank.length}`);
  console.log(`  - Quantitative Aptitude: ${quantQuestions.length}`);
  console.log(`  - DSA: ${dsaQuestions.length}`);
  console.log(`  - Other Subjects (DBMS, OS, CN, etc.): ${otherQuestions.length}`);

  // Write to src/data
  const srcDataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(srcDataDir)) fs.mkdirSync(srcDataDir, { recursive: true });
  const srcDataFile = path.join(srcDataDir, 'curatedQuestions.json');
  fs.writeFileSync(srcDataFile, JSON.stringify(completeBank, null, 2), 'utf8');
  console.log(`[BuildBank] Wrote ${completeBank.length} questions to ${srcDataFile}`);

  // Write to dist/data
  const distDataDir = path.join(__dirname, '../../dist/data');
  if (!fs.existsSync(distDataDir)) fs.mkdirSync(distDataDir, { recursive: true });
  const distDataFile = path.join(distDataDir, 'curatedQuestions.json');
  fs.writeFileSync(distDataFile, JSON.stringify(completeBank, null, 2), 'utf8');
  console.log(`[BuildBank] Wrote ${completeBank.length} questions to ${distDataFile}`);

  return {
    total: completeBank.length,
    quant: quantQuestions.length,
    dsa: dsaQuestions.length,
    other: otherQuestions.length,
    stats
  };
}

if (require.main === module) {
  try {
    const res = buildAndPersistCuratedBank();
    console.log('[BuildBank] Successfully built curated bank:', res);
  } catch (err) {
    console.error('[BuildBank] Ingestion error:', err);
    process.exit(1);
  }
}
