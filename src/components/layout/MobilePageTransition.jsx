/**
 * MobilePageTransition.jsx — premium horizontal page transitions for the
 * mobile bottom navigation (≤1024px), built on the framer-motion library
 * the project already depends on.
 *
 * ARCHITECTURE (spec §2/§3/§8): a single dedicated transition viewport
 * (.page-transition-viewport — position:relative, overflow-x clipped,
 * zero padding/margins) wraps exactly ONE page at a time. Transitions
 * are SEQUENTIAL (AnimatePresence mode="wait"): the outgoing page
 * slides/fades out completely, is fully unmounted, and only then does
 * the incoming page mount and slide in. Two pages NEVER coexist in the
 * DOM — the duplicated-content bug class is impossible by construction.
 *
 * The page stays in normal document flow the whole time (no absolute
 * positioning, no popLayout) → zero layout shift, native scrolling and
 * natural page heights preserved (spec §5/§6/§18).
 *
 * DIRECTION (spec §7/§9): computed from the destination and origin tab
 * indexes in `mobileNavItems` (origin = path rendered before the
 * navigation, tracked in a ref). Destination right of origin → old page
 * exits LEFT, new enters from the RIGHT; destination left of origin →
 * the mirror image. Keys are the stable pathname (never random/index).
 *
 * RAPID TAPS (spec §12, strategy A): `pageTransitionState.active` is
 * exported for MobileNavigation, which holds new taps until the
 * in-flight transition finishes — transitions can never stack.
 *
 * FIXED-POSITION SAFETY (spec §15): no will-change is left on the
 * wrapper and framer-motion renders transform: none once the slide
 * settles at x:0 — so fixed overlays (Weather Modal) keep anchoring to
 * the real viewport after the transition.
 *
 * MOBILE ONLY: above 1024px (no bottom nav) children render untouched.
 */

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation } from "react-router-dom";
import useMediaQuery from "../../hooks/useMediaQuery";
import { mobileNavItems } from "./MobileNavigation";
import "./MobilePageTransition.css";

/* Slide distance ≈ 8% of a phone viewport; exit + enter stay inside the
   400–500ms window (spec §10). Opacity is the only other property. */
const SLIDE_PX = 28;
const EXIT_MS = 200;
const ENTER_MS = 240;
const EASE = [0.22, 0.61, 0.36, 1]; // smooth accelerate → decelerate

/** Shared lock read by MobileNavigation (spec §12): while true, new tab
    taps are held until the current transition completes. */
export const pageTransitionState = { active: false };

export default function MobilePageTransition({ children }) {
    const location = useLocation();
    const isMobileNav = useMediaQuery("(max-width: 1024px)");
    const reduceMotion = useReducedMotion();

    const tabIndex = (path) =>
        mobileNavItems.findIndex((item) =>
            item.path === "/" ? path === "/" : path.startsWith(item.path),
        );

    /* Origin = the path rendered until this navigation (ref updated after
       the direction-computing render — no stale reads). */
    const prevPathRef = useRef(location.pathname);
    const from = tabIndex(prevPathRef.current);
    const to = tabIndex(location.pathname);
    useEffect(() => {
        prevPathRef.current = location.pathname;
    }, [location.pathname]);

    const direction = to >= 0 && from >= 0 && from > to ? "right" : "left";

    /* Slide variants — functions of `custom` so the EXITING page (which
       re-resolves its variant at exit time) leaves toward the correct
       side of the SAME navigation the user made. */
    const slideVariants = {
        initial: (d) => ({
            x: (d === "right" ? -1 : 1) * SLIDE_PX, // enter from the side moved toward
            opacity: 0,
        }),
        enter: {
            x: 0,
            opacity: 1,
            transition: { duration: ENTER_MS / 1000, ease: EASE },
        },
        exit: (d) => ({
            x: (d === "right" ? -1 : 1) * -SLIDE_PX, // exit toward where we came from
            opacity: 0,
            transition: { duration: EXIT_MS / 1000, ease: EASE },
        }),
    };

    /* Accessibility: prefers-reduced-motion → quick cross-fade, no slide. */
    const fadeVariants = {
        initial: { opacity: 0 },
        enter: { opacity: 1, transition: { duration: 0.18 } },
        exit: { opacity: 0, transition: { duration: 0.15 } },
    };

    /* Navigation lock: armed for the whole exit+enter window with a
       timeout failsafe (onAnimationComplete normally clears it early). */
    useEffect(() => {
        if (!isMobileNav || reduceMotion) {
            pageTransitionState.active = false;
            return undefined;
        }
        pageTransitionState.active = true;
        const failsafe = setTimeout(() => {
            pageTransitionState.active = false;
        }, EXIT_MS + ENTER_MS + 150);
        return () => clearTimeout(failsafe);
    }, [location.pathname, isMobileNav, reduceMotion]);

    /* Desktop (>1024px) has no bottom nav → render pages untouched. */
    if (!isMobileNav) return <>{children}</>;

    return (
        <div className="page-transition-viewport">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                    key={location.pathname}
                    className="page-transition-page"
                    custom={direction}
                    variants={reduceMotion ? fadeVariants : slideVariants}
                    initial="initial"
                    animate="enter"
                    exit="exit"
                    onAnimationComplete={(definition) => {
                        if (definition === "enter") pageTransitionState.active = false;
                    }}
                >
                    {children}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
