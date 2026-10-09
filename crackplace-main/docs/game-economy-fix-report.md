# CrackPlace AI — Game Economy & Battle Calculation Fix Report

## 1. Executive Summary & Problem Overview
During audit and analysis of the CrackPlace AI multiplayer battle system and economy engine, critical inconsistencies were identified across Score, XP, Player Levels, Coins, and Elo calculation and display:

- **Screenshot Analysis (Sandhya vs Loki)**: In the user-provided screenshot, Sandhya's client rendered **"DEFEAT"** with **"MY SCORE 20 VS LOKI 20"**, while Loki's client rendered **"VICTORY"** with **"MY SCORE 40 VS SANDHYA 20"**.
- **Root Cause**: The client result screen (`Battle.tsx`) was rendering transient, un-synchronized React component state (`opponentProgress.score`) rather than the authoritative server battle record emitted upon match conclusion.
- **Starting Elo Divergence**: Player profiles in Firestore initialized with `battleRating: 1000`, while `BattleEngine.ts` assumed `1200` as default.
- **Magic Numbers & Multiple Evaluators**: Hardcoded multipliers, scoring rules, and coin bonuses were scattered across controllers and services without a single authoritative source of truth.

---

## 2. Root Cause Analysis

| System | Pre-Fix Behavior | Root Cause | Fix Implemented |
|---|---|---|---|
| **Battle Score** | Hardcoded 20 in socket handler; UI rendered local state `playerScore` and `opponentProgress.score` | Score calculated independently; UI ignored server conclusion payload | Authoritative `ScoreCalculator` calculates each question deterministic points and aggregate battle score |
| **Result Screen** | Rendered stale local React state | Result UI read `opponentProgress.score` rather than `battleResult.playerReward` | `Battle.tsx` renders exclusively from authoritative `battleResult.playerReward` |
| **Elo Rating** | Starting Elo mismatched (`1000` vs `1200`); single-sided updates | Hardcoded rating fallbacks; asymmetrical rounding | Centralized standard logistic `EloCalculator` with mathematical symmetry ($\Delta A + \Delta B = 0$) and `GAME_CONFIG.elo.startingRating: 1000` |
| **XP & Level Progression** | Level could theoretically drop or mismatch total XP | Independent level and XP state mutations | Level is derived monotonically from `totalXp` via `LevelCalculator.calculateLevelProgress()`; level decreases are impossible |
| **Coins** | Hardcoded magic numbers (15, 8, 40, 20, 10, 5) | No central economy balance table | Centralized `CoinCalculator` referencing `GAME_CONFIG.coins` with negative debt protection |
| **Idempotency** | Multiple event triggers could re-award XP/coins | Lack of transactional deduplication | `BattleResultProcessor` with distributed memory & database idempotency lock on `battleRewards/{battleId}` |

---

## 3. Authoritative Architecture & Single Source of Truth

The entire game economy has been consolidated into `backend/src/game/`:

```
backend/src/game/
├── config/
│   └── gameConfig.ts           # Centralized configuration (Scoring, XP, Coins, Elo, Levels)
├── scoring/
│   ├── scoreCalculator.ts      # Authoritative Question & Battle Scoring
│   ├── xpCalculator.ts         # Authoritative XP Formulae (Battle, Quiz, Coding, HR)
│   ├── levelCalculator.ts      # Monotonic Level Derivation & Progress Calculations
│   ├── coinCalculator.ts       # Authoritative Coin Rewards & Debt Prevention
│   ├── eloCalculator.ts        # Zero-Sum Symmetrical Elo Rating System
│   ├── rewardCalculator.ts     # Reward Package Assembler for Both Participants
│   └── battleResultProcessor.ts# Transactional Idempotency Guard & Firestore Persistence
└── index.ts                    # Single unified export barrel
```

---

## 4. Mathematical Formulas & Game Economy Rules

### 4.1. Question & Battle Score Formula
For each question:
$$\text{Base Points} = 20$$
$$\text{Difficulty Multipliers} = \begin{cases} \text{Easy:} & 1.0 \\ \text{Medium:} & 1.0 \\ \text{Hard:} & 1.25 \end{cases}$$
$$\text{Speed Bonus Threshold} = 0.5 \times \text{Time Limit (e.g. 15s for 30s limit)}$$
$$\text{Speed Ratio} = \max\left(0, 1 - \frac{\text{Response Time}}{\text{Threshold}}\right)$$
$$\text{Speed Bonus} = \text{round}(\text{Speed Ratio} \times 5)$$
$$\text{Question Score} = \text{round}(\text{Base Points} \times \text{Difficulty Multiplier}) + \text{Speed Bonus}$$

