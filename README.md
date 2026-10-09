# CrackPlace AI — Placement Preparation & Competitive PvP Platform

CrackPlace AI is an AI-powered placement preparation and competitive multiplayer platform engineered for university students and job applicants preparing for technical, aptitude, coding, DBMS, operating systems, and HR interview rounds.

---

## ⚡ Key Highlights & Architecture
* **Target Scale**: Built to reliably handle **2,000+ concurrent active users** across practice modes and competitive real-time battles.
* **Server-Authoritative Gameplay**: Sockets, timers, question validation, scoring, XP, coins, and Elo updates are computed strictly on the backend.
* **Zero Runtime AI Dependencies in Live Battles**: Questions are pre-ingested, normalized, and cached from **MMLU**, **HellaSwag**, and curated banks.
* **Redis State Engine**: Ephemeral battle state, distributed matchmaking queues, rate limiting, and Socket.IO multi-node clustering.
* **Durable Persistence**: Cloud Firestore with transactional safety and write aggregation.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
* Node.js v18+ / v20+
* npm

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env

# Run automated tests
npm test

# Run dataset ingestion (MMLU + HellaSwag + Curated)
npm run ingest:all

# Run 2,000-user load benchmark
npm run loadtest

# Start backend dev server
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 📖 Comprehensive Documentation
Detailed architectural and engineering documentation is available in the `docs/` directory:
* [Architecture Overview](docs/architecture.md)
* [Scalability & Clustering](docs/scalability.md)
* [Security & Anti-Cheat](docs/security.md)
* [Database & Storage Optimization](docs/database.md)
* [Multiplayer Battle Engine](docs/multiplayer.md)
* [Question Pool System](docs/question-system.md)
* [Dataset Ingestion Guide](docs/dataset-ingestion.md)
* [Production Deployment](docs/deployment.md)
* [Load Testing Report](docs/load-testing.md)
* [Troubleshooting Guide](docs/troubleshooting.md)
* [Final Enhancement Report](docs/final-enhancement-report.md)
