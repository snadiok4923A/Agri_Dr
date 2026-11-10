// Temporary probe (deleted after use): voice error classification,
// partial-speech retention, retry and text fallback on /ai-doctor.
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4175/Agri_Dr";
let failures = 0;

function record(ok, label, detail = "") {
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` -> ${detail}` : ""}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, timeout = 5000, step = 60) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
        try {
            if (await fn()) return true;
        } catch {
            /* keep polling */
        }
        await sleep(step);
    }
    return false;
}

// Scripted Web Speech API: same event contract Chrome uses.
function mockScript() {
    class FakeSR {
        constructor() {
            this.lang = "en-IN";
            this.continuous = false;
            this.interimResults = false;
            this.maxAlternatives = 1;
            window.__sr = this;
        }
        start() {
            window.__srTotalStarts = (window.__srTotalStarts || 0) + 1;
            window.__srStarted = true;
            const mode = window.__srMode || "normal";
            if (mode === "denied") return this._fail("not-allowed");
            if (mode === "service") return this._fail("service-not-allowed");
            if (mode === "network") return this._fail("network");
            if (mode === "capture") return this._fail("audio-capture");
            if (mode === "language") return this._fail("language-not-supported");
            setTimeout(() => this.onstart && this.onstart(), 5);
        }
        stop() {
            window.__srStops += 1;
            setTimeout(() => this.onend && this.onend(), 5);
        }
        abort() {
            this.stop();
        }
        _fail(error) {
            setTimeout(() => {
                this.onerror && this.onerror({ error });
                this.onend && this.onend();
            }, 5);
        }
    }
    window.SpeechRecognition = FakeSR;
    window.webkitSpeechRecognition = FakeSR;
    window.__srTotalStarts = 0;
    window.__srMode = "normal";
    window.__online = true;
    Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => window.__online !== false,
    });
    window.__srEmit = (text, isFinal) => {
        const rec = window.__sr;
        if (!rec || !rec.onresult) return;
        const results = [
            Object.assign([{ transcript: text, confidence: 0.9 }], {
                isFinal: Boolean(isFinal),
                length: 1,
            }),
        ];
        rec.onresult({ resultIndex: 0, results });
    };
}

async function gotoWithRetry(page, url, attempts = 3) {
    let lastError;
    for (let i = 0; i < attempts; i++) {
        try {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
            return;
        } catch (error) {
            lastError = error;
            await sleep(400);
        }
    }
    throw lastError;
}

async function boot(browser, { mode = "normal", unsupported = false } = {}) {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
    });
    const errors = [];
    const apiCalls = [];
    if (unsupported) {
        await context.addInitScript(() => {
            delete window.SpeechRecognition;
            delete window.webkitSpeechRecognition;
            Object.defineProperty(window, "SpeechRecognition", {
                configurable: true,
                get: () => undefined,
            });
            Object.defineProperty(window, "webkitSpeechRecognition", {
                configurable: true,
                get: () => undefined,
            });
        });
    } else {
        await context.addInitScript(mockScript);
    }
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("request", (r) => {
        const url = r.url();
        if (/\/disease\/|openai|anthropic|gemini|generativelanguage|api\.openai/i.test(url)) {
            apiCalls.push(url);
        }
    });
    await gotoWithRetry(page, `${BASE}/`);
    await page.evaluate(() => {
        localStorage.setItem("krisiveda.guest", "1");
        localStorage.setItem("krisiveda-lang", "en");
    });
    await gotoWithRetry(page, `${BASE}/ai-doctor`);
    await page.waitForSelector(".ai-doctor__chatbar", { timeout: 15000 });
    if (!unsupported) await page.evaluate((m) => (window.__srMode = m), mode);
    return { context, page, errors, apiCalls };
}

const banner = (page) => page.locator(".ai-doctor__voice-error");
const bannerText = async (page) =>
    (await banner(page).count()) ? (await banner(page).innerText()).replace(/\s+/g, " ") : "";
const inputValue = (page) => page.locator(".ai-doctor__chatbar-input").inputValue();
const listeningPanel = (page) => page.locator(".ai-doctor__listening");
const micButton = (page) => page.locator(".ai-doctor__chatbar-mic");

const browser = await chromium.launch();

/* 1 — permission denied */
{
    const { context, page, errors } = await boot(browser, { mode: "denied" });
    await micButton(page).click();
    await until(async () => (await bannerText(page)).length > 0, 6000);
    const text = await bannerText(page);
    record(/microphone access is blocked/i.test(text), "permission denied gets its own message", text);
    record(!/internet|offline/i.test(text), "permission denied is not reported as a connection problem", text);
    record((await listeningPanel(page).count()) === 0, "permission denied stops the listening state");
    record((await page.getByRole("button", { name: /try again/i }).count()) >= 1, "retry action offered after permission denial");
    record((await page.getByRole("button", { name: /type instead/i }).count()) >= 1, "text fallback offered after permission denial");
    record(errors.length === 0, "no page errors during permission denial", errors.join(" | "));
    await context.close();
}

