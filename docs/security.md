# CrackPlace AI — Production Security Architecture

## 1. Zero-Trust Identity Verification
* **Cryptographic Token Verification**: All HTTP endpoints enforce `Bearer <Firebase ID Token>` verified via `admin.auth().verifyIdToken()`.
* **Socket Handshake Verification**: Socket.IO connections on `/matchmaking` and `/battle` validate the client token during the WebSocket handshake (`socket.handshake.auth.token`).
* **Authoritative Identity**: The server binds `socket.data.userId` from the decoded token payload and rejects any client request attempting to supply or override `userId`.

---

## 2. Server-Authoritative Anti-Cheat Protections

### 2.1 Answer Protection & Sanitization
* Questions sent to the client are stripped of `correctOption` and `explanation`.
* Correct option mapping is stored strictly in server-side Redis state.

### 2.2 Server-Side Score & Elo Settlement
* The client sends only: `{ battleId, questionIndex, selectedOption }`.
* The server verifies the active battle status, evaluates correctness, calculates point values, and enforces idempotency (duplicate submissions for the same question index are safely rejected).
* Rating updates (Elo), XP, and Coins are calculated and committed via Firestore transactions with duplicate reward protection.

---

## 3. Secret Isolation & Credential Safety
* No private keys, service account JSON files, or OpenRouter keys are committed to Git or exposed in client bundles.
* Rate limiters protect HTTP endpoints (`standardApiLimiter`, `strictAuthLimiter`, `aiLimiter`) and socket events (`socketRateLimit`).
* Structured logging automatically sanitizes sensitive fields (`password`, `token`, `apiKey`, `authorization`).
