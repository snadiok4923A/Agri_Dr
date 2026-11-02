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

import { useState } from "react";
import AuthLayout from "../auth/AuthLayout";
import { useLanguage } from "../../hooks/useLanguage";
import { translations } from "../../data/translations";

export default function AuthLanguageGate({ children }) {
    const { t, language, changeLanguage, languages } = useLanguage();
    const [selectedCode, setSelectedCode] = useState(language || "en");
    const [isConfirmed, setIsConfirmed] = useState(() => {
        return Boolean(localStorage.getItem("krisiveda-lang"));
    });

    // Language already persisted (previous visit or confirmed selection) → skip straight to auth.
    if (isConfirmed || localStorage.getItem("krisiveda-lang")) {
        return children;
    }

    const select = (code) => {
        setSelectedCode(code);
    };

    const canProceed = languages.some((l) => l.code === selectedCode);

    const handleContinue = (e) => {
        if (e && typeof e.preventDefault === "function") {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!canProceed) return;
        changeLanguage(selectedCode);
        setIsConfirmed(true);
    };

    const activeTitle =
        translations[selectedCode]?.onboarding?.language?.title ||
        t("onboarding.language.title");
    const activeSubtitle =
        translations[selectedCode]?.onboarding?.language?.subtitle ||
        t("onboarding.language.subtitle");
    const continueLabel =
        translations[selectedCode]?.onboarding?.language?.continue ||
        t("onboarding.language.continue");

    return (
        <AuthLayout title={activeTitle} subtitle={activeSubtitle}>
            {/* Picking a language only updates the selection — the user
                must still confirm with Continue (no immediate navigation). */}
            <div
                className="obw-lang-grid"
                role="listbox"
                aria-label={activeTitle}
            >
                {languages.map((l) => (
                    <button
                        key={l.code}
                        type="button"
                        role="option"
                        aria-selected={selectedCode === l.code}
                        className={`obw-lang ${selectedCode === l.code ? "obw-lang--active" : ""}`}
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
                onClick={handleContinue}
                disabled={!canProceed}
            >
                {continueLabel}
            </button>
        </AuthLayout>
    );
}
