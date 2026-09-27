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

    // Language already selected (previous visit or previous pick in this
    // session) → continue to authentication without re-asking.
    if (localStorage.getItem("krisiveda-lang")) return children;

    const pick = (code) => {
        // Persist via the existing system, then reveal the auth window.
        changeLanguage(code);
    };

    return (
        <AuthLayout
            title={t("onboarding.language.title")}
            subtitle={t("onboarding.language.subtitle")}
        >
            {/* Selecting a language IS the continue action — no extra
                Next button, and deliberately NO skip anywhere here. */}
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
                        onClick={() => pick(l.code)}
                    >
                        <span className="obw-lang__flag" aria-hidden="true">
                            {l.flag}
                        </span>
                        <span className="obw-lang__native">{l.native}</span>
                        <span className="obw-lang__name">{l.name}</span>
                    </button>
                ))}
            </div>
        </AuthLayout>
    );
}
