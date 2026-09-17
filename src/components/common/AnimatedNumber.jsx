import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { useLanguage } from "../../hooks/useLanguage";

/**
 * Smoothly counts a number up whenever `value` changes.
 * Falls back to an instant, static value when the user has
 * requested reduced motion (prefers-reduced-motion).
 *
 * Locale-aware: renders digits in the selected UI language
 * (e.g. ১২.২ in Bengali) via the i18n formatter.
 */
export default function AnimatedNumber({
    value,
    duration = 1.1,
    decimals = 0,
}) {
    const { language, locale } = useLanguage();
    const [display, setDisplay] = useState(0);
    const prevValue = useRef(0);
    const shouldReduceMotion = useReducedMotion();

    useEffect(() => {
        if (shouldReduceMotion) {
            setDisplay(value);
            prevValue.current = value;
            return;
        }

        const controls = animate(prevValue.current, value, {
            duration,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (v) => setDisplay(v),
            onComplete: () => {
                prevValue.current = value;
            },
        });

        return () => controls.stop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, duration, shouldReduceMotion]);

    let formatted;
    try {
        formatted = display.toLocaleString(language === "en" ? "en-IN" : locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    } catch {
        formatted = display.toFixed(decimals);
    }

    return <>{formatted}</>;
}
