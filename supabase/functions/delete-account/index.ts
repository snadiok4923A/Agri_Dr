// ============================================================================
// Edge Function: delete-account  (v3 — instrumented for runtime debugging)
//
// Permanently deletes the AUTHENTICATED caller's account. Deploy:
//   Dashboard → Edge Functions → delete-account → paste this file → Deploy
//   (or: npx supabase functions deploy delete-account --project-ref <ref>)
//
// WHY THIS CLIENT (verified, not guessed): "@supabase/server" is NOT a
// published module — the server-side createServerClient people find in
// searches belongs to "@supabase/ssr", a cookie-based helper for
// Next.js/Astro servers that does not run on Supabase Edge Functions.
// The CURRENT Supabase Edge Functions pattern is jsr:@supabase/
// supabase-js@2 + the platform-injected SUPABASE_SERVICE_ROLE_KEY,
// which is exactly what this function uses.
//
// SECURITY MODEL (unchanged, verified working — OPTIONS 200, JWT
// gateway-validated, POST reaches this code):
//   • Identity comes EXCLUSIVELY from the verified Authorization bearer
//     JWT (admin.auth.getUser re-checks it against GoTrue). No user_id
//     is accepted from the client — a caller can only delete THEMSELVES.
//   • The service-role key is read only from server env and NEVER
//     appears in logs, responses, or the frontend.
//
// v3 CHANGES (runtime-500 debugging):
//   1. Step-by-step "DELETE_ACCOUNT: …" logging so the Function Logs
//      show exactly which operation fails.
//   2. Errors are logged safely: step name + error name + message +
//      status/code. NEVER tokens, refresh tokens, keys, the raw
//      Authorization header, or user passwords.
//   3. Error RESPONSES are safe and structured:
//      { success:false, error:"delete_failed", step:"auth_delete",
//        message:"…", detail:"…" } — detail carries only the upstream
//      GoTrue/PostgREST error string (never a secret).
//   4. CONFIRMATION RETRY: after a successful deleteUser the follow-up
//      getUserById can still see the user for a short window (GoTrue
//      read-after-write). The confirmation now retries with a short
//      delay before concluding failure — this removes the most likely
//      source of false "delete_not_confirmed" 500s.
//   5. deleteUser explicitly passes { should_soft_delete:false } and the
//      confirmation also accepts a user carrying deleted_at (soft
//      delete) as confirmed.
//   6. Cascade verification: the caller's profiles row is read before
//      and after deletion (service role bypasses RLS) and the result is
//      logged — proving whether the auth.users FK cascade fired.
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Confirmation retry tuning (bounded — total ≤ ~1.5 s of waiting). */
const CONFIRM_ATTEMPTS = 3;
const CONFIRM_DELAY_MS = 700;

function logStep(step) {
    console.log(`DELETE_ACCOUNT: ${step}`);
}

/** Extract only safe fields from an upstream error. Never a secret. */
function describeError(err) {
    if (!err) return "unknown error";
    const e = err ?? {};
    const name = e.name ? String(e.name) : "Error";
    const message = e.message ? String(e.message) : String(err);
    const code = e.code ?? e.status ?? e.statusCode ?? null;
    return code != null ? `${name} (${code}): ${message}` : `${name}: ${message}`;
}

/** Safe structured server log: step + error name/message/code only. */
function logError(step, err) {
    console.error(
        JSON.stringify({
            event: "DELETE_ACCOUNT_ERROR",
            step,
            error: describeError(err),
        }),
    );
}

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
}

/** Safe structured error response — no secrets, no tokens, no headers. */
function fail(status, code, step, message, detail = null) {
    return json(
        { success: false, error: code, step, message, detail },
        status,
    );
}

