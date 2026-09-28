/**
 * authService.js — ALL Supabase auth operations + friendly error mapping.
 *
 * Pure logic layer: no React, no UI, no CSS. The AuthProvider consumes
 * these functions; Login/Signup UI components only ever call AuthProvider
 * methods. Redesign the UI freely — this layer stays untouched.
 *
 * Rules enforced here (spec §20/§22):
 *   • raw Supabase/technical errors are converted to friendly messages
 *   • full error details go to console (dev diagnostics, never secrets)
 *   • no password/secret logging, ever
 */

import { supabase } from "./supabaseClient";

/** Google OAuth redirect target — origin + Vite base path. On GitHub
 *  Pages the app lives at /Agri_Dr/, so origin alone would 404. */
export function getOAuthRedirectUrl() {
    return window.location.origin + import.meta.env.BASE_URL;
}

/** True when the error is a genuine network failure (offline, DNS…). */
function isNetworkError(error) {
    if (!error) return false;
    const msg = String(error.message || error).toLowerCase();
    return (
        msg.includes("failed to fetch") ||
        msg.includes("networkerror") ||
        msg.includes("network error") ||
        msg.includes("load failed") ||
        msg.includes("fetch failed")
    );
}

/** Map a Supabase auth error to a user-friendly message (spec §20).
 *  Unknown errors fall back to a generic message; details hit console. */
export function friendlyAuthError(error, context = "") {
    // Console keeps the technical detail — never logs passwords (none exist here)
    if (error) console.warn(`[auth] ${context || "auth error"}:`, error.message || error);

    if (isNetworkError(error)) {
        return "Unable to connect. Please check your internet connection and try again.";
    }

    const msg = String(error?.message || error || "").toLowerCase();

    if (msg.includes("invalid login credentials")) {
        return "Email or password is incorrect.";
    }
    if (msg.includes("email not confirmed")) {
        return "Please confirm your email before logging in.";
    }
    if (msg.includes("already registered") || msg.includes("already exists")) {
        return "An account with this email already exists. Please log in.";
    }
    if (msg.includes("user already exists")) {
        return "An account with this email already exists. Please log in.";
    }
    if (msg.includes("rate limit") || msg.includes("too many requests")) {
        return "Too many attempts. Please wait a moment and try again.";
    }
    if (msg.includes("password should be at least")) {
        return "Your password is too short. Please use at least 6 characters.";
    }
    if (msg.includes("unable to validate email") || msg.includes("invalid email")) {
        return "Please enter a valid email address.";
    }
    if (msg.includes("signups not allowed")) {
        return "New sign-ups are currently disabled. Please contact support.";
    }
    if (msg.includes("oauth") || msg.includes("provider")) {
        return "Google sign-in could not be completed. Please try again.";
    }
    return "Something went wrong. Please try again in a moment.";
}

/** Email + Password sign-up. With email confirmation enabled server-side,
 *  a successful call still means "check your inbox" — the returned
 *  `needsEmailConfirmation` flag makes that explicit to the UI.
 *  @returns {{ needsEmailConfirmation: boolean }} */
export async function signUpWithEmail({ email, password }) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // Most projects: session is null until the user clicks the email link.
    return { needsEmailConfirmation: !data?.session };
}

/** Email + Password sign-in. */
export async function signInWithEmail({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

/** Google OAuth — the ONLY thing the app does for Google login: hand off
 *  to Google's own page. No Google password ever touches this app. */
export async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: getOAuthRedirectUrl(),
        },
    });
    if (error) throw error;
}

/** Sign out everywhere and clear local session state. */
export async function signOutUser() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

/**
 * Permanently delete the signed-in account via the `delete-account`
 * Edge Function (supabase/functions/delete-account).
 *
 * SECURITY (spec §4/§5): the privileged service-role key lives ONLY in
 * the Edge Function's server env — nothing is added to this bundle. The
 * request carries just the caller's own session token; the function
 * derives the target user from that verified JWT, so a client can never
 * name another account as the deletion target.
 *
 * No-ops (returns false) without a live session or a configured client.
 * Throws on failure — the UI must only show success when THIS resolves.
 */
export async function deleteCurrentUserAccount() {
    if (!supabase) return false;
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session) return false; // §11/§13: nothing to delete without a user

    const { data, error } = await supabase.functions.invoke("delete-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) {
        // Diagnostics: the function returns {error:{code,op,detail}} on
        // failure (HTTP error bodies arrive via error.context). Logged to
        // the console ONLY — the UI keeps its friendly message, and no
        // token/secret is ever included in these fields.
        const body = data?.error || error?.context?.error || error?.context || null;
        if (body) console.warn("[auth] delete-account server error:", JSON.stringify(body));
        throw error;
    }
    if (!data?.success) {
        if (data?.error) console.warn("[auth] delete-account server error:", JSON.stringify(data.error));
        throw new Error(data?.error?.message || "Account deletion failed.");
    }
    return true;
}
