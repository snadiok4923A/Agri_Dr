/**
 * ProtectedRoute.jsx — gate for authenticated-only areas.
 *
 * • While the initial session check runs (refreshing the page), a minimal
 *   splash renders instead of flashing the login screen.
 * • Unauthenticated visitors are redirected to /login; the attempted
 *   location is remembered so login can return them to it.
 * • Already-authenticated visitors hitting /login or /signup bounce back
 *   to the app (handled inside Login/Signup via the same pattern).
 *
 * Pure routing logic — zero styling coupling; the splash markup is the
 * only presentational bit and is trivially replaceable.
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function ProtectedRoute({ children }) {
    const { isAuthenticated, initializing } = useAuth();
    const location = useLocation();

    if (initializing) {
        // Session restore in flight (e.g. page refresh) — hold the shell.
        return (
            <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
                <span aria-live="polite">Loading…</span>
            </div>
        );
    }

    if (!isAuthenticated) {
        // Remember where the user wanted to go; Login sends them back here.
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return children;
}
