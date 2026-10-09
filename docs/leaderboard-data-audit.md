# CrackPlace AI — Full Leaderboard Data Audit & Architecture Fix Report

## 1. Executive Summary

This audit investigated the root causes behind demo, test, and hardcoded fallback entries (such as *"Host Master"*, *"Guest Challenger"*, *"Anonymous Cadet"*, and *"Sandhya P"*) appearing on the **CrackPlace AI Global Rankings** leaderboard.

The leaderboard system has been redesigned from the ground up:
- **Zero Fallback Mock Users**: Eliminated all hardcoded demo arrays that previously masked database failures or empty state conditions.
- **Single Authoritative Data Source**: Rankings originate strictly from the authoritative Firestore `users` collection and verified `xpTransactions`.
- **Deterministic Ranking Rules**: Clear, mathematically defined ranking formulas for both **All-Time Global** (Elo $\rightarrow$ XP $\rightarrow$ UID) and **Weekly Sprint** (Weekly XP $\rightarrow$ Elo $\rightarrow$ XP $\rightarrow$ UID).
- **UID-Based Verification & Deduplication**: Each real user is identified by their unique Firebase UID; duplicate or client-spoofed identities are prevented.
- **Strict Demo/Test Isolation**: Development and test suite fixtures are isolated via `isTest: true` / `isDemo: true` / `environment: 'test'` and filtered from production queries.
- **Honest UI State Handling**: True empty states (*"No Ranked Candidates Yet"*) and actionable error states (*"Unable to load rankings. Try Again"*) replace fake data.

---

## 2. Root Cause Analysis: Where Did the Fake Data Come From?

