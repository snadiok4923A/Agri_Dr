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

/** Flatten a Supabase session into the shape the app consumes. */
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

    // Initial session restore (also handles the Google OAuth return URL)
    useEffect(() => {
        let mounted = true;
        supabase.auth
            .getSession()
            .then(({ data }) => {
                if (!mounted) return;
                setSession(data.session ?? null);
            })
            .catch(console.warn)
            .finally(() => {
                if (mounted) setInitializing(false);
            });

        // Live updates: login, logout, token refresh/expiration, OAuth return
        const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
            if (!mounted) return;
            setSession(newSession ?? null);
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

    const signOut = useCallback(async () => {
        setLoading(true);
        try {
            await signOutUser();
        } finally {
            setLoading(false);
        }
    }, []);

    const value = useMemo(
        () => ({
            user: toAuthUser(session),
            session,
            loading,
            initializing,
            isAuthenticated: !!session,
            signIn,
            signUp,
            signInWithGoogle,
            signOut,
        }),
        [session, loading, initializing, signIn, signUp, signInWithGoogle, signOut],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access auth state + actions anywhere in the component tree. */
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
}
