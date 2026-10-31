import { validateCropImageFile } from "./cropAnalysisService.js";
import { preprocessBrowserImage } from "./browserDiseasePreprocess.js";

const VERSION = "rice-disease-warmstart-v1";
const BASE = `${import.meta.env.BASE_URL}models/${VERSION}/`;
const MODEL = "rice_disease_15class.onnx";
const MODEL_BYTES = 6142549;
const MODEL_HASH =
    "5593156d6da4c35132248e1aafcce6b8294e8cdf66f4255ca91db5d95c8fa12a";
const SIDECARS = [
    "model_metadata.json",
    "class_mapping.json",
    "onnx_parity.json",
];
const INPUT_SHAPE = [1, 3, 224, 224];
const WARNING =
    "Development model: review this image label with an agricultural expert. It is not a confirmed diagnosis.";
const INFO = {
    model_version: VERSION,
    classes_total: 15,
    threshold: 0.6,
    production: false,
    runtime: "onnxruntime-web-wasm",
};
const CLASSES = [
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
const PREPROCESSING = {
    color_mode: "RGB",
    exif_transpose: true,
    resize: { short_edge: 256, interpolation: "bilinear" },
    center_crop: 224,
    scale: "pixel / 255.0",
    normalization: {
        mean: [0.485, 0.456, 0.406],
        std: [0.229, 0.224, 0.225],
        channel_order: "RGB",
    },
    layout: "NCHW",
    dtype: "float32",
    batch: "dynamic",
};
let bundlePromise;
let sessionPromise;
let runQueue = Promise.resolve();

function fail(reason, message) {
    throw Object.assign(new Error(message), { reason });
}
function failure(error) {
    return {
        ...INFO,
        status: "error",
        reason: error?.reason || "browser-model-unavailable",
        confidence: 0,
        class_id: null,
        disease: null,
        display_name: null,
        category: null,
        top_predictions: [],
        message: `${error?.reason ? error.message : "Browser analysis is unavailable. Please retry."} ${WARNING}`,
    };
}
function same(a, b) {
    return (
        a === b ||
        (a !== null &&
            b !== null &&
            typeof a === "object" &&
            typeof b === "object" &&
            Array.isArray(a) === Array.isArray(b) &&
            Object.keys(a).length === Object.keys(b).length &&
            Object.keys(a).every(
                (key) => Object.hasOwn(b, key) && same(a[key], b[key]),
            ))
    );
}
async function sha256(bytes) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
    ).join("");
}
async function request(name, method = "GET") {
    let response;
    try {
        response = await fetch(`${BASE}${name}`, {
            method,
            headers: {
                Accept: name.endsWith(".json")
                    ? "application/json"
                    : "application/octet-stream",
            },
        });
    } catch {
        fail(
            "browser-model-unavailable",
            "Browser model files could not be reached. Please retry.",
        );
    }
    if (!response.ok)
        fail(
            "browser-model-missing",
            `Browser model asset ${name} is unavailable.`,
        );
    if (/html/i.test(response.headers.get("content-type") || ""))
        fail(
            "browser-model-integrity",
            "A model URL returned a web page instead of a model asset.",
        );
    return response;
}
async function verifiedBytes(name, entry) {
    const bytes = new Uint8Array(await (await request(name)).arrayBuffer());
    const prefix = new TextDecoder().decode(bytes.subarray(0, 128));
    if (
        /^\s*(?:<|version https:\/\/git-lfs\.github\.com\/spec\/v1)/i.test(
            prefix,
        ) ||
        bytes.byteLength !== entry.bytes ||
        (await sha256(bytes)) !== entry.sha256
    ) {
        fail(
            "browser-model-integrity",
            `Browser model asset ${name} failed its size or SHA-256 check.`,
        );
    }
    return bytes;
}
function validateManifest(manifest) {
    if (
        manifest?.schema_version !== 1 ||
        manifest.model_version !== VERSION ||
        manifest.num_classes !== 15 ||
        manifest.confidence_threshold !== 0.6 ||
        !same(
            Object.keys(manifest.files || {}).sort(),
            [...SIDECARS, MODEL].sort(),
        ) ||
        Object.values(manifest.files).some(
            (f) =>
                !Number.isSafeInteger(f?.bytes) ||
                f.bytes <= 0 ||
                !/^[a-f0-9]{64}$/.test(f.sha256),
        ) ||
        SIDECARS.some((name) => manifest.files[name].bytes > 262144) ||
        manifest.files[MODEL].bytes !== MODEL_BYTES ||
        manifest.files[MODEL].sha256 !== MODEL_HASH
    ) {
        fail(
            "browser-model-contract",
            "The browser model manifest does not match the pinned warmstart model.",
        );
    }
}
function validateBundle(manifest, metadata, mapping, parity) {
    const onnx = metadata?.onnx;
    if (
        metadata?.model_version !== VERSION ||
        metadata.num_classes !== 15 ||
        metadata.architecture !== "mobilenet_v3_small" ||
        !same(
            metadata.class_order,
            CLASSES.map(([id]) => id),
        ) ||
        !same(metadata.preprocessing, PREPROCESSING) ||
        onnx?.sha256 !== MODEL_HASH ||
        onnx.bytes !== manifest.files[MODEL].bytes ||
        onnx.opset !== 17 ||
        onnx.input_name !== "images" ||
        onnx.output_name !== "logits" ||
        onnx.input_type !== "tensor(float)" ||
        onnx.output_type !== "tensor(float)" ||
        !same(onnx.input_shape, ["batch", 3, 224, 224]) ||
        !same(onnx.output_shape, ["batch", 15])
    ) {
        fail(
            "browser-model-contract",
            "Browser model metadata or preprocessing is incompatible.",
        );
    }
    if (
        mapping?.model_version !== VERSION ||
        mapping.num_classes !== 15 ||
        mapping.order_is_model_output_order !== true ||
        !Array.isArray(mapping.classes) ||
        mapping.classes.length !== 15 ||
        Object.keys(metadata.class_display_names || {}).length !== 15 ||
        Object.keys(metadata.class_categories || {}).length !== 15 ||
        !mapping.classes.every(
            (c, i) =>
                c?.class_id === CLASSES[i][0] &&
                c.display_name === CLASSES[i][1] &&
                c.category === CLASSES[i][2] &&
                metadata.class_display_names[c.class_id] === c.display_name &&
                metadata.class_categories[c.class_id] === c.category &&
                typeof c.notes === "string" &&
                c.needs_review ===
                    ["downy_mildew", "leaf_smut"].includes(c.class_id),
        )
    ) {
        fail(
            "browser-model-contract",
            "Browser model labels do not match the fixed 15-class taxonomy.",
        );
    }
    if (
        !same(parity, metadata.parity) ||
        parity?.all_within_atol !== true ||
        !Number.isSafeInteger(parity.samples) ||
        parity.samples <= 0 ||
        parity.preprocessing_identical !== true ||
        !Number.isFinite(parity.atol) ||
        parity.atol <= 0 ||
        !Number.isFinite(parity.max_abs_logit_difference) ||
        parity.max_abs_logit_difference < 0 ||
        parity.max_abs_logit_difference > parity.atol ||
        parity.predicted_class_agreement !== 1 ||
        !same(parity.input_signature, {
            name: onnx.input_name,
            shape: onnx.input_shape,
            type: onnx.input_type,
        }) ||
        !same(parity.output_signature, {
            name: onnx.output_name,
            shape: onnx.output_shape,
            type: onnx.output_type,
        })
    ) {
        fail(
            "browser-model-contract",
            "The original PyTorch/ONNX CPU parity evidence is missing or inconsistent.",
        );
    }
}
function loadBundle() {
    bundlePromise ||= (async () => {
        if (!globalThis.crypto?.subtle)
            fail(
                "browser-crypto-unavailable",
                "Secure SHA-256 verification is unavailable in this browser.",
            );
        let manifest;
        try {
            manifest = await (await request("manifest.json")).json();
        } catch (error) {
            if (error.reason) throw error;
            fail(
                "browser-model-contract",
                "The browser model manifest is not valid JSON.",
            );
        }
        validateManifest(manifest);
        const [metadata, mapping, parity] = await Promise.all(
            SIDECARS.map(async (name) => {
                const bytes = await verifiedBytes(name, manifest.files[name]);
                try {
                    return JSON.parse(
                        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
                    );
                } catch {
                    fail(
                        "browser-model-contract",
                        `Browser model asset ${name} is not valid JSON.`,
                    );
                }
            }),
        );
        validateBundle(manifest, metadata, mapping, parity);
        const head = await request(MODEL, "HEAD");
        const length = head.headers.get("content-length");
        if (!/^\d+$/.test(length || "") || Number(length) !== MODEL_BYTES) {
            fail(
                "browser-model-integrity",
                "The browser model HEAD response has a missing or incorrect file size.",
            );
        }
        return { manifest, metadata, classes: mapping.classes };
    })().catch((error) => {
        bundlePromise = undefined;
        throw error;
    });
    return bundlePromise;
}

