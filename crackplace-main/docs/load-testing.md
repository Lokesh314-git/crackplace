# CrackPlace AI — Load Testing & Benchmark Report

## 1. Load Test Strategy
The load benchmark (`npm run loadtest`) simulates high-density concurrent user spikes (100, 500, 1,000, 1,500, and 2,000 active concurrent connections) issuing practice quizzes, API profile checks, health readiness probes, and leaderboard queries.

---

## 2. Benchmark Measurement Results

| Concurrent Users | Throughput (RPS) | Requests Processed | Latency (p50) | Latency (p95) | Error Rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **100 Users** | 857 req/sec | 4,349 | 33 ms | 132 ms | **0.00%** |
| **500 Users** | 583 req/sec | 3,071 | 475 ms | 1,545 ms | **0.00%** |
| **1,000 Users** | 485 req/sec | 2,780 | 1,097 ms | 3,323 ms | **0.00%** |
| **1,500 Users** | 426 req/sec | 2,469 | 4,112 ms | 4,314 ms | **0.00%** |
| **2,000 Users** | 318 req/sec | 2,170 | 5,299 ms | 5,426 ms | **0.00%** |

* **Zero Unhandled Crashes**: 100% request completion without unhandled process exceptions.
* **Rate Limiting Protection**: `express-rate-limit` prevents denial of service while keeping active player connections intact.
