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
import { useLanguage } from "../../hooks/useLanguage";
import { useOnboarding } from "../../hooks/useOnboarding";
import "./EmptyFarmNotice.css";

export default function EmptyFarmNotice({ variant = "page", finance = false }) {
    const { t } = useLanguage();
    const { resetOnboarding } = useOnboarding();

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
                onClick={resetOnboarding}
            >
                {t("onboarding.empty.finish")}
            </button>
        </section>
    );
}