export async function getBrowserDiseaseStatus() {
    try {
        await loadBundle();
        // Asset readiness only: neither WASM nor model weights have been loaded.
        return {
            ...INFO,
            available: true,
            classes: 15,
            status: "ready",
            reason: null,
            message: WARNING,
        };
    } catch (error) {
        const result = failure(error);
        return {
            ...result,
            available: false,
            classes: 0,
            status: "unavailable",
        };
    }
}
function loadSession() {
    sessionPromise ||= (async () => {
        const bundle = await loadBundle();
        const bytes = await verifiedBytes(MODEL, bundle.manifest.files[MODEL]);
        // Keep the weight pin independent of the fetched manifest.
        if ((await sha256(bytes)) !== MODEL_HASH)
            fail(
                "browser-model-integrity",
                "The ONNX weights do not match the pinned source hash.",
            );
        try {
            const [ort, wasm, mjs] = await Promise.all([
                import("onnxruntime-web/wasm"),
                import("onnxruntime-web/ort-wasm-simd-threaded.wasm?url"),
                import("onnxruntime-web/ort-wasm-simd-threaded.mjs?url"),
            ]);
            ort.env.wasm.numThreads = 1;
            ort.env.wasm.proxy = false;
            ort.env.wasm.wasmPaths = { wasm: wasm.default, mjs: mjs.default };
            const session = await ort.InferenceSession.create(bytes, {
                executionProviders: ["wasm"],
            });
            if (
                !same(session.inputNames, ["images"]) ||
                !same(session.outputNames, ["logits"])
            ) {
                await session.release?.();
                fail(
                    "browser-model-contract",
                    "The loaded ONNX session has unexpected input/output names.",
                );
            }
            return { ort, session, bundle };
        } catch (error) {
            if (error.reason) throw error;
            fail(
                "browser-runtime-unavailable",
                "The local WASM runtime could not start. Please retry.",
            );
        }
    })().catch((error) => {
        sessionPromise = undefined;
        throw error;
    });
    return sessionPromise;
}
function finiteFloat32(data, length) {
    return (
        data instanceof Float32Array &&
        data.length === length &&
        data.every(Number.isFinite)
    );
}
function roundConfidence(value) {
    // Exact binary ties at four decimal places are multiples of 1/32.
    const scaled = value * 10000;
    if (Number.isInteger(value * 32) && scaled % 1 === 0.5) {
        const lower = Math.floor(scaled);
        return (lower + (lower % 2)) / 10000;
    }
    return Number(value.toFixed(4));
}
function prediction(logits, classes) {
    const maximum = Math.max(...logits);
    const weights = Array.from(logits, (value) => Math.exp(value - maximum));
    const total = weights.reduce((sum, value) => sum + value, 0);
    const ranked = weights
        .map((_, i) => i)
        .sort((a, b) => weights[b] - weights[a] || b - a);
    const top_predictions = ranked.slice(0, 3).map((i) => {
        const c = classes[i];
        return {
            class_id: c.class_id,
            disease: c.display_name,
            display_name: c.display_name,
            category: c.category,
            confidence: roundConfidence(weights[i] / total),
            needs_review: c.needs_review,
            warning: c.needs_review ? c.notes : null,
        };
    });
    const best = top_predictions[0];
    // Deliberately gate the rounded response confidence, matching backend V2.
    const accepted = best.confidence >= 0.6;
    return {
        ...INFO,
        status: accepted ? "ok" : "uncertain",
        confidence: best.confidence,
        class_id: accepted ? best.class_id : null,
        disease: accepted ? best.disease : null,
        display_name: accepted ? best.display_name : null,
        category: accepted ? best.category : null,
        top_predictions,
        needs_review: best.needs_review,
        warning: best.warning,
        logits: Array.from(logits),
        message: `${accepted ? "Image classification only." : "The result is uncertain. Please try a clearer rice photo."} ${WARNING}${best.warning ? ` ${best.warning}` : ""}`,
    };
}

