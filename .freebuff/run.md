# Krisiveda Dev Server

## Reproduce Artifacts

No special env files needed — this is a Vite + React project with all deps in `package.json`.

```bash
npm install
```

## Run Server

Port: 5176 (default 5173 may be in use). The app is served at `/Agri_de/` (set via `base` in vite.config.js).

```bash
npx vite --port 5176 --host 127.0.0.1
```

**Windows detach (PowerShell):**
```powershell
Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList 'node_modules/vite/bin/vite.js','--port','5176','--host','127.0.0.1' -WorkingDirectory 'C:\Users\Sandipan Paul\Documents\DOCS\Project\Webside for this\Agri_de' -RedirectStandardOutput 'C:\Users\Sandipan Paul\Documents\DOCS\Project\Webside for this\Agri_de\.freebuff\preview-cb1eb702-d691-4b16-90ea-d22ba5005d24.log' -RedirectStandardError 'C:\Users\Sandipan Paul\Documents\DOCS\Project\Webside for this\Agri_de\.freebuff\preview-cb1eb702-d691-4b16-90ea-d22ba5005d24.log.err' -WindowStyle Hidden -PassThru | ForEach-Object { $_.Id }
```

**App URL:** `http://127.0.0.1:5176/Agri_de/`

## Key Config

- `vite.config.js` → `base: '/Agri_de/'`
- `src/App.jsx` → `<BrowserRouter basename="/Agri_de">`