For incorrect or timed-out answers:
$$\text{Question Score} = 0$$

$$\text{Final Battle Score} = \sum_{i=1}^{N} \text{Question Score}_i$$

---

### 4.2. Elo Rating System
For two players with ratings $R_A$ and $R_B$:
$$E_A = \frac{1}{1 + 10^{(R_B - R_A) / 400}}$$
$$E_B = 1 - E_A$$

Actual score outcome $S$:
$$S = \begin{cases} 1.0 & \text{Win} \\ 0.5 & \text{Draw} \\ 0.0 & \text{Loss} \end{cases}$$

Rating updates with K-Factor ($K = 32$):
$$\Delta R_A = \text{round}(K \times (S_A - E_A))$$
$$\Delta R_B = -\Delta R_A \quad (\text{Enforces strict symmetry})$$
$$R'_A = \max(\text{MIN\_FLOOR}, R_A + \Delta R_A)$$

---

### 4.3. XP Progression & Monotonic Level Derivation
Cumulative XP required to reach Level $L$:
$$\text{XP}(L) = \begin{cases} 0 & L = 1 \\ 100 & L = 2 \\ \text{XP}(L-1) + 100 + 50 \times (L-1) & L > 2 \end{cases}$$

- **Level Calculation**: Level is derived strictly and monotonically from $\text{totalXP}$.
- **Level Decreases**: Impossible by mathematical design. A player losing a match gains minimum participation XP ($+10$), strictly ensuring non-decreasing progression.

---

### 4.4. Coin Economics
$$\text{Battle Coins} = \begin{cases} 20 & \text{Win} \\ 10 & \text{Draw} \\ 5 & \text{Loss} \end{cases}$$
$$\text{New Coins Balance} = \max(0, \text{Current Coins} + \Delta\text{Coins})$$

---

## 5. Result Synchronization & Idempotency Guarantee

```
CLIENT                              SERVER
   │                                   │
   │── Submit Question Answer ────────>│ (ScoreCalculator evaluates deterministically)
   │<── answer_evaluated ──────────────│
   │                                   │
   │── Battle Ends (Time or Finish) ──>│ (Lock active on battleId)
   │                                   │ (Check memory cache / DB battleRewards/{battleId})
   │                                   │ (RewardCalculator computes playerA & playerB packages)
   │                                   │ (Atomic Batch write to users/ and battleRewards/)
   │<── battle_concluded (Player A) ───│ (Contains authoritative playerReward for Player A)
   │<── battle_concluded (Player B) ───│ (Contains authoritative playerReward for Player B)
   │                                   │
```

---

## 6. Verification & Automated Test Results

Automated test suite (`npm test`) executed and verified:

```
PASS src/__tests__/economy.test.ts (8.63 s)
  Authoritative Game Economy & Battle Calculations
    1. Score Calculator
      √ calculates correct answer score with base points and difficulty modifier
      √ awards speed bonus for fast correct answers within threshold
      √ awards exactly 0 points for incorrect answers or timeouts
      √ calculates aggregate battle scores accurately
    2. XP and Level Progression System
      √ awards configured XP for win, loss, and draw
      √ derives levels monotonically from cumulative XP
      √ correctly handles multiple level increases from large single rewards
      √ never allows level to decrease on match loss
    3. Coin System
      √ awards configured coins for battle outcomes
      √ prevents negative coin balances
    4. Symmetrical Elo / Rating System
      √ maintains mathematical symmetry (gain of A == loss of B) for equal ratings
      √ awards fewer points to higher-rated player beating lower-rated player
      √ awards massive points for upset win (lower-rated beats higher-rated)
      √ enforces minimum rating floor
    5. Authoritative Reward Calculator and Idempotency
      √ calculates deterministic battle outcome and player rewards matching authoritative rules
      √ is completely idempotent when executed multiple times through BattleResultProcessor

PASS src/__tests__/rewards.test.ts
PASS src/__tests__/battle.test.ts
PASS src/__tests__/auth.test.ts
PASS src/__tests__/questions.test.ts

Test Suites: 5 passed, 5 total
Tests:       29 passed, 29 total
Snapshots:   0 total
Time:        20.169 s
```

- **Frontend Typecheck**: `npx tsc --noEmit` exited with code 0.
- **Backend Typecheck**: `npx tsc --noEmit` exited with code 0.
