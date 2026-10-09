import { ingestMMLU } from './ingest-mmlu';
import { ingestHellaSwag } from './ingest-hellaswag';
import { QuestionService } from '../services/QuestionService';
import { db } from '../config/firebase';
import logger from '../utils/logger';

export async function ingestAll() {
  console.log('====================================================');
  console.log('  CRACKPLACE AI — MASTER DATASET INGESTION WORKER   ');
  console.log('====================================================');

  // 1. Seed curated core questions
  logger.info('Ingesting Core Curated Questions...');
  const categories = ['Aptitude', 'DSA', 'DBMS', 'Operating Systems'];
  let curatedCount = 0;
  for (const cat of categories) {
    const list = QuestionService.getCuratedFallbackQuestions(cat);
    for (const q of list) {
      await db.collection('questions').doc(q.id).set(q);
      curatedCount++;
    }
  }
  logger.info(`Seeded ${curatedCount} Core Curated Placement Questions.`);

  // 2. Ingest MMLU
  const mmluStats = await ingestMMLU();

  // 3. Ingest HellaSwag
  const hsStats = await ingestHellaSwag();

  console.log('\n====================================================');
  console.log('               INGESTION SUMMARY REPORT              ');
  console.log('====================================================');
  console.log(`Core Questions Seeded:  ${curatedCount}`);
  console.log(`MMLU Questions:         ${mmluStats.imported} imported (${mmluStats.valid} valid, ${mmluStats.duplicates} duplicates)`);
  console.log(`HellaSwag Questions:    ${hsStats.imported} imported (${hsStats.valid} valid, ${hsStats.duplicates} duplicates)`);
  console.log(`Total Active Bank:      ${curatedCount + mmluStats.valid + hsStats.valid} questions ready for PvP battles.`);
  console.log('====================================================\n');
}

if (require.main === module) {
  ingestAll().then(() => process.exit(0)).catch((e) => {
    console.error('Ingestion failed:', e);
    process.exit(1);
  });
}
