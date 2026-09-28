/**
 * profileService.js — SERVER-side profile picture (cross-device sync).
 *
 * Pure Supabase logic layer (same pattern as onboardingService.js): no
 * React, no UI. The BROWSER is no longer the source of truth:
 *
 *   upload → Storage bucket "avatars" at "<user_id>/avatar-<ts>.<ext>"
 *          → profiles.avatar_url stores that object path
 *          → any device: fetch profiles.avatar_url for the same user.id
 *            → supabase.storage.getPublicUrl → same picture everywhere
 *
 * GRACEFUL DEGRADATION (project-wide pattern): until migration_avatar.sql
 * is applied (profiles.avatar_url column + avatars bucket), every call
 * fails softly — the app keeps working on the user-scoped localStorage
 * copy. No raw database error ever reaches a farmer.
 */

import { supabase } from "./supabaseClient";

const BUCKET = "avatars";
/** Longest edge of the re-encoded copy kept in localStorage. The FULL
 *  original always goes to Supabase; the small copy is only an offline/
 *  instant-paint cache. */
export const AVATAR_CACHE_EDGE = 512;

function warn(context, error) {
    if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[profile] ${context}:`, error?.message || error);
    }
}

function isSchemaError(error) {
    if (!error) return false;
    const msg = String(error.message || error).toLowerCase();
    return (
        msg.includes("could not find the table") ||
        msg.includes("column") ||
        msg.includes("schema cache") ||
        msg.includes("does not exist") ||
        msg.includes("bucket not found") ||
        msg.includes("permission") ||
        msg.includes("jwt") ||
        msg.includes("row-level security")
    );
}

/** Read the stored avatar PATH for a user ('' when none/unavailable). */
export async function fetchAvatarPath(userId) {
    if (!userId || !supabase) return "";
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", userId)
            .maybeSingle();
        if (error) {
            if (!isSchemaError(error)) warn("avatar fetch failed", error);
            else warn("avatar fetch — migration not applied", error);
            return "";
        }
        return typeof data?.avatar_url === "string" ? data.avatar_url : "";
    } catch (err) {
        warn("avatar fetch threw", err);
        return "";
    }
}

/** Public URL for a storage path ('' when the path is empty/unknown). */
export function getAvatarPublicUrl(path) {
    if (!path || !supabase) return "";
    try {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return data?.publicUrl || "";
    } catch {
        return "";
    }
}

/**
 * Load the user's avatar URL from the SERVER (the cross-device path):
 * profiles.avatar_url → public Storage URL. Returns '' when the user has
 * no uploaded picture or the migration/bucket is not available yet.
 */
export async function fetchServerAvatarUrl(userId) {
    const path = await fetchAvatarPath(userId);
    return getAvatarPublicUrl(path);
}

/**
 * Upload a picked image for the CURRENT user and record it on their
 * profile row. Path is user-scoped ("<uid>/avatar-<ts>.<ext>") — no
 * shared filename, enforced again by the bucket's RLS policies.
 * Returns the storage path, or null on any failure (caller keeps the
 * local copy and may show an error).
 */
export async function uploadAvatar(userId, file) {
    if (!userId || !supabase || !file) return null;
    const ext =
        file.type === "image/png"
            ? "png"
            : file.type === "image/webp"
              ? "webp"
              : "jpg";
    // Unique name per upload → browsers never serve a stale cached
    // avatar after replacement, and old objects remain for rollback.
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    try {
        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, {
                contentType: file.type || "image/jpeg",
                cacheControl: "31536000", // unique name → immutable object
                upsert: false,
            });
        if (error) {
            if (!isSchemaError(error)) warn("avatar upload failed", error);
            else warn("avatar upload — migration not applied", error);
            return null;
        }
        const saved = await saveAvatarPath(userId, path);
        if (!saved) {
            // Object stored but row write failed: the picture is on the
            // server; a retry will re-save. Report partial success as
            // failure so the caller keeps the local cache.
            return null;
        }
        return path;
    } catch (err) {
        warn("avatar upload threw", err);
        return null;
    }
}

/** Persist the avatar path on the user's profile row (no-op when absent). */
export async function saveAvatarPath(userId, path) {
    if (!userId || !supabase) return false;
    try {
        const { error } = await supabase
            .from("profiles")
            .upsert(
                { id: userId, avatar_url: path, updated_at: new Date().toISOString() },
                { onConflict: "id" },
            );
        if (error) {
            if (!isSchemaError(error)) warn("avatar save failed", error);
            else warn("avatar save — migration not applied", error);
            return false;
        }
        return true;
    } catch (err) {
        warn("avatar save threw", err);
        return false;
    }
}

/**
 * Re-encode a picked image to a ≤512px JPEG/PNG data URL for the instant
 * local cache. Resolves to the data URL, or rejects if the browser
 * cannot decode it (caller falls back to the raw FileReader data URL).
 */
export function downscaleToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                const scale = Math.min(
                    1,
                    AVATAR_CACHE_EDGE / Math.max(img.width, img.height),
                );
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                // PNG keeps transparency; everything else → compact JPEG.
                resolve(canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.85));
            } catch (e) {
                URL.revokeObjectURL(url);
                reject(e);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("decode failed"));
        };
        img.src = url;
    });
}