/* 2 — speech service refused the session */
{
    const { context, page } = await boot(browser, { mode: "service" });
    await micButton(page).click();
    await until(async () => (await bannerText(page)).length > 0, 6000);
    const text = await bannerText(page);
    record(/speech service is not responding/i.test(text), "service-not-allowed is reported as service unavailable", text);
    record(!/internet|offline/i.test(text), "service failure is not called an internet problem", text);
    record(!/microphone access is blocked/i.test(text), "service failure is not called a permission problem", text);
    record((await listeningPanel(page).count()) === 0, "service failure stops the listening state");
    await context.close();
}

/* 3 — engine `network` error while online (the reported symptom) */
{
    const { context, page } = await boot(browser, { mode: "network" });
    await micButton(page).click();
    await until(async () => (await bannerText(page)).length > 0, 6000);
    const text = await bannerText(page);
    record(/speech service is not responding/i.test(text), "network failure while online is called service unavailable", text);
    record(!/needs an internet connection|you are offline/i.test(text), "online failure no longer shows the generic internet message", text);
    record((await listeningPanel(page).count()) === 0, "network failure stops the listening state");
    await context.close();
}

/* 4 — genuinely offline */
{
    const { context, page } = await boot(browser, { mode: "network" });
    await page.evaluate(() => (window.__online = false));
    await micButton(page).click();
    await until(async () => (await bannerText(page)).length > 0, 6000);
    const text = await bannerText(page);
    record(/you are offline/i.test(text), "offline device gets the offline message", text);
    record(!/speech service is not responding/i.test(text), "offline message differs from service-unavailable message", text);
    await context.close();
}

/* 5 — no microphone */
{
    const { context, page } = await boot(browser, { mode: "capture" });
    await micButton(page).click();
    await until(async () => (await bannerText(page)).length > 0, 6000);
    const text = await bannerText(page);
    record(/no microphone was found/i.test(text), "missing microphone has its own message", text);
    record(!/internet|offline|speech service/i.test(text), "missing microphone is not confused with network or service", text);
    await context.close();
}

/* 6 — unsupported spoken language */
{
    const { context, page } = await boot(browser, { mode: "language" });
    await micButton(page).click();
    await until(async () => (await bannerText(page)).length > 0, 6000);
    const text = await bannerText(page);
    record(/cannot recognise the selected spoken language/i.test(text), "unsupported language has its own message", text);
    record(!/internet|offline|microphone access is blocked/i.test(text), "unsupported language is not a generic error", text);
    await context.close();
}

/* 7 — partial speech survives a failure */
{
    const { context, page } = await boot(browser, { mode: "normal" });
    await micButton(page).click();
    await until(() => page.evaluate(() => Boolean(window.__srStarted)), 4000);
    await page.evaluate(() => window.__srEmit("my paddy leaves have", false));
    await until(async () => (await page.locator(".ai-doctor__listening-preview").innerText()).includes("my paddy"), 3000);
    await page.evaluate(() => {
        window.__sr.onerror({ error: "network" });
        window.__sr.onend();
    });
    await until(async () => (await bannerText(page)).length > 0, 5000);
    record((await inputValue(page)).includes("my paddy leaves have"), "partially recognised speech is kept on failure", await inputValue(page));
    record((await listeningPanel(page).count()) === 0, "failed session leaves no listening state");
    record((await bannerText(page)).length > 0, "failure still explains itself after salvaging speech");
    await context.close();
}

/* 8 — stop keeps partial speech, no speech shows its own message */
{
    const { context, page } = await boot(browser, { mode: "normal" });
    await micButton(page).click();
    await until(() => page.evaluate(() => Boolean(window.__srStarted)), 4000);
    await page.evaluate(() => window.__srEmit("how much urea for", false));
    await until(async () => (await page.locator(".ai-doctor__listening-preview").innerText()).includes("how much"), 3000);
    await page.locator(".ai-doctor__voice-stop").click();
    await until(async () => (await page.locator(".ai-doctor__listening").count()) === 0, 4000);
    record((await inputValue(page)).includes("how much urea for"), "stopping manually keeps the partial transcript", await inputValue(page));
    record((await bannerText(page)).length === 0, "manual stop with speech shows no error");
    await context.close();
}
{
    const { context, page } = await boot(browser, { mode: "silent" });
    await micButton(page).click();
    await until(async () => (await listeningPanel(page).count()) > 0, 5000);
    await sleep(3200);
    await page.locator(".ai-doctor__voice-stop").click();
    await until(async () => (await bannerText(page)).length > 0, 4000);
    const text = await bannerText(page);
    record(/no speech (was )?detected/i.test(text), "stopping after silence reports no speech detected", text);
    record(!/internet|offline|speech service/i.test(text), "no-speech message is not a connection error", text);
    await context.close();
}

