# CrackPlace AI — XP and Level-Up System Comprehensive Audit & Specification

## 1. Executive Summary

This document presents a comprehensive audit, root-cause analysis, mathematical specification, and implementation verification of the **XP, Level-Up, and Gamification Economy System** across CrackPlace AI (Backend and Frontend).

The goal of this overhaul was to eliminate discrepancies where the Dashboard, Profile, Battle Result screen, Leaderboard, and Navbar displayed inconsistent level or XP values, to enforce strict server-authoritative calculations, to ensure mathematical monotonicity and idempotency across all game activities, and to maintain complete separation between **XP (progression)** and **Elo (skill rating)**.

---

## 2. Current Problems Found & Root Causes

| Issue Identified | Root Cause | Impact | Resolution |
| :--- | :--- | :--- | :--- |
| **Field Schema Mismatch (`xp` vs `totalXp`)** | `BattleResultProcessor.ts` persisted battle progression to `totalXp` in Firestore, whereas `quiz.ts`, `study.ts`, `coding.ts`, and frontend `UserProfile` read/wrote to `xp`. | Battles appeared to not reward XP on the frontend; profile and dashboard were out of sync. | Unified database writes across all routes and battle engines to atomically write identical values to both `xp` and `totalXp`. |
| **Decentralized Ad-Hoc Frontend Math** | `Dashboard.tsx` and `Profile.tsx` each implemented their own arithmetic functions calculating progress bars and next level XP. | Frontend progress bars displayed cumulative total XP against next cumulative thresholds ($150 / 250\text{ XP}$) instead of localized in-level progression ($50 / 150\text{ XP}$), causing erratic percentage jumps. | Built centralized frontend utility [levelCalculator.ts](file:///d:/My%20projects/Bhu-projects/Placement-quiz/frontend/src/utils/levelCalculator.ts) mirroring the authoritative backend [levelCalculator.ts](file:///d:/My%20projects/Bhu-projects/Placement-quiz/backend/src/game/scoring/levelCalculator.ts). |
| **Missing Auditable XP Ledger** | XP changes directly mutated user documents without recording historical transactions. | Impossible to audit XP exploits, track reward sources, or diagnose reward discrepancies. | Implemented `XpTransactionService` writing immutable ledger records to `xpTransactions` collection with `{ userId, source, referenceId, xpBefore, xpEarned, xpAfter, levelBefore, levelAfter, leveledUp, levelsGained, createdAt }`. |
| **Lack of Reward Deduplication & Idempotency** | Double clicks on quiz submission, socket reconnects, or page refreshes could potentially trigger multiple reward evaluations. | Risk of multiple XP payouts for the same battle or quiz completion. | Implemented composite idempotency keys `${source}_${referenceId}_${userId}` backed by in-memory deduplication cache and Firestore checks. |
| **Fragile Single-Level Increments (`level += 1`)** | Legacy code in several routes assumed a reward could only trigger at most one level up. | Large XP rewards (e.g. solving hard problems + achievements + daily streaks) failed to advance users who crossed multiple level thresholds. | Replaced with deterministic evaluation `newLevel = calculateLevelFromXP(newTotalXp)` where `levelsGained = newLevel - oldLevel`. |
| **Inconsistent Leaderboard Level Display** | `/api/leaderboard` returned static/uncalculated level numbers stored in stale user documents. | Users on the leaderboard showed different levels than on their personal profile page. | Leaderboard endpoint now runs dynamic `calculateLevelFromXP(xp)` on every user record. |

---

## 3. Mathematical Specifications & Progression Rules

### 3.1 Constants & Parameters
* **Base Level**: Level 1 (requires 0 XP to achieve Level 1).
* **Level 1 Base Threshold ($B$)**: $100\text{ XP}$ (XP required to reach Level 2 from Level 1).
* **Level Scaling Increment ($I$)**: $50\text{ XP}$ per level.

### 3.2 XP Needed For a Specific Level
The XP required to advance from Level $L$ to Level $L + 1$ is:
$$\text{XP}_{\text{step}}(L) = B + (L - 1) \times I = 100 + 50(L - 1)$$

* Level 1 $\rightarrow$ 2: $100\text{ XP}$
* Level 2 $\rightarrow$ 3: $150\text{ XP}$
* Level 3 $\rightarrow$ 4: $200\text{ XP}$
* Level 4 $\rightarrow$ 5: $250\text{ XP}$
* Level 5 $\rightarrow$ 6: $300\text{ XP}$
* Level $N \rightarrow N+1$: $100 + 50(N - 1)\text{ XP}$

### 3.3 Cumulative XP Required to Reach Level $L$
To reach Level $L$ from Level 1 (where Level 1 requires 0 XP):
$$\text{CumulativeXP}(L) = \sum_{k=1}^{L-1} (100 + 50(k - 1)) = (L - 1) \times 100 + 25 \times (L - 1)(L - 2)$$

| Level | Level XP Step | Cumulative XP Required |
| :---: | :---: | :---: |
| **Level 1** | $100\text{ XP}$ | $0\text{ XP}$ |
| **Level 2** | $150\text{ XP}$ | $100\text{ XP}$ |
| **Level 3** | $200\text{ XP}$ | $250\text{ XP}$ |
| **Level 4** | $250\text{ XP}$ | $450\text{ XP}$ |
| **Level 5** | $300\text{ XP}$ | $700\text{ XP}$ |
| **Level 6** | $350\text{ XP}$ | $1,000\text{ XP}$ |
| **Level 7** | $400\text{ XP}$ | $1,350\text{ XP}$ |
| **Level 8** | $450\text{ XP}$ | $1,750\text{ XP}$ |
| **Level 9** | $500\text{ XP}$ | $2,200\text{ XP}$ |
| **Level 10** | $550\text{ XP}$ | $2,700\text{ XP}$ |

### 3.4 Inverted Formula: Level from Total Accumulated XP
Given an authoritative total accumulated XP ($X \ge 0$), the level is calculated deterministically:
```typescript
function calculateLevelFromXP(totalXp: number): number {
  const safeXp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  let cumulativeRequired = 0;

  while (true) {
    const nextLevelCost = 100 + (level - 1) * 50;
    if (safeXp < cumulativeRequired + nextLevelCost) {
      break;
    }
    cumulativeRequired += nextLevelCost;
    level++;
  }

  return level;
}
```

### 3.5 Level-Up Progression & In-Level Progress Calculation
```typescript
function calculateLevelProgress(totalXp: number): LevelProgressDetails {
  const safeXp = Math.max(0, Math.floor(Number(totalXp) || 0));
  const currentLevel = calculateLevelFromXP(safeXp);
  const currentLevelBaseXp = calculateCumulativeXpForLevel(currentLevel);
  const nextLevelCost = 100 + (currentLevel - 1) * 50;
  const nextLevelCumulativeXp = currentLevelBaseXp + nextLevelCost;
  const xpIntoCurrentLevel = Math.max(0, safeXp - currentLevelBaseXp);
  const xpRemainingToNextLevel = Math.max(0, nextLevelCumulativeXp - safeXp);
  const progressPercentage = Math.min(100, Math.max(0, Math.round((xpIntoCurrentLevel / nextLevelCost) * 100)));

  return {
    currentLevel,
    totalXp: safeXp,
    currentLevelBaseXp,
    nextLevelCumulativeXp,
    xpIntoCurrentLevel,
    xpRequiredForNextLevel: nextLevelCost,
    xpRemainingToNextLevel,
    progressPercentage
  };
}
```

---

## 4. Authoritative Reward Pipeline & Deduplication Flow

The system enforces a single, authoritative processing pipeline for every game action:

```
Activity Trigger (Battle, Quiz, Coding, HR Interview, Daily Login, Mystery Box)
                           ↓
Check Idempotency (source + referenceId + userId)
   - If already processed: Return cached result (0 double rewards)
                           ↓
Fetch authoritative current XP (oldXp = user.xp ?? user.totalXp ?? 0)
                           ↓
Calculate: newXp = oldXp + earnedXp
                           ↓
Evaluate Level Transition:
   oldLevel = calculateLevelFromXP(oldXp)
   newLevel = calculateLevelFromXP(newXp)
   leveledUp = newLevel > oldLevel
   levelsGained = Math.max(0, newLevel - oldLevel)
                           ↓
Generate Auditable XP Transaction:
   {
     userId,
     source,
     referenceId,
     xpBefore: oldXp,
     xpEarned: earnedXp,
     xpAfter: newXp,
     levelBefore: oldLevel,
     levelAfter: newLevel,
     leveledUp,
     levelsGained,
     createdAt: ISO string
   }
                           ↓
Commit Atomically to Database:
   - users/{userId}: update { xp: newXp, totalXp: newXp, level: newLevel, ... }
   - xpTransactions/{source_refId_userId}: set transaction record
                           ↓
Broadcast / Return to Client:
   - Synchronous Response contains: { xp: newXp, level: newLevel, leveledUp, levelsGained, earnedXp }
   - Real-time Firestore snapshot updates client authStore
```

---

## 5. Summary of Code Refactoring

### 5.1 Backend Services & Handlers
1. **[levelCalculator.ts](file:///d:/My%20projects/Bhu-projects/Placement-quiz/backend/src/game/scoring/levelCalculator.ts)**:
   - Added `evaluateXpReward()`, `calculateCumulativeXpForLevel()`, `calculateLevelProgress()`, and full type definitions (`XpRewardEvaluation`, `XpTransactionRecord`, `LevelProgressDetails`).
2. **[XpTransactionService.ts](file:///d:/My%20projects/Bhu-projects/Placement-quiz/backend/src/services/XpTransactionService.ts)** *(New)*:
   - Built dedicated transactional ledger service managing composite keys `${source}_${referenceId}_${userId}`, Firestore persistence, memory deduplication caching, and history querying (`getUserTransactions()`).
3. **[battleResultProcessor.ts](file:///d:/My%20projects/Bhu-projects/Placement-quiz/backend/src/game/scoring/battleResultProcessor.ts)**:
   - Fixed field divergence; atomically writes `xp`, `totalXp`, `level`, and adds `xpTransactions` records for both Player A and Player B in batch transactions.
4. **[quiz.ts](file:///d:/My%20projects/Bhu-projects/Placement-quiz/backend/src/routes/quiz.ts)**:
   - Uses `LevelCalculator.evaluateXpReward()` for quiz submission and achievement bonuses with unique transaction keys.
5. **[coding.ts](file:///d:/My%20projects/Bhu-projects/Placement-quiz/backend/src/routes/coding.ts)**:
   - Uses `evaluateXpReward()` with `problemId` idempotency keys for both problem completions and unlockable achievements.
6. **[study.ts](file:///d:/My%20projects/Bhu-projects/Placement-quiz/backend/src/routes/study.ts)**:
   - Uses `evaluateXpReward()` with note completion keys.
7. **[interview.ts](file:///d:/My%20projects/Bhu-projects/Placement-quiz/backend/src/routes/interview.ts)**:
   - Uses `evaluateXpReward()` with unique dialogue SHA-256 hash idempotency keys.
8. **[index.ts](file:///d:/My%20projects/Bhu-projects/Placement-quiz/backend/src/index.ts)**:
   - Refactored daily login rewards, mission claims, lucky spin, mystery box, and dynamic leaderboard level calculation. Exposed `GET /api/auth/xp/transactions`.

### 5.2 Frontend Components & Store
1. **[levelCalculator.ts](file:///d:/My%20projects/Bhu-projects/Placement-quiz/frontend/src/utils/levelCalculator.ts)** *(New)*:
   - Centralized deterministic math utility for client-side display calculations.
2. **[Dashboard.tsx](file:///d:/My%20projects/Bhu-projects/Placement-quiz/frontend/src/pages/Dashboard.tsx)**:
   - Displays mathematically exact in-level progress: `prog.xpIntoCurrentLevel / prog.xpRequiredForNextLevel XP` with accurate percentage bar.
3. **[Profile.tsx](file:///d:/My%20projects/Bhu-projects/Placement-quiz/frontend/src/pages/Profile.tsx)**:
   - Added interactive **XP Audit Log** tab displaying real-time transaction ledger directly from `/api/auth/xp/transactions`.
4. **[Navbar.tsx](file:///d:/My%20projects/Bhu-projects/Placement-quiz/frontend/src/components/layout/Navbar.tsx)**:
   - Added Level + XP progress capsule with hovering tooltip showing in-level progress and percentage.
5. **[Sidebar.tsx](file:///d:/My%20projects/Bhu-projects/Placement-quiz/frontend/src/components/layout/Sidebar.tsx)**:
   - Uses `calculateLevelFromXP` for profile card display.
6. **[DashboardLayout.tsx](file:///d:/My%20projects/Bhu-projects/Placement-quiz/frontend/src/components/layout/DashboardLayout.tsx)**:
   - Level-up modal displays `Level X → Level Y (+XP Earned)`.
7. **[authStore.ts](file:///d:/My%20projects/Bhu-projects/Placement-quiz/frontend/src/store/authStore.ts)**:
   - Snapshot listener dynamically derives level from authoritative XP and triggers level-up celebration events.

---

## 6. Comprehensive Test Suite Execution

All 15 target scenarios were implemented in **[xp_level_system.test.ts](file:///d:/My%20projects/Bhu-projects/Placement-quiz/backend/src/__tests__/xp_level_system.test.ts)** and verified against the backend test suite:

```
PASS src/__tests__/battle.test.ts
PASS src/__tests__/auth.test.ts
PASS src/__tests__/economy.test.ts
PASS src/__tests__/xp_level_system.test.ts
PASS src/__tests__/questions.test.ts
PASS src/__tests__/rewards.test.ts

Test Suites: 6 passed, 6 total
Tests:       44 passed, 44 total
Snapshots:   0 total
Time:        27.556 s
```

### Detailed Scenario Results

| # | Test Scenario | Input & Conditions | Mathematical Expectation | Status |
| :---: | :--- | :--- | :--- | :---: |
| **1** | XP reward without level-up | Old: $0\text{ XP}$ (Lvl 1), Reward: $+50\text{ XP}$ | New: $50\text{ XP}$ (Lvl 1), `leveledUp: false`, $50/100\text{ XP}$ ($50\%$) | **PASSED** |
| **2** | XP reward causing single level-up | Old: $50\text{ XP}$ (Lvl 1), Reward: $+60\text{ XP}$ | New: $110\text{ XP}$ (Lvl 2), `leveledUp: true`, $10/150\text{ XP}$ | **PASSED** |
| **3** | XP reward causing multiple level-ups | Old: $50\text{ XP}$ (Lvl 1), Reward: $+500\text{ XP}$ | New: $550\text{ XP}$ (Lvl 4), `levelsGained: 3`, $100/250\text{ XP}$ | **PASSED** |
| **4** | Exact level threshold transition | Old: $0\text{ XP}$, Reward: $+100\text{ XP}$ | New: $100\text{ XP}$ (Lvl 2), $0/150\text{ XP}$ ($0\%$) | **PASSED** |
| **5** | Exactly 1 XP below threshold | Old: $0\text{ XP}$, Reward: $+99\text{ XP}$ | New: $99\text{ XP}$ (Lvl 1), `leveledUp: false`, $99/100\text{ XP}$ ($99\%$) | **PASSED** |
| **6** | Exactly 1 XP above threshold | Old: $0\text{ XP}$, Reward: $+101\text{ XP}$ | New: $101\text{ XP}$ (Lvl 2), `leveledUp: true`, $1/150\text{ XP}$ | **PASSED** |
| **7** | Zero XP reward safety | Old: $250\text{ XP}$ (Lvl 3), Reward: $+0\text{ XP}$ | New: $250\text{ XP}$ (Lvl 3), `leveledUp: false`, $0/200\text{ XP}$ | **PASSED** |
| **8** | Duplicate reward request idempotency | Same source, refId, and userId invoked twice | First returns `isRewardProcessed: false`, second returns `true` | **PASSED** |
| **9** | Battle retry / re-calculation | Recalculating battle results with identical stats | Identical XP, Coins, and Elo generated deterministically | **PASSED** |
| **10** | Reconstructed state consistency | User with $450\text{ XP}$ reconstructed | `calculateLevelFromXP(450) === 4` in all components | **PASSED** |
| **11** | Monotonic XP gain during reconnects | State transitions across connection loss | XP strictly increases: $\text{XP}_{\text{after}} \ge \text{XP}_{\text{before}}$ | **PASSED** |
| **12** | Sequential activity equation check | 4 sequential activities ($+40, +60, +150, +300$) | $\text{XP}_{\text{start}} + \sum \text{Earned} \equiv \text{XP}_{\text{final}}$ ($0 \rightarrow 550\text{ XP}$, Lvl 4) | **PASSED** |
| **13** | Legacy user document auto-repair | User record missing `level` or with stale `level` | Dynamically auto-derives correct level from `xp` | **PASSED** |
| **14** | Negative/invalid XP clamping | Input $-100\text{ XP}$ or `NaN` | Clamped to $0\text{ XP}$, level stays 1, no corruption | **PASSED** |
| **15** | Very large XP values | $1,000,000\text{ XP}$ single input | Resolved in $<1\text{ ms}$, calculates Level 199, zero overflow | **PASSED** |

---

## 7. Elo & XP System Separation Guarantee

* **XP & Level**: Represent **lifetime progression and effort**. XP gains are strictly monotonic ($earnedXP \ge 0$). Losing a 1v1 battle awards participation XP (e.g. $+24\text{ XP}$) and **never reduces total XP or Level**.
* **Elo Rating**: Represents **competitive skill matchmaking**. Elo changes symmetrically based on win/loss/draw outcome, opponent strength, and rating floor ($800$). Losing a battle reduces Elo by $\Delta\text{Elo}$ without modifying XP.

---

## 8. Final Verification & Status

1. **Backend Build & Unit Tests**: **100% Passed (44/44 tests across 6 suites)**.
2. **Frontend Build (`npm run build`)**: **100% Passed (TypeScript + Vite bundling with zero errors)**.
3. **Ledger Integrity**: Every XP modification records an immutable log in `xpTransactions`.
4. **UI Uniformity**: Dashboard, Profile, Leaderboard, Navbar, and Battle Results all read and display the exact same authoritative values and mathematical level thresholds.
