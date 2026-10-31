import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
    preprocessBrowserImage,
    rgbaToModelTensor,
    resizeDimensions,
    roundTiesToEven,
} from "./browserDiseasePreprocess.js";

const preprocessing = {
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
const PLANE = 224 * 224;
const normalized = (value, channel) =>
    Math.fround(
        Math.fround(
            Math.fround(value / 255) -
                Math.fround(preprocessing.normalization.mean[channel]),
        ) / Math.fround(preprocessing.normalization.std[channel]),
    );
function rgba(width = 32, height = 32, color = [12, 128, 240, 255]) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) data.set(color, i);
    return { data, width, height };
}
function patterned(width, height, alpha) {
    const image = rgba(width, height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            image.data.set(
                [
                    (17 * x + 13 * y + 3) % 256,
                    (7 * x + 29 * y + 71) % 256,
                    (31 * x + 5 * y + 19) % 256,
                    alpha ? (11 * x + 23 * y + 37) % 256 : 255,
                ],
                (y * width + x) * 4,
            );
        }
    }
    return image;
}
function tensorHash(tensor) {
    const bytes = Buffer.allocUnsafe(tensor.byteLength);
    for (let i = 0; i < tensor.length; i++)
        bytes.writeFloatLE(tensor[i], i * 4);
    return createHash("sha256").update(bytes).digest("hex");
}

test("Python ties-even resizing preserves portrait/landscape aspect ratios", () => {
    assert.deepEqual(
        [0.5, 1.5, 2.5, 3.5, -1.5, -2.5].map(roundTiesToEven),
        [0, 2, 2, 4, -2, -2],
    );
    assert.deepEqual(resizeDimensions(513, 512), { width: 256, height: 256 });
    assert.deepEqual(resizeDimensions(512, 515), { width: 256, height: 258 });
    assert.deepEqual(resizeDimensions(32, 47), { width: 256, height: 376 });
    assert.deepEqual(resizeDimensions(47, 32), { width: 376, height: 256 });
    assert.throws(() => roundTiesToEven(Infinity), /finite/);
});

test("minimum 32x32 input yields contiguous float32 NCHW without mutating source pixels", () => {
    const image = rgba();
    const original = image.data.slice();
    const tensor = rgbaToModelTensor(image, preprocessing);
    assert.ok(tensor instanceof Float32Array);
    assert.equal(tensor.length, 3 * PLANE);
    assert.equal(tensor.byteOffset, 0);
    assert.equal(tensor.byteLength, tensor.buffer.byteLength);
    const expected = [
        -1.9124069213867188, 0.20518219470977783, 2.3785624504089355,
    ];
    for (let c = 0; c < 3; c++) {
        assert.ok(
            tensor
                .subarray(c * PLANE, (c + 1) * PLANE)
                .every((v) => v === expected[c]),
        );
    }
    assert.ok(tensor.every(Number.isFinite));
    assert.deepEqual(image.data, original);
});

test("transparency composites onto white and grayscale RGB remains three channels", () => {
    for (const [color, expected] of [
        [
            [3, 79, 122, 0],
            [255, 255, 255],
        ],
        [
            [255, 0, 0, 128],
            [255, 127, 127],
        ],
        [
            [128, 128, 128, 255],
            [128, 128, 128],
        ],
    ]) {
        const tensor = rgbaToModelTensor(rgba(32, 32, color), preprocessing);
        for (let c = 0; c < 3; c++) {
            assert.ok(
                tensor
                    .subarray(c * PLANE, (c + 1) * PLANE)
                    .every((v) => v === normalized(expected[c], c)),
            );
        }
    }
});

