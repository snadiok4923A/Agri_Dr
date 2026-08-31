# Krisiveda Dev Server

## Reproduce Artifacts

No special env files needed — this is a fresh Vite + React project with all deps in `package.json`.

```bash
npm install
```

## Run Server

```bash
npm run dev -- --port 5175 --host 127.0.0.1
```

Default port: 5173. If in use, pick the next free port and update the command.

**Windows detach (PowerShell):**
```powershell
Start-Process npm.cmd -ArgumentList 'run','dev','--','--port','5175','--host','127.0.0.1' -WindowStyle Hidden -PassThru | ForEach-Object { $_.Id }
```
