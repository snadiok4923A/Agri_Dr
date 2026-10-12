/*
 * AuthLanguageGate.jsx — MANDATORY language choice, shown BEFORE auth.
 *
 * Flow order (spec): Choose Language → Authentication → (survey) → Done
 * → Website. This gate wraps the public auth routes (/login, /signup) and
 * renders the "Choose Language" window INSTEAD of them until a language
 * is picked. There is deliberately NO skip: the user must select a
 * language before they can reach authentication.
 *
 * The choice goes through the EXISTING language system
 * (useLanguage.changeLanguage → localStorage `krisiveda-lang`), so there
 * is no second language state — Settings and the header stay in sync,
 * and returning users (language already stored) pass straight through
 * without seeing this screen again.
 *
 * Visual language = the auth glass card (AuthLayout + Auth.css tokens);
 * the only content is the title, the supported languages from the same
 * `languages` config the rest of the app uses, and the selection state.
 */

import AuthLayout from "../auth/AuthLayout";
import { useLanguage } from "../../hooks/useLanguage";

export default function AuthLanguageGate({ children }) {
    const { t, language, changeLanguage, languages } = useLanguage();

    // Language already persisted (previous visit) → skip straight to auth.
    if (localStorage.getItem("krisiveda-lang")) return children;

    const select = (code) => {
        // Persist via the EXISTING language system so Settings/Header stay
        // in sync — no second language state anywhere.
        changeLanguage(code);
    };

    // Never block on the default: English is pre-selected on first paint.
    const canProceed = languages.some((l) => l.code === language);

    return (
        <AuthLayout
            title={t("onboarding.language.title")}
            subtitle={t("onboarding.language.subtitle")}
        >
            {/* Picking a language only updates the selection — the user
                must still confirm with Continue (no immediate navigation). */}
            <div
                className="obw-lang-grid"
                role="listbox"
                aria-label={t("onboarding.language.title")}
            >
                {languages.map((l) => (
                    <button
                        key={l.code}
                        type="button"
                        role="option"
                        aria-selected={language === l.code}
                        className={`obw-lang ${language === l.code ? "obw-lang--active" : ""}`}
                        onClick={() => select(l.code)}
                    >
                        <span className="obw-lang__flag" aria-hidden="true">
                            {l.flag}
                        </span>
                        <span className="obw-lang__native">{l.native}</span>
                        <span className="obw-lang__name">{l.name}</span>
                    </button>
                ))}
            </div>

            <button
                type="button"
                className="obw-lang-continue"
                onClick={() => {
                    // Persist + reveal the auth window the same way the old
                    // single-pick path did, but only after an explicit
                    // Continue — never on the language tap itself.
                    select(language);
                }}
                disabled={!canProceed}
            >
                {t("onboarding.language.continue")}
            </button>
        </AuthLayout>
    );
}
