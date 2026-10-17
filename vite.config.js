import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Deployment base. GitHub Pages serves this repo at /Agri_Dr/, so every
 * asset URL and the router basename must use the same value.
 */
const BASE = '/Agri_Dr/'
const BASE_NO_SLASH = BASE.replace(/\/+$/, '') // "/Agri_Dr"

/** Shared between 404.html and the injected restore script. */
const REDIRECT_STORAGE_KEY = 'krisiveda:spa-redirect'
const REDIRECT_PARAM = 'spa-redirect'

/**
 * Script injected into <head> of index.html (before the module bundle, so
 * it runs before React Router mounts). It turns the URL written by
 * 404.html back into the real route, so the router never sees the bounce.
 */
function restoreRouteScript() {
    return `(function () {
  try {
    var stored = null;
    try {
      stored = window.sessionStorage.getItem(${JSON.stringify(REDIRECT_STORAGE_KEY)});
      window.sessionStorage.removeItem(${JSON.stringify(REDIRECT_STORAGE_KEY)});
    } catch (e) {}
    var match = new RegExp('[?&]${REDIRECT_PARAM}=([^&]*)').exec(
      window.location.search
    );
    var route = stored || (match && decodeURIComponent(match[1].replace(/\\+/g, ' ')));
    if (!route || route.charAt(0) !== '/') return;
    window.history.replaceState(null, '', ${JSON.stringify(BASE_NO_SLASH)} + route);
  } catch (e) {}
})();`
}

/**
 * The page GitHub Pages serves (with HTTP 404) for any path that is not a
 * real file. It saves the requested route and bounces to the app entry,
 * where restoreRouteScript() re-applies it.
 */
function notFoundPage() {
    return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>Krisiveda — Smart Farming Platform</title>
    <script>
      (function () {
        var base = ${JSON.stringify(BASE_NO_SLASH)};
        var loc = window.location;
        var rel = loc.pathname.indexOf(base) === 0
          ? loc.pathname.slice(base.length)
          : loc.pathname;
        if (!rel || rel.charAt(0) !== '/') rel = '/' + rel.replace(/^\\/+/, '');
        rel = rel.replace(/\\/{2,}/g, '/');
        var target = rel + loc.search + loc.hash;
        try {
          window.sessionStorage.setItem(${JSON.stringify(REDIRECT_STORAGE_KEY)}, target);
        } catch (e) {}
        loc.replace(base + '/?${REDIRECT_PARAM}=' + encodeURIComponent(target));
      })();
    </script>
  </head>
  <body></body>
</html>
`
}

/**
 * GitHub Pages has no server-side rewrite, so a refresh on /Agri_Dr/crops
 * is answered by 404.html. This plugin keeps the client-side fallback in
 * the published build:
 *
 *   build → emit dist/404.html (saves the route, then loads the entry)
 *   both  → inject the restore script into index.html
 *
 * Both pieces are derived from BASE, so they can never drift from the
 * Vite base path. Routing stays BrowserRouter — no route, link or
 * basename changes are needed.
 */
function githubPagesSpaFallback() {
    return {
        name: 'github-pages-spa-fallback',
        transformIndexHtml: {
            order: 'pre',
            handler() {
                return [
                    {
                        tag: 'script',
                        injectTo: 'head-prepend',
                        children: restoreRouteScript(),
                    },
                ]
            },
        },
        generateBundle() {
            this.emitFile({
                type: 'asset',
                fileName: '404.html',
                source: notFoundPage(),
            })
        },
    }
}

export default defineConfig({
    plugins: [react(), githubPagesSpaFallback()],
    base: BASE,
})
