# CrackPlace AI — Frontend Application

> **AI-Powered Campus Placement & Technical Assessment Preparation Platform**

CrackPlace AI is a full-stack, enterprise-grade placement preparation web application built with React, TypeScript, and Vite. It provides comprehensive training modules covering Quantitative Aptitude, Data Structures & Algorithms, Core CS subjects, Logical Reasoning, Verbal Ability, and AI Mock Interviews, alongside a competitive real-time 1v1 multiplayer Battle Arena.

---

## 🌟 Key Features

- **Comprehensive Training Hubs**:
  - **Quantitative Aptitude & Mathematics**
  - **Data Structures & Algorithms (DSA)**
  - **Database Management Systems (DBMS)**
  - **Operating Systems (OS)**
  - **Computer Networks (CN)**
  - **Logical Reasoning & Puzzles**
  - **Verbal Ability & Technical Communication**
  - **HR & Behavioral STAR Interview Coach**
- **Real-Time 1v1 Battle Arena**:
  - Competitive matchmaking with Elo rating calculations.
  - Custom Battle Rooms with shareable challenge URLs (`/battle?room=ROOM_CODE`).
  - Independent, per-player option shuffling preventing screen-peeking.
  - Synchronized timer and instant authoritative answer evaluation.
- **Gamified Progression System**:
  - Experience Points (XP), dynamic leveling system, and daily streaks.
  - Coins economy, Lucky Wheel spins, Mystery Box loot openings.
  - Real-time global and college placement readiness leaderboards.
- **Customization Locker & Store**:
  - Unlockable avatars, prestige rings, loadout frames, title badges, and visual themes.
  - Candidate profile completeness audit (+20 XP milestone rewards).
- **AI Mentorship & Instant Explanations**:
  - In-depth algorithmic breakdowns and conceptual hints.

---

## 🛠️ Technology Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS + Custom Design System
- **State Management**: Zustand (Auth, Profile, and Game session synchronization)
- **Real-Time WebSockets**: Socket.IO Client
- **Authentication**: Firebase Authentication (Google OAuth + Email/Password)
- **Database & Question Bank**: Supabase PostgreSQL + Firebase Firestore
- **Routing**: React Router DOM (v7)

---

## 📂 Project Structure

```
frontend/
├── public/                  # Static assets, icons, sitemap.xml, sw.js
├── src/
│   ├── components/          # Reusable UI components, decks, and layouts
│   ├── config/              # Firebase, Supabase, cosmetics, and game configs
│   ├── pages/               # Main application views (Battle, Quiz, Profile, Store, etc.)
│   ├── routes/              # ProtectedRoute and navigation guards
│   ├── store/               # Zustand authStore and state providers
│   ├── types/               # TypeScript data models and interfaces
│   ├── utils/               # Gamification math, avatar resolver, readiness scoring
│   ├── App.tsx              # Application route tree
│   ├── main.tsx             # Global fetch interceptor & application bootstrap
│   └── index.css            # Core design system tokens and responsive styles
├── .env.example             # Template for required environment variables
├── package.json             # Scripts and dependencies
└── vite.config.ts           # Vite bundler and development proxy configuration
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18.x or later)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/Lokesh314-git/crackplace.git
cd crackplace

# Install dependencies
npm install
```

### Environment Configuration

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your respective credentials:

```env
# Backend API & WebSocket Endpoint
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000

# Frontend Public Web Application URL
VITE_APP_URL=http://localhost:5173

# Supabase Question Bank (Client Publishable Anon Key only)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-publishable-key

# Firebase Client Web Configuration
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-firebase-app-id
```

### Running Locally

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 📦 Production Build

```bash
# Run typecheck and bundle client distribution
npm run build

# Preview production build locally
npm run preview
```

Output is emitted to the `dist/` directory, ready for deployment on Vercel, Netlify, Cloudflare Pages, or AWS S3/CloudFront.

---

## ⚔️ Custom Battle Room Links

When a candidate creates a Custom Battle room, the frontend generates a shareable challenge URL:

- **Development**: `http://localhost:5173/battle?room=APT-XXXXXX`
- **Production**: `https://your-domain.com/battle?room=APT-XXXXXX`

When another candidate opens this link:
1. The application checks authentication state (redirecting to `/login` if unauthenticated).
2. Extracts the room code from the URL parameters.
3. Automatically joins the custom battle lobby over Socket.IO.
4. Synchronizes lobby state and begins countdown once both players click **Ready**.

---

## 🛡️ Security

- **No Secrets in Frontend**: Supabase service-role keys and Firebase Admin private keys are strictly server-only.
- **Sanitized Questions**: Correct answer keys and explanations are omitted during active battles until authoritative evaluation is completed by the backend.

---

## 📄 License

MIT License. Developed for placement preparation and competitive assessment.
