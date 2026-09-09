import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

/**
 * Smoothly counts a number up whenever `value` changes.
 * Falls back to an instant, static value when the user has
 * requested reduced motion (prefers-reduced-motion).
 */
export default function AnimatedNumber({
    value,
    duration = 1.1,
    decimals = 0,
    locale = "en-IN",
}) {
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

    const formatted = display.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });

    return <>{formatted}</>;
}
