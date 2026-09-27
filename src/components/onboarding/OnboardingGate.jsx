/*
 * OnboardingGate.jsx — routing logic for onboarding.
 *
 * FLOW (spec): Language (mandatory, BEFORE auth, in AuthLanguageGate on
 * the public auth routes) → Authentication → survey (this gate) → Done
 * → website.
 *
 * This gate wraps the PROTECTED shell and renders the farm-details survey
 * INSTEAD of the shell exactly when an AUTHENTICATED user still needs it
 * (two-state model — the session is the only source of truth):
 *
 *   authenticated user → needs onboarding unless the server (or the
 *                    user-scoped local mirror, when tables are absent)
 *                    says completed; a user who skipped the FARM DETAILS
 *                    step is asked once per visit and can skip again
 *                    (skipping farm details ≠ skipping authentication)
 *   no session      → NEVER sees the survey. Visitors who skipped auth
 *                    (or simply logged out) have no account to onboard:
 *                    farm-dependent pages show "Sign in to view your
 *                    farm details." empty states instead.
 *
 * RESUME: a partially-completed survey (Back/Next drafts) is re-offered
 * with values prefilled from the user-scoped local mirror.
 *
 * While the identity/persistence state is still loading, the shell holds
 * with the same minimal splash ProtectedRoute uses — no flicker of the
 * wizard for returning users.
 */

import OnboardingWizard from "./OnboardingWizard";
import { useOnboarding } from "../../hooks/useOnboarding";
import { useAuth } from "../../hooks/useAuth";

function OnboardingSplash() {
    return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
            <span aria-live="polite">Loading…</span>
        </div>
    );
}

export default function OnboardingGate({ children }) {
    const { status, completed, skipped } = useOnboarding();
    const { isAuthenticated } = useAuth();

    if (status === "loading") return <OnboardingSplash />;

    // The farm-details survey exists ONLY for real authenticated users
    // (two-state model): without a Supabase session there is no account
    // to onboard — public visitors (incl. "Skip for now") go straight
    // through and see sign-in prompts on farm pages instead.
    if (!isAuthenticated) return children;

    // Skipping FARM DETAILS does not re-block the website (spec §8): a
    // logged-in user who skipped lands in the app and the farm-dependent
    // pages show "Complete your farm details…" empty states. The survey
    // re-opens only via those empty states' CTA (resetOnboarding).
    if (!completed && !skipped) return <OnboardingWizard />;

    return children;
}
