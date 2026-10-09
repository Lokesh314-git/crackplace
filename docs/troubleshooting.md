# CrackPlace AI — Troubleshooting & Incident Response

## 1. Common Diagnostics

### 1.1 "Redis Connection Error"
* **Symptom**: `[REDIS] No active Redis daemon found... Initializing High-Performance In-Memory Cluster Simulator`.
* **Resolution**: The backend operates in self-healing simulation mode for local development. For multi-instance production, set `REDIS_URL=redis://your-redis-host:6379`.

### 1.2 "Unauthorized: No token provided" / "INVALID_TOKEN"
* **Symptom**: HTTP 401/403 or Socket connection rejected with `AUTHENTICATION_REQUIRED`.
* **Resolution**: Ensure frontend passes valid Firebase Auth JWT token in `Authorization: Bearer <token>` and `socket.handshake.auth.token`.

### 1.3 "Rate Limit Exceeded"
* **Symptom**: HTTP 429 status code.
* **Resolution**: Standard user limits allow 200 req/min for APIs and 30 req/min for auth actions. Adjust limits in `backend/src/middleware/rateLimiter.ts` if higher thresholds are needed for custom batch integrations.
