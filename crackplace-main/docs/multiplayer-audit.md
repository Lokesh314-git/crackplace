# CrackPlace AI — Multiplayer & Real-Time Engine Audit

## 1. Multiplayer Architecture Analysis

The real-time multiplayer system powers two primary modes:
1. **Quick 1v1 Ranked Matchmaking**: Automated skill/category matchmaking between active online candidates.
2. **Custom Friend Battle Rooms**: Private lobbies with configurable categories, question counts (5-20), difficulty levels, and shareable invitation links.

---

## 2. Finite State Machine (FSM) Specification

To eliminate desynchronization and race conditions, battles must transition strictly through an explicit state machine:

```
[ WAITING ] ────────► [ MATCHED ] ────────► [ PREPARING ] ────────► [ READY ]
                                                                        │
                                                                        ▼
[ COMPLETED ] ◄────── [ FINISHING ] ◄────── [ ACTIVE ] ◄────────────────┘
      │
      ▼
(Durable Persistence & Reward Settlement)
```

### Invalid Transitions:
* `COMPLETED` $\to$ `ACTIVE` (Rejected)
* `ABORTED` $\to$ `ACTIVE` (Rejected)
* `ACTIVE` $\to$ `WAITING` (Rejected)

---

## 3. Server-Authoritative Gameplay Protocol

### 3.1 Step 1: Pre-selection of Questions
* Questions are selected from the internal normalized question database (MMLU / HellaSwag / curated bank).
* Questions are sanitized (correct options and explanations removed) before broadcasting to players.
* The authoritative question list, correct option indices, and option-order mappings are stored in Redis under `battle:{battleId}`.

### 3.2 Step 2: Server-Side Authoritative Timers
* Server records `questionStartedAt` and `questionEndsAt` (ISO timestamps).
* Clients run local UI countdowns synced against server timestamps.
* Submissions received after `questionEndsAt + gracePeriod` (e.g. 1.5s network buffer) are automatically marked as timed out.

### 3.3 Step 3: Server-Side Scoring & Answer Verification
* Client emits:
  ```json
  {
    "battleId": "battle_1720000000",
    "questionIndex": 0,
    "selectedOption": 2
  }
  ```
* Server validates:
  1. Authenticated user belongs to `battleId`.
  2. Battle state is `ACTIVE`.
  3. `questionIndex` matches player's expected current step.
  4. Player has not already answered this question.
  5. Evaluates correctness and computes points based on difficulty + response time.
  6. Increments authoritative score in Redis.
  7. Broadcasts `step_update` event to opponent containing updated scores and progress.

### 3.4 Step 4: Disconnection & Reconnection Grace Period
* If a player's socket disconnects during an active battle:
  * Room is marked with `disconnectGraceExpiresAt = now + 45s`.
  * Opponent is notified: `{"event": "opponent_disconnected", "gracePeriodSeconds": 45}`.
  * If the player reconnects within 45s with valid auth token, the current question snapshot, elapsed time, and live scores are restored.
  * If the grace period expires without reconnection, the abandoned player forfeits and the remaining player is awarded the victory.