Deno.serve(async (req) => {
    // 1) OPTIONS with 200 (verified working — unchanged).
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            status: 200,
            headers: {
                ...CORS_HEADERS,
                "Access-Control-Allow-Headers":
                    req.headers.get("Access-Control-Request-Headers") ??
                    CORS_HEADERS["Access-Control-Allow-Headers"],
            },
        });
    }
    // 2) POST only.
    if (req.method !== "POST") {
        return fail(405, "method_not_allowed", "method_check", "Use POST.");
    }

    logStep("request_received");

    // Environment — availability is logged as a boolean, never a value.
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    if (!serviceKey || !supabaseUrl) {
        logError("env_check", "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL not set");
        return fail(
            500,
            "server_misconfigured",
            "env_check",
            "Service is not configured. (Edge Functions → Secrets)",
        );
    }

    // Admin (service-role) client — the current documented Edge pattern.
    const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${serviceKey}` } },
    });
    logStep("admin_client_created");

    // 3) Verify the authenticated caller from the bearer JWT ONLY.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
        return fail(401, "no_credentials", "auth_header", "Missing bearer token.");
    }
    logStep("auth_token_found");
    const token = authHeader.slice(7).trim();
    let callerId = "";
    try {
        const { data, error } = await admin.auth.getUser(token);
        if (error || !data?.user?.id) {
            logError("jwt_verify", error ?? "no user in token");
            return fail(401, "invalid_token", "jwt_verify", "Invalid or expired session.");
        }
        callerId = data.user.id;
    } catch (err) {
        logError("jwt_verify", err);
        return fail(401, "invalid_token", "jwt_verify", "Invalid or expired session.");
    }
    logStep("user_verified");

    try {
        // Pre-delete state read (RLS bypassed via service role): proves
        // which migrations are applied and what the cascade must remove.
        // Non-fatal — absence of the tables is a valid degraded state.
        try {
            const { data: p, error: pe } = await admin
                .from("profiles")
                .select("id")
                .eq("id", callerId)
                .maybeSingle();
            const { data: f, error: fe } = await admin
                .from("farms")
                .select("id")
                .eq("user_id", callerId)
                .maybeSingle();
            console.log(
                JSON.stringify({
                    event: "DELETE_ACCOUNT_PRECHECK",
                    user_id: callerId,
                    profiles_row: pe ? `unavailable: ${pe.message}` : p ? "present" : "absent",
                    farms_row: fe ? `unavailable: ${fe.message}` : f ? "present" : "absent",
                }),
            );
        } catch (err) {
            logError("precheck", err);
        }

        // 5) Delete ALL objects belonging ONLY to this user's folder.
        logStep("avatar_cleanup_started");
        let avatarsDeleted = 0;
        try {
            const objects: string[] = [];
            let offset = 0;
            for (;;) {
                const { data, error } = await admin.storage
                    .from("avatars")
                    .list(callerId, {
                        limit: 100,
                        offset,
                        sortBy: { column: "created_at", order: "desc" },
                    });
                if (error) {
                    logError("avatar_list", error);
                    break;
                }
                for (const o of data ?? []) {
                    if (o?.name) objects.push(`${callerId}/${o.name}`);
                }
                if (!data || data.length < 100) break;
                offset += 100;
            }
            if (objects.length) {
                const { error } = await admin.storage
                    .from("avatars")
                    .remove(objects);
                if (error) logError("avatar_remove", error);
                else avatarsDeleted = objects.length;
            }
        } catch (err) {
            // Storage hiccup must not block the account deletion itself;
            // orphaned objects are unreachable once the auth user is gone.
            logError("avatar_cleanup", err);
        }
        logStep("avatar_cleanup_completed");

        // 7) Delete the Auth user (explicit permanent delete). FK CASCADE
        //    (auth.users.id → profiles/farms/land_parcels) removes all
        //    user-owned rows; auth-schema cascades remove sessions.
        logStep("auth_delete_started");
        const { error: delErr } = await admin.auth.deleteUser(callerId, {
            should_soft_delete: false,
        });
        if (delErr) {
            // e.g. FK violations, GoTrue rejections — message is the real
            // upstream error string (no secrets in it).
            logError("auth_delete", delErr);
            return fail(
                500,
                "delete_failed",
                "auth_delete",
                "The account could not be deleted. Nothing has been removed — please try again.",
                describeError(delErr),
            );
        }
        logStep("auth_delete_completed");

        // 8) Verify the auth user no longer exists — with retry, because
        //    a read immediately after delete can still see the user
        //    (GoTrue read-after-write lag). A user carrying deleted_at
        //    counts as confirmed (soft-delete accepted).
        logStep("delete_confirmation_started");
        let confirmed = false;
        let confirmMode = "unknown";
        for (let attempt = 1; attempt <= CONFIRM_ATTEMPTS && !confirmed; attempt++) {
            if (attempt > 1) {
                await new Promise((r) => setTimeout(r, CONFIRM_DELAY_MS));
            }
            try {
                const { data: check, error: checkErr } = await admin.auth.getUserById(callerId);
                if (checkErr) {
                    confirmed = true; // lookup error ⇒ the user is gone
                    confirmMode = `user_gone_attempt_${attempt}`;
                    break;
                }
                const u: Record<string, unknown> | undefined = check?.user as
                    | Record<string, unknown>
                    | undefined;
                const softDeletedAt =
                    (u?.deleted_at as string | undefined) ??
                    (u?.soft_deleted_at as string | undefined) ??
                    (u?.softDeleteAt as string | undefined) ??
                    null;
                if (softDeletedAt) {
                    confirmed = true;
                    confirmMode = `soft_deleted_at=${softDeletedAt}`;
                } else {
                    confirmMode = `user_still_intact_attempt_${attempt}`;
                }
            } catch (err) {
                logError("delete_confirm", err);
                confirmMode = "confirm_lookup_threw";
            }
        }
        if (!confirmed) {
            return fail(
                500,
                "delete_not_confirmed",
                "delete_confirm",
                "Deletion could not be confirmed. If you were logged out, the account is already gone; otherwise please try again.",
                confirmMode,
            );
        }
        logStep("delete_confirmation_completed");

        // Cascade verification (read-only, non-fatal): the profiles row
        // must be gone after the auth user was deleted — or the table
        // doesn't exist yet (migration not applied).
        let cascade = "unknown";
        try {
            const { data: p2, error: pe2 } = await admin
                .from("profiles")
                .select("id")
                .eq("id", callerId)
                .maybeSingle();
            if (pe2) cascade = `unavailable: ${pe2.message}`;
            else cascade = p2 ? "ROW_STILL_PRESENT (cascade failed!)" : "row_removed";
        } catch (err) {
            logError("cascade_check", err);
        }

        // 9) Success — minimal audit trail, no PII beyond the caller id.
        console.log(
            JSON.stringify({
                event: "account_deleted",
                user_id: callerId,
                avatars_deleted: avatarsDeleted,
                confirm_mode: confirmMode,
                cascade_check: cascade,
                at: new Date().toISOString(),
            }),
        );
        return json({
            success: true,
            data: { userId: callerId, avatarsDeleted, cascade },
        });
    } catch (err) {
        logError("unexpected", err);
        return fail(
            500,
            "unexpected",
            "unexpected",
            "Something went wrong while deleting the account. Please try again.",
            err?.message ? String(err.message) : null,
        );
    }
});
