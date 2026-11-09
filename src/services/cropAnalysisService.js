/**
 * cropAnalysisService — the single entry point for crop-disease analysis.
 *
 * The backend returns classification only. It does not provide treatment
 * recommendations, which must come from a separately verified source.
 */

const DEFAULT_API_BASE_URL = "https://krisiveda-ml-api.onrender.com";
const configuredApiBaseUrl = import.meta.env.VITE_KRISIVEDA_ML_API_URL?.trim();
const isLoopbackUrl =
    /^https?:\/\/(127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(
        configuredApiBaseUrl || "",
    );
const API_BASE_URL = (
    import.meta.env.PROD && isLoopbackUrl
        ? DEFAULT_API_BASE_URL
        : configuredApiBaseUrl || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");
// Vite proxies only development V2 requests to the separate local backend.
// Production and V1 retain the existing API URL and loopback safety guard.
const V2_API_BASE_URL = import.meta.env.DEV
    ? `${import.meta.env.BASE_URL}api`
    : API_BASE_URL;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
// A stalled connection must surface as an error, never as an endless spinner.
const STATUS_TIMEOUT_MS = 6000;
const PREDICT_TIMEOUT_MS = 20000;

async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}
export const SUPPORTED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
]);

const DISEASE_ENDPOINTS = {
    v1: "/disease/predict",
    v2: "/disease/v2/predict",
};

export async function getDiseaseV2Status() {
    try {
        const response = await fetchWithTimeout(
            `${V2_API_BASE_URL}/disease/v2/status`,
            { headers: { Accept: "application/json" } },
            STATUS_TIMEOUT_MS,
        );
        if (!response.ok)
            return { available: false, reason: `api-${response.status}` };
        const result = await response.json();
        if (
            typeof result?.available === "boolean" &&
            typeof result.classes === "number"
        ) {
            return result;
        }
        return { available: false, reason: "invalid-response" };
    } catch {
        return { available: false, reason: "not-connected" };
    }
}

export function validateCropImageFile(file) {
    if (!file) return "no-image";
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) return "unsupported-file-type";
    if (file.size > MAX_IMAGE_BYTES) return "file-too-large";
    return null;
}

export async function analyzeCropImage(file, model = "v1") {
    const invalidReason = validateCropImageFile(file);
    if (invalidReason) return { status: "error", reason: invalidReason };

    if (model === "browser-v2") {
        try {
            const { analyzeBrowserCropImage } =
                await import("./browserDiseaseService");
            return await analyzeBrowserCropImage(file);
        } catch {
            return { status: "error", reason: "browser-model-unavailable" };
        }
    }

    const formData = new FormData();
    formData.append("file", file);

    let response;
    try {
        response = await fetchWithTimeout(
            `${model === "v2" ? V2_API_BASE_URL : API_BASE_URL}${DISEASE_ENDPOINTS[model] || DISEASE_ENDPOINTS.v1}`,
            {
                method: "POST",
                body: formData,
            },
            PREDICT_TIMEOUT_MS,
        );
    } catch (error) {
        // A timed-out prediction produced no result; never present it as one.
        if (error?.name === "AbortError")
            return { status: "error", reason: "timeout" };
        return { status: "not_connected" };
    }

    if (!response.ok) {
        if (response.status === 503) {
            return { status: "not_connected" };
        }
        if (response.status === 415) {
            return { status: "error", reason: "unsupported-file-type" };
        }
        if (response.status === 422) {
            return { status: "error", reason: "invalid-image" };
        }
        return {
            status: "error",
            reason: `api-${response.status}`,
        };
    }

    try {
        const result = await response.json();
        if (
            ["ok", "uncertain"].includes(result?.status) &&
            typeof result.confidence === "number" &&
            Array.isArray(result.top_predictions)
        ) {
            return result;
        }
    } catch {
        // The caller receives an explicit error state below.
    }
    return { status: "error", reason: "invalid-response" };
}
