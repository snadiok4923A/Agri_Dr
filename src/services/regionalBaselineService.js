const API_BASE_URL = (import.meta.env.VITE_KRISIVEDA_ML_API_URL || "").replace(/\/+$/, "");

function apiUrl(path) {
    if (!API_BASE_URL) {
        throw new Error("REGIONAL_BASELINE_API_NOT_CONFIGURED");
    }
    return `${API_BASE_URL}${path}`;
}

async function request(path, options = {}) {
    let response;
    try {
        response = await fetch(apiUrl(path), {
            headers: { "Content-Type": "application/json" },
            ...options,
        });
    } catch {
        throw new Error("REGIONAL_BASELINE_NETWORK_ERROR");
    }

    if (!response.ok) {
        let detail = "";
        try {
            detail = (await response.json())?.detail || "";
        } catch {
            // The status code is still useful when the server response is not JSON.
        }
        const error = new Error(detail || `REGIONAL_BASELINE_API_ERROR_${response.status}`);
        error.status = response.status;
        throw error;
    }
    return response.json();
}

export function fetchRegionalBaseline() {
    return request("/regional-baseline");
}

export function estimateRegionalBaseline(farmArea, areaUnit) {
    return request("/regional-baseline/estimate", {
        method: "POST",
        body: JSON.stringify({ farm_area: farmArea, area_unit: areaUnit }),
    });
}

export function isRegionalBaselineApiConfigured() {
    return Boolean(API_BASE_URL);
}
