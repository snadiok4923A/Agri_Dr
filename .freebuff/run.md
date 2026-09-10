# Krisiveda — Run doc

Vite + React app. Base path: `/Agri_Dr/`.

## Reproduce artifacts
1. No env files needed — all data comes from `src/data/mockData.js`.
2. Dependencies: `npm install` (lockfile: `package-lock.json`).
3. No build artifacts required for dev preview.

## Run the server
1. Default port 5173. If busy, Vite auto-increments (5174, 5176, …) — check the log for the actual port.
2. Start detached (PowerShell, from project root):
   ```
   powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -RedirectStandardOutput '.freebuff\preview-cb1eb702-d691-4b16-90ea-d22ba5005d24.log' -RedirectStandardError '.freebuff\preview-cb1eb702-d691-4b16-90ea-d22ba5005d24.log.err' -WindowStyle Hidden -PassThru).Id"
   ```
   (stdout and stderr must go to different files.)
3. Confirm: `curl http://[::1]:5173/Agri_Dr/` returns 200, and `netstat -ano | grep 5173` shows the PID.
4. Register preview with URL `http://[::1]:5173/Agri_Dr/` + the PID from netstat.
5. Production build check: `npm run build`.

## Last verified
- Port 5173, PID 4184, HTTP 200, dashboard rendering (greeting, weather, production hero, 4 metric cards, attention cards, varieties, charts).
