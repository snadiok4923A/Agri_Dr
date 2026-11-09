import { test as base, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

const APP_BASE = "/Agri_Dr/";
// "localhost", not "127.0.0.1": Vite binds whichever loopback address Node
// resolves first (often IPv6 [::1] on Windows), so a literal 127.0.0.1 fetch
// of a dev-served module fails. Every other spec already uses "localhost".
const DEV_URL = "http://localhost:5173/Agri_Dr/";
const SERVICE_URL = "/Agri_Dr/src/services/browserDiseaseService.js";
const VERSION = "rice-disease-warmstart-v1";
const MODEL = "rice_disease_15class.onnx";
const MODEL_SHA256 =
    "5593156d6da4c35132248e1aafcce6b8294e8cdf66f4255ca91db5d95c8fa12a";
const MODEL_BASE = `${APP_BASE}models/${VERSION}/`;
const PINNED_FILES = {
    [MODEL]: { bytes: 6142549, sha256: MODEL_SHA256 },
    "model_metadata.json": {
        bytes: 37829,
        sha256: "066e89f2c334dfd973bee66936d6ff616d6bd9ee207a74fb33e4d5e652cab235",
    },
    "class_mapping.json": {
        bytes: 6101,
        sha256: "99dceae78a962814b868f99c56e7aba314684d5ef609c29422dc3dc2095035c9",
    },
    "onnx_parity.json": {
        bytes: 793,
        sha256: "ec43a3ad89d19861a4925322868d20f7149cffd8abf55bf4a4581e6477aae08c",
    },
};
const FILES = ["manifest.json", ...Object.keys(PINNED_FILES)].sort();
const CLASS_ROWS = [
    ["bacterial_leaf_blight", "Bacterial leaf blight", "disease"],
    ["bacterial_leaf_streak", "Bacterial leaf streak", "disease"],
    ["bacterial_panicle_blight", "Bacterial panicle blight", "disease"],
    ["bacterial_stripe_disease", "Bacterial stripe disease", "disease"],
    ["brown_spot", "Brown spot", "disease"],
    ["dead_heart", "Dead heart", "pest"],
    ["downy_mildew", "Downy mildew", "disease"],
    ["healthy_rice_leaf", "Healthy leaf", "healthy"],
    ["hispa", "Rice hispa", "pest"],
    ["leaf_blast", "Leaf blast", "disease"],
    ["leaf_smut", "Leaf smut", "disease"],
    ["leaf_roller", "Leaf roller", "pest"],
    ["tungro", "Tungro", "disease"],
    ["white_stem_borer", "White stem borer", "pest"],
    ["yellow_stem_borer", "Yellow stem borer", "pest"],
];
// CPU and WASM execute the same float32 graph but may accumulate reductions in
// different orders. Use symmetric relative error with a unit floor so values
// near zero do not create an unstable denominator. 6e-5 bounds the measured
// 4.953e-5 cross-runtime error with a small guard for browser/runtime variance,
// while remaining far below a material logit shift.
const LOGIT_RTOL = 6e-5;
const LOGIT_SCALE_FLOOR = 1;
const PROBABILITY_ATOL = 1e-4;
const picker = (page) => page.getByRole("combobox", { name: "Analysis model" });
const browserOption = (page) =>
    picker(page).locator('option[value="browser-v2"]');
const weightGets = (traffic) =>
    traffic.requests.filter(
        ({ url, method }) =>
            new URL(url).pathname === MODEL_BASE + MODEL && method === "GET",
    );
const isInferenceAsset = (url) =>
    /\.(?:onnx|wasm|mjs)(?:[?#]|$)/i.test(url) ||
    /\/[^/?]*(?:onnxruntime|ort[-.]wasm)[^/?]*\.js(?:[?#]|$)/i.test(url);
const isBinaryWasm = ({ url, method }) =>
    method === "GET" &&
    new URL(url).pathname.endsWith(".wasm") &&
    !new URL(url).searchParams.has("url");
const isRuntimeMjs = ({ url, method }) =>
    method === "GET" &&
    new URL(url).pathname.endsWith(".mjs") &&
    !new URL(url).searchParams.has("url");

const test = base.extend({
    modelTraffic: [
        async ({ page }, use, testInfo) => {
            const traffic = {
                requests: [],
                responses: [],
                predictions: [],
                blockedAssets: [],
                workers: [],
            };
            page.on("request", (request) => {
                traffic.requests.push({
                    url: request.url(),
                    method: request.method(),
                });
            });
            page.on("response", (response) => {
                traffic.responses.push({
                    url: response.url(),
                    method: response.request().method(),
                    status: response.status(),
                });
            });
            page.on("worker", (worker) => traffic.workers.push(worker.url()));
            await page.addInitScript(() => {
                localStorage.setItem("krisiveda.guest", "1");
                localStorage.setItem("krisiveda-lang", "en");

                // Observe native calls without replacing ORT, tensors, or model data.
                const calls = {
                    compile: 0,
                    compileStreaming: 0,
                    instantiate: 0,
                    instantiateStreaming: 0,
                    Module: 0,
                    Instance: 0,
                };
                window.__browserModelWasmCalls = calls;
                const wasm = globalThis.WebAssembly;
                if (!wasm) return;
                for (const name of [
                    "compile",
                    "compileStreaming",
                    "instantiate",
                    "instantiateStreaming",
                ]) {
                    if (typeof wasm[name] !== "function") continue;
                    wasm[name] = new Proxy(wasm[name], {
                        apply(target, receiver, args) {
                            calls[name] += 1;
                            return Reflect.apply(target, receiver, args);
                        },
                    });
                }
                for (const name of ["Module", "Instance"]) {
                    wasm[name] = new Proxy(wasm[name], {
                        construct(target, args, newTarget) {
                            calls[name] += 1;
                            return Reflect.construct(target, args, newTarget);
                        },
                    });
                }
            });
            await page.route(/\/disease\/v2\/status\/?(?:\?.*)?$/, (route) =>
                route.fulfill({
                    status: 503,
                    headers: { "access-control-allow-origin": "*" },
                    json: {
                        available: false,
                        classes: 15,
                        reason: "backend-offline",
                    },
                }),
            );
            // Never synthesize a prediction, or let a regression upload an image.
            await page.route(
                /\/disease\/(?:v2\/)?predict\/?(?:\?.*)?$/,
                (route) => {
                    traffic.predictions.push({
                        url: route.request().url(),
                        method: route.request().method(),
                    });
                    return route.abort("blockedbyclient");
                },
            );
            await page.route(
                (url) => isInferenceAsset(url.href),
                (route) => {
                    const url = new URL(route.request().url());
                    if (
                        url.origin !== new URL(page.url()).origin ||
                        !url.pathname.startsWith(APP_BASE)
                    ) {
                        traffic.blockedAssets.push(url.href);
                        return route.abort("blockedbyclient");
                    }
                    return route.continue();
                },
            );
            // Playwright routing disables HTTP cache: silence on repeat must come
            // from application/module reuse, not the browser's response cache.
            await use(traffic);
            if (
                testInfo.status !== testInfo.expectedStatus ||
                traffic.predictions.length ||
                traffic.blockedAssets.length
            ) {
                await testInfo.attach("browser-model-network", {
                    body: Buffer.from(JSON.stringify(traffic, null, 2)),
                    contentType: "application/json",
                });
            }
            expect(
                traffic.predictions,
                "Browser analysis must never call either prediction API",
            ).toEqual([]);
            expect(
                traffic.blockedAssets,
                "Weights and WASM/MJS must stay same-origin under /Agri_Dr/",
            ).toEqual([]);
        },
        { auto: true },
    ],
});

async function dashboard(page, url = "./") {
    await page.goto(url);
    await expect(page.locator(".dashboard-diagnosis-paste")).toBeVisible();
}

async function canvasPng(page) {
    const bytes = await page.evaluate(async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 192;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Native canvas is unavailable");
        context.fillStyle = "#e7edc7";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#24833a";
        context.beginPath();
        context.ellipse(160, 96, 126, 39, -0.3, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "#123f22";
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(40, 132);
        context.lineTo(280, 60);
        context.stroke();
        context.fillStyle = "#936b36";
        for (let i = 0; i < 7; i++) {
            context.fillRect(100 + i * 17, 89 + (i % 3) * 8, 4, 3);
        }
        const blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/png"),
        );
        if (!blob || blob.type !== "image/png")
            throw new Error("Canvas PNG encoding failed");
        return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    return {
        name: "browser-model-leaf.png",
        mimeType: "image/png",
        buffer: Buffer.from(bytes),
    };
}

async function uploadPreview(page) {
    await page
        .locator('input[type="file"][accept="image/*"]')
        .setInputFiles(await canvasPng(page));
    await expect(picker(page)).toBeVisible();
    await expect(page.locator(".camodal__photo")).toHaveJSProperty(
        "naturalWidth",
        320,
    );
    await expect(page.locator(".camodal__photo")).toHaveJSProperty(
        "naturalHeight",
        192,
    );
}

async function selectBrowser(page) {
    await expect(browserOption(page)).toHaveJSProperty("disabled", false);
    await picker(page).selectOption("browser-v2");
    await expect(picker(page)).toHaveValue("browser-v2");
}

const wasmCalls = (page) =>
    page.evaluate(() => ({ ...window.__browserModelWasmCalls }));
const inferenceRequests = (traffic) =>
    traffic.requests.filter(({ url }) => isInferenceAsset(url));

async function expectUiPrediction(page) {
    const body = page.locator(".camodal__analysis-body");
    await expect(
        body.getByText(`Model version: ${VERSION}`, { exact: true }),
    ).toBeVisible({ timeout: 90_000 });
    await expect(body).toContainText("Development model:");
    await expect(body).toContainText("It is not a confirmed diagnosis.");
    const status = body.locator(".camodal__status");
    await expect(status).toHaveText(/^\s*\d{1,3}%\s*$/);
    const percentage = Number(
        (await status.innerText()).trim().replace("%", ""),
    );
    expect(Number.isFinite(percentage)).toBe(true);
    expect(percentage).toBeGreaterThanOrEqual(0);
    expect(percentage).toBeLessThanOrEqual(100);
    if (await body.locator(".camodal__uncertain-warning").count()) {
        await expect(body.locator(".camodal__analysis-disease")).toHaveCount(0);
        const possible = body
            .locator(".camodal__analysis-msg")
            .filter({ hasText: /^Possible matches:/ });
        const names = (await possible.innerText())
            .replace(/^Possible matches:\s*/, "")
            .split(/,\s*/);
        expect(names).toHaveLength(3);
        expect(new Set(names).size).toBe(3);
        for (const name of names)
            expect(CLASS_ROWS.map((row) => row[1])).toContain(name);
    } else {
        const name = (
            await body.locator(".camodal__analysis-disease").innerText()
        ).trim();
        const row = CLASS_ROWS.find((entry) => entry[1] === name);
        expect(
            row,
            "An accepted label must belong to the pinned taxonomy",
        ).toBeTruthy();
        await expect(body).toContainText(
            `Category: ${row[2][0].toUpperCase()}${row[2].slice(1)}`,
        );
    }
    const text = await body.innerText();
    expect(text).not.toMatch(/\b(?:NaN|Infinity)\b/);
    return text;
}

async function expectUiFailure(page, message) {
    const body = page.locator(".camodal__analysis-body");
    await expect(body).toContainText(message, { timeout: 90_000 });
    await expect(body).toContainText("It is not a confirmed diagnosis.");
    await expect(body.locator(".camodal__analysis-disease")).toHaveCount(0);
    await expect(body).not.toContainText("Model version:");
    await expect(body).not.toContainText("Possible matches:");
    await expect(body.locator(".camodal__status")).not.toHaveText(/\d+%/);
}

function softmax(logits) {
    const maximum = Math.max(...logits);
    const weights = logits.map((value) => Math.exp(value - maximum));
    const total = weights.reduce((sum, value) => sum + value, 0);
    return weights.map((value) => value / total);
}

function relativeDifference(actual, reference) {
    return (
        Math.abs(actual - reference) /
        Math.max(Math.abs(actual), Math.abs(reference), LOGIT_SCALE_FLOOR)
    );
}

function roundConfidence(value) {
    // The API contract uses four decimal places and even rounding at binary half ties.
    const scaled = value * 10000;
    if (Number.isInteger(value * 32) && scaled % 1 === 0.5) {
        const lower = Math.floor(scaled);
        return (lower + (lower % 2)) / 10000;
    }
    return Number(value.toFixed(4));
}

const rankedIndices = (logits) =>
    logits.map((_, i) => i).sort((a, b) => logits[b] - logits[a] || b - a);

function expectTensorPrediction(result, classes) {
    expect(Array.isArray(result.logits), JSON.stringify(result)).toBe(true);
    expect(result.logits).toHaveLength(15);
    expect(result.logits.every(Number.isFinite)).toBe(true);
    const probabilities = softmax(result.logits);
    expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(
        1,
        12,
    );
    const ranked = rankedIndices(result.logits);
    const top = ranked.slice(0, 3).map((index) => {
        const entry = classes[index];
        return {
            class_id: entry.class_id,
            disease: entry.display_name,
            display_name: entry.display_name,
            category: entry.category,
            confidence: roundConfidence(probabilities[index]),
            needs_review: entry.needs_review,
            warning: entry.needs_review ? entry.notes : null,
        };
    });
    const accepted = top[0].confidence >= 0.6;
    expect(result).toMatchObject({
        model_version: VERSION,
        classes_total: 15,
        runtime: "onnxruntime-web-wasm",
        threshold: 0.6,
        production: false,
        status: accepted ? "ok" : "uncertain",
        confidence: top[0].confidence,
        class_id: accepted ? top[0].class_id : null,
        disease: accepted ? top[0].disease : null,
        display_name: accepted ? top[0].display_name : null,
        category: accepted ? top[0].category : null,
        needs_review: top[0].needs_review,
        warning: top[0].warning,
        top_predictions: top,
    });
    expect(result.top_predictions).toHaveLength(3);
    expect(
        result.top_predictions.every((entry) =>
            Number.isFinite(entry.confidence),
        ),
    ).toBe(true);
    expect(result.message).toMatch(
        /Development model:.*not a confirmed diagnosis\./,
    );
    return { probabilities, ranked };
}

test("production publishes exactly the pinned ONNX, manifest, metadata, taxonomy and parity evidence", async ({
    page,
}) => {
    const directory = new URL(`../../dist/models/${VERSION}/`, import.meta.url);
    expect(
        (await readdir(new URL("../../dist/models/", import.meta.url))).sort(),
    ).toEqual([VERSION]);
    expect((await readdir(directory)).sort()).toEqual(FILES);
    await dashboard(page);
    expect(new URL(page.url()).origin).toBe("http://127.0.0.1:4175");
    expect(new URL(page.url()).pathname).toBe(APP_BASE);
    const assets = await page.evaluate(
        async ({ base, names }) => {
            return Promise.all(
                names.map(async (name) => {
                    const response = await fetch(base + name);
                    if (!response.ok)
                        throw new Error(`${name}: HTTP ${response.status}`);
                    const bytes = new Uint8Array(await response.arrayBuffer());
                    const text = name.endsWith(".json");
                    // The browser pins the canonical LF form of text assets.
                    const canonical = text
                        ? bytes.filter(
                              (_, i) =>
                                  !(bytes[i] === 13 && bytes[i + 1] === 10),
                          )
                        : bytes;
                    const digest = async (value) =>
                        Array.from(
                            new Uint8Array(
                                await crypto.subtle.digest("SHA-256", value),
                            ),
                            (b) => b.toString(16).padStart(2, "0"),
                        ).join("");
                    return {
                        name,
                        url: response.url,
                        contentType: response.headers.get("content-type"),
                        rawBytes: bytes.length,
                        rawSha256: await digest(bytes),
                        bytes: canonical.length,
                        sha256: await digest(canonical),
                        prefix: new TextDecoder().decode(
                            bytes.subarray(0, 128),
                        ),
                        json: name.endsWith(".json")
                            ? JSON.parse(new TextDecoder().decode(bytes))
                            : null,
                    };
                }),
            );
        },
        { base: MODEL_BASE, names: FILES },
    );
    const byName = Object.fromEntries(
        assets.map((asset) => [asset.name, asset]),
    );
    const manifest = byName["manifest.json"].json;
    expect(manifest).toEqual({
        schema_version: 1,
        model_version: VERSION,
        num_classes: 15,
        confidence_threshold: 0.6,
        files: PINNED_FILES,
    });
    for (const asset of assets) {
        const [source, built] = await Promise.all([
            readFile(
                new URL(
                    `../../public/models/${VERSION}/${asset.name}`,
                    import.meta.url,
                ),
            ),
            readFile(new URL(asset.name, directory)),
        ]);
        const hash = (bytes) =>
            createHash("sha256").update(bytes).digest("hex");
        expect(asset.rawSha256, `${asset.name}: HTTP/public mismatch`).toBe(
            hash(source),
        );
        expect(asset.rawSha256, `${asset.name}: HTTP/dist mismatch`).toBe(
            hash(built),
        );
        expect(asset.rawBytes).toBe(built.length);
        expect(asset.contentType).not.toMatch(/html/i);
        expect(asset.prefix).not.toMatch(
            /^\s*(?:<|version https:\/\/git-lfs\.github\.com\/spec\/v1)/i,
        );
        expect(new URL(asset.url).pathname).toBe(MODEL_BASE + asset.name);
        if (asset.name !== "manifest.json") {
            expect({ bytes: asset.bytes, sha256: asset.sha256 }).toEqual(
                manifest.files[asset.name],
            );
        }
    }
    const metadata = byName["model_metadata.json"].json;
    const mapping = byName["class_mapping.json"].json;
    const parity = byName["onnx_parity.json"].json;
    expect(metadata).toMatchObject({
        model_version: VERSION,
        num_classes: 15,
        architecture: "mobilenet_v3_small",
        onnx: {
            sha256: MODEL_SHA256,
            bytes: PINNED_FILES[MODEL].bytes,
            opset: 17,
            input_name: "images",
            input_shape: ["batch", 3, 224, 224],
            input_type: "tensor(float)",
            output_name: "logits",
            output_shape: ["batch", 15],
            output_type: "tensor(float)",
        },
        preprocessing: {
            color_mode: "RGB",
            exif_transpose: true,
            resize: { short_edge: 256, interpolation: "bilinear" },
            center_crop: 224,
            scale: "pixel / 255.0",
            layout: "NCHW",
            dtype: "float32",
            normalization: {
                mean: [0.485, 0.456, 0.406],
                std: [0.229, 0.224, 0.225],
                channel_order: "RGB",
            },
        },
    });
    expect(mapping).toMatchObject({
        model_version: VERSION,
        num_classes: 15,
        order_is_model_output_order: true,
    });
    expect(
        mapping.classes.map((entry) => [
            entry.class_id,
            entry.display_name,
            entry.category,
        ]),
    ).toEqual(CLASS_ROWS);
    expect(metadata.class_order).toEqual(CLASS_ROWS.map((row) => row[0]));
    for (const entry of mapping.classes) {
        expect(metadata.class_display_names[entry.class_id]).toBe(
            entry.display_name,
        );
        expect(metadata.class_categories[entry.class_id]).toBe(entry.category);
        expect(entry.needs_review).toBe(
            ["downy_mildew", "leaf_smut"].includes(entry.class_id),
        );
    }
    expect(parity).toEqual(metadata.parity);
    expect(parity).toMatchObject({
        all_within_atol: true,
        preprocessing_identical: true,
        predicted_class_agreement: 1,
        atol: 1e-4,
    });
    expect(parity.samples).toBeGreaterThan(0);
    expect(Number.isFinite(parity.max_abs_logit_difference)).toBe(true);
    expect(parity.max_abs_logit_difference).toBeLessThanOrEqual(parity.atol);
    expect(parity.input_signature).toEqual({
        name: "images",
        shape: ["batch", 3, 224, 224],
        type: "tensor(float)",
    });
    expect(parity.output_signature).toEqual({
        name: "logits",
        shape: ["batch", 15],
        type: "tensor(float)",
    });
});

test("Dashboard preflight keeps V1 default and API V2 disabled without loading weights or WASM", async ({
    page,
    modelTraffic,
}) => {
    // Readiness is metadata-only: no HEAD probe and no ONNX download.
    await dashboard(page);
    expect(weightGets(modelTraffic)).toHaveLength(0);
    expect(
        inferenceRequests(modelTraffic).filter(
            ({ method }) => method !== "HEAD",
        ),
    ).toEqual([]);
    await uploadPreview(page);
    await expect(picker(page)).toHaveValue("v1");
    await expect(picker(page).locator("option")).toHaveText([
        "Existing Model (6 Classes)",
        "Advanced Model (15 Classes)",
        "Browser Model (15 Classes)",
    ]);
    await expect(picker(page).locator('option[value="v2"]')).toHaveJSProperty(
        "disabled",
        true,
    );
    await selectBrowser(page);
    const preflight = modelTraffic.requests.filter(({ url }) =>
        new URL(url).pathname.startsWith(MODEL_BASE),
    );
    expect(
        preflight
            .filter(({ method }) => method === "GET")
            .map(({ url }) => new URL(url).pathname.split("/").pop())
            .sort(),
    ).toEqual([
        "class_mapping.json",
        "manifest.json",
        "model_metadata.json",
        "onnx_parity.json",
    ]);
    expect(preflight.filter(({ method }) => method === "HEAD")).toHaveLength(0);
    expect(weightGets(modelTraffic)).toHaveLength(0);
    expect(
        inferenceRequests(modelTraffic).filter(
            ({ method }) => method !== "HEAD",
        ),
    ).toEqual([]);
    expect(
        Object.values(await wasmCalls(page)).every((count) => count === 0),
    ).toBe(true);
    await picker(page).selectOption("v1");
    await expect(picker(page)).toHaveValue("v1");
});

test("Git-normalized LF sidecars, as served by GitHub Pages, keep Browser Model enabled", async ({
    page,
}) => {
    for (const name of [
        "model_metadata.json",
        "class_mapping.json",
        "onnx_parity.json",
    ]) {
        await page.route("**" + MODEL_BASE + name, async (route) => {
            const response = await route.fetch();
            const bytes = Buffer.from(await response.body());
            const lf = Buffer.from(
                bytes.toString("utf8").replaceAll("\r\n", "\n"),
            );
            // The deployed Pages branch stores these JSON files with LF.
            expect(lf.length).toBeLessThan(bytes.length);
            await route.fulfill({
                status: 200,
                headers: {
                    "content-type": "application/json; charset=utf-8",
                    "content-length": String(lf.length),
                },
                body: lf,
            });
        });
    }
    await dashboard(page);
    await uploadPreview(page);
    await expect(browserOption(page)).toHaveJSProperty("disabled", false);
    await picker(page).selectOption("browser-v2");
    await expect(picker(page)).toHaveValue("browser-v2");
});

test("production Analyze uses uploaded and pasted PNGs with local WASM, reusing the model/runtime", async ({
    page,
    modelTraffic,
}) => {
    await dashboard(page);
    await uploadPreview(page);
    await selectBrowser(page);
    const previewUrl = await page
        .locator(".camodal__photo")
        .getAttribute("src");
    await page.getByRole("button", { name: "Analyze", exact: true }).click();
    const firstText = await expectUiPrediction(page);
    expect(weightGets(modelTraffic)).toHaveLength(1);
    expect(modelTraffic.responses.filter(isBinaryWasm).length).toBeGreaterThan(
        0,
    );
    expect(modelTraffic.responses.filter(isRuntimeMjs).length).toBeGreaterThan(
        0,
    );
    for (const response of modelTraffic.responses.filter(
        (entry) => isBinaryWasm(entry) || isRuntimeMjs(entry),
    )) {
        expect(response.status).toBe(200);
        expect(new URL(response.url).origin).toBe(new URL(page.url()).origin);
        expect(new URL(response.url).pathname.startsWith(APP_BASE)).toBe(true);
    }
    const firstCalls = await wasmCalls(page);
    expect(
        Object.values(firstCalls).reduce((sum, count) => sum + count, 0),
    ).toBeGreaterThan(0);
    const firstRequests = [...inferenceRequests(modelTraffic)];
    await page.locator(".camodal__close").click();
    await expect(picker(page)).toHaveValue("browser-v2");
    await expect(page.locator(".camodal__photo")).toHaveAttribute(
        "src",
        previewUrl,
    );
    const pasted = await canvasPng(page);
    await page.evaluate((bytes) => {
        const image = new Blob([new Uint8Array(bytes)], { type: "image/png" });
        Object.defineProperty(navigator.clipboard, "read", {
            configurable: true,
            value: async () => [new ClipboardItem({ "image/png": image })],
        });
    }, Array.from(pasted.buffer));
    await page.locator(".camodal__paste").click();
    await expect(page.locator(".camodal__photo")).not.toHaveAttribute(
        "src",
        previewUrl,
    );
    await expect(page.locator(".camodal__photo")).toHaveJSProperty(
        "naturalWidth",
        320,
    );
    await expect(picker(page)).toHaveValue("browser-v2");
    await expect(page.locator(".camodal__analysis-body")).toHaveCount(0);
    expect(inferenceRequests(modelTraffic)).toEqual(firstRequests);
    await page.getByRole("button", { name: "Analyze", exact: true }).click();
    expect(await expectUiPrediction(page)).toBe(firstText);
    expect(weightGets(modelTraffic)).toHaveLength(1);
    expect(inferenceRequests(modelTraffic)).toEqual(firstRequests);
    expect(await wasmCalls(page)).toEqual(firstCalls);
    expect(
        modelTraffic.workers,
        "Single-thread WASM must not create a worker pool or proxy worker",
    ).toEqual([]);
});

test("a same-length corrupt ONNX fails closed before runtime initialization and never falls back to an API", async ({
    page,
    modelTraffic,
}) => {
    let corruptions = 0;
    await page.route("**" + MODEL_BASE + MODEL, async (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        const response = await route.fetch();
        const bytes = Buffer.from(await response.body());
        expect(bytes.length).toBe(PINNED_FILES[MODEL].bytes);
        bytes[Math.floor(bytes.length / 2)] ^= 1;
        corruptions += 1;
        await route.fulfill({ response, body: bytes });
    });
    await dashboard(page);
    await uploadPreview(page);
    await selectBrowser(page);
    await page.getByRole("button", { name: "Analyze", exact: true }).click();
    await expectUiFailure(
        page,
        `Browser model asset ${MODEL} failed its size or SHA-256 check.`,
    );
    expect(corruptions).toBe(1);
    expect(weightGets(modelTraffic)).toHaveLength(1);
    expect(
        modelTraffic.requests.filter(
            (entry) => isBinaryWasm(entry) || isRuntimeMjs(entry),
        ),
    ).toEqual([]);
    expect(
        Object.values(await wasmCalls(page)).every((count) => count === 0),
    ).toBe(true);
    await page.locator(".camodal__close").click();
    await expect(picker(page)).toHaveValue("browser-v2");
});

test("a damaged taxonomy sidecar disables Browser Model and retains the existing six-class default", async ({
    page,
    modelTraffic,
}) => {
    let corruptions = 0;
    await page.route(
        "**" + MODEL_BASE + "class_mapping.json",
        async (route) => {
            const response = await route.fetch();
            const bytes = Buffer.from(await response.body());
            const index = bytes.indexOf("bacterial_leaf_blight");
            expect(index).toBeGreaterThan(0);
            bytes[index] = "x".charCodeAt(0);
            // Still valid JSON and the original length; only SHA verification catches it.
            JSON.parse(bytes.toString("utf8"));
            corruptions += 1;
            await route.fulfill({ response, body: bytes });
        },
    );
    const sidecarPromise = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname ===
            MODEL_BASE + "class_mapping.json",
    );
    await dashboard(page);
    await (await sidecarPromise).finished();
    await uploadPreview(page);
    await expect(browserOption(page)).toHaveJSProperty("disabled", true);
    await expect(picker(page)).toHaveValue("v1");
    await expect(picker(page).locator('option[value="v1"]')).toHaveJSProperty(
        "disabled",
        false,
    );
    await expect(picker(page).locator('option[value="v2"]')).toHaveJSProperty(
        "disabled",
        true,
    );
    expect(corruptions).toBe(1);
    expect(
        modelTraffic.requests.filter(
            ({ url }) => new URL(url).pathname === MODEL_BASE + MODEL,
        ),
    ).toEqual([]);
    expect(inferenceRequests(modelTraffic)).toEqual([]);
    expect(
        Object.values(await wasmCalls(page)).every((count) => count === 0),
    ).toBe(true);
});

test("a stalled ONNX download ends Analyze with a timeout error and the next attempt recovers", async ({
    page,
    modelTraffic,
}) => {
    await page.route("**" + MODEL_BASE + MODEL, () => {});
    await dashboard(page);
    await uploadPreview(page);
    await selectBrowser(page);
    await page.getByRole("button", { name: "Analyze", exact: true }).click();
    await expectUiFailure(
        page,
        `Browser model asset ${MODEL} timed out. Please retry.`,
    );
    await expect(page.locator(".camodal__analysis-body")).not.toContainText(
        "Analyzing image...",
    );
    // A stalled local model never falls back to any API prediction path.
    expect(
        modelTraffic.requests.filter(({ url }) =>
            /\/disease\/(?:predict|v2\/predict)$/.test(new URL(url).pathname),
        ),
    ).toEqual([]);
    await page.unroute("**" + MODEL_BASE + MODEL);
    await page.locator(".camodal__close").click();
    await expect(picker(page)).toHaveValue("browser-v2");
    await page.getByRole("button", { name: "Analyze", exact: true }).click();
    await expectUiPrediction(page);
});

test("an undecodable PNG ends Analyze with the image error instead of loading forever", async ({
    page,
    modelTraffic,
}) => {
    await dashboard(page);
    await uploadPreview(page);
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
        name: "leaf.png",
        mimeType: "image/png",
        buffer: Buffer.concat([
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            Buffer.from("truncated png payload that cannot be decoded"),
        ]),
    });
    await expect(picker(page)).toBeVisible();
    await selectBrowser(page);
    await page.getByRole("button", { name: "Analyze", exact: true }).click();
    const body = page.locator(".camodal__analysis-body");
    await expect(body).toContainText(
        "The uploaded image is invalid or could not be decoded.",
    );
    await expect(body).not.toContainText("Analyzing image...");
    expect(weightGets(modelTraffic)).toHaveLength(0);
});

test("an unsupported WASM environment reports an Analyze-time error without switching models or using an API", async ({
    page,
    modelTraffic,
}) => {
    await page.addInitScript(() => {
        Object.defineProperty(globalThis, "WebAssembly", {
            configurable: true,
            writable: true,
            value: undefined,
        });
    });
    await dashboard(page);
    expect(await page.evaluate(() => typeof globalThis.WebAssembly)).toBe(
        "undefined",
    );
    await uploadPreview(page);
    // Readiness is intentionally metadata-only, not a runtime capability probe.
    await selectBrowser(page);
    await page.getByRole("button", { name: "Analyze", exact: true }).click();
    await expectUiFailure(
        page,
        "The local WASM runtime could not start. Please retry.",
    );
    expect(weightGets(modelTraffic)).toHaveLength(1);
    await page.locator(".camodal__close").click();
    await expect(picker(page)).toHaveValue("browser-v2");
});

test("real browser WASM matches CPU logits, softmax, gates and top-three taxonomy for all 15 identical tensors", async ({
    page,
    modelTraffic,
}, testInfo) => {
    test.setTimeout(240_000);
    const fixtureUrl = new URL(
        "../fixtures/browser-model-reference.json",
        import.meta.url,
    );
    let reference;
    try {
        reference = JSON.parse(await readFile(fixtureUrl, "utf8"));
    } catch (error) {
        throw new Error(
            "Generate playwright-test/fixtures/browser-model-reference.json with the pinned model and ONNX Runtime CPU before running this suite; no synthetic reference or skip is allowed.",
            { cause: error },
        );
    }
    expect(reference.model_version).toBe(VERSION);
    expect(reference.model_sha256).toBe(MODEL_SHA256);
    expect(reference.generated_with).toBeTruthy();
    expect(reference.cases).toHaveLength(15);
    expect(
        reference.cases.map(({ seed }) => seed).sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 15 }, (_, i) => i));
    for (const entry of reference.cases) {
        expect(Array.isArray(entry.logits)).toBe(true);
        expect(entry.logits).toHaveLength(15);
        expect(entry.logits.every(Number.isFinite)).toBe(true);
    }
    // Isolate runtime parity from the full Dashboard's unrelated startup work.
    // Only the HTML shell is synthetic; ESM, ONNX, WASM and results remain real.
    await page.route(DEV_URL, (route) =>
        route.fulfill({
            contentType: "text/html",
            body: "<!doctype html><title>Browser model CPU/WASM parity</title>",
        }),
    );
    await page.goto(DEV_URL);
    const results = await page.evaluate(
        async ({ serviceUrl, seeds }) => {
            const { runBrowserDiseaseTensor } = await import(serviceUrl);
            const results = [];
            for (const seed of seeds) {
                const input = new Float32Array(150528);
                for (let i = 0; i < input.length; i++) {
                    input[i] = (((i * 7 + seed * 31) % 257) - 128) / 64;
                }
                results.push({
                    seed,
                    result: await runBrowserDiseaseTensor(input),
                });
            }
            return results;
        },
        {
            serviceUrl: SERVICE_URL,
            seeds: reference.cases.map(({ seed }) => seed),
        },
    );
    await testInfo.attach("browser-model-wasm-results", {
        body: Buffer.from(JSON.stringify(results, null, 2)),
        contentType: "application/json",
    });
    const mapping = await page.evaluate(async (url) => {
        const response = await fetch(url);
        if (!response.ok)
            throw new Error(`Class mapping: HTTP ${response.status}`);
        return response.json();
    }, MODEL_BASE + "class_mapping.json");
    expect(
        mapping.classes.map((entry) => [
            entry.class_id,
            entry.display_name,
            entry.category,
        ]),
    ).toEqual(CLASS_ROWS);
    const measurements = results.map(({ seed, result }) => {
        expect(
            Array.isArray(result.logits),
            `seed ${seed}: ${JSON.stringify(result)}`,
        ).toBe(true);
        expect(result.logits).toHaveLength(15);
        expect(result.logits.every(Number.isFinite)).toBe(true);
        const cpu = reference.cases.find((entry) => entry.seed === seed).logits;
        const cpuProbabilities = softmax(cpu);
        const wasmProbabilities = softmax(result.logits);
        return {
            seed,
            cpu_logits: cpu,
            wasm_logits: result.logits,
            max_abs_logit_difference: Math.max(
                ...cpu.map((value, i) => Math.abs(value - result.logits[i])),
            ),
            max_relative_logit_difference: Math.max(
                ...cpu.map((value, i) =>
                    relativeDifference(result.logits[i], value),
                ),
            ),
            max_abs_probability_difference: Math.max(
                ...cpuProbabilities.map((value, i) =>
                    Math.abs(value - wasmProbabilities[i]),
                ),
            ),
        };
    });
    const summary = {
        model_version: VERSION,
        model_sha256: MODEL_SHA256,
        samples: measurements.length,
        logit_rtol: LOGIT_RTOL,
        logit_scale_floor: LOGIT_SCALE_FLOOR,
        probability_atol: PROBABILITY_ATOL,
        max_abs_logit_difference: Math.max(
            ...measurements.map((entry) => entry.max_abs_logit_difference),
        ),
        max_relative_logit_difference: Math.max(
            ...measurements.map(
                (entry) => entry.max_relative_logit_difference,
            ),
        ),
        max_abs_probability_difference: Math.max(
            ...measurements.map(
                (entry) => entry.max_abs_probability_difference,
            ),
        ),
    };
    // Emit measured evidence before assertions, including on a tolerance failure.
    console.log("[browser-model CPU/WASM parity] " + JSON.stringify(summary));
    await testInfo.attach("browser-model-cpu-wasm-parity", {
        body: Buffer.from(
            JSON.stringify(
                {
                    ...summary,
                    generated_with: reference.generated_with,
                    cases: measurements,
                },
                null,
                2,
            ),
        ),
        contentType: "application/json",
    });
    for (const entry of measurements) {
        expect
            .soft(
                entry.max_relative_logit_difference,
                `seed ${entry.seed}: CPU/WASM logits exceed the 6e-5 symmetric relative threshold; inspect the parity attachment`,
            )
            .toBeLessThanOrEqual(LOGIT_RTOL);
        expect
            .soft(
                entry.max_abs_probability_difference,
                `seed ${entry.seed}: CPU/WASM softmax differs`,
            )
            .toBeLessThanOrEqual(PROBABILITY_ATOL);
    }
    for (const { seed, result } of results) {
        const { ranked } = expectTensorPrediction(result, mapping.classes);
        const cpuLogits = reference.cases.find(
            (entry) => entry.seed === seed,
        ).logits;
        const cpuProbabilities = softmax(cpuLogits);
        const cpuRanked = rankedIndices(cpuLogits);
        expect(ranked[0], `seed ${seed}: CPU/WASM argmax`).toBe(cpuRanked[0]);
        expect(
            result.top_predictions.map((entry) => entry.class_id),
            `seed ${seed}: CPU/WASM top three`,
        ).toEqual(
            cpuRanked
                .slice(0, 3)
                .map((index) => mapping.classes[index].class_id),
        );
        for (const [rank, prediction] of result.top_predictions.entries()) {
            expect(
                Math.abs(
                    prediction.confidence - cpuProbabilities[cpuRanked[rank]],
                ),
                `seed ${seed}: rounded top-${rank + 1} confidence versus CPU softmax`,
            ).toBeLessThanOrEqual(PROBABILITY_ATOL);
        }
        const accepted = roundConfidence(cpuProbabilities[cpuRanked[0]]) >= 0.6;
        expect(
            result.status,
            `seed ${seed}: rounded 0.6 CPU confidence gate`,
        ).toBe(accepted ? "ok" : "uncertain");
        expect(result.class_id).toBe(
            accepted ? mapping.classes[cpuRanked[0]].class_id : null,
        );
    }
    expect(weightGets(modelTraffic)).toHaveLength(1);
    expect(modelTraffic.responses.filter(isBinaryWasm).length).toBeGreaterThan(
        0,
    );
    expect(modelTraffic.responses.filter(isRuntimeMjs).length).toBeGreaterThan(
        0,
    );
    expect(modelTraffic.workers).toEqual([]);
});

for (const width of [375, 768, 1280]) {
    test(`Browser Model remains selectable without horizontal overflow at ${width}px`, async ({
        page,
        modelTraffic,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await dashboard(page);
        await uploadPreview(page);
        await expect(picker(page)).toHaveValue("v1");
        await selectBrowser(page);
        await expect(picker(page).locator("option:checked")).toHaveText(
            "Browser Model (15 Classes)",
        );
        const controls = [
            picker(page),
            page.getByRole("button", { name: "Analyze", exact: true }),
            page
                .getByRole("dialog", { name: "Crop Diagnosis" })
                .getByRole("button", {
                    name: "Paste image from clipboard",
                    exact: true,
                }),
            page.getByRole("button", { name: "Choose Another", exact: true }),
        ];
        for (const control of controls) {
            await expect(control).toBeVisible();
            await expect(control).toBeInViewport();
            const bounds = await control.boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        }
        const dimensions = await page.evaluate(() => {
            const overlay = document.querySelector(".camodal__overlay");
            const modal = document.querySelector(".camodal");
            return {
                viewport: innerWidth,
                document: document.documentElement.scrollWidth,
                body: document.body.scrollWidth,
                overlay: overlay.scrollWidth,
                overlayClient: overlay.clientWidth,
                modal: modal.scrollWidth,
                modalClient: modal.clientWidth,
            };
        });
        expect(dimensions.document).toBeLessThanOrEqual(
            dimensions.viewport + 1,
        );
        expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
        expect(dimensions.overlay).toBeLessThanOrEqual(
            dimensions.overlayClient + 1,
        );
        expect(dimensions.modal).toBeLessThanOrEqual(
            dimensions.modalClient + 1,
        );
        expect(weightGets(modelTraffic)).toHaveLength(0);
    });
}
