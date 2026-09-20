/**
 * cropAnalysisService — the single entry point for crop-disease analysis.
 *
 * The Machine Learning model is NOT connected yet. analyzeCropImage() always
 * resolves to an explicit `{ status: "not_connected" }` result — it never
 * fabricates a diagnosis, confidence or treatment (spec §14/§15/§31).
 *
 * Future connection (spec §16): replace the stub body with a real inference
 * call — TensorFlow.js, ONNX Runtime Web, or a backend API — and return:
 *
 *   {
 *     status: "ok",
 *     disease: "Leaf Blast",
 *     confidence: 0.94,
 *     severity: "High",
 *     symptoms: ["..."],
 *     treatment: "...",
 *     medicine: "Tricyclazole 75% WP",
 *     dose: "0.6 g / L",
 *     coverage: "250 g for 1.8 acres",
 *     treatmentCost: "₹1,200 / acre",
 *   }
 *
 * The analysis window already renders every field above when present, so
 * connecting a model requires NO UI redesign — only this function changes.
 */

export async function analyzeCropImage(file) {
    if (!file) return { status: "error", reason: "no-image" };

    // ---- Future ML inference goes here ---------------------------------
    // e.g. const model = await tf.loadLayersModel(MODEL_URL); ...
    // There is intentionally NO artificial delay: the UI must not pretend
    // that analysis is running when no model exists (spec §20).

    return { status: "not_connected" };
}
