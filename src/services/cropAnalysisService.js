/**
 * cropAnalysisService — the single entry point for crop-disease analysis.
 *
 * The backend returns classification only. It does not provide treatment
 * recommendations, which must come from a separately verified source.
 */

const DEFAULT_API_BASE_URL = "https://krisiveda-ml-api.onrender.com";
const API_BASE_URL = (
    import.meta.env.VITE_KRISIVEDA_ML_API_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
        response = await fetch(`${API_BASE_URL}/disease/predict`, {
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
