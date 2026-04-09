# HealthQuest — Runner Companion App

## Deploy to Vercel (Free)

### Option A: Drag & Drop (Easiest)
1. Go to vercel.com → New Project → "Deploy without Git"
2. Drag this entire folder into Vercel
3. Framework: Vite → Deploy
4. Done. Live URL in ~2 minutes.

### Option B: GitHub + Vercel
1. Push this folder to a GitHub repo
2. Connect repo on vercel.com
3. Framework: Vite → Deploy

## Run Locally
```
npm install
npm run dev
```
Open http://localhost:3000

## Notes
- No API key needed — uses Claude API via proxy (already configured)
- All app state is stored in localStorage (persists on reload)
- Mobile-first design, best viewed on phone or narrow browser window
