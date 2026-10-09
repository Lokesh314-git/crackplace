# CrackPlace AI — Dataset Ingestion Pipeline

## 1. Ingestion Commands

```bash
# Ingest MMLU Dataset
npm run ingest:mmlu

# Ingest HellaSwag Dataset
npm run ingest:hellaswag

# Master Ingestion (Core Curated + MMLU + HellaSwag)
npm run ingest:all
```

---

## 2. Ingestion Pipeline Workflow

```
MMLU / HellaSwag Source
           ↓
     Dataset Fetcher
           ↓
    Raw Text Parser
           ↓
MCQ Normalizer & Category Mapper
           ↓
Deterministic Difficulty Classifier
           ↓
SHA-256 Deduplication Filter
           ↓
Schema & Option Validator
           ↓
Batch Persistence (Firestore / DB)
           ↓
Ingestion Statistics Logged
```

---

## 3. Dataset Attribution & Licenses
* **MMLU**: Measuring Massive Multitask Language Understanding (Hendrycks et al., MIT License).
* **HellaSwag**: Can a Machine Really Finish Your Sentence? (Zellers et al., MIT License).
* **Curated Bank**: CrackPlace AI Core Engineering & Placement Questions (MIT License).
