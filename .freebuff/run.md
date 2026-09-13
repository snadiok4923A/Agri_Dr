# Krisiveda — Run Doc

## 1. Reproduce uncommitted artifacts a fresh checkout needs

- **Dependencies:** run `npm install` in the repo root (uses `package-lock.json`; no `.env.local` or other secret env files are needed — the app runs on mock data in `src/data/`).
- **No other uncommitted artifacts are required.** Vite base path `/Agri_Dr/` is committed in `vite.config.js`.

## 2. Run the dev server

- Command: `npm run dev` (runs `vite`, port **5173**, base `/Agri_Dr/`)
- Open: **`http://localhost:5173/Agri_Dr/`** — the bare root `/` returns 404 by design (Vite base path).
- If **5173 is occupied** (e.g. another Vite project of the user's is running): pick the next free port and start with
  `npx vite --port 5174 --strictPort`, then open `http://localhost:5174/Agri_Dr/`.
- Freebuff preview registration: use the full base-path URL, not the bare root.
