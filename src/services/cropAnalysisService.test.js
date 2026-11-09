import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("./cropAnalysisService.js", import.meta.url), "utf8");
const hostedApi = "https://krisiveda-ml-api.onrender.com";
let importId = 0;

async function loadService(overrides = {}) {
    const env = {
        DEV: true,
        PROD: false,
        BASE_URL: "/Agri_Dr/",
        VITE_KRISIVEDA_ML_API_URL: "http://127.0.0.1:8000",
        ...overrides,
    };
    const code = source.replaceAll("import.meta.env", JSON.stringify(env));
    return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}#${++importId}`);
}

const readyStatus = {
    available: true,
    classes: 15,
    model_version: "rice-disease-warmstart-v1",
    production: false,
};
const prediction = { status: "uncertain", confidence: 0.4, top_predictions: [] };
const image = () => new File(["test image"], "leaf.png", { type: "image/png" });

test("development V2 status uses the proxy and preserves the backend fields", async (t) => {
    const fetch = t.mock.method(globalThis, "fetch", async () => Response.json(readyStatus));
    const service = await loadService();
    assert.deepEqual(await service.getDiseaseV2Status(), readyStatus);
    assert.equal(fetch.mock.calls[0].arguments[0], "/Agri_Dr/api/disease/v2/status");
    assert.deepEqual(fetch.mock.calls[0].arguments[1].headers, { Accept: "application/json" });
});

for (const payload of [null, {}, { available: "true", classes: 15 }, { available: true, classes: "15" }]) {
    test(`invalid V2 status fails closed: ${JSON.stringify(payload)}`, async (t) => {
        t.mock.method(globalThis, "fetch", async () => Response.json(payload));
        const service = await loadService();
        assert.deepEqual(await service.getDiseaseV2Status(), { available: false, reason: "invalid-response" });
    });
}

for (const status of [404, 500, 503]) {
    test(`V2 status HTTP ${status} fails closed`, async (t) => {
        t.mock.method(globalThis, "fetch", async () => new Response(null, { status }));
        const service = await loadService();
        assert.deepEqual(await service.getDiseaseV2Status(), { available: false, reason: `api-${status}` });
    });
}

test("V2 network and JSON failures keep the model unavailable", async (t) => {
    const fetch = t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
    const service = await loadService();
    assert.equal((await service.getDiseaseV2Status()).available, false);
    fetch.mock.mockImplementation(async () => new Response("not JSON"));
    assert.equal((await service.getDiseaseV2Status()).available, false);
});

test("only explicit V2 predictions use the V2 proxy; default and unknown models retain V1", async (t) => {
    const fetch = t.mock.method(globalThis, "fetch", async () => Response.json(prediction));
    const service = await loadService();
    for (const model of [undefined, "v1", "v2", "unknown"]) {
        assert.deepEqual(await service.analyzeCropImage(image(), model), prediction);
    }
    assert.deepEqual(fetch.mock.calls.map((call) => call.arguments[0]), [
        "http://127.0.0.1:8000/disease/predict",
        "http://127.0.0.1:8000/disease/predict",
        "/Agri_Dr/api/disease/v2/predict",
        "http://127.0.0.1:8000/disease/predict",
    ]);
    for (const call of fetch.mock.calls) {
        assert.equal(call.arguments[1].method, "POST");
        assert.equal(call.arguments[1].body.get("file").name, "leaf.png");
    }
});

for (const configuredApi of ["http://127.0.0.1:8001", "http://localhost:8001", undefined, "https://api.example.com/"]) {
    test(`production keeps existing routing and loopback protection: ${configuredApi}`, async (t) => {
        const fetch = t.mock.method(globalThis, "fetch", async () => Response.json(readyStatus));
        const service = await loadService({ DEV: false, PROD: true, VITE_KRISIVEDA_ML_API_URL: configuredApi });
        const expectedApi = configuredApi?.startsWith("https://api.example.com") ? "https://api.example.com" : hostedApi;
        await service.getDiseaseV2Status();
        await service.analyzeCropImage(image());
        await service.analyzeCropImage(image(), "v2");
        assert.deepEqual(fetch.mock.calls.map((call) => call.arguments[0]), [
            `${expectedApi}/disease/v2/status`,
            `${expectedApi}/disease/predict`,
            `${expectedApi}/disease/v2/predict`,
        ]);
    });
}

test("a stalled prediction returns an explicit timeout instead of loading forever", async (t) => {
    const service = await loadService();
    let aborted = false;
    t.mock.method(
        globalThis,
        "fetch",
        (url, options = {}) =>
            new Promise((_, reject) => {
                options.signal?.addEventListener("abort", () => {
                    aborted = true;
                    reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
                });
            }),
    );
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const pending = service.analyzeCropImage(image(), "v2");
    t.mock.timers.tick(20000);
    assert.deepEqual(await pending, { status: "error", reason: "timeout" });
    assert.equal(aborted, true);
});

test("image safety checks reject missing, unsupported, and oversized uploads without a request", async (t) => {
    const fetch = t.mock.method(globalThis, "fetch");
    const service = await loadService();
    assert.deepEqual(await service.analyzeCropImage(null, "v2"), { status: "error", reason: "no-image" });
    assert.deepEqual(await service.analyzeCropImage(new File(["text"], "leaf.txt"), "v2"), { status: "error", reason: "unsupported-file-type" });
    assert.deepEqual(await service.analyzeCropImage({ type: "image/png", size: 10 * 1024 * 1024 + 1 }, "v2"), { status: "error", reason: "file-too-large" });
    assert.equal(fetch.mock.callCount(), 0);
});
