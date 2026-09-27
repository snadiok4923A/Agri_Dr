/*
 * OnboardingGate.jsx — routing logic for onboarding.
 *
 * FLOW (spec): Language (mandatory, BEFORE auth, in AuthLanguageGate on
 * the public auth routes) → Authentication → survey (this gate) → Done
 * → website.
 *
 * This gate wraps the PROTECTED shell and renders the farm-details survey
 * INSTEAD of the shell exactly when an authenticated user still needs it:
 *
 *   signed-in user → needs onboarding unless the server (or local
 *                    mirror, when tables are absent) says completed;
 *                    a previously-skipped user is asked once per visit
 *                    and can skip again (skip ≠ complete)
 *   guest          → NEVER sees the survey. They skipped authentication,
 *                    so their farm details stay local-only/absent and the
 *                    farm-dependent pages show empty states (spec: no
 *                    fake data, no authenticated records without auth).
 *
 * RESUME: a partially-completed survey (Back/Next drafts) is re-offered
 * with values prefilled from the local mirror.
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
    const { status, completed } = useOnboarding();
    const { isGuest } = useAuth();

    if (status === "loading") return <OnboardingSplash />;

    // Guests bypass the survey entirely — authentication was skipped, so
    // no authenticated farm record may exist (spec §4/§12).
    if (isGuest) return children;

    if (!completed) return <OnboardingWizard />;

    return children;
}
