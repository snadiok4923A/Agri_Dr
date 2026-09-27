/*
 * cropStages.js — rice growth-stage vocabulary for onboarding.
 *
 * Data rules:
 *  - ORDER IS DISPLAY ORDER. Each stage lists the stages that normally
 *    come BEFORE it, so onboarding always offers a real, agrologically
 *    coherent sequence ending at the farmer's current stage.
 *  - keys are stable identifiers persisted in Supabase; labels resolve
 *    via the `onboarding.stages.<key>` translation keys (English labels
 *    live here as the fallback and for the chips themselves).
 *  - `before` arrays reuse stage KEYS — no duplicate label data.
 */

export const CROP_STAGES = [
    { key: "seedling", label: "Seedling / Nursery", before: [] },
    { key: "transplanting", label: "Transplanting", before: ["seedling"] },
    { key: "tillering", label: "Tillering", before: ["seedling", "transplanting"] },
    { key: "panicleInitiation", label: "Panicle Initiation", before: ["seedling", "transplanting", "tillering"] },
    { key: "flowering", label: "Flowering", before: ["seedling", "transplanting", "tillering", "panicleInitiation"] },
    { key: "grainFilling", label: "Grain Filling", before: ["seedling", "transplanting", "tillering", "panicleInitiation", "flowering"] },
    { key: "maturity", label: "Maturity", before: ["seedling", "transplanting", "tillering", "panicleInitiation", "flowering", "grainFilling"] },
    { key: "readyForHarvest", label: "Ready for Harvest", before: ["seedling", "transplanting", "tillering", "panicleInitiation", "flowering", "grainFilling", "maturity"] },
];

/* Full key → English label map (validation + fallback rendering). */
export const STAGE_LABELS = Object.fromEntries(
    CROP_STAGES.map((s) => [s.key, s.label]),
);

/* Stage options for one parcel: everything up to and including `key`,
 * in display order. Unknown key → all stages (never an empty list). */
export function stageOptionsFor(key) {
    const idx = CROP_STAGES.findIndex((s) => s.key === key);
    if (idx === -1) return CROP_STAGES;
    return CROP_STAGES.slice(0, idx + 1);
}
