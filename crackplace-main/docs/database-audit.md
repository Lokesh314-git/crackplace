# CrackPlace AI — Database & Storage Audit

## 1. Firestore Data Model & Schema Overview

The database contains durable business entities and historical records:

| Collection | Role | Read Frequency | Write Frequency | Indexing Requirements |
| :--- | :--- | :--- | :--- | :--- |
| `users` | User profiles, stats, currency, cosmetics, missions | High (Login, Refresh) | Moderate (Rewards, Transactions) | `battleRating DESC`, `xp DESC` |
| `questions` | Ingested MMLU & HellaSwag question bank | High (Matchmaking & Quizzes) | Low (Offline Ingestion) | `category ASC, difficulty ASC, active ASC` |
| `battleHistory` | Immutable final battle outcomes and statistics | Moderate (User History) | Moderate (Per match conclusion) | `uids ARRAY_CONTAINS, createdAt DESC` |
| `quizzes` | Self-paced AI / practice quiz instances | Low-Moderate | Low-Moderate | `userId ASC, createdAt DESC` |
| `codingSubmissions`| User algorithmic compiler runs | Moderate | Moderate | `userId ASC, createdAt DESC` |
| `notifications` | User achievement & streak alerts | Moderate | Moderate | `userId ASC, createdAt DESC` |

---

## 2. Inefficiencies Identified & Optimization Blueprint

### 2.1 Problem: High-Frequency Battle State in Firestore
* **Issue**: Writing room states to `battleRooms` or `battles` collection on every question tick consumes excessive document writes and triggers Firestore write latency (150-350ms).
* **Fix**:
  * Store in-flight battles in Redis as hash/JSON with key `battle:{battleId}` and a TTL of 1 hour.
  * Write to Firestore (`battleHistory`) only upon match finalization.

### 2.2 Problem: Unindexed Full Collection Scans
* **Issue**:
  * Automatic cleanup previously executed `db.collection('quizzes').get()` and filtered by timestamp in Node memory.
  * Leaderboard fallback executed `db.collection('users').get()` when composite index was building.
* **Fix**:
  * Convert all cleanup queries to compound indexed queries with limits:
    ```typescript
    const staleQuizzes = await db.collection('quizzes')
      .where('results', '==', null)
      .where('createdAt', '<', twentyFourHoursAgo)
      .limit(200)
      .get();
    ```
  * Maintain Redis Sorted Sets for leaderboards (`ZADD leaderboard:elo {rating} {uid}`) for $O(\log(N))$ rank retrieval without querying Firestore.

### 2.3 Concurrency & Transaction Safety
* **Requirement**: Double reward claims or concurrent spin wheel triggers must not corrupt user balances or level progress.
* **Implementation**:
  * Execute balance mutations within atomic Firestore transactions (`db.runTransaction()`).
  * Use distributed Redis locks (`redlock` / `SET key val NX EX 5`) for battle conclusion finalization across clustered backend workers.