test("undersized/fractional dimensions, malformed RGBA, and unsupported/non-finite metadata fail", () => {
    for (const [width, height] of [
        [31, 32],
        [32, 31],
        [0, 32],
        [-1, 32],
        [32.5, 32],
        [NaN, 32],
    ]) {
        assert.throws(
            () =>
                rgbaToModelTensor(
                    { data: new Uint8Array(), width, height },
                    preprocessing,
                ),
            /32/,
        );
    }
    assert.throws(
        () =>
            rgbaToModelTensor(
                { data: new Uint8Array(3), width: 32, height: 32 },
                preprocessing,
            ),
        /RGBA/,
    );
    assert.throws(
        () =>
            rgbaToModelTensor(
                { data: new Float32Array(32 * 32 * 4), width: 32, height: 32 },
                preprocessing,
            ),
        /8-bit/,
    );
    for (const changes of [
        { layout: "NHWC" },
        { exif_transpose: false },
        { resize: { short_edge: 256, interpolation: "nearest" } },
        {
            normalization: {
                ...preprocessing.normalization,
                mean: [NaN, 0, 0],
            },
        },
        { normalization: { ...preprocessing.normalization, std: [0, 1, 1] } },
        {
            normalization: {
                ...preprocessing.normalization,
                std: [Infinity, 1, 1],
            },
        },
        {
            normalization: {
                ...preprocessing.normalization,
                std: [Number.MIN_VALUE, 1, 1],
            },
        },
    ]) {
        assert.throws(
            () => rgbaToModelTensor(rgba(), { ...preprocessing, ...changes }),
            /preprocessing|normalization/,
        );
    }
    assert.throws(
        () =>
            rgbaToModelTensor(rgba(), {
                ...preprocessing,
                normalization: {
                    ...preprocessing.normalization,
                    std: [1e-40, 1, 1],
                },
            }),
        /finite/,
    );
});

// Generated read-only with Pillow 12.3.0 + NumPy: RGBA alpha_composite over white,
// RGB.resize(BILINEAR), Python-rounded short edge 256, floor-center crop 224,
// float32 /255, ImageNet normalize, CHW; SHA-256 covers every little-endian float.
for (const [width, height, alpha, hash] of [
    [
        32,
        33,
        true,
        "087dc721f0374890c299b8bbd2adc85885119b6129e87bf0f6447fd13ea75305",
    ],
    [
        47,
        32,
        false,
        "054c929f831ae8d4ae7b13f48ca7ea12ae241bbb3e3ee475e10c09c1dc6aff6f",
    ],
    [
        513,
        512,
        false,
        "f02cfb6f478b72346efc31dcfddc3ffa6fa5b8d867cad052baee4a979b821fef",
    ],
    [
        512,
        513,
        true,
        "1368c5f0c0c0c83e32f1ce03ee2cdb450aac8daffca411a69c7fc83ca1b3bf29",
    ],
    [
        769,
        513,
        false,
        "29f157633705795daf07aff5c8da5b50034e11e68e584610538b2cc7e5dedde4",
    ],
    [
        256,
        257,
        false,
        "ce6c5e9793dc121fb7bd259f9d1f1dc453a040a0545e1fe6ea03698881483267",
    ],
    [
        1024,
        768,
        true,
        "943b8048a2dfea4dabc30cd0fdea9a89c5102f570f5a24470c44a93b0abf528e",
    ],
]) {
    test(`Pillow decoded-pixel parity: ${width}x${height}, alpha=${alpha}`, () => {
        assert.equal(
            tensorHash(
                rgbaToModelTensor(
                    patterned(width, height, alpha),
                    preprocessing,
                ),
            ),
            hash,
        );
    });
}

function globalValue(t, name, value) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value,
    });
    t.after(() =>
        original
            ? Object.defineProperty(globalThis, name, original)
            : delete globalThis[name],
    );
}
function canvasMock(t, pixels, fails = false) {
    const context = {
        drawImage: t.mock.fn(),
        getImageData: t.mock.fn(() => {
            if (fails) throw new Error("Pixel extraction failed");
            return pixels;
        }),
    };
    const canvas = {
        width: 0,
        height: 0,
        getContext: t.mock.fn(() => context),
    };
    globalValue(t, "document", { createElement: t.mock.fn(() => canvas) });
    return { canvas, context };
}

