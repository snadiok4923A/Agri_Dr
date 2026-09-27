/*
 * GuestLanguageGate.jsx — the guest's single onboarding question.
 *
 * A guest (auth "Skip for now") gets the FULL app immediately — but if
 * they have never picked a language, one compact glass card asks first
 * (same visual language as the wizard). Everything else — auth step,
 * farm survey — is purely optional for guests; farm pages show empty
 * states with a CTA that hands them back to the wizard when they want it.
 *
 * The choice goes through the EXISTING language system
 * (useLanguage.changeLanguage → localStorage `krisiveda-lang`), so it
 * survives refresh and Settings stays in sync. One "don't ask again"
 * flag (onboarding.skipped) keeps the card from re-appearing.
 */

import AuthLayout from "../auth/AuthLayout";
import { useLanguage, LANGUAGES } from "../../hooks/useLanguage";
import { useOnboarding } from "../../hooks/useOnboarding";
import "./OnboardingWizard.css";

export default function GuestLanguageGate({ children }) {
    const { t, language, changeLanguage } = useLanguage();
    const { skipped, skipOnboarding } = useOnboarding();

    // Picked before (or explicitly dismissed) → straight into the app.
    if (skipped || localStorage.getItem("krisiveda-lang")) return children;

    return (
        <AuthLayout
            title={t("onboarding.language.title")}
            subtitle={t("onboarding.language.subtitle")}
        >
            <div
                className="obw-lang-grid"
                role="listbox"
                aria-label={t("onboarding.language.title")}
            >
                {LANGUAGES.map((l) => (
                    <button
                        key={l.code}
                        type="button"
                        role="option"
                        aria-selected={language === l.code}
                        className={`obw-lang ${language === l.code ? "obw-lang--active" : ""}`}
                        onClick={() => changeLanguage(l.code)}
                    >
                        <span className="obw-lang__flag" aria-hidden="true">
                            {l.flag}
                        </span>
                        <span className="obw-lang__native">{l.native}</span>
                        <span className="obw-lang__name">{l.name}</span>
                    </button>
                ))}
            </div>

            <div className="obw-nav">
                <span />
                <div className="obw-nav__right">
                    <button
                        type="button"
                        className="obw-nav__skip"
                        onClick={() => skipOnboarding()}
                    >
                        {t("onboarding.skip")}
                    </button>
                    {/* Selecting a language IS the answer — one tap enters
                        the app; no separate Next button needed. */}
                </div>
            </div>
        </AuthLayout>
    );
}
