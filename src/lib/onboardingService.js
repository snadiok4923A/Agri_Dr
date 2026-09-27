/*
 * onboardingService.js — Supabase persistence for onboarding data.
 *
 * Pure logic layer (same pattern as authService.js): no React, no UI.
 * Tables: profiles / farms / land_parcels — see
 * supabase/migration_onboarding.sql (RLS keyed to auth.uid()).
 *
 * GRACEFUL DEGRADATION: if the migration has not been applied yet
 * (missing tables / PostgREST errors), every function returns null-ish
 * results and the app falls back to localStorage-only persistence —
 * the UI never blocks and never shows a raw database error to farmers.
 */

import { supabase } from "./supabaseClient";

/** Row shapes stay in one place so callers can build objects safely. */
export const AREA_UNITS = [
    { value: "acre", label: "Acre" },
    { value: "hectare", label: "Hectare" },
    { value: "bigha", label: "Bigha" },
    { value: "katha", label: "Katha" },
    { value: "decimal", label: "Decimal" },
];

/** Any schema/permission failure → local-only mode (silent in production,
 *  one console.warn in dev so the fix is discoverable). */
function isSchemaError(error) {
    if (!error) return false;
    const msg = String(error.message || error).toLowerCase();
    return (
        msg.includes("could not find the table") ||
        msg.includes("schema cache") ||
        msg.includes("does not exist") ||
        msg.includes("permission") ||
        msg.includes("jwt") ||
        msg.includes("row-level security")
    );
}

function warnOnce(context, error) {
    if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[onboarding] ${context} — falling back to local storage:`,
            error?.message || error);
    }
}

/** Fetch the onboarding state for a user, or null when absent/unavailable. */
export async function fetchOnboardingState(userId) {
    if (!userId || !supabase) return null;
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("selected_language, onboarding_completed, onboarding_skipped")
            .eq("id", userId)
            .maybeSingle();
        if (error) {
            if (isSchemaError(error)) warnOnce("profiles fetch", error);
            else console.warn("[onboarding] profiles fetch failed:", error.message);
            return null;
        }
        return data
            ? {
                selectedLanguage: data.selected_language || null,
                onboardingCompleted: !!data.onboarding_completed,
                onboardingSkipped: !!data.onboarding_skipped,
            }
            : { selectedLanguage: null, onboardingCompleted: false, onboardingSkipped: false };
    } catch (err) {
        warnOnce("profiles fetch", err);
        return null;
    }
}

/** Upsert the user's profile row (language + onboarding flags). */
export async function saveProfileState(
    userId,
    { selectedLanguage, onboardingCompleted, onboardingSkipped },
) {
    if (!userId || !supabase) return false;
    try {
        const patch = { updated_at: new Date().toISOString() };
        if (selectedLanguage !== undefined) patch.selected_language = selectedLanguage;
        if (onboardingCompleted !== undefined) patch.onboarding_completed = onboardingCompleted;
        if (onboardingSkipped !== undefined) patch.onboarding_skipped = onboardingSkipped;
        const { error } = await supabase
            .from("profiles")
            .upsert({ id: userId, ...patch }, { onConflict: "id" });
        if (error) {
            if (isSchemaError(error)) warnOnce("profiles save", error);
            else console.warn("[onboarding] profiles save failed:", error.message);
            return false;
        }
        return true;
    } catch (err) {
        warnOnce("profiles save", err);
        return false;
    }
}

/** Fetch the farm row for a user (or null). */
export async function fetchFarm(userId) {
    if (!userId || !supabase) return null;
    try {
        const { data, error } = await supabase
            .from("farms")
            .select("id, name")
            .eq("user_id", userId)
            .maybeSingle();
        if (error) {
            if (isSchemaError(error)) warnOnce("farm fetch", error);
            else console.warn("[onboarding] farm fetch failed:", error.message);
            return null;
        }
        return data ? { id: data.id, name: data.name || "" } : null;
    } catch (err) {
        warnOnce("farm fetch", err);
        return null;
    }
}

/** Create (or rename) the farm row; returns the farm id or null. */
export async function upsertFarm(userId, name) {
    if (!userId || !supabase) return null;
    try {
        const { data, error } = await supabase
            .from("farms")
            .upsert({ user_id: userId, name: name || "" }, { onConflict: "user_id" })
            .select("id")
            .maybeSingle();
        if (error) {
            if (isSchemaError(error)) warnOnce("farm save", error);
            else console.warn("[onboarding] farm save failed:", error.message);
            return null;
        }
        return data?.id ?? null;
    } catch (err) {
        warnOnce("farm save", err);
        return null;
    }
}

/** Fetch all parcels of a user's farm, ordered. */
export async function fetchParcels(userId) {
    if (!userId || !supabase) return null;
    try {
        const { data, error } = await supabase
            .from("land_parcels")
            .select("order_index, area, unit, rice_variety, crop_stage")
            .eq("user_id", userId)
            .order("order_index", { ascending: true });
        if (error) {
            if (isSchemaError(error)) warnOnce("parcels fetch", error);
            else console.warn("[onboarding] parcels fetch failed:", error.message);
            return null;
        }
        return (data || []).map((row) => ({
            order: row.order_index,
            area: Number(row.area),
            unit: row.unit,
            riceVariety: row.rice_variety || "",
            stage: row.crop_stage || "",
        }));
    } catch (err) {
        warnOnce("parcels fetch", err);
        return null;
    }
}

/** Replace the farm's parcels with one ordered batch. */
export async function replaceParcels(userId, farmId, parcels) {
    if (!userId || !farmId || !supabase) return false;
    try {
        const { error: delError } = await supabase
            .from("land_parcels")
            .delete()
            .eq("user_id", userId);
        if (delError) {
            if (isSchemaError(delError)) warnOnce("parcels clear", delError);
            else console.warn("[onboarding] parcels clear failed:", delError.message);
            return false;
        }
        if (!parcels.length) return true;
        const rows = parcels.map((p, i) => ({
            user_id: userId,
            farm_id: farmId,
            order_index: i,
            area: p.area,
            unit: p.unit,
            rice_variety: p.riceVariety || "",
            crop_stage: p.stage || "",
        }));
        const { error: insError } = await supabase
            .from("land_parcels")
            .insert(rows);
        if (insError) {
            if (isSchemaError(insError)) warnOnce("parcels save", insError);
            else console.warn("[onboarding] parcels save failed:", insError.message);
            return false;
        }
        return true;
    } catch (err) {
        warnOnce("parcels save", err);
        return false;
    }
}
