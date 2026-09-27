/**
 * ProtectedRoute.jsx — gate for the app shell.
 *
 * TWO-STATE MODEL (strict): the Supabase session is the ONLY source of
 * truth — real session → logged in; no session → logged out.
 *
 * "Skip for now" is a PUBLIC-BROWSING PREFERENCE, not authentication:
 * visitors who skipped may browse the public website (same shell), but
 * they get NO user object, NO authenticated account controls, and NO
 * private farm data (farm pages render sign-in empty states instead).
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function ProtectedRoute({ children }) {
    // Visitors who skipped auth may stay on the public website without an
    // account (spec §11 — skip must keep working). This grants browsing,
    // never identity.
    const { isAuthenticated, isGuest, initializing } = useAuth();
    const location = useLocation();

    if (initializing) {
        // Session restore in flight (e.g. page refresh) — hold the shell.
        return (
            <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
                <span aria-live="polite">Loading…</span>
            </div>
        );
    }

    if (!isAuthenticated && !isGuest) {
        // No session and never skipped: send the visitor to /login and
        // remember where they wanted to go so login can return them there.
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return children;
}
