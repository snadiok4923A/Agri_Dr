/**
 * AuthLayout.jsx — shared shell for the Login/Signup pages.
 *
 * PRESENTATION ONLY (spec §14): all auth logic lives in
 * useAuth/authService. Styling lives in Auth.css — restyle freely
 * without touching logic.
 *
 * Background: a slow 5-second cross-fade slideshow over the agricultural
 * photos in public/logpic/ (pc*.jpg on desktop/tablet, mob*.jpg on
 * mobile — the same 768px breakpoint the stylesheet uses). Two stacked
 * layers: the BASE layer always shows the current image; the FRONT
 * layer loads the NEXT image hidden (opacity 0 — its paint doubles as
 * the preload, so the fade can never show a blank frame) and fades IN
 * over the base when the slide advances. After the fade the front
 * image is promoted to the base and the front layer resets instantly
 * for the next cycle. Infinite loop, no black flash, no layout shift.
 */

import { useEffect, useState } from "react";
import useMediaQuery from "../../hooks/useMediaQuery";
import { PC_BACKGROUNDS, MOB_BACKGROUNDS } from "../../data/authBackgrounds";
import "./Auth.css";

/* Rotation cadence (spec: every 5 seconds) and cross-fade duration —
   FADE_MS must stay in sync with --bg-fade-ms usage in Auth.css. */
const ROTATE_MS = 5000;
const FADE_MS = 1600;

export default function AuthLayout({ title, subtitle, children, footer }) {
    const base = import.meta.env.BASE_URL;
    const asset = (name) => `${base}logpic/${name}`;
    const isMobile = useMediaQuery("(max-width: 768px)");

    const list = isMobile ? MOB_BACKGROUNDS : PC_BACKGROUNDS;

    /* Slideshow state: which image the BASE layer paints and which one
       (if any) the FRONT layer is currently cross-fading in. Starts at
       0 = pc.jpg / mob.jpg — spec: first image, never random. */
    const [slide, setSlide] = useState({ base: 0, front: null });
    /* Freeze the loop if any background 404s — freeze on what is
       painted, never cycle broken URLs onto a blank screen. */
    const [bgBroken, setBgBroken] = useState(false);

    /* Slideshow driver — ONE interval per mount, created/cleared in a
       single effect (no duplicate timers across re-renders). The pure
       updater carries both indices, so no stale closures. */
    useEffect(() => {
        if (bgBroken || list.length < 2) return undefined;
        const timer = setInterval(() => {
            setSlide((s) =>
                s.front === null
                    ? { ...s, front: (s.base + 1) % list.length } // start fade-in
                    : { base: s.front, front: null }, // promote + instant reset
            );
        }, ROTATE_MS);
        return () => clearInterval(timer);
    }, [bgBroken, list.length]);

    /* Viewport flip between the pc/mob sets: restart on that set's
       first image so the correct device list is used immediately. */
    useEffect(() => {
        setSlide({ base: 0, front: null });
        setBgBroken(false);
    }, [isMobile]);

    /* Preload + error probe for the NEXT image in sequence. The front
       layer's own paint covers the fade itself; this guarantees the
       next image is decoded before it is ever shown. */
    useEffect(() => {
        if (list.length < 2) return undefined;
        const next = list[(slide.base + 1) % list.length];
        const img = new Image();
        img.onerror = () => setBgBroken(true);
        img.src = asset(next);
        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [slide.base, list, asset, base]);

    const frontName = slide.front === null ? list[slide.base] : list[slide.front];

    return (
        <div
            className="auth-page"
            style={{
                "--bg-base": `url(${asset(list[slide.base] ?? list[0])})`,
                "--bg-front": `url(${asset(frontName ?? list[0])})`,
                "--bg-fade-ms": `${FADE_MS}ms`,
            }}
        >
            {/* Slideshow layers (bottom → top): base photo (always
                visible), front photo (hidden; fades IN over the base
                while .auth-bg-layer--fading), then the unchanged
                readability scrim. DOM order stacks them — no z-index. */}
            <div className="auth-bg-layer" aria-hidden="true" />
            <div
                className={`auth-bg-layer auth-bg-layer--front ${
                    slide.front !== null ? "auth-bg-layer--fading" : ""
                }`}
                aria-hidden="true"
            />
            {/* Translucent readability overlay — above the photos, below the card */}
            <div className="auth-bg" aria-hidden="true" />

            <div className="auth-panel">
                <div className="auth-brand">
                    <div className="auth-brand__mark" aria-hidden="true">
                        <img
                            src={`${base}logo.jpg`}
                            alt="Krisiveda"
                            className="auth-brand__logo"
                        />
                    </div>
                    <span className="auth-brand__name">Krisiveda</span>
                </div>

                <div className="auth-card">
                    <div className="auth-card__head">
                        <h1 className="auth-card__title">{title}</h1>
                        {subtitle && <p className="auth-card__subtitle">{subtitle}</p>}
                    </div>
                    {children}
                    {footer && <div className="auth-card__footer">{footer}</div>}
                </div>
            </div>
        </div>
    );
}
