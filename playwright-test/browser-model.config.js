import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
    testDir: "./tests",
    testMatch: "browser-model.spec.js",
    outputDir: "./test-results/browser-model",
    fullyParallel: false,
    workers: 1,
    timeout: 120_000,
    expect: { timeout: 15_000 },
    retries: 0,
    forbidOnly: !!process.env.CI,
    reporter: "list",
    use: {
        baseURL: "http://127.0.0.1:4175/Agri_Dr/",
        headless: true,
        viewport: { width: 1280, height: 800 },
        actionTimeout: 15_000,
        navigationTimeout: 60_000,
        serviceWorkers: "block",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [{ name: "chromium", use: { browserName: "chromium" } }],
    // Build dist and generate fixtures/browser-model-reference.json before running.
    // Playwright owns both server lifecycles; this configuration never builds.
    webServer: [
        {
            // "localhost", not "127.0.0.1": Vite binds whichever loopback
            // address Node resolves first (often IPv6 [::1] on Windows).
            // Polling a literal 127.0.0.1 misses that listener, so Playwright
            // tried to start a second server, hit --strictPort EADDRINUSE and
            // waited out the full startup timeout. "localhost" reaches the
            // server on either address family, matching playwright.config.js.
            command: "npm run dev -- --host localhost --port 5173 --strictPort",
            cwd: projectRoot,
            url: "http://localhost:5173/Agri_Dr/",
            reuseExistingServer: true,
            timeout: 120_000,
        },
        {
            command:
                "npm run preview -- --host 127.0.0.1 --port 4175 --strictPort",
            cwd: projectRoot,
            url: "http://127.0.0.1:4175/Agri_Dr/",
            reuseExistingServer: false,
            timeout: 120_000,
        },
    ],
});
