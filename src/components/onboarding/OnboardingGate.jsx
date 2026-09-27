/*
 * OnboardingGate.jsx — routing logic for first-run onboarding.
 *
 * Decides, on every render of the protected shell, whether the user
 * still needs onboarding and renders the wizard INSTEAD of the shell
 * until they finish or skip:
 *
 *   signed-in user → needs onboarding unless the server (or local
 *                    mirror, when tables are absent) says completed;
 *                    a previously-skipped user is asked once per visit
 *                    and can skip again (skip ≠ complete)
 *   guest          → only the language step is required, then never
 *                    again (local flag)
 *
 * RESUME: a partially-completed wizard (Back/Next drafts) is re-offered
 * with values prefilled from the local mirror — the user never re-enters
 * what they already typed.
 *
 * While the identity/persistence state is still loading, the shell holds
 * with the same minimal splash ProtectedRoute uses — no flicker of the
 * wizard for returning users.
 */

import OnboardingWizard from "./OnboardingWizard";
import GuestLanguageGate from "./GuestLanguageGate";
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
    const { status, completed, isGuest: onboardingIsGuest, redo } = useOnboarding();
    const { isGuest: authIsGuest } = useAuth();
    const isGuest = onboardingIsGuest || authIsGuest;

    if (status === "loading") return <OnboardingSplash />;

    // Guest WITH redo (empty-state CTA): the full survey, but the auth
    // step is skipped — they already declined sign-in once.
    if (isGuest && redo) return <OnboardingWizard includeAuth={false} />;

    // Fresh guests only ever answer the language question; they are never
    // forced through auth or the farm survey, and the answer is remembered.
    if (isGuest) return <GuestLanguageGate>{children}</GuestLanguageGate>;

    if (!completed) return <OnboardingWizard />;

    return children;
}
