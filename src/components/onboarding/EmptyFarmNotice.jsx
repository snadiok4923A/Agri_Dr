/*
 * EmptyFarmNotice.jsx — empty state for farm-dependent pages.
 *
 * Three situations (spec §7/§8):
 *   • signed out      → "Sign in to view your farm details." + Sign In CTA
 *                       (no previous user's data may ever appear here)
 *   • guest           → same sign-in prompt (they skipped authentication)
 *   • authenticated   → "Complete your farm details…" + CTA that re-opens
 *                       the wizard via resetOnboarding()
 *
 * Used by MyFarm (whole page), Finance (page) and Dashboard/Improve/
 * Insights (sections/pages).
 */

import { Sprout } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { useOnboarding } from "../../hooks/useOnboarding";
import { useAuth } from "../../hooks/useAuth";
import "./EmptyFarmNotice.css";

/* Per-topic signed-out messages (spec §8): each farm-dependent area
   explains what signing in unlocks, via the existing i18n system. */
const SIGNED_OUT_TITLE_KEY = {
    farm: "onboarding.empty.signInToView",
    finance: "onboarding.empty.signInToView",
    improve: "onboarding.empty.signInImprove",
    insights: "onboarding.empty.signInInsights",
};

export default function EmptyFarmNotice({
    variant = "page",
    finance = false,
    topic = "farm",
}) {
    const { t } = useLanguage();
    const { resetOnboarding } = useOnboarding();
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();

    /* TWO-STATE MODEL (spec): signed in or not. Skipped-auth visitors and
       plain logged-out users are the SAME state — not authenticated — so
       they all get the sign-in prompt. Only a real authenticated user
       resumes/re-opens the survey. */
    const signedOut = !isAuthenticated;
    const handleClick = () => {
        if (signedOut) navigate("/login");
        else resetOnboarding();
    };

    return (
        <section
            className={`emptyfarm emptyfarm--${variant}`}
            aria-live="polite"
        >
            <span className="emptyfarm__icon" aria-hidden="true">
                <Sprout size={variant === "page" ? 30 : 24} />
            </span>
            <h3 className="emptyfarm__title">
                {t(
                    signedOut
                        ? SIGNED_OUT_TITLE_KEY[topic] || "onboarding.empty.signInToView"
                        : finance
                          ? "onboarding.empty.financeTitle"
                          : "onboarding.empty.farmTitle",
                )}
            </h3>
            <p className="emptyfarm__body">{t("onboarding.empty.farmBody")}</p>
            <button
                type="button"
                className="emptyfarm__cta"
                onClick={handleClick}
            >
                {t(
                    signedOut
                        ? "onboarding.empty.signInCta"
                        : "onboarding.empty.finish",
                )}
            </button>
        </section>
    );
}
