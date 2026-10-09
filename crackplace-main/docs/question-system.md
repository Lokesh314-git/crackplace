# CrackPlace AI — Question Architecture & Pool System

## 1. Design Philosophy
* **Zero Runtime Dataset Dependencies**: A live PvP match or quiz never downloads datasets or triggers synchronous external AI calls.
* **Pre-Ingestion**: Questions are ingested offline into normalized schemas with deterministic difficulty classification and deduplication hashing.
* **Answer Sanitization**: Questions sent to the client never include correct options or solutions before submission.

---

## 2. Common Question Schema

```typescript
interface Question {
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
```

---

## 3. Deduplication & Hashing Algorithm
Questions are hashed using SHA-256 over normalized question text and sorted option values:
```typescript
computeQuestionHash(questionText, options) -> SHA-256 (normalized_prompt ::: normalized_sorted_options)
```
Duplicate candidates are detected and rejected before entering the database.

---

## 4. Deterministic Difficulty Classifier
* **Easy**: Total character count $< 120$ without mathematical formulas or code blocks.
* **Hard**: Total character count $> 350$, or containing syntax tokens (`{}`, `[]`, `SELECT`, `JOIN`, `pointer`, `mutex`, `algorithm`).
* **Medium**: Standard benchmark questions fitting intermediate placement test profiles.
