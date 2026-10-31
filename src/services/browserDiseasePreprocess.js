const CROP = 224;
const PLANE = CROP * CROP;
const PRECISION = 2 ** 22;
const f32 = Math.fround;
const byte = (sum) => Math.min(255, Math.max(0, Math.floor(sum / PRECISION)));

export function roundTiesToEven(value) {
    if (!Number.isFinite(value))
        throw new RangeError("Expected a finite dimension.");
    const lower = Math.floor(value);
    const fraction = value - lower;
    return fraction < 0.5 || (fraction === 0.5 && lower % 2 === 0)
        ? lower
        : lower + 1;
}

export function resizeDimensions(width, height) {
    if (
        !Number.isSafeInteger(width) ||
        !Number.isSafeInteger(height) ||
        width < 32 ||
        height < 32
    ) {
        throw new RangeError(
            "Image must be at least 32 x 32 pixels with integer dimensions.",
        );
    }
    const scale = 256 / Math.min(width, height);
    return {
        width: roundTiesToEven(width * scale),
        height: roundTiesToEven(height * scale),
    };
}

function normalization(preprocessing) {
    const p = preprocessing;
    if (
        p?.color_mode !== "RGB" ||
        p.exif_transpose !== true ||
        p.resize?.short_edge !== 256 ||
        p.resize?.interpolation !== "bilinear" ||
        p.center_crop !== CROP ||
        p.scale !== "pixel / 255.0" ||
        p.normalization?.channel_order !== "RGB" ||
        p.layout !== "NCHW" ||
        p.dtype !== "float32"
    ) {
        throw new Error("Unsupported disease model preprocessing contract.");
    }
    const values = [p.normalization.mean, p.normalization.std];
    if (
        values.some(
            (v) =>
                !Array.isArray(v) ||
                v.length !== 3 ||
                !v.every(Number.isFinite),
        )
    ) {
        throw new Error("Invalid model normalization parameters.");
    }
    const [mean, std] = values.map((v) => Float32Array.from(v));
    if (
        !mean.every(Number.isFinite) ||
        !std.every((v) => Number.isFinite(v) && v > 0)
    ) {
        throw new Error("Invalid float32 model normalization parameters.");
    }
    return { mean, std };
}

function coefficients(input, output, offset) {
    const scale = input / output;
    const support = Math.max(1, scale);
    const inverse = 1 / support;
    return Array.from({ length: CROP }, (_, i) => {
        const center = (i + offset + 0.5) * scale;
        const start = Math.max(0, Math.trunc(center - support + 0.5));
        const end = Math.min(input, Math.trunc(center + support + 0.5));
        const weights = Array.from({ length: end - start }, (_, k) =>
            Math.max(0, 1 - Math.abs((k + start - center + 0.5) * inverse)),
        );
        const total = weights.reduce((sum, weight) => sum + weight, 0);
        // Pillow's 8-bit bilinear path quantizes coefficients to 22 bits.
        return {
            start,
            weights: weights.map((w) =>
                Math.floor((w / total) * PRECISION + 0.5),
            ),
        };
    });
}

/** Upright, unpremultiplied 8-bit RGBA pixels -> contiguous float32 CHW. */
export function rgbaToModelTensor({ data, width, height }, preprocessing) {
    const resized = resizeDimensions(width, height);
    const { mean, std } = normalization(preprocessing);
    if (
        !(data instanceof Uint8ClampedArray || data instanceof Uint8Array) ||
        data.length !== width * height * 4
    ) {
        throw new TypeError(
            "Expected width x height unpremultiplied 8-bit RGBA pixels.",
        );
    }
    const horizontal = coefficients(
        width,
        resized.width,
        Math.floor((resized.width - CROP) / 2),
    );
    const vertical = coefficients(
        height,
        resized.height,
        Math.floor((resized.height - CROP) / 2),
    );
    const firstRow = vertical[0].start;
    const last = vertical[CROP - 1];
    const endRow = last.start + last.weights.length;
    // Only keep rows/columns that can contribute to the final center crop.
    const intermediate = new Uint8Array((endRow - firstRow) * CROP * 3);
    for (let y = firstRow; y < endRow; y++) {
        for (let x = 0; x < CROP; x++) {
            const { start, weights } = horizontal[x];
            for (let c = 0; c < 3; c++) {
                let sum = PRECISION / 2;
                for (let k = 0; k < weights.length; k++) {
                    const index = (y * width + start + k) * 4;
                    const alpha = data[index + 3];
                    // Composite each source sample onto white BEFORE filtering.
                    const rgb = Math.floor(
                        (data[index + c] * alpha + 255 * (255 - alpha) + 127) /
                            255,
                    );
                    sum += rgb * weights[k];
                }
                intermediate[((y - firstRow) * CROP + x) * 3 + c] = byte(sum);
            }
        }
    }
    const tensor = new Float32Array(3 * PLANE);
    for (let y = 0; y < CROP; y++) {
        const { start, weights } = vertical[y];
        for (let x = 0; x < CROP; x++) {
            for (let c = 0; c < 3; c++) {
                let sum = PRECISION / 2;
                for (let k = 0; k < weights.length; k++) {
                    sum +=
                        intermediate[
                            ((start + k - firstRow) * CROP + x) * 3 + c
                        ] * weights[k];
                }
                // Match NumPy float32 rounding at /255, subtract, and divide.
                const value = f32(f32(f32(byte(sum) / 255) - mean[c]) / std[c]);
                if (!Number.isFinite(value))
                    throw new Error("Non-finite model input.");
                tensor[c * PLANE + y * CROP + x] = value;
            }
        }
    }
    return tensor;
}

/** Browser decoding is not Pillow JPEG draft decoding; pixel-stage parity only. */
export async function preprocessBrowserImage(file, preprocessing) {
    normalization(preprocessing);
    let source;
    let objectUrl;
    let canvas;
    try {
        if (typeof createImageBitmap === "function") {
            source = await createImageBitmap(file, {
                imageOrientation: "from-image",
                premultiplyAlpha: "none",
                colorSpaceConversion: "none",
            });
        } else {
            objectUrl = URL.createObjectURL(file);
            source = new Image();
            await new Promise((resolve, reject) => {
                source.onload = () => resolve();
                source.onerror = () =>
                    reject(new Error("Unable to decode image."));
                source.src = objectUrl;
            });
        }
        const width = source.naturalWidth ?? source.width;
        const height = source.naturalHeight ?? source.height;
        resizeDimensions(width, height);
        canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", {
            willReadFrequently: true,
            colorSpace: "srgb",
        });
        if (!context)
            throw new Error("Canvas pixel extraction is unavailable.");
        context.drawImage(source, 0, 0);
        return rgbaToModelTensor(
            context.getImageData(0, 0, width, height),
            preprocessing,
        );
    } finally {
        if (canvas) {
            canvas.width = 0;
            canvas.height = 0;
        }
        source?.close?.();
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            if (source) {
                source.onload = null;
                source.onerror = null;
                source.removeAttribute?.("src");
            }
        }
    }
}
