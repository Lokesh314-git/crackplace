# CrackPlace AI — Game Economy & Battle Calculation Comprehensive Audit

## Executive Overview
This audit examines every point in the CrackPlace AI codebase where scores, XP, coins, player levels, Elo ratings, and rewards are calculated, transmitted, stored, and displayed.

The audit identifies discrepancies that caused the visual and numerical bugs shown in the production screenshots (e.g., tie scores resulting in defeat labels, opponent score desynchronization on result screens, stale store states, and conflicting starting Elo values).

---

## 1. Audit Findings Matrix

| Dimension | Previous State / Implementation | Issues & Root Causes Identified | Target Authoritative State |
| :--- | :--- | :--- | :--- |
| **Battle Score** | Calculated per step in memory / socket event | UI result screen displayed local React `playerScore` & `opponentProgress.score` instead of authoritative server match record | Server computes and returns authoritative `score` and `opponentScore` in `battle_concluded` payload |
| **Question Score** | Fixed 20 points per correct answer | Hardcoded `+20` magic numbers in multiple frontend/backend files without difficulty/speed weights | `scoreCalculator.ts`: Base points + configurable difficulty multiplier + optional speed bonus |
| **Tie / Draw Logic** | `winnerId = 'draw'` when scores equal | Frontend checked `battleResult.winnerId === userProfile.uid`; if false and not explicitly checking draw state properly, defaulted to DEFEAT UI | Server explicitly returns `result: 'WIN' \| 'LOSS' \| 'DRAW'`, `isDraw: boolean`, and `winnerId: string \| null` |
| **XP System** | Win: +40 XP, Loss: +10 XP, Draw: +15 XP | Scattered magic numbers; no unified breakdown of participation, accuracy, and win bonuses | `xpCalculator.ts`: Unified formula with single source of truth |
| **Player Level** | Derived via `calculateLevelFromXp(xp)` in `gamification.ts` | Disconnected level updates in some routes; level threshold formula duplicated in frontend types | Monotonic derivation: `Level = calculateLevelFromXP(totalXP)`. Level NEVER decreases on match loss or Elo drop |
| **Coins System** | Win: +20, Loss: +5, Draw: +8 | Client could submit mock coin rewards or store state could desync | `coinCalculator.ts`: Authoritative calculation with `Math.max(0, coins)` debt protection |
| **Elo Rating** | Default rating: 1000 in `users` creation vs 1200 in `BattleEngine` | **Starting rating contradiction**: New users created with 1000 Elo, but `BattleEngine` defaulted missing Elo to 1200 | Centralized `gameConfig.ts` with starting rating = 1000, K-factor = 32, floor = 100, strict symmetry |
| **Result Screen** | React state `playerScore` vs `opponentProgress.score` | Opponent's final question submission was not yet received by opponent's client before `battle_concluded` arrived, showing stale 20 vs 40 | Result screen renders directly and exclusively from server `battleResult` data |

---

## 2. Detailed Root Cause Analysis

### 2.1 The "Tie Score / Defeat" & Score Desync Bug (Screenshot Analysis)
1. **Root Cause 1: Result Screen Rendering Stale React State**:
   In `frontend/src/pages/Battle.tsx`:
   ```tsx
   <p className="font-display font-black text-3xl text-white mt-1">{playerScore}</p>
   ...
   <p className="font-display font-black text-3xl text-gray-400 mt-1">{opponentProgress.score}</p>
   ```
   When the match concluded, the client rendered its own local React state (`playerScore = 20`, `opponentProgress.score = 20`).
   However, on the server, the opponent had answered an additional question bringing their score to 40 (`winnerId = Loki`).
   Because Sandhya's client rendered local state (20 vs 20) while evaluating `isMeWinner = winnerId === userProfile.uid` (false), Sandhya's screen rendered **"DEFEAT"** with a **20 vs 20** scoreboard!
2. **Root Cause 2: Incomplete Result Payload**:
   The server emitted only `{ winnerId, isDraw, playerDeltas }` instead of sending a complete player-specific summary (`previousScore`, `finalScore`, `opponentScore`, `previousElo`, `newElo`, `eloChange`, `previousXp`, `newXp`, `xpEarned`, `previousCoins`, `newCoins`, `coinsEarned`, `previousLevel`, `newLevel`, `leveledUp`).

### 2.2 Elo Starting Rating Contradiction
* In `backend/src/index.ts` (Auth register/verify): `battleRating = 1000`
* In `backend/src/routes/quiz.ts`: `battleRating = 1000`
* In `backend/src/services/BattleEngine.ts`: `baseRating = userData.battleRating || 1200`
* In `backend/src/index.ts` (Custom rooms): `battleRating = userData.battleRating || 1200`
* **Fix**: Unify all defaults to `gameConfig.elo.startingRating` (1000).

---

## 3. Calculation Architecture Blueprint

The game economy will be structured under `backend/src/game/`:

```text
backend/src/game/
├── config/
│   └── gameConfig.ts          # Centralized economy configuration
├── scoring/
│   ├── scoreCalculator.ts     # Question & Battle scoring
│   ├── xpCalculator.ts        # XP rules across all modes
│   ├── levelCalculator.ts     # Level derivation & thresholds
│   ├── coinCalculator.ts      # Coin rewards & store pricing
│   ├── eloCalculator.ts       # Symmetrical Elo mathematics
│   ├── rewardCalculator.ts    # Comprehensive reward package assembler
│   └── battleResultProcessor.ts # Atomic transaction & persistence
└── index.ts
```
