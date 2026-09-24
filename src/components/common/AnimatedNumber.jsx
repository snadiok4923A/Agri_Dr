import { useEffect, useRef, useState } from "react";
import useMediaQuery from "../../hooks/useMediaQuery";
import { useLanguage } from "../../hooks/useLanguage";

/**
 * Smoothly counts a number up whenever `value` changes.
 * Falls back to an instant, static value when the user has
 * requested reduced motion (prefers-reduced-motion).
 *
 * Locale-aware: renders digits in the selected UI language
 * (e.g. ১২.২ in Bengali) via the i18n formatter.
 *
 * PERF: this used to borrow framer-motion's `animate()` for a single
 * number tween. Pulling a whole animation engine into the eagerly-loaded
 * Dashboard for two counters cost parse/execute time on every first
 * paint, so the tween is now a plain requestAnimationFrame loop (~30
 * lines) with the SAME cubic-bezier(0.16, 1, 0.3, 1) curve, and
 * framer-motion only ships inside the lazy chunk of the one page that
 * still uses its scroll-free mount reveals (Improve).
 */

/* cubic-bezier(x1, y1, x2, y2) → easing function, solved by bisection.
   Matches the curve framer-motion was given, exactly. */
function cubicBezier(x1, y1, x2, y2) {
    const axis = (t, a1, a2) =>
        3 * a1 * t * (1 - t) * (1 - t) + 3 * a2 * t * t * (1 - t) + t * t * t;
    return (x) => {
        let lo = 0;
        let hi = 1;
        let t = x;
        for (let i = 0; i < 12; i += 1) {
            t = (lo + hi) / 2;
            if (axis(t, x1, x2) < x) lo = t;
            else hi = t;
        }
        return axis(t, y1, y2);
    };
}

const EASE = cubicBezier(0.16, 1, 0.3, 1);

export default function AnimatedNumber({
    value,
    duration = 1.1,
    decimals = 0,
}) {
    const { language, locale } = useLanguage();
    const [display, setDisplay] = useState(0);
    const prevValue = useRef(0);
    const shouldReduceMotion = useMediaQuery(
        "(prefers-reduced-motion: reduce)"
    );

    useEffect(() => {
        const from = prevValue.current;

        if (shouldReduceMotion || from === value) {
            prevValue.current = value;
            setDisplay(value);
            return undefined;
        }

        let frame = 0;
        const start = performance.now();
        const ms = Math.max(1, duration * 1000);

        const step = (now) => {
            const progress = Math.min(1, (now - start) / ms);
            setDisplay(from + (value - from) * EASE(progress));
            if (progress < 1) {
                frame = requestAnimationFrame(step);
            } else {
                prevValue.current = value;
            }
        };

        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
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
