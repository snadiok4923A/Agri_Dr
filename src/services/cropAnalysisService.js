/**
 * cropAnalysisService — the single entry point for crop-disease analysis.
 *
 * The backend returns classification only. It does not provide treatment
 * recommendations, which must come from a separately verified source.
 */

const DEFAULT_API_BASE_URL = "https://krisiveda-ml-api.onrender.com";
const configuredApiBaseUrl = import.meta.env.VITE_KRISIVEDA_ML_API_URL?.trim();
const isLoopbackUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(
    configuredApiBaseUrl || "",
);
const API_BASE_URL = (
    import.meta.env.PROD && isLoopbackUrl
        ? DEFAULT_API_BASE_URL
        : configuredApiBaseUrl || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/* Opt-in only: VITE_KRISIVEDA_DISEASE_API_VERSION=v2 switches the analysis
   request to the 15-class development endpoint. Unset (the default) keeps the
   6-class production path, so website behaviour is unchanged. */
const DISEASE_API_VERSION =
    import.meta.env.VITE_KRISIVEDA_DISEASE_API_VERSION?.trim() || "v1";
const DISEASE_ENDPOINT =
    DISEASE_API_VERSION === "v2" ? "/disease/v2/predict" : "/disease/predict";

export async function analyzeCropImage(file) {
    if (!file) return { status: "error", reason: "no-image" };
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
        return { status: "error", reason: "unsupported-file-type" };
    }
    if (file.size > MAX_IMAGE_BYTES) {
        return { status: "error", reason: "file-too-large" };
    }

    const formData = new FormData();
    formData.append("file", file);

    let response;
    try {
        response = await fetch(`${API_BASE_URL}${DISEASE_ENDPOINT}`, {
            method: "POST",
            body: formData,
        });
    } catch {
        return { status: "not_connected" };
    }

    if (!response.ok) {
        if (response.status === 503) {
            return { status: "not_connected" };
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
