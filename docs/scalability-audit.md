# CrackPlace AI — Scalability & Concurrency Audit

## Target: 2,000 Concurrent Active Users

This audit evaluates the bottlenecks preventing horizontal scaling and prescribes the necessary infrastructure adaptations to handle 2,000+ concurrent active users across practice modes and real-time PvP battles.

---

## 1. Identified Scalability Bottlenecks

### 1.1 In-Memory Matchmaking Queue (`Map<string, LobbyPlayer>`)
* **Impact**: Critical. If traffic is distributed across multiple Node.js backend processes (e.g. via Kubernetes or PM2 cluster), players connected to Server A cannot match with players connected to Server B.
* **Resolution**: Replace memory Maps with Redis Sorted Sets / Lists using atomic Redis scripts (Lua) or multi-command transactions for queue pop and match creation.

### 1.2 Uncoordinated Socket.IO Instances
* **Impact**: High. Sockets connected to different server instances cannot broadcast room updates (`io.to(battleId).emit(...)`) across nodes without a distributed messaging backplane.
* **Resolution**: Install and configure `@socket.io/redis-adapter` with a Redis pub/sub cluster or instance.

### 1.3 Synchronous AI Latency in PvP Matchmaking
* **Impact**: Critical. Calling OpenRouter synchronously on battle initialization causes 3,000ms - 8,000ms delay and chokes when 500+ battles are spawned simultaneously.
* **Resolution**: Questions must be pre-cached and pulled from local question repositories (MMLU + HellaSwag datasets) in < 10ms.

### 1.4 High-Frequency Firestore Writes on Every Step
* **Impact**: High. Writing progress to Firestore on every question submission risks exceeding Firestore write limits (1 write/sec per document limit and expensive write quota costs).
* **Resolution**: Keep active battle progress in Redis with TTL. Perform durable write to Firestore collection `battleHistory` and user transaction updates strictly upon match conclusion.

### 1.5 Full Collection Scans for Database Maintenance & Leaderboards
* **Impact**: High. `db.collection('quizzes').get()` and `db.collection('users').get()` download every document in Firestore into memory during sweeps or fallback leaderboard queries.
* **Resolution**: Use timestamp-indexed queries (`.where('createdAt', '<', thirtyMinsAgo)`), pagination (`.limit(50)`), and Redis sorted sets (`ZADD leaderboard:elo`) for constant-time leaderboard lookups.

---

## 2. Horizontal Scaling Architecture

```
                    ┌─────────────────────────┐
                    │     Load Balancer       │
                    │  (Round Robin / IP Hash)│
                    └────────────┬────────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 ▼               ▼               ▼
           ┌───────────┐   ┌───────────┐   ┌───────────┐
           │ Backend 1 │   │ Backend 2 │   │ Backend N │
           └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
                 │               │               │
                 └───────────────┼───────────────┘
                                 │
                         ┌───────▼───────┐
                         │  Redis Layer  │
                         │ (Redis Cluster│
                         │  or Sentinel) │
                         └───────────────┘
```

* **Stateless API tier**: Node.js processes hold no sticky local state.
* **Ephemeral state in Redis**: Sockets, matchmaking tickets, battle rooms, rate limits, lock tokens.
* **Persistent state in Firestore**: Users, question banks, progress analytics, historical battle records.
