# CrackPlace AI — Performance & Target SLA Audit

## 1. Target Service Level Objectives (SLOs)

For a target concurrency of **2,000 active users**:

| Metric | Target SLA | Strategy / Optimization |
| :--- | :--- | :--- |
| **HTTP Request Latency (p95)** | $< 300\text{ ms}$ | Redis caching for static/read-heavy endpoints (leaderboard, profile, catalog) |
| **Socket Event Propagation (p95)** | $< 150\text{ ms}$ | Redis Adapter for Socket.IO horizontal clustering; lightweight event payloads |
| **Matchmaking Latency (p95)** | $< 1,500\text{ ms}$ | In-memory/Redis queue popping; instant pre-cached question selection |
| **Question Load Time** | $< 25\text{ ms}$ | Local indexed storage + Redis question cache (0 external API dependencies) |
| **Error Rate** | $< 0.1\%$ | Graceful degradation, fallback question pools, retry exponential backoff |
| **Reward Correctness** | $100\%$ ($0$ dupes) | Idempotent transaction keys and Redis distributed locking |

---

## 2. Load Testing Profiles (k6 / Autocannon)

### Scenario 1: 100 to 500 Concurrent Users (Normal Campus Batch)
* **Workload**: 70% Practice Quizzes & Coding, 30% 1v1 Ranked Battles.
* **Expected Throughput**: ~400 - 800 req/sec HTTP + 150 socket events/sec.

### Scenario 2: 1,000 to 2,000 Concurrent Users (Peak Placement Drive Rush)
* **Workload**: 50% Practice, 50% Real-time Battles (1,000 players in 500 active rooms).
* **Expected Throughput**: ~1,800 - 3,500 req/sec HTTP + 1,200 socket events/sec.
* **Target Resource Usage**:
  * Node.js Cluster: 4-8 vCPU, 4GB RAM.
  * Redis: $< 512\text{ MB}$ memory.
  * Firestore Writes: Reduced by $> 85\%$ via Redis aggregation.
