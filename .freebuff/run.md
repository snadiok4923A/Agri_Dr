# Krisiveda — Dev Server Run Doc

Vite + React app. Base path `/Agri_Dr/`.

## Reproduce artifacts
- Dependencies are already installed in `node_modules/`. To restore: `npm install` (package-lock.json pins versions).
- No `.env.local` or other secret env files are needed to run the app.

## Run the dev server (Windows, detached)
1. Check whether port 5173 is free. **Important:** 5173 may be occupied by an unrelated local project (`T A N T R A V E D A`) — if so, use 5174:
   `netstat -ano | findstr :5173`
2. Start detached with PowerShell (stdout and stderr MUST go to different files):
   ```
   powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev','--','--port','5174','--strictPort' -RedirectStandardOutput '.freebuff/preview-cb1eb702-d691-4b16-90ea-d22ba5005d24.log' -RedirectStandardError '.freebuff/preview-cb1eb702-d691-4b16-90ea-d22ba5005d24.log.err' -WindowStyle Hidden -PassThru).Id"
   ```
   (If 5173 is genuinely free, you can omit the `--port 5174 --strictPort` args.)
3. Verify it answers before registering the preview:
   `curl -s -o /dev/null -w "%{http_code}" http://[::1]:5174/Agri_Dr/` → expect `200`
4. Confirm the pid survived: `powershell -NoProfile -Command "Get-Process -Id <pid>"`
5. Preview URL: `http://[::1]:5174/Agri_Dr/` (base path `/Agri_Dr/` is required — the bare root returns 404 by design).

## Notes
- The Start-Process command can exceed the 30s tool timeout while still succeeding — always re-verify with curl + netstat afterwards.
- Production build check: `npm run build`.
