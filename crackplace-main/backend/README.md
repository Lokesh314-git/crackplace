# CrackPlace AI — Backend Services & Real-Time Battle Engine

> **Server-Authoritative REST API, Socket.IO Real-Time Multiplayer Engine, and Progression Service**

The CrackPlace AI Backend powers real-time multiplayer 1v1 battles, authenticated REST API endpoints, server-authoritative scoring and option shuffling, Firebase Admin token verification, and Supabase question bank retrieval.

---

## 🌟 Key Architecture & Capabilities

- **Server-Authoritative Battle Engine (`/battle` & `/matchmaking` namespaces)**:
  - Skill-based matchmaking with Redis distributed queues.
  - Independent, per-player question option shuffling.
  - Server-calculated scores, XP rewards, coin earnings, and symmetrical Elo adjustments.
  - Graceful reconnection handling and automatic forfeit timeouts.
- **REST API Modules**:
  - `/api/quiz` — Single-player placement practice modules & tests.
  - `/api/coding` — Algorithmic challenge execution and test case verification.
  - `/api/interview` — AI-powered mock HR interviews with STAR evaluation.
  - `/api/study` — Subject-wise notes, conceptual summaries, and practice quizzes.
  - `/api/auth/profile/update` — Comprehensive candidate profile persistence.
  - `/api/auth/battle/history` — Assessment history with opponent profile resolution.
  - `/api/auth/leaderboard` — Real-time Elo and placement readiness rankings.
  - `/health` & `/ready` — Uptime and service health probes.
- **Data & Gamification Integrity**:
  - Server-calculated level curves, progression thresholds, and audit logging.
  - Idempotent reward processing via `BattleResultProcessor`.
  - Zero database writes during active gameplay (state held in Redis / memory; batched on conclusion).

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (v18+) + TypeScript
- **Web Framework**: Express.js
- **Real-Time WebSockets**: Socket.IO (v4) with Redis Adapter
- **Database & State**:
  - **Firebase Firestore / Auth**: User profiles, progression, and match history.
  - **Supabase PostgreSQL**: Single source of truth for validated question bank.
  - **Redis**: Ephemeral live match state, matchmaking queues, and multi-node pub/sub.
- **AI Integrations**: OpenRouter / Google Gemini API (Isolated to study and interview endpoints).

---

## 📂 Project Structure

```
backend/
├── src/
│   ├── config/              # Firebase Admin, Supabase, and Redis clients
│   ├── game/                # Server-authoritative game math (Elo, scoring, levels)
│   ├── middleware/          # Firebase Auth token verification and rate limiters
│   ├── routes/              # Express API routers (quiz, coding, interview, study)
│   ├── services/            # BattleEngine, QuestionService, AIService, XpTransactionService
│   ├── types/               # TypeScript interfaces and schemas
│   ├── utils/               # Gamification math, cosmetics catalog, logger, avatar resolver
│   ├── __tests__/           # Comprehensive Jest test suite (11 suites, 83 unit/int tests)
│   └── index.ts             # Express app bootstrap & Socket.IO server initialization
├── .env.example             # Template for required environment variables
├── jest.config.js           # Jest testing configuration
├── package.json             # Scripts and dependencies
└── tsconfig.json            # TypeScript compiler configuration
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18.x or later)
- Redis Server (Optional for local development; required for horizontal scaling)
- Firebase Project with Service Account
- Supabase Project URL and API Keys

### Installation

```bash
# Clone the repository
git clone https://github.com/Lokesh314-git/crackplace-backend.git
cd crackplace-backend

# Install dependencies
npm install
```

### Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your configuration:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173

# Firebase Admin Credentials
# (Paste full service account JSON as single-line string, or place serviceAccountKey.json locally)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project","private_key":"...","client_email":"..."}

# Supabase Question Bank
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Redis (Optional locally)
REDIS_URL=redis://localhost:6379

# AI Keys (Optional for study & interview coaching)
OPENROUTER_QWEN_KEY=
```

### Running Locally

```bash
# Start development server with hot reload
npm run dev
```

The server will listen on `http://localhost:5000`.

---

## 🧪 Testing

```bash
# Run complete test suite
npm test
```

All 11 test suites covering option shuffling, XP calculation, symmetrical Elo, battle flow, and security must pass.

---

## 📦 Production Build & Execution

```bash
# Compile TypeScript to JavaScript in dist/
npm run build

# Start production server
npm start
```

---

## 🔍 Health & Diagnostic Endpoints

- **`GET /health`**: Returns basic service uptime and timestamp.
  ```json
  { "status": "OK", "uptime": 124.5, "timestamp": "2026-10-04T19:00:00.000Z" }
  ```
- **`GET /ready`**: Validates connectivity to Firebase, Supabase, and Redis without leaking secrets.

---

## 🛡️ Security Guidelines

- **Never Commit Secrets**: Ensure `serviceAccountKey.json`, `.env`, and private `.pem` files remain in `.gitignore`.
- **Authoritative Validation**: Clients only submit option coordinates (`0`, `1`, `2`, `3`). The backend maps coordinates back to original database keys and validates answers server-side.

---

## 📄 License

MIT License.
