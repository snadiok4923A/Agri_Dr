import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const VERSION = "rice-disease-warmstart-v1";
const BASE = `/Agri_Dr/models/${VERSION}/`;
const MODEL = "rice_disease_15class.onnx";
const names = [
    "manifest.json",
    "model_metadata.json",
    "class_mapping.json",
    "onnx_parity.json",
    MODEL,
];
const originals = new Map(
    await Promise.all(
        names.map(async (name) => [
            name,
            await readFile(
                new URL(
                    `../../public/models/${VERSION}/${name}`,
                    import.meta.url,
                ),
            ),
        ]),
    ),
);
const source = await readFile(
    new URL("./browserDiseaseService.js", import.meta.url),
    "utf8",
);
const validatorSource = await readFile(
    new URL("./cropAnalysisService.js", import.meta.url),
    "utf8",
);
const env = { BASE_URL: "/Agri_Dr/", DEV: false, PROD: true };
const moduleUrl = (code) =>
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const validatorUrl = moduleUrl(
    validatorSource.replaceAll("import.meta.env", JSON.stringify(env)),
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const tensor = () => new Float32Array(150528);
const file = () =>
    new File(["local image bytes"], "leaf.png", { type: "image/png" });
let id = 0;

async function harness(t) {
    const files = new Map(originals);
    const state = {
        runtimeImports: 0,
        env: { wasm: {} },
        createCalls: [],
        runCalls: [],
        preprocessCalls: [],
        releases: 0,
        activeRuns: 0,
        maxActiveRuns: 0,
        inputNames: ["images"],
        outputNames: ["logits"],
        createFailures: 0,
        runFailures: 0,
        decodeFailure: false,
        missing: new Set(),
        headType: "application/octet-stream",
        headLength: String(originals.get(MODEL).length),
        modelType: "application/octet-stream",
        output: {
            type: "float32",
            dims: [1, 15],
            data: Float32Array.from({ length: 15 }, (_, i) =>
                i === 9 ? 5 : 0,
            ),
        },
    };
    const key = `__browserDiseaseServiceTest${++id}`;
    globalThis[key] = state;
    t.after(() => {
        delete globalThis[key];
    });
    const runtimeUrl = moduleUrl(`
        const state = globalThis[${JSON.stringify(key)}];
        state.runtimeImports++;
        export const env = state.env;
        export class Tensor {
            constructor(type, data, dims) { this.type = type; this.data = data; this.dims = dims; }
        }
        export const InferenceSession = { create: async (bytes, options) => {
            state.createCalls.push({ bytes, options });
            if (state.createFailures > 0) { state.createFailures--; throw new Error('WASM unavailable'); }
            return {
                inputNames: state.inputNames, outputNames: state.outputNames,
                run: async (feeds) => {
                    state.runCalls.push(feeds);
                    state.activeRuns++;
                    state.maxActiveRuns = Math.max(state.maxActiveRuns, state.activeRuns);
                    try {
                        await Promise.resolve();
                        if (state.runFailures > 0) { state.runFailures--; throw new Error('Run failed'); }
                        return { logits: state.output };
                    } finally { state.activeRuns--; }
                },
                release: async () => { state.releases++; },
            };
        }};
    `);
    const preprocessUrl = moduleUrl(`
        const state = globalThis[${JSON.stringify(key)}];
        export async function preprocessBrowserImage(file, preprocessing) {
            state.preprocessCalls.push([file, preprocessing]);
            if (state.decodeFailure) throw new Error('Invalid encoded image');
            return new Float32Array(150528);
        }
    `);
    const replacements = [
        ["./cropAnalysisService.js", validatorUrl],
        ["./browserDiseasePreprocess.js", preprocessUrl],
        ["onnxruntime-web/wasm", runtimeUrl],
        [
            "onnxruntime-web/ort-wasm-simd-threaded.wasm?url",
            moduleUrl('export default "/Agri_Dr/assets/ort-test.wasm";'),
        ],
        [
            "onnxruntime-web/ort-wasm-simd-threaded.mjs?url",
            moduleUrl('export default "/Agri_Dr/assets/ort-test.mjs";'),
        ],
    ];
    let code = source.replaceAll("import.meta.env", JSON.stringify(env));
    for (const [specifier, url] of replacements)
        code = code.replaceAll(JSON.stringify(specifier), JSON.stringify(url));
    const service = await import(`${moduleUrl(code)}#${id}`);
    const fetch = t.mock.method(
        globalThis,
        "fetch",
        async (url, options = {}) => {
            assert.ok(
                url.startsWith(BASE),
                `Unexpected external or wrong-base request: ${url}`,
            );
            const name = url.slice(BASE.length);
            assert.ok(names.includes(name));
            if (state.missing.has(name))
                return new Response(null, { status: 404 });
            if (options.method === "HEAD") {
                assert.equal(name, MODEL);
                const headers = { "Content-Type": state.headType };
                if (state.headLength !== null)
                    headers["Content-Length"] = state.headLength;
                return new Response(null, { headers });
            }
            return new Response(files.get(name), {
                headers: {
                    "Content-Type":
                        name === MODEL ? state.modelType : "application/json",
                },
            });
        },
    );
    const json = (name) => JSON.parse(files.get(name).toString("utf8"));
    function write(name, bytes, rehash = true) {
        files.set(name, Buffer.from(bytes));
        if (name !== "manifest.json" && rehash) {
            const manifest = json("manifest.json");
            manifest.files[name] = {
                bytes: files.get(name).length,
                sha256: hash(files.get(name)),
            };
            files.set("manifest.json", Buffer.from(JSON.stringify(manifest)));
        }
    }
    function patch(name, change) {
        const value = json(name);
        change(value);
        write(name, JSON.stringify(value));
    }
    return { service, state, files, fetch, json, write, patch };
}

function assertError(result, reason) {
    assert.equal(result.status, "error");
    assert.equal(result.reason, reason);
    assert.equal(result.production, false);
    assert.equal(result.runtime, "onnxruntime-web-wasm");
    assert.match(result.message, /development model/i);
    assert.equal(result.disease, null);
}

test("status validates actual sidecars and HEAD once without loading weights or runtime", async (t) => {
    const { service, state, fetch } = await harness(t);
    const status = await service.getBrowserDiseaseStatus();
    assert.equal(status.available, true);
    assert.equal(status.classes, 15);
    assert.equal(status.model_version, VERSION);
    assert.equal(status.status, "ready");
    assert.equal(status.reason, null);
    assert.equal(status.production, false);
    assert.equal(state.runtimeImports, 0);
    assert.equal(state.createCalls.length, 0);
    assert.equal(fetch.mock.callCount(), 5);
    assert.deepEqual(
        fetch.mock.calls
            .filter((c) => c.arguments[0].endsWith(MODEL))
            .map((c) => c.arguments[1].method),
        ["HEAD"],
    );
    assert.deepEqual(await service.getBrowserDiseaseStatus(), status);
    assert.equal(fetch.mock.callCount(), 5);
});

for (const name of names) {
    test(`missing ${name} fails closed and failed bundle initialization can retry`, async (t) => {
        const { service, state } = await harness(t);
        state.missing.add(name);
        const failed = await service.getBrowserDiseaseStatus();
        assert.equal(failed.available, false);
        assert.equal(failed.classes, 0);
        assert.equal(failed.status, "unavailable");
        assert.equal(failed.reason, "browser-model-missing");
        state.missing.delete(name);
        assert.equal((await service.getBrowserDiseaseStatus()).available, true);
        assert.equal(state.runtimeImports, 0);
    });
}

for (const [label, change] of [
    [
        "schema",
        (m) => {
            m.schema_version = 2;
        },
    ],
    [
        "version",
        (m) => {
            m.model_version = "another-model";
        },
    ],
    [
        "class count",
        (m) => {
            m.num_classes = 6;
        },
    ],
    [
        "threshold",
        (m) => {
            m.confidence_threshold = 0.5;
        },
    ],
    [
        "missing file entry",
        (m) => {
            delete m.files["class_mapping.json"];
        },
    ],
    [
        "weight hash pin",
        (m) => {
            m.files[MODEL].sha256 = "0".repeat(64);
        },
    ],
    [
        "weight byte pin",
        (m) => {
            m.files[MODEL].bytes++;
        },
    ],
]) {
    test(`manifest rejects wrong ${label}`, async (t) => {
        const { service, patch, state } = await harness(t);
        patch("manifest.json", change);
        const result = await service.getBrowserDiseaseStatus();
        assert.equal(result.available, false);
        assert.equal(result.reason, "browser-model-contract");
        assert.equal(state.runtimeImports, 0);
    });
}

for (const name of [
    "model_metadata.json",
    "class_mapping.json",
    "onnx_parity.json",
]) {
    test(`${name} must match its manifest SHA-256, not just byte length`, async (t) => {
        const { service, files, write } = await harness(t);
        const bytes = Buffer.from(files.get(name));
        bytes[bytes.length - 2] ^= 1;
        write(name, bytes, false);
        const result = await service.getBrowserDiseaseStatus();
        assert.equal(result.available, false);
        assert.equal(result.reason, "browser-model-integrity");
    });
}

for (const [label, name, change] of [
    [
        "model version",
        "model_metadata.json",
        (m) => {
            m.model_version = "v2";
        },
    ],
    [
        "class order",
        "model_metadata.json",
        (m) => {
            m.class_order.reverse();
        },
    ],
    [
        "display label",
        "class_mapping.json",
        (m) => {
            m.classes[0].display_name = "Wrong label";
        },
    ],
    [
        "category",
        "model_metadata.json",
        (m) => {
            m.class_categories.hispa = "disease";
        },
    ],
    [
        "review flag",
        "class_mapping.json",
        (m) => {
            m.classes[6].needs_review = false;
        },
    ],
    [
        "input name",
        "model_metadata.json",
        (m) => {
            m.onnx.input_name = "input";
        },
    ],
    [
        "input shape",
        "model_metadata.json",
        (m) => {
            m.onnx.input_shape = ["batch", 224, 224, 3];
        },
    ],
    [
        "output shape",
        "model_metadata.json",
        (m) => {
            m.onnx.output_shape = ["batch", 6];
        },
    ],
    [
        "dtype",
        "model_metadata.json",
        (m) => {
            m.onnx.output_type = "tensor(double)";
        },
    ],
    [
        "normalization",
        "model_metadata.json",
        (m) => {
            m.preprocessing.normalization.std[0] = 1;
        },
    ],
    [
        "parity mismatch",
        "onnx_parity.json",
        (m) => {
            m.samples++;
        },
    ],
]) {
    test(`correctly hashed but incompatible ${label} is rejected`, async (t) => {
        const { service, patch } = await harness(t);
        patch(name, change);
        const result = await service.getBrowserDiseaseStatus();
        assert.equal(result.available, false);
        assert.equal(result.reason, "browser-model-contract");
    });
}

for (const change of [
    (p) => {
        p.samples = 0;
    },
    (p) => {
        p.all_within_atol = false;
    },
]) {
    test(`even matching metadata/parity requires a nonempty passing CPU check: ${change}`, async (t) => {
        const { service, patch, json } = await harness(t);
        patch("onnx_parity.json", change);
        patch("model_metadata.json", (m) => {
            m.parity = json("onnx_parity.json");
        });
        assert.equal(
            (await service.getBrowserDiseaseStatus()).reason,
            "browser-model-contract",
        );
    });
}

test("JSON object key order does not change the meaning of embedded parity", async (t) => {
    const { service, patch } = await harness(t);
    patch("onnx_parity.json", (p) => {
        const entries = Object.entries(p).reverse();
        for (const key of Object.keys(p)) delete p[key];
        Object.assign(p, Object.fromEntries(entries));
    });
    assert.equal((await service.getBrowserDiseaseStatus()).available, true);
});

for (const [label, change] of [
    [
        "HTML",
        (s) => {
            s.headType = "text/html; charset=utf-8";
        },
    ],
    [
        "missing size",
        (s) => {
            s.headLength = null;
        },
    ],
    [
        "wrong size",
        (s) => {
            s.headLength = "128";
        },
    ],
]) {
    test(`ONNX HEAD rejects ${label} without downloading it`, async (t) => {
        const { service, state, fetch } = await harness(t);
        change(state);
        assert.equal(
            (await service.getBrowserDiseaseStatus()).reason,
            "browser-model-integrity",
        );
        assert.equal(state.runtimeImports, 0);
        assert.ok(
            !fetch.mock.calls.some(
                (c) =>
                    c.arguments[0].endsWith(MODEL) &&
                    c.arguments[1].method !== "HEAD",
            ),
        );
    });
}

test("invalid tensor inputs fail before any network or runtime work", async (t) => {
    const { service, fetch } = await harness(t);
    const nan = tensor();
    nan[4] = NaN;
    const infinite = tensor();
    infinite[0] = Infinity;
    for (const data of [
        null,
        [],
        new Float64Array(150528),
        new Float32Array(15),
        nan,
        infinite,
    ]) {
        assertError(
            await service.runBrowserDiseaseTensor(data),
            "invalid-tensor",
        );
    }
    assert.equal(fetch.mock.callCount(), 0);
});

test("verified weights create one shared single-thread local WASM session and expose plain logits", async (t) => {
    const { service, state, fetch } = await harness(t);
    const results = await Promise.all([
        service.runBrowserDiseaseTensor(tensor()),
        service.runBrowserDiseaseTensor(tensor()),
    ]);
    for (const result of results) {
        assert.equal(result.status, "ok");
        assert.equal(result.class_id, "leaf_blast");
        assert.equal(result.disease, "Leaf blast");
        assert.equal(result.category, "disease");
        assert.equal(result.model_version, VERSION);
        assert.equal(result.production, false);
        assert.equal(result.runtime, "onnxruntime-web-wasm");
        assert.equal(result.top_predictions.length, 3);
        assert.ok(Array.isArray(result.logits));
        assert.deepEqual(result.logits, Array.from(state.output.data));
    }
    assert.equal(state.runtimeImports, 1);
    assert.equal(state.createCalls.length, 1);
    assert.equal(state.maxActiveRuns, 1);
    assert.equal(
        hash(state.createCalls[0].bytes),
        JSON.parse(originals.get("manifest.json")).files[MODEL].sha256,
    );
    assert.deepEqual(state.createCalls[0].options, {
        executionProviders: ["wasm"],
    });
    assert.deepEqual(state.env.wasm, {
        numThreads: 1,
        proxy: false,
        wasmPaths: {
            wasm: "/Agri_Dr/assets/ort-test.wasm",
            mjs: "/Agri_Dr/assets/ort-test.mjs",
        },
    });
    assert.deepEqual(state.runCalls[0].images.dims, [1, 3, 224, 224]);
    assert.equal(state.runCalls[0].images.type, "float32");
    assert.ok(state.runCalls[0].images.data instanceof Float32Array);
    assert.equal(
        fetch.mock.calls.filter(
            (c) =>
                c.arguments[0].endsWith(MODEL) &&
                c.arguments[1].method === "GET",
        ).length,
        1,
    );
});

for (const corruption of ["changed weight byte", "HTML", "Git LFS pointer"]) {
    test(`prediction rejects ${corruption} before importing runtime or creating a session`, async (t) => {
        const { service, files, write, state } = await harness(t);
        if (corruption === "changed weight byte") {
            const bytes = Buffer.from(files.get(MODEL));
            bytes[bytes.length - 1] ^= 1;
            write(MODEL, bytes, false);
        } else if (corruption === "HTML") {
            state.modelType = "text/html";
            write(MODEL, "<!DOCTYPE html><html>Not found</html>", false);
        } else
            write(
                MODEL,
                "version https://git-lfs.github.com/spec/v1\noid sha256:123\nsize 6142549\n",
                false,
            );
        assertError(
            await service.runBrowserDiseaseTensor(tensor()),
            "browser-model-integrity",
        );
        assert.equal(state.runtimeImports, 0);
        assert.equal(state.createCalls.length, 0);
    });
}

test("failed session creation resets for retry rather than poisoning the cache", async (t) => {
    const { service, state } = await harness(t);
    state.createFailures = 1;
    assertError(
        await service.runBrowserDiseaseTensor(tensor()),
        "browser-runtime-unavailable",
    );
    assert.equal(
        (await service.runBrowserDiseaseTensor(tensor())).status,
        "ok",
    );
    assert.equal(state.createCalls.length, 2);
});

test("wrong session names release the session, fail closed, and allow retry", async (t) => {
    const { service, state } = await harness(t);
    state.outputNames = ["probabilities"];
    assertError(
        await service.runBrowserDiseaseTensor(tensor()),
        "browser-model-contract",
    );
    assert.equal(state.releases, 1);
    state.outputNames = ["logits"];
    assert.equal(
        (await service.runBrowserDiseaseTensor(tensor())).status,
        "ok",
    );
});

test("output names, shape, float32 type, count, and finite logits are enforced on every run", async (t) => {
    const { service, state } = await harness(t);
    const good = state.output;
    const nonfinite = new Float32Array(15);
    nonfinite[0] = Infinity;
    for (const output of [
        undefined,
        { ...good, type: "float64" },
        { ...good, dims: [15] },
        { ...good, dims: [2, 15] },
        { ...good, data: new Float32Array(14) },
        { ...good, data: new Float64Array(15) },
        { ...good, data: nonfinite },
    ]) {
        state.output = output;
        assertError(
            await service.runBrowserDiseaseTensor(tensor()),
            "browser-model-output",
        );
    }
    state.output = good;
    state.runFailures = 1;
    assertError(
        await service.runBrowserDiseaseTensor(tensor()),
        "browser-runtime-unavailable",
    );
    assert.equal(
        (await service.runBrowserDiseaseTensor(tensor())).status,
        "ok",
    );
});

test("stable softmax handles large logits and uncertainty nulls every primary label", async (t) => {
    const { service, state } = await harness(t);
    state.output.data = new Float32Array(15).fill(10000);
    const uncertain = await service.runBrowserDiseaseTensor(tensor());
    assert.equal(uncertain.status, "uncertain");
    assert.equal(uncertain.confidence, 0.0667);
    for (const key of ["class_id", "disease", "display_name", "category"])
        assert.equal(uncertain[key], null);
    assert.equal(uncertain.top_predictions.length, 3);
    state.output.data[4] = 20000;
    const certain = await service.runBrowserDiseaseTensor(tensor());
    assert.equal(certain.status, "ok");
    assert.equal(certain.confidence, 1);
    assert.equal(certain.class_id, "brown_spot");
});

test("confidence is rounded to four decimals BEFORE applying the backend V2 0.60 gate", async (t) => {
    const { service, state } = await harness(t);
    for (const [probability, expected, status] of [
        [0.59996, 0.6, "ok"],
        [0.59994, 0.5999, "uncertain"],
    ]) {
        state.output.data = new Float32Array(15);
        state.output.data[0] = Math.log((probability * 14) / (1 - probability));
        const result = await service.runBrowserDiseaseTensor(tensor());
        assert.equal(result.confidence, expected);
        assert.equal(result.status, status);
        assert.equal(result.threshold, 0.6);
    }
});

test("downy mildew and leaf smut retain canonical review flags, warnings, and development labeling", async (t) => {
    const { service, state, json } = await harness(t);
    for (const index of [6, 10]) {
        state.output.data = new Float32Array(15);
        state.output.data[index] = 5;
        const result = await service.runBrowserDiseaseTensor(tensor());
        assert.equal(result.needs_review, true);
        assert.equal(result.top_predictions[0].needs_review, true);
        assert.equal(
            result.warning,
            json("class_mapping.json").classes[index].notes,
        );
        assert.ok(result.message.includes(result.warning));
        assert.match(result.message, /development model/i);
        assert.ok(!Object.hasOwn(result, "recommendations"));
    }
});

test("file wrapper reuses shared validation and never requests assets for invalid files", async (t) => {
    const { service, fetch, state } = await harness(t);
    for (const [input, reason] of [
        [null, "no-image"],
        [
            new File(["x"], "x.svg", { type: "image/svg+xml" }),
            "unsupported-file-type",
        ],
        [{ type: "image/png", size: 10 * 1024 * 1024 + 1 }, "file-too-large"],
        [new File([], "x.png", { type: "image/png" }), "invalid-image"],
    ]) {
        assertError(await service.analyzeBrowserCropImage(input), reason);
    }
    assert.equal(fetch.mock.callCount(), 0);
    assert.equal(state.preprocessCalls.length, 0);
});

test("file wrapper supplies verified original preprocessing and returns friendly decoder errors", async (t) => {
    const { service, state, json } = await harness(t);
    const input = file();
    assert.equal((await service.analyzeBrowserCropImage(input)).status, "ok");
    assert.equal(state.preprocessCalls[0][0], input);
    assert.deepEqual(
        state.preprocessCalls[0][1],
        json("model_metadata.json").preprocessing,
    );
    state.decodeFailure = true;
    assertError(await service.analyzeBrowserCropImage(file()), "invalid-image");
    assert.equal(state.runCalls.length, 1);
});

test("missing secure SHA-256 support fails closed before fetching model assets", async (t) => {
    const { service, fetch } = await harness(t);
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: undefined,
    });
    t.after(() => Object.defineProperty(globalThis, "crypto", descriptor));
    const result = await service.getBrowserDiseaseStatus();
    assert.equal(result.available, false);
    assert.equal(result.reason, "browser-crypto-unavailable");
    assert.equal(fetch.mock.callCount(), 0);
});
