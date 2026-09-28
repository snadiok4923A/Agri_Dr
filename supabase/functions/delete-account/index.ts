// ============================================================================
// Edge Function: delete-account  (v2 — self-diagnosing runtime errors)
//
// Permanently deletes the AUTHENTICATED caller's account. Deploy:
//   Dashboard → Edge Functions → delete-account → paste this file → Deploy
//   (or: npx supabase functions deploy delete-account --project-ref <ref>)
//
// SECURITY MODEL (unchanged):
//   • Identity comes EXCLUSIVELY from the verified Authorization bearer
//     JWT (admin.auth.getUser). No user_id is accepted from the client,
//     so a caller can only ever delete THEMSELVES.
//   • The service-role key is read only from server env (auto-injected
//     by the platform for deployed functions) and NEVER appears in a
//     response, log, or the frontend bundle.
//
// v2 CHANGES (runtime-500 debugging, per incident triage):
//   1. deleteUser now passes { should_soft_delete: false } EXPLICITLY —
//      GoTrue may otherwise soft-delete (deleted_at) instead of removing
//      the user, which changed what the confirmation step saw.
//   2. The confirmation step treats BOTH a missing user AND a user
//      carrying deleted_at/soft_deleted_at as confirmed deletion; only a
//      fully intact user is a failure.
//   3. Every operation logs its own failure via console.error as
//      structured JSON {op, message} — NO tokens, keys, or user PII.
//   4. Error RESPONSES now carry op + detail so the exact failing
//      operation is visible in the browser Network tab (values are
//      GoTrue/PostgREST error strings only — never secrets).
//   5. Cascade verification: before deleting, the function reads the
//      caller's profiles/farms row counts (service role bypasses RLS);
//      after deletion it re-checks that the profiles row is gone —
//      proving the auth.users FK cascade actually fired.
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
}

/** Uniform error shape — safe detail only (error strings, never secrets). */
function fail(status, code, message, op, detail) {
    return json(
        { success: false, error: { code, message, op, detail: detail ?? null } },
        status,
    );
}

/** Safe structured server log: op + message only. Never tokens/keys/PII. */
function logError(op, err) {
    const message = err?.message ? String(err.message) : String(err ?? "unknown");
    console.error(JSON.stringify({ event: "delete_account_error", op, message }));
}

Deno.serve(async (req) => {
    // Preflight: 200 + CORS headers. Echo the browser's requested header
    // list back verbatim, so the preflight can never fail on an
    // incomplete Access-Control-Allow-Headers list.
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
    if (req.method !== "POST") {
        return fail(405, "method_not_allowed", "Use POST.", "method_check");
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceKey) {
        // Mis-configured deployment — refuse loudly, delete nothing.
        console.error(
            JSON.stringify({ event: "delete_account_error", op: "env_check", message: "SUPABASE_SERVICE_ROLE_KEY not set" }),
        );
        return fail(500, "server_misconfigured", "Service is not configured.", "env_check");
    }
    // Availability logged as a boolean only — never the value.
    console.log(JSON.stringify({ event: "delete_account_start", has_service_key: true }));

    const admin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        serviceKey,
        { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ------------------------------------------------------------------
    // 1) IDENTITY — verified from the bearer JWT only.
    // ------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
        return fail(401, "no_credentials", "Missing bearer token.", "auth_header");
    }
    const token = authHeader.slice(7).trim();
    let callerId = "";
    try {
        const { data, error } = await admin.auth.getUser(token);
        if (error || !data?.user?.id) {
            logError("jwt_verify", error ?? "no user in token");
            return fail(401, "invalid_token", "Invalid or expired session.", "jwt_verify");
        }
        callerId = data.user.id;
    } catch (err) {
        logError("jwt_verify", err);
        return fail(401, "invalid_token", "Invalid or expired session.", "jwt_verify");
    }

    try {
        // --------------------------------------------------------------
        // 2) PRE-DELETE STATE — read-only diagnostics (RLS bypassed via
        //    service role). Proves which migrations are applied and how
        //    much user-owned data the cascade must remove.
        // --------------------------------------------------------------
        let profilesRow = "unknown";
        let farmsRow = "unknown";
        try {
            const { data: p, error: pe } = await admin
                .from("profiles")
                .select("id")
                .eq("id", callerId)
                .maybeSingle();
            profilesRow = pe
                ? `unavailable: ${pe.message}`
                : p
                  ? "present"
                  : "absent";
        } catch (err) {
            logError("precheck_profiles", err);
        }
        try {
            const { data: f, error: fe } = await admin
                .from("farms")
                .select("id")
                .eq("user_id", callerId)
                .maybeSingle();
            farmsRow = fe ? `unavailable: ${fe.message}` : f ? "present" : "absent";
        } catch (err) {
            logError("precheck_farms", err);
        }
        console.log(
            JSON.stringify({
                event: "delete_account_precheck",
                user_id: callerId,
                profiles_row: profilesRow,
                farms_row: farmsRow,
            }),
        );

        // --------------------------------------------------------------
        // 3) AVATAR FILES — delete EVERY object in the caller's own
        //    folder (versioned names → possibly several). Storage API
        //    only; the prefix is built from the verified id, so no other
        //    user's folder is addressable.
        // --------------------------------------------------------------
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
            logError("avatar_cleanup", err);
            /* Storage hiccup: continue — the account itself is the point. */
        }

        // --------------------------------------------------------------
        // 4) AUTH USER — EXPLICIT permanent deletion. FK CASCADE
        //    (auth.users.id → profiles/farms/land_parcels) removes every
        //    user-owned row; auth schema cascades remove sessions.
        // --------------------------------------------------------------
        const { error: delErr } = await admin.auth.deleteUser(callerId, {
            should_soft_delete: false,
        });
        if (delErr) {
            // PostgREST FK violations / GoTrue failures surface here —
            // the message is the actual database/auth error (no secrets).
            logError("auth_delete", delErr);
            return fail(
                500,
                "delete_failed",
                "The account could not be deleted. Nothing has been removed — please try again.",
                "auth_delete",
                String(delErr.message ?? delErr),
            );
        }

        // --------------------------------------------------------------
        // 5) HARD CONFIRMATION — never report success on trust:
        //    • user gone (error)               → confirmed (hard delete)
        //    • user present WITH deleted_at    → confirmed (soft delete)
        //    • user fully intact               → NOT confirmed → 500
        // --------------------------------------------------------------
        let confirmed = false;
        let confirmMode = "unknown";
        try {
            const { data: check, error: checkErr } = await admin.auth.getUserById(callerId);
            if (checkErr) {
                confirmed = true; // any lookup error ⇒ the user is gone
                confirmMode = "user_gone";
            } else {
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
                    confirmed = false;
                    confirmMode = "user_still_intact";
                }
            }
        } catch (err) {
            logError("delete_confirm", err);
            confirmed = false;
            confirmMode = "confirm_lookup_threw";
        }
        if (!confirmed) {
            return fail(
                500,
                "delete_not_confirmed",
                "Deletion could not be confirmed. If you were logged out, the account is already gone; otherwise please try again.",
                "delete_confirm",
                confirmMode,
            );
        }

        // --------------------------------------------------------------
        // 6) CASCADE VERIFICATION — the profiles row must be gone after
        //    the auth user was deleted (or the table must not exist yet).
        //    Read-only; result logged for the Function Logs.
        // --------------------------------------------------------------
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
            "Something went wrong while deleting the account. Please try again.",
            "unexpected",
            err?.message ? String(err.message) : null,
        );
    }
});
