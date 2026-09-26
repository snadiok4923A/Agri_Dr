/**
 * MobilePageTransition.jsx — premium horizontal page transitions for the
 * mobile bottom navigation (≤1024px), built on the framer-motion library
 * the project already depends on.
 *
 * DIRECTION (spec §1/§9): computed from the destination and origin tab
 * indexes in `mobileNavItems` — navigating to a tab further right slides
 * the content left (new page enters from the right); to a tab further
 * left, slides right. The origin is the path rendered BEFORE the
 * navigation (tracked in a ref), so direction is always derived from
 * real tab positions — no per-tab hardcoding. Sidebar/drawer navigation
 * to these same routes animates identically; routes outside the tab
 * list (e.g. /crops/:id) fall back to a forward (left) slide.
 *
 * SHELL (spec §4): this component wraps ONLY the routed page inside
 * Layout's <main>. Header and bottom nav live outside it and never move.
 *
 * RAPID TAPS (spec §6): AnimatePresence owns the exit animations and
 * keys animations strictly by pathname, so interrupting one transition
 * with another tap is safe — framer-motion reconciles the exiting and
 * entering snapshots without stacking or flicker.
 *
 * MOBILE ONLY (spec: "for mobile only"): above 1024px (where the bottom
 * nav is hidden) children render with no animation at all.
 */

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation } from "react-router-dom";
import useMediaQuery from "../../hooks/useMediaQuery";
import { mobileNavItems } from "./MobileNavigation";

/* Slide distance ≈ 8% of a phone viewport — large enough to read as a
   slide, small enough to stay soft. Depth values per spec §3. */
const SLIDE_PX = 28;
const EXIT_OPACITY = 0.92;
const ENTER_OPACITY = 0.96;
const DEPTH_SCALE = 0.985;
const DURATION = 0.44; // seconds — inside the 400–550ms spec window
const EASE = [0.22, 0.61, 0.36, 1]; // smooth accelerate → decelerate

export default function MobilePageTransition({ children }) {
    const location = useLocation();
    const isMobileNav = useMediaQuery("(max-width: 1024px)");
    const reduceMotion = useReducedMotion();

    const tabIndex = (path) => {
        const idx = mobileNavItems.findIndex((item) => {
            if (item.path === "/") return path === "/";
            return path.startsWith(item.path);
        });
        return idx;
    };

    /* The origin is the path that was rendered until this navigation —
       held in a ref (updated AFTER the transition render, so the
       render that computes direction still sees the previous path). */
    const prevPathRef = useRef(location.pathname);
    const from = tabIndex(prevPathRef.current);
    const to = tabIndex(location.pathname);
    useEffect(() => {
        prevPathRef.current = location.pathname;
    }, [location.pathname]);

    /* Direction from tab indexes: destination right of origin → content
       slides left (enter from right); left of origin → slides right.
       Equal/unknown → treated as forward. */
    const direction = to >= 0 && from >= 0 && from > to ? "right" : "left";
    const sign = direction === "left" ? 1 : -1;

    const variants = {
        initial: {
            x: sign * SLIDE_PX,
            opacity: ENTER_OPACITY,
            scale: DEPTH_SCALE,
        },
        enter: {
            x: 0,
            opacity: 1,
            scale: 1,
            transition: { duration: DURATION, ease: EASE },
        },
        exit: {
            x: sign * -SLIDE_PX,
            opacity: EXIT_OPACITY,
            scale: DEPTH_SCALE,
            transition: { duration: DURATION, ease: EASE },
        },
    };

    /* Accessibility: honor prefers-reduced-motion — cross-fade only. */
    const safeVariants = reduceMotion
        ? {
              initial: { opacity: 0 },
              enter: { opacity: 1, transition: { duration: 0.2 } },
              exit: { opacity: 0, transition: { duration: 0.2 } },
          }
        : variants;

    /* Desktop (>1024px) has no bottom nav → render pages untouched. */
    if (!isMobileNav) return <>{children}</>;

    return (
        <AnimatePresence
            mode="popLayout"
            initial={false}
            custom={direction}
        >
            <motion.div
                key={location.pathname}
                className="mobile-page-transition"
                custom={direction}
                variants={safeVariants}
                initial="initial"
                animate="enter"
                exit="exit"
                style={{ willChange: "transform, opacity" }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
