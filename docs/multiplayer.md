# CrackPlace AI — Server-Authoritative Multiplayer Battle Engine

## 1. Overview
The multiplayer battle engine manages competitive real-time 1v1 skill matchmaking and custom private friend lobbies.

---

## 2. Finite State Machine (FSM)

```
[ WAITING ] ──► [ MATCHED ] ──► [ PREPARING ] ──► [ ACTIVE ] ──► [ FINISHING ] ──► [ COMPLETED ]
                                                        │
                                                        ▼
                                                  [ ABORTED ]
```

* **WAITING**: Player in matchmaking queue (`matchmaking:queue:{category}`).
* **MATCHED**: Opponent identified, match ticket created.
* **ACTIVE**: Questions loaded from internal cache, authoritative countdown running.
* **COMPLETED**: All answers processed or time expired; Elo, XP, and coins settled atomically in Firestore.

---

## 3. Server-Authoritative Socket Contracts

### Client $\to$ Server: `submit_answer`
```json
{
  "battleId": "battle_1720000000",
  "questionIndex": 0,
  "selectedOption": 2
}
```

### Server $\to$ Client: `answer_evaluated`
```json
{
  "questionIndex": 0,
  "isCorrect": true,
  "score": 20,
  "explanation": "Brief explanation...",
  "correctOption": 2
}
```

### Server $\to$ Opponent: `step_update`
```json
{
  "uid": "user_123",
  "score": 20,
  "progressIndex": 1,
  "finished": false
}
```

### Server $\to$ Room: `battle_concluded`
```json
{
  "winnerId": "user_123",
  "isDraw": false,
  "playerDeltas": {
    "user_123": { "elo": 16, "xp": 40, "coins": 20, "score": 100 },
    "user_456": { "elo": -16, "xp": 10, "coins": 5, "score": 60 }
  }
}
```

---

## 4. Reconnection Protocol
* Disconnections trigger a **45-second grace period** (`disconnectGraceExpiresAt`).
* Reconnecting players send `join_room` with their Firebase Auth token.
* The server responds with `battle_restored` containing the complete live question snapshot, elapsed timer, current question index, and opponent progress.
