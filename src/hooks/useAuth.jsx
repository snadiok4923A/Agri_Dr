/**
 * AuthContext.jsx — global authentication state for the whole app.
 *
 * ARCHITECTURE (spec §10/§14):
 *
 *   authService.js (pure Supabase logic)  ← no React, no UI
 *            ↓
 *   AuthProvider (this file: session state + actions)
 *            ↓
 *   App / ProtectedRoute / Header / Login / Signup  ← presentation only
 *
 * UI components call `signIn / signUp / signInWithGoogle / signOut` from
 * `useAuth()` and read `user / session / loading / initializing`. They
 * can be redesigned freely without touching auth logic.
 *
 * AUTHENTICATION MODEL (strict): there are exactly TWO states.
 *
 *   real Supabase session/user  → LOGGED IN  (authenticated UI + data)
 *   no Supabase session         → LOGGED OUT (public UI, no private data)
 *
 * Nothing else is authentication: not onboarding state, not localStorage
 * flags, not a "guest"/"demo" identity. The old guest user object was a
 * fabricated logged-in state and has been removed (spec: no fake user).
 *
 * "Skip for now" on the auth pages is ONLY a routing preference: it keeps
 * the visitor on the public website after they skip, and survives refresh
 * so the redirect flow isn't re-forced. It grants NO user object, NO
 * authenticated controls, and NO private farm data.
 *
 * Detected states (spec §9): logged in, logged out, Google login
 * completed (via detectSessionInUrl + onAuthStateChange), session
 * restored after refresh (persistSession), session expiration.
 */

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import {
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle as googleSignIn,
    signOutUser,
} from "../lib/authService";

const AuthContext = createContext(null);

/** "Skip for now" routing preference (spec §11: skip must keep working).
 *  Pure navigation state — never authentication, never a user identity.
 *  Keeps the historical "krisiveda.guest" key name so visitors who
 *  skipped before this change keep their preference across refresh. */
const SKIPPED_KEY = "krisiveda.guest";

function readSkippedFlag() {
    try {
        return localStorage.getItem(SKIPPED_KEY) === "1";
    } catch {
        return false;
    }
}

function clearSkippedFlag() {
    try {
        localStorage.removeItem(SKIPPED_KEY);
    } catch {
        /* private mode — flag simply won't persist */
    }
}

/** Flatten a Supabase session into the shape the app consumes.
 *  Returns a REAL user or null — no fabricated objects, ever. */
function toAuthUser(session) {
    if (!session?.user) return null;
    const u = session.user;
    const meta = u.user_metadata || {};
    return {
        id: u.id,
        email: u.email || meta.email || "",
        // Google users: real name/avatar from the provider profile (spec §13)
        name: meta.full_name || meta.name || "",
        avatarUrl: meta.avatar_url || meta.picture || "",
        provider: u.app_metadata?.provider || "email",
        emailConfirmed: !!u.email_confirmed_at || !!u.confirmed_at,
        raw: u,
    };
}

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [initializing, setInitializing] = useState(true);
    /** Per-request busy flag — true while any auth operation runs
     *  (sign-in / sign-up / Google / sign-out). UI disables buttons. */
    const [loading, setLoading] = useState(false);
    /** "Skip for now" routing preference — NOT an auth state. */
    const [skipped, setSkipped] = useState(readSkippedFlag);

    // Initial session restore (also handles the Google OAuth return URL)
    useEffect(() => {
        let mounted = true;
        supabase.auth
            .getSession()
            .then(({ data }) => {
                if (!mounted) return;
                setSession(data.session ?? null);
                // A real session outranks the skip preference.
                if (data.session) {
                    setSkipped(false);
                    clearSkippedFlag();
                }
            })
            .catch(console.warn)
            .finally(() => {
                if (mounted) setInitializing(false);
            });

        // Live updates: login, logout, token refresh/expiration, OAuth return
        // The Supabase session IS the single source of truth: every
        // consumer re-renders from this one state change.
        const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
            if (!mounted) return;
            setSession(newSession ?? null);
            if (newSession) {
                setSkipped(false);
                clearSkippedFlag();
            } else if (event === "SIGNED_OUT") {
                // Signing out clears the skip preference too — the user is
                // plain LOGGED OUT. The onboarding provider reacts to the
                // same identity change and wipes all user-specific state.
                setSkipped(false);
                clearSkippedFlag();
            }
        });

        return () => {
            mounted = false;
            sub.subscription.unsubscribe();
        };
    }, []);

    const signIn = useCallback(async ({ email, password }) => {
        setLoading(true);
        try {
            return await signInWithEmail({ email, password });
        } finally {
            setLoading(false);
        }
    }, []);

    const signUp = useCallback(async ({ email, password }) => {
        setLoading(true);
        try {
            return await signUpWithEmail({ email, password });
        } finally {
            setLoading(false);
        }
    }, []);

    const signInWithGoogle = useCallback(async () => {
        setLoading(true);
        try {
            await googleSignIn();
            // Successful call redirects the whole tab to Google — no
            // state change to await here; onAuthStateChange handles the
            // return trip.
        } finally {
            setLoading(false);
        }
    }, []);

    /** Sign out: Supabase clears the session (incl. its auth storage
     *  entry) and emits SIGNED_OUT; the listener above updates the app
     *  state and the onboarding provider wipes every piece of user-
     *  specific data. Nothing is deleted on the server — the user's farm
     *  rows stay in Supabase for their next login. */
    const signOut = useCallback(async () => {
        setLoading(true);
        try {
            await signOutUser();
        } finally {
            setLoading(false);
        }
    }, []);

    /** "Skip for now" on Login/Signup — remember the PUBLIC-browsing
     *  preference so refreshes don't bounce the visitor back to /login.
     *  This grants NOTHING else: no user object, no authenticated UI. */
    const enterGuestMode = useCallback(() => {
        setSkipped(true);
        try {
            localStorage.setItem(SKIPPED_KEY, "1");
        } catch {
            /* private mode — preference only lasts this page load */
        }
    }, []);

    /** Clearing the skip preference (e.g. explicit sign-in prompt path). */
    const exitGuestMode = useCallback(() => {
        setSkipped(false);
        clearSkippedFlag();
    }, []);

    const value = useMemo(
        () => ({
            // A user object ONLY when a real Supabase session exists.
            user: session ? toAuthUser(session) : null,
            session,
            loading,
            initializing,
            isAuthenticated: !!session,
            /** Public-browsing preference after "Skip for now". Deliberately
             *  NOT auth state: true never implies a user or session. */
            isGuest: !session && skipped,
            enterGuestMode,
            exitGuestMode,
            signIn,
            signUp,
            signInWithGoogle,
            signOut,
        }),
        [
            session,
            loading,
            initializing,
            skipped,
            enterGuestMode,
            exitGuestMode,
            signIn,
            signUp,
            signInWithGoogle,
            signOut,
        ],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access auth state + actions anywhere in the component tree. */
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
}
