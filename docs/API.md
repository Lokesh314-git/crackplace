# CrackPlace AI — REST API & Socket.IO Reference

---

## 🌐 REST API Endpoints

All authenticated REST API endpoints require a valid Firebase ID token passed in the `Authorization` header:

```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

### Health & Diagnostic Endpoints

#### `GET /health`
- **Auth**: Public
- **Description**: Returns basic process uptime and timestamp.
- **Response `200 OK`**:
  ```json
  {
    "status": "OK",
    "uptime": 3600.5,
    "timestamp": "2026-10-04T19:00:00.000Z"
  }
  ```

#### `GET /ready`
- **Auth**: Public
- **Description**: Returns readiness of backing dependencies (Firebase, Supabase, Redis) without exposing secrets.

---

### User Profile & Progression Endpoints

#### `POST /api/auth/profile/update`
- **Auth**: Required
- **Description**: Updates candidate details (academic, career, social links). Awards +20 XP first-time profile reward when complete.
- **Request Body**:
  ```json
  {
    "displayName": "Loki Cadet",
    "username": "loki_dev",
    "bio": "Full-stack developer preparing for Tier-1 placements.",
    "college": "Indian Institute of Technology",
    "degree": "B.Tech",
    "department": "Computer Science & Engineering",
    "year": 4,
    "graduationYear": "2026",
    "semester": "7th",
    "careerGoal": "Software Development Engineer",
    "dreamCompany": "Google",
    "preferredRole": "Full Stack Developer",
    "city": "Bangalore",
    "state": "Karnataka",
    "country": "India",
    "linkedin": "https://linkedin.com/in/username",
    "github": "username",
    "portfolio": "https://myportfolio.com",
    "leetcode": "username",
    "hackerrank": "username",
    "codeforces": "handle"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "message": "Profile updated successfully.",
    "profile": { ... },
    "xpRewardGranted": true,
    "leveledUp": false,
    "newLevel": 8
  }
  ```

#### `POST /api/auth/profile/equip`
- **Auth**: Required
- **Description**: Equips or unequips an owned cosmetic item (avatar, ring, frame, background, title, theme).
- **Request Body**:
  ```json
  {
    "category": "avatar",
    "itemId": "avatar_starter"
  }
  ```

#### `GET /api/auth/battle/history`
- **Auth**: Required
- **Description**: Returns the authenticated user's battle assessment history with scores, Elo changes, and opponent display details.

#### `GET /api/auth/leaderboard`
- **Auth**: Required
- **Description**: Returns top 50 candidates sorted by `battleRating` descending.

---

### Training & Practice Modules

#### `POST /api/quiz/questions`
- **Auth**: Optional / Required
- **Description**: Retrieves single-player placement practice questions from Supabase for a given subject and difficulty.

#### `POST /api/coding/execute`
- **Auth**: Required
- **Description**: Executes and evaluates candidate algorithm code against test cases.

#### `POST /api/interview/chat`
- **Auth**: Required
- **Description**: AI mock HR interview response generator and STAR evaluation feedback.

---

## ⚡ Socket.IO Event Reference

### Matchmaking Namespace: `/matchmaking`

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `join_lobby` | Client -> Server | `{ battleType, rating, profile }` | Queues player into skill-based matchmaking |
| `leave_lobby` | Client -> Server | `{}` | Cancels matchmaking queue |
| `match_found` | Server -> Client | `{ battleId, opponent, quiz, battleEndsAt }` | Dispatched when two players are paired |
| `match_error` | Server -> Client | `{ message }` | Dispatched on queue errors |

### Battle Namespace: `/battle`

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `join_battle` | Client -> Server | `{ battleId }` | Joins live battle room |
| `submit_answer` | Client -> Server | `{ battleId, questionIndex, selectedOption }` | Submits relative option index (`0-3`) |
| `answer_evaluated` | Server -> Client | `{ questionIndex, selectedOption, isCorrect, score, explanation, correctOption }` | Authoritative answer feedback |
| `step_update` | Server -> Client | `{ uid, score, progressIndex, finished }` | Broadcasts opponent progress to room |
| `battle_concluded` | Server -> Client | `{ battleId, status, winnerId, isDraw, playerReward, opponentReward }` | Dispatches final Elo, XP, and coins |
| `player_disconnected` | Server -> Client | `{ userId, gracePeriodSeconds }` | Notifies opponent of disconnect grace timer |
| `player_reconnected` | Server -> Client | `{ userId }` | Notifies opponent that player returned |
| `get_battle_state` | Client -> Server | `{ battleId }` | Safety polling to recover match state |
