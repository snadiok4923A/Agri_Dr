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

export default function EmptyFarmNotice({ variant = "page", finance = false }) {
    const { t } = useLanguage();
    const { isGuest, resetOnboarding } = useOnboarding();
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();

    /* Signed-out users and guests must SIGN IN before any farm record can
       exist for them (spec §7: "Sign in to view your farm details.").
       Only authenticated users resume/re-open the survey. */
    const needsSignIn = !isAuthenticated;
    const handleClick = () => {
        if (needsSignIn || isGuest) navigate("/login");
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
                    needsSignIn || isGuest
                        ? "onboarding.empty.signInToView"
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
                    needsSignIn || isGuest
                        ? "onboarding.empty.signInCta"
                        : "onboarding.empty.finish",
                )}
            </button>
        </section>
    );
}
