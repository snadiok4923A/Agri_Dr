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
 *  original always goes to Supabase; the smaller copy is only an offline/
 *  instant-paint cache — sized generously so the profile popup stays
 *  sharp even when the server layer is unavailable (degraded mode shows
 *  THIS copy, so it must not look soft). */
export const AVATAR_CACHE_EDGE = 768;

/* ------- upload compression (quality-first: spec band ≈ 1–5 MB) ------- */
/** Hard cap on the ORIGINAL file the user picks (bytes). Larger files are
 *  rejected before any read/compression work. */
export const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
/** Profile pictures never need more than this on the longest edge; larger
 *  images are downscaled proportionally (never upscaled, never cropped). */
export const MAX_OUTPUT_EDGE = 1600;
/** Quality-first target: encode from high quality downwards while the
 *  output is above target. Visually excellent avatars land in the 1–5 MB
 *  band at 0.85–0.9; the floor exists only as a last resort and never
 *  dips into visibly-degraded territory. */
const TARGET_BYTES = 5 * 1024 * 1024;
const MIN_QUALITY = 0.8;
const START_QUALITY = 0.9;

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

/** Canvas → Blob as a promise (no base64 in the storage path). */
function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("encode failed"))),
            mime,
            quality,
        );
    });
}

/** Blob → data URL (browser-local cache only — never stored server-side). */
export function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(blob);
    });
}

/**
 * Decode the picked file with EXIF orientation APPLIED, so phone photos
 * (portrait JPEGs) never end up sideways after compression.
 * createImageBitmap({imageOrientation:'from-image'}) handles it in all
 * modern browsers; an <img> decode is the fallback (browsers apply EXIF
 * for <img> rendering too).
 * Exported for the profile-photo editor, which needs the same EXIF-safe
 * decode as the source of the circular crop (single decode, reused).
 */
export async function decodeOriented(file) {
    try {
        if (window.createImageBitmap) {
            return await createImageBitmap(file, {
                imageOrientation: "from-image",
            });
        }
    } catch {
        /* fall through to <img> */
    }
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        img.decoding = "async";
        await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = () => rej(new Error("decode failed"));
            img.src = url;
        });
        return img;
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** Sampled alpha check: does this image actually use transparency? */
function detectAlpha(source) {
    try {
        const s = document.createElement("canvas");
        s.width = 32;
        s.height = 32;
        const ctx = s.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(source, 0, 0, 32, 32);
        const d = ctx.getImageData(0, 0, 32, 32).data;
        for (let i = 3; i < d.length; i += 4) {
            if (d[i] < 255) return true;
        }
    } catch {
        /* opaque unless proven otherwise */
    }
    return false;
}

/** Storage extension for a mime type ("image/jpeg"→"jpg" etc.). */
function extForMime(mime) {
    const m = String(mime || "").toLowerCase();
    return m.includes("png") ? "png" : m.includes("webp") ? "webp" : "jpg";
}

/**
 * Browser-side compression for the avatar upload (quality-first):
 *   decode (EXIF-correct) → if the file ALREADY fits the size band and
 *   the 1600px edge budget, pass it through untouched (re-encoding could
 *   only lose quality) → otherwise proportional resize to ≤1600px longest
 *   edge → high-quality re-encode (JPEG for photos, WebP when the image
 *   actually uses transparency — never flattening a transparent PNG)
 *   → Blob output. The ORIGINAL file is never uploaded when compression
 *   is required; an already-small image is never recompressed.
 * Throws when the browser cannot decode the image; callers keep the
 * previous avatar in that case.
 */
export async function compressImage(file) {
    const source = await decodeOriented(file);
    const sw = source.width || source.naturalWidth;
    const sh = source.height || source.naturalHeight;
    if (!sw || !sh) {
        source.close?.();
        throw new Error("decode failed");
    }

    // Quality-first pass-through: an image that already fits the output
    // band AND the edge budget needs no compression — forwarding the
    // original bytes preserves 100% of the quality (spec: never recompress
    // a reasonably-sized image just to shave bytes).
    if (file.size <= TARGET_BYTES && Math.max(sw, sh) <= MAX_OUTPUT_EDGE) {
        const transparent = detectAlpha(source);
        const mime = file.type || (transparent ? "image/webp" : "image/jpeg");
        const cacheDataUrl = makeCacheDataUrl(source, sw, sh, transparent);
        source.close?.();
        if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.info(
                `[profile] avatar pass-through (no recompression): ${sw}×${sh}, ${(file.size / 1024 / 1024).toFixed(2)} MB`,
            );
        }
        return {
            blob: file,
            mime,
            ext: extForMime(mime),
            width: sw,
            height: sh,
            cacheDataUrl,
        };
    }

    // Resize only when necessary; never upscale, never distort, never crop.
    const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, w, h);
    source.close?.();

    // Transparency survives (WebP keeps alpha); photos → compact JPEG.
    const transparent = detectAlpha(canvas);
    const mime = transparent ? "image/webp" : "image/jpeg";

    // Adaptive quality: start high, step down only while the output is
    // above target — and never below the quality floor. If even the floor
    // exceeds the target we KEEP the floor-quality blob: visual quality
    // outranks file size (spec).
    let blob = null;
    let usedQuality = START_QUALITY;
    for (let q = START_QUALITY; q >= MIN_QUALITY; q -= 0.05) {
        usedQuality = q;
        blob = await canvasToBlob(canvas, mime, q);
        if (blob.size <= TARGET_BYTES) break;
    }
    // Browsers without WebP encoding silently fall back to PNG — trust
    // the ACTUAL blob type so the storage extension/contentType always
    // match the compressed output.
    const actualMime = blob.type || mime;
    const actualExt = extForMime(actualMime);

    // Small ≤768px copy for the instant local paint + offline cache
    // (browser-local ONLY — never uploaded, never stored server-side).
    const cacheDataUrl = makeCacheDataUrl(canvas, w, h, transparent);

    if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info(
            `[profile] avatar compressed: ${sw}×${sh} → ${w}×${h}, q=${usedQuality}, ${(file.size / 1024 / 1024).toFixed(2)} MB → ${(blob.size / 1024 / 1024).toFixed(2)} MB`,
        );
    }

    canvas.width = 0; // release the bitmap memory
    canvas.height = 0;
    return {
        blob,
        mime: actualMime,
        ext: actualExt,
        width: w,
        height: h,
        cacheDataUrl,
    };
}

