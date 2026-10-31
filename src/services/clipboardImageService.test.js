import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const toModuleUrl = (source) =>
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const cropSource = await readFile(
    new URL("./cropAnalysisService.js", import.meta.url),
    "utf8",
);
const cropModule = toModuleUrl(
    cropSource.replaceAll(
        "import.meta.env",
        JSON.stringify({
            DEV: true,
            PROD: false,
            BASE_URL: "/Agri_Dr/",
        }),
    ),
);
const clipboardSource = await readFile(
    new URL("./clipboardImageService.js", import.meta.url),
    "utf8",
);
const service = await import(
    toModuleUrl(clipboardSource.replace("./cropAnalysisService", cropModule))
);
const { prepareClipboardImage, readClipboardImage, getPastedImage } = service;
const image = (type = "image/png", contents = "image bytes") =>
    new File([contents], "leaf.png", { type });

const savedGlobals = new WeakMap();
function globalValue(t, name, value) {
    if (!savedGlobals.has(t)) {
        const originals = new Map();
        savedGlobals.set(t, originals);
        t.after(() => {
            for (const [key, descriptor] of originals) {
                if (descriptor)
                    Object.defineProperty(globalThis, key, descriptor);
                else delete globalThis[key];
            }
        });
    }
    const originals = savedGlobals.get(t);
    if (!originals.has(name))
        originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value,
    });
}

function bitmapDecoder(t, { width = 100, height = 200, fails = false } = {}) {
    const close = t.mock.fn();
    const decode = t.mock.fn(async () => {
        if (fails) throw new Error("Undecodable image");
        return { width, height, close };
    });
    globalValue(t, "createImageBitmap", decode);
    return { decode, close };
}

function clipboard(t, items, errorName) {
    const read = t.mock.fn(async () => {
        if (errorName)
            throw new DOMException("Clipboard read failed", errorName);
        return items;
    });
    globalValue(t, "navigator", { clipboard: { read } });
    globalValue(t, "isSecureContext", true);
    return read;
}

test("accepted clipboard images reuse the upload validation and release decoded bitmap memory", async (t) => {
    const { decode, close } = bitmapDecoder(t);
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
        const file = image(type);
        assert.deepEqual(await prepareClipboardImage(file), { file });
    }
    assert.equal(decode.mock.callCount(), 3);
    assert.equal(close.mock.callCount(), 3);
});

test("invalid type, oversized, empty, and missing files fail before decoding", async (t) => {
    const { decode } = bitmapDecoder(t);
    for (const [file, reason] of [
        [null, "no-image"],
        [image("image/gif"), "unsupported-file-type"],
        [{ type: "image/png", size: 10 * 1024 * 1024 + 1 }, "file-too-large"],
        [image("image/png", ""), "invalid-image"],
    ]) {
        assert.deepEqual(await prepareClipboardImage(file), { reason });
    }
    assert.equal(decode.mock.callCount(), 0);
});

for (const dimensions of [{ fails: true }, { width: 0 }, { height: 0 }]) {
    test(`corrupt/zero-dimension bitmap is rejected: ${JSON.stringify(dimensions)}`, async (t) => {
        const { close } = bitmapDecoder(t, dimensions);
        assert.deepEqual(await prepareClipboardImage(image()), {
            reason: "invalid-image",
        });
        assert.equal(close.mock.callCount(), dimensions.fails ? 0 : 1);
    });
}

for (const valid of [true, false]) {
    test(`Image fallback revokes its temporary object URL on ${valid ? "success" : "failure"}`, async (t) => {
        globalValue(t, "createImageBitmap", undefined);
        globalValue(
            t,
            "Image",
            class {
                naturalWidth = 100;
                naturalHeight = 200;
                set src(value) {
                    assert.equal(value, "blob:decoder-test");
                    queueMicrotask(() =>
                        valid ? this.onload() : this.onerror(),
                    );
                }
            },
        );
        const create = t.mock.method(
            URL,
            "createObjectURL",
            () => "blob:decoder-test",
        );
        const revoke = t.mock.method(URL, "revokeObjectURL", () => {});
        const file = image();
        assert.deepEqual(
            await prepareClipboardImage(file),
            valid ? { file } : { reason: "invalid-image" },
        );
        assert.equal(create.mock.calls[0].arguments[0], file);
        assert.equal(revoke.mock.callCount(), 1);
        assert.equal(revoke.mock.calls[0].arguments[0], "blob:decoder-test");
    });
}

test("ClipboardItem blobs become correctly named File objects and non-image items are skipped", async (t) => {
    bitmapDecoder(t);
    for (const [type, extension] of [
        ["image/png", "png"],
        ["image/jpeg", "jpg"],
        ["image/webp", "webp"],
    ]) {
        const blob = new Blob(["image bytes"], { type });
        const getType = t.mock.fn(async () => blob);
        clipboard(t, [{ types: ["text/plain"] }, { types: [type], getType }]);
        const { file } = await readClipboardImage();
        assert.ok(file instanceof File);
        assert.equal(file.type, type);
        assert.equal(file.name, `clipboard-image.${extension}`);
        assert.equal(await file.text(), "image bytes");
        assert.deepEqual(getType.mock.calls[0].arguments, [type]);
    }
});

test("text/empty clipboard and unsupported image types return actionable reasons", async (t) => {
    for (const [items, reason] of [
        [[], "clipboard-empty"],
        [[{ types: ["text/plain", "text/html"] }], "clipboard-empty"],
        [[{ types: ["image/gif"] }], "unsupported-file-type"],
    ]) {
        clipboard(t, items);
        assert.deepEqual(await readClipboardImage(), { reason });
    }
});

for (const [errorName, reason] of [
    ["NotAllowedError", "clipboard-denied"],
    ["SecurityError", "clipboard-denied"],
    ["NotReadableError", "clipboard-read-failed"],
]) {
    test(`clipboard ${errorName} fails gracefully`, async (t) => {
        clipboard(t, [], errorName);
        assert.deepEqual(await readClipboardImage(), { reason });
    });
}

test("insecure context and unavailable Clipboard API do not attempt reads", async (t) => {
    const read = clipboard(t, []);
    globalValue(t, "isSecureContext", false);
    assert.deepEqual(await readClipboardImage(), {
        reason: "clipboard-unavailable",
    });
    assert.equal(read.mock.callCount(), 0);
    globalValue(t, "isSecureContext", true);
    for (const value of [
        undefined,
        {},
        { clipboard: {} },
        { clipboard: { read: true } },
    ]) {
        globalValue(t, "navigator", value);
        assert.deepEqual(await readClipboardImage(), {
            reason: "clipboard-unavailable",
        });
    }
});

test("keyboard paste prefers supported image items and falls back to files", () => {
    const png = image();
    const gif = image("image/gif");
    const item = (file) => ({
        kind: "file",
        type: file.type,
        getAsFile: () => file,
    });
    assert.equal(getPastedImage({ items: [item(gif), item(png)] }), png);
    assert.equal(getPastedImage({ files: [gif, png] }), png);
    assert.equal(getPastedImage({ items: [item(gif)] }), gif);
    assert.equal(
        getPastedImage({ items: [{ kind: "string", type: "text/plain" }] }),
        null,
    );
    assert.equal(getPastedImage(null), null);
});

test("keyboard paste preserves the advertised type when the browser File type is missing", async () => {
    const file = image("", "png bytes");
    const result = getPastedImage({
        items: [{ kind: "file", type: "image/png", getAsFile: () => file }],
    });
    assert.ok(result instanceof File);
    assert.equal(result.type, "image/png");
    assert.equal(await result.text(), "png bytes");
});
