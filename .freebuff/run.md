# Krisiveda — How to Run (Preview)

Vite + React dev server for the Krisiveda (Agri_de) project.

## How to reproduce the artifacts

1. **Dependencies** — install once with npm:
   ```
   npm install
   ```
   (`node_modules` is normally already present in this checkout.)

2. **Env files** — none required. This project has no `.env` files; all data is local mock data (`src/data/`).

## How to run the server

```
npm run dev
```

- Default port: **5173** (Vite default). Base path is `/Agri_Dr/` — open `http://localhost:5173/Agri_Dr/` (the bare root returns 404 by design of the base path).
- If 5173 is occupied by another local project, start on the next free port instead:
  ```
  npm run dev -- --port 5174 --strictPort
  ```
- Detached start (Windows, used by the preview):
  ```
  powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev','--','--port','5174','--strictPort' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
  ```
  stdout and stderr must go to different files.

## Verify

- `curl -s -o /dev/null -w "%{http_code}" http://[::1]:PORT/Agri_Dr/` should return `200`.
- Build check: `npm run build`.
