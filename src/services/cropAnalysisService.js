/**
 * cropAnalysisService — the single entry point for crop-disease analysis.
 *
 * The backend returns classification only. It does not provide treatment
 * recommendations, which must come from a separately verified source.
 */

const API_BASE_URL = (import.meta.env.VITE_KRISIVEDA_ML_API_URL || "").replace(/\/+$/, "");

export async function analyzeCropImage(file) {
    if (!file) return { status: "error", reason: "no-image" };
    if (!API_BASE_URL) return { status: "not_connected" };

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
        if (["ok", "uncertain"].includes(result?.status)) return result;
    } catch {
        // The caller receives an explicit error state below.
    }
    return { status: "error", reason: "invalid-response" };
}
