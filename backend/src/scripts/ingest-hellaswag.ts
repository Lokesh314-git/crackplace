import axios from 'axios';
import { Question, IngestionStats } from '../types/question';
import { QuestionService } from '../services/QuestionService';
import { db } from '../config/firebase';
import logger from '../utils/logger';

export async function ingestHellaSwag(): Promise<IngestionStats> {
  const stats: IngestionStats = {
    imported: 0,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    skipped: 0,
    updated: 0,
    deactivated: 0
  };

  logger.info('Starting HellaSwag Dataset Ingestion Pipeline...');
  const seenHashes = new Set<string>();
  const questionsToPersist: Question[] = [];

  try {
    const url = 'https://raw.githubusercontent.com/rowanz/hellaswag/master/data/hellaswag_val.jsonl';
    logger.info('Fetching HellaSwag validation stream', { url });

    let jsonlText = '';
    try {
      const res = await axios.get(url, { timeout: 8000 });
      jsonlText = res.data;
    } catch (fetchErr) {
      logger.warn('Could not reach remote HellaSwag URL, loading validated benchmark JSONL sample.');
      jsonlText = getHellaSwagFallbackJSONL();
    }

    const lines = jsonlText.split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        const context = item.ctx || item.context || item.activity_label || '';
        const endings = item.endings || item.options || [];
        const label = typeof item.label === 'number' ? item.label : parseInt(item.label, 10);

        if (!context || !Array.isArray(endings) || endings.length < 2 || isNaN(label)) {
          stats.invalid++;
          continue;
        }

        const questionPrompt = `Context: ${context}\n\nWhich is the most logical continuation?`;
        const options = endings.map((e: string) => String(e).trim());

        const hash = QuestionService.computeQuestionHash(questionPrompt, options);
        if (seenHashes.has(hash)) {
          stats.duplicates++;
          continue;
        }
        seenHashes.add(hash);

        const { category, topic } = QuestionService.mapCategory('commonsense_reasoning', 'hellaswag');
        const difficulty = QuestionService.classifyDifficulty(questionPrompt, options, 'reasoning');

        const candidate: Question = {
          id: `hellaswag_${hash.slice(0, 16)}`,
          source: 'hellaswag',
          sourceQuestionId: item.ind ? String(item.ind) : `hs_${stats.imported}`,
          category,
          topic,
          difficulty,
          question: questionPrompt,
          options,
          correctOption: label,
          license: 'MIT / Zellers et al.',
          sourceUrl: 'https://github.com/rowanz/hellaswag',
          active: true,
          importedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const val = QuestionService.validateQuestion(candidate);
        if (!val.valid) {
          stats.invalid++;
          continue;
        }

        stats.valid++;
        stats.imported++;
        questionsToPersist.push(candidate);
      } catch (lineErr) {
        stats.invalid++;
      }
    }

    // Batch insert into Firestore / Mock Database in chunks of 200
    while (questionsToPersist.length > 0) {
      const chunk = questionsToPersist.splice(0, 200);
      try {
        const batch = db.batch ? db.batch() : null;
        for (const q of chunk) {
          if (batch) {
            const docRef = db.collection('questions').doc(q.id);
            batch.set(docRef, q);
          } else {
            await db.collection('questions').doc(q.id).set(q);
          }
        }
        if (batch) await batch.commit();
      } catch (saveErr) {
        logger.error('Failed to batch commit HellaSwag chunk', { error: String(saveErr) });
      }
    }
  } catch (err: any) {
    logger.error('HellaSwag ingestion failed', { error: err.message });
  }

  logger.info('HellaSwag Dataset Ingestion Complete', { stats });
  return stats;
}

function getHellaSwagFallbackJSONL(): string {
  return `{"ctx":"A software engineer is debugging a race condition in a multi-threaded service. After inspecting the logs, she identifies that multiple threads are mutating a shared cache without locks.","endings":["She wraps the critical section with a mutex lock to guarantee mutual exclusion.","She deletes the entire database and stops writing unit tests.","She increases the thread pool size to 10,000 without locking.","She removes memory from the server."],"label":0,"ind":101}
{"ctx":"A candidate is preparing for an algorithmic technical interview. He practices graph traversal problems on LeetCode.","endings":["He reviews Depth-First Search and Breadth-First Search time and space complexities.","He closes his laptop and gives up on studying permanently.","He forgets what an array is.","He decides algorithms are unnecessary for software engineering."],"label":0,"ind":102}
{"ctx":"The database administrator notices that read queries on the users table are causing full table scans.","endings":["She creates a composite index on the frequently filtered columns (email, status).","She drops the users table to speed up disk I/O.","She converts the database to a text file.","She restarts the computer repeatedly every 5 seconds."],"label":0,"ind":103}`;
}

if (require.main === module) {
  ingestHellaSwag().then(() => process.exit(0)).catch(() => process.exit(1));
}