### 2.1 Backend Fallback Mock Array (Root Cause 1)
In [`backend/src/index.ts`](file:///d:/My%20projects/Bhu-projects/Placement-quiz/backend/src/index.ts#L351-L357), the previous implementation contained a catch-block fallback:
```typescript
// PREVIOUS FLAWED CODE in backend/src/index.ts
if (ranks.length > 0) {
  return res.json(ranks);
}
throw new Error('No users found');
} catch (error) {
  const fallbackRanks = [
    { uid: '1', displayName: 'Sandhya P', level: 12, battleRating: 1420, xp: 6200 },
    { uid: '2', displayName: 'Lokesh A', level: 10, battleRating: 1350, xp: 5100 },
    { uid: '3', displayName: 'Ramesh K', level: 8, battleRating: 1210, xp: 4200 }
  ];
  res.json(fallbackRanks);
}
```
Whenever Firestore returned 0 users or an unindexed query threw an exception, the server returned this hardcoded mock array. As a result, users always saw "Sandhya P", "Lokesh A", and "Ramesh K" with fabricated levels and XP.

### 2.2 Unflagged Test Fixtures in Shared Firestore (Root Cause 2)
In `backend/src/__tests__/custom_battle_room.test.ts`, tests seeded sample candidate profiles directly into the shared Firestore database:
- `user_host_123` with display name `"Host Master"` (Rating: 1350, XP: 1200)
- `user_guest_456` with display name `"Guest Challenger"` (Rating: 1280, XP: 750)
- `user_third_789` with display name `"Third Cadet"` (Rating: 1100, XP: 300)

Because these documents were created without test-isolation flags and without an `afterAll` teardown hook, live leaderboard queries pulled these test documents directly into production rankings.

### 2.3 Static Client Tabs (Root Cause 3)
In [`frontend/src/pages/Leaderboards.tsx`](file:///d:/My%20projects/Bhu-projects/Placement-quiz/frontend/src/pages/Leaderboards.tsx), clicking **Weekly Sprint** toggled local UI state but did not query weekly transaction metrics, displaying identical all-time data under both tabs.

---

## 3. Data Architecture & Single Authoritative Pipeline

The new leaderboard data flow guarantees that **only real, authenticated accounts** are processed:

```
                  REAL AUTHENTICATED USERS
                             ↓
              FIRESTORE 'users' & 'xpTransactions'
                             ↓
              ISOLATION FILTER (Exclude isTest / isDemo)
                             ↓
              DETERMINISTIC RANKING ENGINE
                 ┌───────────┴───────────┐
                 │                       │
         ALL-TIME GLOBAL           WEEKLY SPRINT
      (Elo DESC, XP DESC)      (Weekly XP DESC, Elo DESC)
                 │                       │
                 └───────────┬───────────┘
                             ↓
                  REDIS 60s ACTIVE CACHE
                             ↓
                    GET /api/leaderboard
                             ↓
            AUTHENTIC LEADERBOARD UI (Leaderboards.tsx)
         [Podium Top 3] + [Rankings Table] + [User Rank Banner]
```

---

## 4. Ranking Eligibility & Formulas

### 4.1 Ranking Eligibility Rules
To appear on the leaderboard, a document must satisfy:
1. **Real User Account**: Must have a valid Firebase UID document in the `users` collection.
2. **Not a Test/Demo Bot**: Must not have `isTest === true`, `isDemo === true`, or `environment === 'test'`.
3. **Authoritative Stats**: XP and level must be derived strictly from [`calculateLevelFromXP`](file:///d:/My%20projects/Bhu-projects/Placement-quiz/backend/src/game/scoring/levelCalculator.ts).

### 4.2 All-Time Global Ranking Formula
- **Primary Sort**: `battleRating` (Elo) $\mathbf{DESC}$
- **Secondary Tie-Break**: `xp` $\mathbf{DESC}$
- **Tertiary Deterministic Tie-Break**: `uid` $\mathbf{ASC}$ (alphabetical string comparison)

### 4.3 Weekly Sprint Ranking Formula
- **Period**: Current UTC week starting Monday at `00:00:00 UTC` through Sunday `23:59:59 UTC`.
- **Metric**: Sum of all `xpEarned` from `xpTransactions` where `createdAt >= startOfWeekIso`.
- **Primary Sort**: `weeklyXp` $\mathbf{DESC}$
- **Secondary Tie-Break**: `battleRating` $\mathbf{DESC}$
- **Tertiary Tie-Break**: `xp` (Lifetime) $\mathbf{DESC}$
- **Quaternary Tie-Break**: `uid` $\mathbf{ASC}$

---

## 5. Security & Anti-Tampering Safeguards

1. **Server-Authoritative Only**: Client cannot submit ranking data, Elo, or XP via API bodies or socket events.
2. **Authenticated Endpoint**: `GET /api/leaderboard` is protected by `verifyToken` middleware and rate limiters.
3. **Zero Leaks**: Private information (passwords, emails, reset tokens) is stripped; only public profile tokens (`uid`, `displayName`, `photoURL`, `level`, `battleRating`, `xp`, `rank`) are exposed.
4. **UID-Based "You" Matching**: The user highlight banner strictly matches `entry.uid === userProfile.uid`, preventing any display name collision or impersonation.

---

## 6. Frontend UI Improvements

- **Podium Cards**: Dynamically renders 1, 2, or 3 top candidates based on the actual count of eligible candidates.
- **Empty State**: Displays an honest `"No Ranked Candidates Yet"` card with a call-to-action when 0 users exist.
- **Error State**: Displays a `"Unable to load rankings. Try Again"` banner with an inline retry trigger on network/server errors.
- **Live Event Synchronization**: Automatically refreshes rankings when `xp-earned`, `level-up`, or `battle-completed` events fire in the application.
- **Search Filtering**: Real-time filtering by `displayName` while preserving each candidate's true master leaderboard rank number.

---

## 7. Verification & Test Suite Summary

### 7.1 Automated Test Execution (`backend/src/__tests__/leaderboard_system.test.ts`)
```
PASS src/__tests__/leaderboard_system.test.ts
  Authoritative Leaderboard System Suite
    ✓ 1. should reject unauthenticated requests with 401
    ✓ 2. should return All-Time Global rankings sorted deterministically (Elo DESC, XP DESC)
    ✓ 3. should return Weekly Sprint rankings sorted by weekly XP DESC
    ✓ 4. should derive Level accurately from XP for all returned candidate entries
    ✓ 5. should never duplicate identical UIDs in leaderboard results

Test Suites: 9 passed, 9 total
Tests:       64 passed, 64 total
Snapshots:   0 total
Time:        34.5s
```

### 7.2 Frontend Production Bundle Verification
```
✓ 775 modules transformed.
dist/index.html                     0.83 kB │ gzip:   0.44 kB
dist/assets/index-BXDYZHno.css    114.92 kB │ gzip:  16.59 kB
dist/assets/index-Bt0Rv4td.js   1,837.12 kB │ gzip: 527.30 kB
✓ built in 1.33s
```