/* 9 — retry after a service failure */
{
    const { context, page } = await boot(browser, { mode: "service" });
    await micButton(page).click();
    await until(async () => (await bannerText(page)).length > 0, 6000);
    await page.evaluate(() => (window.__srMode = "normal"));
    await page.getByRole("button", { name: /try again/i }).click();
    const relistening = await until(async () => (await listeningPanel(page).count()) > 0, 6000);
    record(relistening, "retry restarts the listening state");
    record((await bannerText(page)).length === 0, "retry clears the previous error");
    const starts = await page.evaluate(() => window.__srTotalStarts);
    record(starts >= 2, "retry actually restarts the speech engine", String(starts));
    await page.evaluate(() => window.__srEmit("retry works", true));
    await until(async () => (await inputValue(page)).includes("retry works"), 4000);
    record((await inputValue(page)).includes("retry works"), "retry session still transcribes into the input");
    await context.close();
}

/* 10 — typing fallback focuses the message box */
{
    const { context, page } = await boot(browser, { mode: "network" });
    await micButton(page).click();
    await until(async () => (await bannerText(page)).length > 0, 6000);
    await page.getByRole("button", { name: /type instead/i }).click();
    const focused = await page.evaluate(
        () => document.activeElement?.className || "",
    );
    record(focused.includes("chatbar-input"), "type-instead focuses the message input", focused);
    record((await bannerText(page)).length === 0, "type-instead clears the voice error");
    await context.close();
}

/* 11 — unsupported browser */
{
    const { context, page } = await boot(browser, { unsupported: true });
    await micButton(page).click();
    await until(async () => (await bannerText(page)).length > 0, 5000);
    const text = await bannerText(page);
    record(/not supported in this browser/i.test(text), "unsupported browser has its own message", text);
    record((await page.getByRole("button", { name: /try again/i }).count()) === 0, "no pointless retry when the browser cannot listen");
    record((await page.getByRole("button", { name: /type instead/i }).count()) === 1, "typing fallback offered when unsupported");
    await context.close();
}

/* 12 — no AI calls, no page errors, mobile layout */
{
    const { context, page, errors, apiCalls } = await boot(browser, { mode: "normal" });
    await micButton(page).click();
    await until(async () => (await page.locator(".ai-doctor__listening-pulse").count()) > 0, 5000);
    record((await page.locator(".ai-doctor__listening").isVisible()), "listening indicator visible while recording");
    await page.evaluate(() => window.__srEmit("testing text input", true));
    await page.locator(".ai-doctor__chatbar-send").click();
    record((await page.locator(".ai-doctor__message--user").count()) === 1, "text still sends as a user message");
    record((await page.locator(".ai-doctor__message--assistant").count()) === 0, "no fake AI response appears");
    record(apiCalls.length === 0, "no AI or speech API requests", apiCalls.join(","));

    await page.setViewportSize({ width: 375, height: 760 });
    await page.evaluate(() => (window.__srMode = "network"));
    await page.locator(".ai-doctor__chatbar-mic").click();
    await until(async () => (await bannerText(page)).length > 0, 6000);
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
    );
    record(overflow <= 0, "no horizontal overflow at 375px with the error banner", String(overflow));
    const bannerBox = await banner(page).boundingBox();
    record(Boolean(bannerBox) && bannerBox.width <= 375, "error banner fits the 375px viewport", JSON.stringify(bannerBox));
    const actionsFit = await page.evaluate(() => {
        const actions = document.querySelector(".ai-doctor__voice-error-actions");
        if (!actions) return false;
        const r = actions.getBoundingClientRect();
        return r.width > 0 && r.right <= window.innerWidth + 1;
    });
    record(actionsFit, "retry and type fallback fit on mobile");
    const navVisible = await page.evaluate(() => {
        const n = document.querySelector(".mobile-nav");
        if (!n) return false;
        const r = n.getBoundingClientRect();
        return getComputedStyle(n).display !== "none" && r.width > 0 && r.bottom <= window.innerHeight + 1;
    });
    record(navVisible, "bottom navigation still visible on mobile");
    record(errors.length === 0, "no page errors in the main flow", errors.join(" | "));
    await context.close();
}

await browser.close();
console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
