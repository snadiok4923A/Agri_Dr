import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BROWSER_MODEL_VERSION = "rice-disease-warmstart-v1";
export const BROWSER_MODEL_SHA256 =
    "5593156d6da4c35132248e1aafcce6b8294e8cdf66f4255ca91db5d95c8fa12a";
const modelPath = join("models", BROWSER_MODEL_VERSION);
const names = [
    "rice_disease_15class.onnx",
    "model_metadata.json",
    "class_mapping.json",
    "onnx_parity.json",
];
const expectedFiles = [...names, "manifest.json"].sort();
const sources = {
    "rice_disease_15class.onnx":
        "KRISIVEDA-ML/models/rice_disease_15class/rice-disease-warmstart-v1/rice_disease_15class.onnx",
    "model_metadata.json":
        "KRISIVEDA-ML/models/rice_disease_15class/rice-disease-warmstart-v1/model_metadata.json",
    "class_mapping.json":
        "KRISIVEDA-ML/models/rice_disease_warmstart_v1/class_mapping.json",
    "onnx_parity.json":
        "KRISIVEDA-ML/models/rice_disease_15class/rice-disease-warmstart-v1/onnx_parity.json",
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
// The browser verifier covers the canonical LF form of JSON sidecars, so a
// Windows CRLF checkout and the Git-normalized LF bytes on GitHub Pages
// validate against the same manifest. ONNX weights stay byte-exact.
const canonicalJson = (bytes) => {
    let crlf = 0;
    for (let i = 0; i < bytes.length - 1; i += 1)
        if (bytes[i] === 13 && bytes[i + 1] === 10) crlf += 1;
    if (!crlf) return bytes;
    const out = Buffer.allocUnsafe(bytes.length - crlf);
    for (let i = 0, j = 0; i < bytes.length; i += 1) {
        if (bytes[i] === 13 && bytes[i + 1] === 10) continue;
        out[j] = bytes[i];
        j += 1;
    }
    return out;
};

export function verifyBrowserModel(siteDirectory = "public") {
    const site = resolve(root, siteDirectory);
    const directory = join(site, modelPath);
    assert.deepEqual(
        readdirSync(join(site, "models")).sort(),
        [BROWSER_MODEL_VERSION],
        "Only the selected model belongs in the website",
    );
    assert.deepEqual(
        readdirSync(directory).sort(),
        expectedFiles,
        "Unexpected or missing browser model assets",
    );
    const manifest = json(join(directory, "manifest.json"));
    assert.equal(manifest.schema_version, 1);
    assert.equal(manifest.model_version, BROWSER_MODEL_VERSION);
    assert.equal(manifest.num_classes, 15);
    assert.equal(manifest.confidence_threshold, 0.6);
    assert.deepEqual(Object.keys(manifest.files).sort(), names.toSorted());
    assert.equal(
        manifest.files[names[0]].sha256,
        BROWSER_MODEL_SHA256,
        "The verified warmstart weights must not be replaced",
    );
    let total = 0;
    for (const name of names) {
        const raw = readFileSync(join(directory, name));
        const bytes = name.endsWith(".json") ? canonicalJson(raw) : raw;
        assert.equal(
            bytes.length,
            manifest.files[name].bytes,
            `${name}: size mismatch`,
        );
        assert.equal(
            sha256(bytes),
            manifest.files[name].sha256,
            `${name}: checksum mismatch`,
        );
        // Local training assets may be absent in a clean production checkout.
        const source = join(root, sources[name]);
        if (existsSync(source)) {
            const original = readFileSync(source);
            assert.equal(
                sha256(name.endsWith(".json") ? canonicalJson(original) : original),
                sha256(bytes),
                `${name}: production copy differs from its original`,
            );
        }
        total += raw.length;
    }
    const metadata = json(join(directory, "model_metadata.json"));
    const mapping = json(join(directory, "class_mapping.json"));
    const parity = json(join(directory, "onnx_parity.json"));
    assert.equal(metadata.model_version, BROWSER_MODEL_VERSION);
    assert.equal(metadata.num_classes, 15);
    assert.equal(metadata.onnx.sha256, BROWSER_MODEL_SHA256);
    assert.equal(metadata.onnx.bytes, manifest.files[names[0]].bytes);
    assert.equal(metadata.onnx.input_name, "images");
    assert.equal(metadata.onnx.output_name, "logits");
    assert.deepEqual(metadata.onnx.input_shape, ["batch", 3, 224, 224]);
    assert.deepEqual(metadata.onnx.output_shape, ["batch", 15]);
    assert.equal(mapping.num_classes, 15);
    assert.equal(mapping.order_is_model_output_order, true);
    assert.equal(new Set(metadata.class_order).size, 15);
    assert.deepEqual(
        mapping.classes.map((entry) => entry.class_id),
        metadata.class_order,
    );
    for (const entry of mapping.classes) {
        assert.equal(
            entry.display_name,
            metadata.class_display_names[entry.class_id],
        );
        assert.equal(entry.category, metadata.class_categories[entry.class_id]);
    }
    assert.deepEqual(parity, metadata.parity);
    assert.equal(parity.predicted_class_agreement, 1);
    assert.equal(parity.all_within_atol, true);
    assert.ok(parity.samples > 0);
    assert.ok(Number.isFinite(parity.max_abs_logit_difference));
    assert.ok(parity.max_abs_logit_difference <= parity.atol);
    // Vite copies public wholesale: ignoring a file alone does not keep it out.
    function checkTree(path) {
        for (const entry of readdirSync(path, { withFileTypes: true })) {
            const next = join(path, entry.name);
            assert.ok(
                !entry.isSymbolicLink(),
                `Do not publish linked training directories: ${next}`,
            );
            if (entry.isDirectory()) {
                assert.ok(
                    !/^(?:KRISIVEDA-ML|rice_disease_15class|datasets?|checkpoints?|reports|\.venv.*)$/i.test(
                        entry.name,
                    ),
                    `Training directory in website: ${next}`,
                );
                checkTree(next);
            } else {
                assert.ok(
                    !/\.(?:pt|pth|ckpt|pkl|pickle|joblib|safetensors|h5|keras|tflite)$/i.test(
                        entry.name,
                    ),
                    `Training/unused model artifact in website: ${next}`,
                );
                if (/\.onnx$/i.test(entry.name))
                    assert.equal(
                        next,
                        join(directory, names[0]),
                        "Unexpected ONNX model in website",
                    );
            }
        }
    }
    checkTree(site);
    console.log(
        `Verified ${siteDirectory}: ${BROWSER_MODEL_VERSION}, ${total.toLocaleString()} artifact bytes, original SHA-256 preserved`,
    );
    return { manifest, metadata, mapping, parity, total };
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    verifyBrowserModel(process.argv[2] || "public");
}
