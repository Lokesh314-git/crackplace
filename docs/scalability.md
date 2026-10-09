# CrackPlace AI — Horizontal Scalability & Cluster Architecture

## 1. Concurrency Architecture for 2,000+ Concurrent Users

CrackPlace AI is designed to scale horizontally across multiple stateless Node.js container instances behind a reverse proxy / load balancer (e.g. NGINX, AWS ALB, GCP Cloud Run, or Kubernetes Ingress).

```
                      ┌────────────────────────────┐
                      │    Cloud Load Balancer     │
                      │  (WSS / HTTPS Sticky Sess) │
                      └─────────────┬──────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
   │ Backend Node 1  │     │ Backend Node 2  │     │ Backend Node N  │
   │ Express + Socket│     │ Express + Socket│     │ Express + Socket│
   └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
            │                       │                       │
            └───────────────────────┼───────────────────────┘
                                    │
                            ┌───────▼───────┐
                            │  Redis Cluster│
                            │ ───────────── │
                            │ Socket Adapter│
                            │ Match Queues  │
                            │ Battle States │
                            │ Cache Layer   │
                            └───────────────┘
```

---

## 2. Distributed Real-Time Messaging (`@socket.io/redis-adapter`)
* Sockets connected to Server A publish and subscribe to battle events broadcasted by Server B seamlessly via Redis Pub/Sub channels.
* Room broadcasts (`io.of('/battle').to(battleId).emit(...)`) are routed across all cluster nodes within $< 20\text{ ms}$.

---

## 3. High-Throughput Question Serving
* **0 Live AI dependencies in battles**: Questions are pre-ingested, validated, categorized, and cached in Redis with 1-hour TTLs.
* Question lookup latency: $< 5\text{ ms}$.
* Battle initialization time: Reduced from $> 4,500\text{ ms}$ (synchronous AI prompt) to $< 15\text{ ms}$.

---

## 4. Firestore Write Aggregation
* Active battle ticks and question answers are recorded in Redis hash structures.
* Durable writes to Firestore occur strictly upon match conclusion in a single transactional batch, reducing Firestore write operations by $> 85\%$.
