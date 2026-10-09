# CrackPlace AI — Production Deployment Guide

This guide details the step-by-step process for deploying the CrackPlace AI ecosystem across production hosting environments.

---

## 🏗️ Deployment Topology

```
                  ┌────────────────────────────────────────┐
                  │          Production Frontend           │
                  │   (Vercel / Cloudflare / Netlify)      │
                  └──────────────────┬─────────────────────┘
                                     │
                    HTTPS REST / WSS WebSocket
                                     │
                  ┌──────────────────▼─────────────────────┐
                  │          Production Backend            │
                  │   (Render / Railway / Fly.io / AWS)    │
                  └────────┬───────────────────┬───────────┘
                           │                   │
                ┌──────────▼────────┐ ┌────────▼──────────┐
                │ Firebase Auth & DB│ │Supabase PostgreSQL│
                │ (User Progression)│ │  (Question Bank)  │
                └───────────────────┘ └───────────────────┘
```

---

## 1. Frontend Deployment (e.g. Vercel, Cloudflare Pages, Netlify)

### Step 1: Repository Root & Build Settings
- **Root Directory**: `frontend/` (or repository root if deployed from subfolder)
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Node Version**: `18.x` or `20.x`

### Step 2: Environment Variables
Add the following in your hosting provider's dashboard:

```env
VITE_API_URL=https://your-backend-api.onrender.com
VITE_SOCKET_URL=https://your-backend-api.onrender.com
VITE_APP_URL=https://your-frontend-domain.com

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-publishable-key

VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-firebase-app-id
```

### Step 3: SPA Fallback
Ensure client-side routing rewrites all unknown paths (`/*`) to `/index.html`.

---

## 2. Backend Deployment (e.g. Render, Railway, Fly.io, AWS EC2)

### Step 1: Build & Start Commands
- **Root Directory**: `backend/`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start` (runs `node dist/index.js`)

### Step 2: Environment Variables
Add the following in your backend hosting environment:

```env
PORT=5000
NODE_ENV=production

# CORS allowed frontend domain (or comma-separated domains)
FRONTEND_URL=https://your-frontend-domain.com
CORS_ORIGIN=https://your-frontend-domain.com

# Firebase Admin Service Account (Single-line JSON string)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}

# Supabase Question Bank
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Redis (Recommended for multi-instance scaling & 500+ battles)
REDIS_URL=rediss://default:password@your-redis-host:6379

# OpenRouter AI Keys (Optional for study & interview coaching)
OPENROUTER_QWEN_KEY=
```

---

## 3. Question Bank Manager Deployment

- **Root Directory**: `question-bank-manager/`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  ```env
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
  ```

---

## 4. Firebase Console Checklist

1. Navigate to **Firebase Console** -> **Authentication** -> **Settings** -> **Authorized domains**.
2. Add your production frontend domain (e.g., `your-frontend-domain.com`, `crackplace.vercel.app`).
3. Ensure **Google Sign-In** provider is enabled and configured with production OAuth redirect URIs.

---

## 5. Supabase Checklist

1. Verify the `questions` table exists with proper indexes on `subject`, `difficulty`, and `topic`.
2. Verify Row Level Security (RLS) policies allow public `SELECT` for active questions.
3. Ensure service-role key is never shared on the client.
