# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## Local disease-model APIs

- V1 remains the default model. Its API base is still `VITE_KRISIVEDA_ML_API_URL`
  (or the existing hosted fallback), and predictions use `/disease/predict`.
- In `npm run dev`, V2 status and prediction requests go through the same-origin
  Vite proxy at `/Agri_Dr/api/disease/v2`. It forwards to
  `http://127.0.0.1:8001/disease/v2/status` and
  `http://127.0.0.1:8001/disease/v2/predict`, avoiding local backend CORS errors.
  Override only this development target with `VITE_KRISIVEDA_ML_V2_API_URL` if
  needed; restart Vite after changing environment variables.
- V2 is selectable only when the status JSON contains `available: true` and
  numeric `classes: 15`. `production: false` is expected for the development
  model; it does not disable it. Failed requests and invalid responses keep V2
  disabled.
- Production builds do not use the development proxy or the V2 development
  target. Both models retain the existing API base and production loopback guard.

## Plant Doctor clipboard images

Use **Paste** on the Crop Diagnosis card or beside **Choose Another** in the
existing preview. PNG, JPEG, and WebP clipboard images are checked against the
same 10 MiB limit as uploads and decoded before replacing the preview. Pasting
never starts prediction or changes the selected V1/V2 model.

With the diagnosis modal open, **Ctrl+V / Cmd+V** also accepts image clipboard
data, including in browsers without `navigator.clipboard.read()`. Normal text
fields and editable content keep their usual paste behavior. Copy the image
itself, not its URL or HTML markup; the app does not download clipboard links.

The Paste button requires HTTPS (or localhost), browser Clipboard API support,
and clipboard permission/user interaction. If unavailable or denied, use the
existing Upload Photo flow or keyboard paste. Mobile browser support varies.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