for (const fails of [false, true]) {
    test(`bitmap options, unscaled extraction, and resource cleanup on ${fails ? "failure" : "success"}`, async (t) => {
        const pixels = rgba(32, 33);
        const bitmap = { width: 32, height: 33, close: t.mock.fn() };
        const decode = t.mock.fn(async () => bitmap);
        globalValue(t, "createImageBitmap", decode);
        const { canvas, context } = canvasMock(t, pixels, fails);
        const file = new Blob(["local image bytes"]);
        if (fails)
            await assert.rejects(
                preprocessBrowserImage(file, preprocessing),
                /extraction failed/,
            );
        else
            assert.deepEqual(
                await preprocessBrowserImage(file, preprocessing),
                rgbaToModelTensor(pixels, preprocessing),
            );
        assert.deepEqual(decode.mock.calls[0].arguments, [
            file,
            {
                imageOrientation: "from-image",
                premultiplyAlpha: "none",
                colorSpaceConversion: "none",
            },
        ]);
        assert.deepEqual(context.drawImage.mock.calls[0].arguments, [
            bitmap,
            0,
            0,
        ]);
        assert.deepEqual(
            context.getImageData.mock.calls[0].arguments,
            [0, 0, 32, 33],
        );
        assert.equal(bitmap.close.mock.callCount(), 1);
        assert.equal(canvas.width, 0);
        assert.equal(canvas.height, 0);
    });
}

test("undersized decoded bitmaps close before allocating a canvas", async (t) => {
    const close = t.mock.fn();
    globalValue(t, "createImageBitmap", async () => ({
        width: 31,
        height: 32,
        close,
    }));
    const { canvas } = canvasMock(t, rgba());
    await assert.rejects(
        preprocessBrowserImage(new Blob(), preprocessing),
        /32/,
    );
    assert.equal(close.mock.callCount(), 1);
    assert.equal(canvas.getContext.mock.callCount(), 0);
});

for (const valid of [true, false]) {
    test(`Image fallback revokes its temporary URL on ${valid ? "success" : "decode failure"}`, async (t) => {
        globalValue(t, "createImageBitmap", undefined);
        globalValue(
            t,
            "Image",
            class {
                naturalWidth = 32;
                naturalHeight = 33;
                set src(value) {
                    assert.equal(value, "blob:preprocess-test");
                    queueMicrotask(() =>
                        valid ? this.onload() : this.onerror(),
                    );
                }
            },
        );
        const create = t.mock.method(
            URL,
            "createObjectURL",
            () => "blob:preprocess-test",
        );
        const revoke = t.mock.method(URL, "revokeObjectURL", () => {});
        canvasMock(t, rgba(32, 33));
        const file = new Blob(["local image bytes"]);
        if (valid)
            assert.equal(
                (await preprocessBrowserImage(file, preprocessing)).length,
                3 * PLANE,
            );
        else
            await assert.rejects(
                preprocessBrowserImage(file, preprocessing),
                /decode image/,
            );
        assert.equal(create.mock.calls[0].arguments[0], file);
        assert.deepEqual(
            revoke.mock.calls.map((call) => call.arguments),
            [["blob:preprocess-test"]],
        );
    });
}

test("Image constructor failure still revokes the temporary URL", async (t) => {
    globalValue(t, "createImageBitmap", undefined);
    globalValue(
        t,
        "Image",
        class {
            constructor() {
                throw new Error("Image unavailable");
            }
        },
    );
    t.mock.method(URL, "createObjectURL", () => "blob:preprocess-test");
    const revoke = t.mock.method(URL, "revokeObjectURL", () => {});
    await assert.rejects(
        preprocessBrowserImage(new Blob(), preprocessing),
        /Image unavailable/,
    );
    assert.deepEqual(
        revoke.mock.calls.map((call) => call.arguments),
        [["blob:preprocess-test"]],
    );
});
