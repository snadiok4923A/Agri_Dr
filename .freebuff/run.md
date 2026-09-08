# Run Doc — Krisiveda

## How to reproduce artifacts
No build artifacts needed. Dependencies should already be installed.

## How to run the server
Run from the project root:
```bash
npm run dev
```

The Vite dev server starts on port 5173 by default (but may need 5176 if 5173 is occupied).
Base path: `/Agri_Dr/`

## Current preview
- **URL**: `http://[::1]:5176/Agri_Dr/`
- **Port**: 5176
- **Base path**: `/Agri_Dr/`

## Detach command (Windows PowerShell)
```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
```
