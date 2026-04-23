# Inshorts-style News App (Full Stack)

Full-stack short-form news app inspired by Inshorts.

## Features
- Home feed with infinite scroll (short summaries)
- Categories (All, Technology, Business, Sports, War)
- Live Feed (timeline with timestamps)
- Firebase Authentication (Google Sign-In)
- Bookmarks (saved articles per user)
- Video section (YouTube Data API)
- Basic admin panel (CRUD news + live updates)
- Optional AI summarization via Grok (xAI)

## Tech
- Frontend: React + Tailwind (Vite)
- Backend: Node.js + Express
- DB: MongoDB + Mongoose

## Project structure
- `frontend/`
  - `src/components`
  - `src/pages`
  - `src/services`
- `backend/`
  - `src/controllers`
  - `src/routes`
  - `src/models`

## Setup

### 1) Install deps
From repo root:

```bash
npm install
```

### 2) Configure environment variables
Create env files based on examples:
- `backend/.env` from `backend/.env.example`
- `frontend/.env` from `frontend/.env.example`

Keep the auth mode aligned on both sides:
- Demo mode: `backend AUTH_MODE=none` and `frontend VITE_AUTH_MODE=none`
- Google sign-in: `backend AUTH_MODE=firebase` and `frontend VITE_AUTH_MODE=firebase`

### 3) Run

```bash
npm run dev
```

Frontend runs on `http://localhost:5173` and backend on `http://localhost:4000` by default.

## API integration notes
- **News provider**: set one of `NEWSAPI_KEY` or `GNEWS_KEY` in `backend/.env`
- **Grok summarization (optional)**: set `GROK_API_KEY` in `backend/.env`
- **YouTube**: set `YOUTUBE_API_KEY` in `backend/.env`
- **Firebase Auth**: create a Firebase project, put browser config in `frontend/.env`, and set `FIREBASE_SERVICE_ACCOUNT_JSON` on the backend if `AUTH_MODE=firebase`

## Deploy
1. Create a MongoDB Atlas database and copy its connection string into backend `MONGODB_URI`.
2. Deploy the backend (`backend/`) to Render using `render.yaml` or manual settings.
3. Set backend env vars:
   `MONGODB_URI`, `CLIENT_ORIGIN`, and the auth mode you actually want.
4. For the fastest stable launch, use demo auth first:
   `AUTH_MODE=none` on the backend and `VITE_AUTH_MODE=none` on the frontend.
5. If you want real Google login in production, switch both to `firebase` and add:
   backend `FIREBASE_SERVICE_ACCOUNT_JSON`, frontend `VITE_FIREBASE_*`.
6. Deploy the frontend (`frontend/`) to Vercel/Netlify/Render Static with `VITE_API_BASE_URL` pointing to the deployed backend `/api` base URL.

