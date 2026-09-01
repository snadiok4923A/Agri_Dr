# Krisiveda Dev Server

## Reproduce Artifacts

No special env files needed — this is a fresh Vite + React project with all deps in `package.json`.

```bash
npm install
```

## Run Server

Default port: 5173. If in use, pick the next free port.

```bash
npx vite --port 5176 --host 127.0.0.1
```

**Windows detach (PowerShell):**
```powershell
Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList 'node_modules/vite/bin/vite.js','--port','5176','--host','127.0.0.1' -WorkingDirectory '<project_root>' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru | ForEach-Object { $_.Id }
```