/** Re-encoded ≤AVATAR_CACHE_EDGE copy for the local instant-paint cache.
 *  Quality 0.9 so the profile popup stays crisp in degraded (local-only)
 *  mode — this copy is what the user SEES until the server layer exists. */
function makeCacheDataUrl(drawSource, w, h, transparent) {
    try {
        const cs = Math.min(1, AVATAR_CACHE_EDGE / Math.max(w, h));
        const c2 = document.createElement("canvas");
        c2.width = Math.max(1, Math.round(w * cs));
        c2.height = Math.max(1, Math.round(h * cs));
        const cctx = c2.getContext("2d");
        cctx.imageSmoothingEnabled = true;
        cctx.imageSmoothingQuality = "high";
        cctx.drawImage(drawSource, 0, 0, c2.width, c2.height);
        return c2.toDataURL(transparent ? "image/webp" : "image/jpeg", 0.9);
    } catch {
        return ""; // cache is optional
    }
}

/**
 * Best-effort cleanup of THIS user's previous avatar objects after a
 * successful upload (versioned-path strategy). Lists ONLY the caller's
 * own "<uid>/" prefix — the bucket's delete policy additionally enforces
 * ownership server-side, so another user's files are untouchable.
 * Never throws; cleanup failure is harmless (old objects just remain).
 */
export async function cleanupOldAvatars(userId, keepPath) {
    if (!userId || !supabase) return;
    try {
        const { data } = await supabase.storage.from(BUCKET).list(userId, {
            limit: 100,
            sortBy: { column: "created_at", order: "desc" },
        });
        const stale = (data || [])
            .map((o) => `${userId}/${o.name}`)
            .filter((p) => p !== keepPath);
        if (stale.length) await supabase.storage.from(BUCKET).remove(stale);
    } catch (err) {
        warn("avatar cleanup skipped", err);
    }
}

/**
 * Upload a picked image for the CURRENT user and record it on their
 * profile row. Path is user-scoped ("<uid>/avatar-<ts>.<ext>") — no
 * shared filename, enforced again by the bucket's RLS policies.
 * `payload` is the COMPRESSED Blob from compressImage() — the original
 * file never reaches Storage. Returns { ok, path } on success,
 * { ok: false, degraded: true } when the server schema/bucket is absent
 * (graceful local-only mode), or { ok: false } on a real failure
 * (caller reverts the avatar and shows an error).
 */
export async function uploadAvatar(userId, payload) {
    if (!userId || !supabase || !payload?.blob) return { ok: false };
    const { blob, ext, mime } = payload;
    // Unique name per upload → browsers never serve a stale cached
    // avatar after replacement (CDN-safe), and old objects remain for
    // rollback until cleanupOldAvatars() prunes them.
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    try {
        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(path, blob, {
                contentType: mime || blob.type || "image/jpeg",
                cacheControl: "31536000", // unique name → immutable object
                upsert: false,
            });
        if (error) {
            if (!isSchemaError(error)) {
                warn("avatar upload failed", error);
                return { ok: false };
            }
            warn("avatar upload — migration not applied", error);
            return { ok: false, degraded: true };
        }
        const saved = await saveAvatarPath(userId, path);
        if (!saved) {
            // Object stored but row write failed: the picture is on the
            // server; a retry will re-save. Report partial success as
            // failure so the caller keeps the local cache.
            return { ok: false, degraded: saved === "degraded" };
        }
        return { ok: true, path };
    } catch (err) {
        warn("avatar upload threw", err);
        return { ok: false };
    }
}

/** Persist the avatar path on the user's profile row. Returns true,
 *  false (real failure), or "degraded" (schema/bucket absent). */
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
            if (!isSchemaError(error)) {
                warn("avatar save failed", error);
                return false;
            }
            warn("avatar save — migration not applied", error);
            return "degraded";
        }
        return true;
    } catch (err) {
        warn("avatar save threw", err);
        return false;
    }
}
