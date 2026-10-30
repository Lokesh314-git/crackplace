const fs = require('fs');
const path = require('path');

const srcData = path.join(__dirname, '../data/curatedQuestions.json');
const distDataDir = path.join(__dirname, '../../dist/data');
const distData = path.join(distDataDir, 'curatedQuestions.json');

if (!fs.existsSync(distDataDir)) {
  fs.mkdirSync(distDataDir, { recursive: true });
}

if (fs.existsSync(srcData)) {
  fs.copyFileSync(srcData, distData);
  console.log(`[CopyAssets] Copied curatedQuestions.json (${(fs.statSync(srcData).size / 1024 / 1024).toFixed(2)} MB) to dist/data/`);
} else {
  console.warn('[CopyAssets] src/data/curatedQuestions.json does not exist!');
}
