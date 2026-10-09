# CrackPlace AI — Database Architecture & Optimization

## 1. Storage Tiers & Responsibilities

| Tier | Engine | Entities Handled | Retention & Lifecycle |
| :--- | :--- | :--- | :--- |
| **Hot Ephemeral Tier** | Redis | Matchmaking queues, active battle states, socket adapters, rate limiters | 1 hour TTL |
| **Durable Document Tier**| Cloud Firestore | User profiles, question repositories, achievements, completed battle history | Permanent / Indexed |

---

## 2. Firestore Document Schemas

### 2.1 `users/{userId}`
```typescript
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'student' | 'admin';
  college?: string;
  degree?: string;
  xp: number;
  coins: number;
  level: number;
  battleRating: number;
  dailyStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  stats: {
    totalQuestionsSolved: number;
    totalBattlesWon: number;
    totalMockTests: number;
  };
  unlockedAchievements: string[];
  missionsState: MissionsState;
  equippedRing?: string | null;
  equippedFrame?: string | null;
  equippedBackground?: string | null;
  equippedTitle?: string | null;
  createdAt: string;
  updatedAt?: string;
}
```

### 2.2 `questions/{questionId}`
```typescript
interface QuestionDocument {
  id: string;
  source: 'mmlu' | 'hellaswag' | 'curated' | 'ai_generated';
  sourceQuestionId?: string;
  category: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  options: string[];
  correctOption: number;
  explanation?: string;
  active: boolean;
  importedAt: string;
  updatedAt: string;
}
```

### 2.3 `battleHistory/{historyId}`
```typescript
interface BattleHistoryRecord {
  battleId: string;
  uids: string[];
  winnerId: string;
  isDraw: boolean;
  category: string;
  difficulty: string;
  reason: string;
  scores: { [userId: string]: number };
  eloChanges: { [userId: string]: number };
  createdAt: string;
}
```

---

## 3. Query Optimization & Indexing Strategy
* **Leaderboards**: Composite index on `battleRating DESC`. In-memory Redis cache with 2-minute TTL serves peak spikes.
* **Battle History**: Compound index on `uids (array-contains)` + `createdAt DESC`.
* **Scheduled Cleanup**: Indexed queries with `.limit(100)` target only expired entries (`expirationTime < thirtyMinsAgo`), eliminating full collection scans.