export async function runBrowserDiseaseTensor(data) {
    try {
        if (!finiteFloat32(data, 150528))
            fail(
                "invalid-tensor",
                "Expected 150528 finite float32 values in RGB NCHW order.",
            );
        const input = new Float32Array(data);
        const { ort, session, bundle } = await loadSession();
        const task = runQueue.then(async () => {
            let outputs;
            try {
                outputs = await session.run({
                    images: new ort.Tensor("float32", input, INPUT_SHAPE),
                });
            } catch {
                fail(
                    "browser-runtime-unavailable",
                    "Browser inference failed. Please retry.",
                );
            }
            const output = outputs?.logits;
            if (
                output?.type !== "float32" ||
                !same(output.dims, [1, 15]) ||
                !finiteFloat32(output.data, 15)
            ) {
                fail(
                    "browser-model-output",
                    "The browser model returned invalid logits or an unexpected output shape.",
                );
            }
            return prediction(output.data, bundle.classes);
        });
        // Serialize shared-session runs without poisoning the queue after failure.
        runQueue = task.catch(() => {});
        return await task;
    } catch (error) {
        return failure(error);
    }
}

export async function analyzeBrowserCropImage(file) {
    try {
        const invalid = validateCropImageFile(file);
        if (invalid)
            fail(
                invalid,
                "Choose a JPG, PNG or WEBP rice photo of at most 10 MiB.",
            );
        if (!file.size) fail("invalid-image", "The selected image is empty.");
        const { metadata } = await loadBundle();
        let tensor;
        try {
            tensor = await preprocessBrowserImage(file, metadata.preprocessing);
        } catch {
            fail(
                "invalid-image",
                "The image could not be decoded. Choose a clear rice photo of at least 32 x 32 pixels.",
            );
        }
        return await runBrowserDiseaseTensor(tensor);
    } catch (error) {
        return failure(error);
    }
}
