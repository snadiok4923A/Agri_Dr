import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
    testDir: "./tests",
    // Production model tests own a separate build/preview lifecycle.
    testIgnore: "browser-model.spec.js",
    outputDir: "./test-results/regression",
    timeout: 60_000,
    retries: 0,
    forbidOnly: !!process.env.CI,
    // Run headless by default; --headed can be passed explicitly.
    use: {
        headless: true,
        viewport: { width: 1280, height: 720 },
        actionTimeout: 10_000,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: { browserName: "chromium" },
        },
    ],
    // Start the dev server before tests and shut it down after.
    // This keeps the repo self-contained for the logout E2E check.
    webServer: {
        command: "npm run dev -- --host localhost --port 5173 --strictPort",
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        url: "http://localhost:5173/Agri_Dr/",
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        env: { BASE_URL: "http://localhost:5173" },
    },
});
