# Run Doc — Krisiveda

## How to reproduce artifacts
No build artifacts needed. Dependencies should already be installed (`npm install` if node_modules is missing).

## How to run the server
Run from the project root:
```bash
npm run dev
```

The Vite dev server starts on port 5173 by default (use the next free port, e.g. 5176, if 5173 is occupied by another project).
Base path: `/Agri_Dr/` — set in BOTH `vite.config.js` (`base`) and `src/App.jsx` (`BrowserRouter basename`); keep the two in sync.

## Current preview
- **URL**: `http://[::1]:5173/Agri_Dr/`
- **Port**: 5173
- **Base path**: `/Agri_Dr/`

## Detach command (Windows PowerShell)
```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WorkingDirectory '<project-root>' -WindowStyle Hidden -PassThru).Id"
```
stdout and stderr must point at DIFFERENT files (PowerShell requirement).
