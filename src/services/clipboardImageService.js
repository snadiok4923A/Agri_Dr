import {
    SUPPORTED_IMAGE_TYPES,
    validateCropImageFile,
} from "./cropAnalysisService";

async function decodeImage(file) {
    if (typeof createImageBitmap === "function") {
        const bitmap = await createImageBitmap(file);
        try {
            if (!bitmap.width || !bitmap.height) throw new Error("Empty image");
        } finally {
            bitmap.close();
        }
        return;
    }

    const url = URL.createObjectURL(file);
    try {
        await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () =>
                image.naturalWidth && image.naturalHeight
                    ? resolve()
                    : reject(new Error("Empty image"));
            image.onerror = () => reject(new Error("Invalid image"));
            image.src = url;
        });
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function prepareClipboardImage(file) {
    const reason = validateCropImageFile(file);
    if (reason) return { reason };
    if (!file.size) return { reason: "invalid-image" };
    try {
        await decodeImage(file);
        return { file };
    } catch {
        return { reason: "invalid-image" };
    }
}

export async function readClipboardImage() {
    if (
        globalThis.isSecureContext === false ||
        typeof globalThis.navigator?.clipboard?.read !== "function"
    ) {
        return { reason: "clipboard-unavailable" };
    }
    try {
        // Read only on an explicit button click; keyboard paste uses its event data.
        const items = await navigator.clipboard.read();
        for (const item of items) {
            const type = item.types.find((mime) =>
                SUPPORTED_IMAGE_TYPES.has(mime),
            );
            if (!type) continue;
            const blob = await item.getType(type);
            const extension =
                type === "image/jpeg" ? "jpg" : type.split("/")[1];
            return prepareClipboardImage(
                new File([blob], `clipboard-image.${extension}`, {
                    type: blob.type || type,
                }),
            );
        }
        const hasImage = items.some((item) =>
            item.types.some((type) => type.startsWith("image/")),
        );
        return {
            reason: hasImage ? "unsupported-file-type" : "clipboard-empty",
        };
    } catch (error) {
        return {
            reason:
                error?.name === "NotAllowedError" ||
                error?.name === "SecurityError"
                    ? "clipboard-denied"
                    : "clipboard-read-failed",
        };
    }
}

export function getPastedImage(clipboardData) {
    const items = Array.from(clipboardData?.items || []);
    const imageItems = items.filter(
        (item) => item.kind === "file" && item.type.startsWith("image/"),
    );
    const item =
        imageItems.find((candidate) =>
            SUPPORTED_IMAGE_TYPES.has(candidate.type),
        ) || imageItems[0];
    if (item) {
        const file = item.getAsFile();
        if (file)
            return file.type
                ? file
                : new File([file], file.name, { type: item.type });
    }
    const files = Array.from(clipboardData?.files || []).filter((file) =>
        file.type.startsWith("image/"),
    );
    return (
        files.find((file) => SUPPORTED_IMAGE_TYPES.has(file.type)) ||
        files[0] ||
        null
    );
}

export function isClipboardTextTarget(target) {
    return Boolean(
        target?.closest?.(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
        ),
    );
}
