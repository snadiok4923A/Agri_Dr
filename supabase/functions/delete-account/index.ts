// ============================================================================
// Edge Function: delete-account
//
// Permanently deletes the AUTHENTICATED caller's account. Deploy:
//   supabase functions deploy delete-account --project-ref <ref>
// ( SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically. )
//
// SECURITY MODEL (spec §4/§5/§6/§15):
//   • The privileged key used here is the SERVICE ROLE, read only from
//     server-side env — it NEVER ships in frontend code or the GitHub
//     Pages bundle. The browser only ever POSTs its own session token.
//   • Identity comes EXCLUSIVELY from the verified Authorization bearer
//     JWT (admin.auth.getUser validates signature + expiry against
//     GoTrue). There is no user_id in the request body to trust — a
//     caller can only ever delete THEMSELVES.
//   • The caller's id is the ownership boundary for every deletion:
//     only "avatars/<callerId>/…" objects and the caller's own rows.
//
// DATA MODEL: profiles / farms / land_parcels reference auth.users(id)
// ON DELETE CASCADE (migration_onboarding.sql), so removing the auth
// user removes every user-owned row — no manual table-by-table SQL and
// no risk of touching another user's data. Shared/reference data is
// untouched because nothing else is keyed to the user.
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

/** Uniform error shape — friendly message only, never internals. */
function fail(status, code, message) {
    return json({ success: false, error: { code, message } }, status);
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
        return fail(405, "method_not_allowed", "Use POST.");
    }

    const admin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { autoRefreshToken: false, persistSession: false } },
    );
    if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
        // Mis-configured deployment — refuse loudly, delete nothing.
        return fail(500, "server_misconfigured", "Service is not configured.");
    }

    // ------------------------------------------------------------------
    // 1) IDENTITY — verified from the bearer JWT only (spec §5).
    // ------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
        return fail(401, "no_credentials", "Missing bearer token.");
    }
    const token = authHeader.slice(7).trim();
    let callerId = "";
    try {
        const { data, error } = await admin.auth.getUser(token);
        if (error || !data?.user?.id) {
            return fail(401, "invalid_token", "Invalid or expired session.");
        }
        callerId = data.user.id;
    } catch {
        return fail(401, "invalid_token", "Invalid or expired session.");
    }

    try {
        // --------------------------------------------------------------
        // 2) AVATAR FILES — delete EVERY object in the caller's own
        //    folder (versioned names mean there can be several). Storage
        //    API only, never direct SQL against storage.objects (§7).
        //    Path prefix is built from the verified id, so no other
        //    user's folder is addressable, ever.
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
                if (error) break;
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
                if (!error) avatarsDeleted = objects.length;
            }
        } catch {
            /* Storage hiccup: continue — the account itself is the point.
               Orphaned objects are unreachable once the user is gone and
               can be swept by an admin later. */
        }

        // --------------------------------------------------------------
        // 3) AUTH USER — one privileged delete. FK CASCADE
        //    (auth.users.id → profiles/farms/land_parcels) removes every
        //    user-owned row; the auth schema's own cascade removes the
        //    user's sessions/refresh tokens.
        // --------------------------------------------------------------
        const { error: delErr } = await admin.auth.deleteUser(callerId);
        if (delErr) {
            return fail(
                500,
                "delete_failed",
                "The account could not be deleted. Nothing has been removed — please try again.",
            );
        }

        // --------------------------------------------------------------
        // 4) HARD CONFIRMATION — never report success on trust (§9):
        //    re-fetch the user; it MUST now fail. If it still succeeds
        //    the deletion did not take effect and we say so.
        // --------------------------------------------------------------
        let confirmed = false;
        try {
            const { error: checkErr } = await admin.auth.getUserById(callerId);
            confirmed = !!checkErr; // any error ⇒ the user is gone
        } catch {
            confirmed = false;
        }
        if (!confirmed) {
            return fail(
                500,
                "delete_not_confirmed",
                "Deletion could not be confirmed. If you were logged out, the account is already gone; otherwise please try again.",
            );
        }

        // Minimal audit trail (no PII beyond the id, no secrets).
        console.log(
            JSON.stringify({
                event: "account_deleted",
                user_id: callerId,
                avatars_deleted: avatarsDeleted,
                at: new Date().toISOString(),
            }),
        );

        return json({ success: true, data: { userId: callerId, avatarsDeleted } });
    } catch {
        return fail(
            500,
            "unexpected",
            "Something went wrong while deleting the account. Please try again.",
        );
    }
});
