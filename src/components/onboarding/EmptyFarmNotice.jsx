/*
 * EmptyFarmNotice.jsx — empty state for farm-dependent pages.
 *
 * Shown instead of mock/demo data when the signed-in user has not
 * completed the farm survey (or skipped it). One CTA re-opens the
 * wizard via resetOnboarding() — the gate picks it up on the next
 * render and no navigation is needed.
 *
 * Used by MyFarm (whole page) and Finance/Dashboard (farm sections).
 */

import { Sprout } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { useOnboarding } from "../../hooks/useOnboarding";
import "./EmptyFarmNotice.css";

export default function EmptyFarmNotice({ variant = "page", finance = false }) {
    const { t } = useLanguage();
    const { isGuest, resetOnboarding } = useOnboarding();
    const navigate = useNavigate();

    /* Guests skipped authentication — there is no survey session to resume
       for them, so the CTA routes to sign-in (spec §4: no authenticated
       farm records without auth). Authenticated users resume/re-open the
       survey via resetOnboarding; the gate picks it up instantly. */
    const handleClick = () => {
        if (isGuest) navigate("/login");
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
                {t(finance ? "onboarding.empty.financeTitle" : "onboarding.empty.farmTitle")}
            </h3>
            <p className="emptyfarm__body">{t("onboarding.empty.farmBody")}</p>
            <button
                type="button"
                className="emptyfarm__cta"
                onClick={handleClick}
            >
                {t(isGuest ? "onboarding.empty.signInCta" : "onboarding.empty.finish")}
            </button>
        </section>
    );
}
