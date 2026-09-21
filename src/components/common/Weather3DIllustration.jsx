import { useId } from "react";

/**
 * Weather3DIllustration — premium STATIC 3D weather object for the MAIN
 * dashboard Weather card, styled after the soft-3D reference art.
 *
 * Depth is built with lightweight SVG layering only:
 *   • every composition has a rear cloud layer (smaller, cooler/darker,
 *     slightly receded) behind the bright foreground cloud
 *   • clouds are volumetric: sphere-shaded puffs, white top-surface
 *     highlight, darker shading pooling under the base, blurred ambient
 *     ground shadow
 *   • sun is a sphere-shaded body with a static warm halo
 *   • rain is a few static gradient droplets (with a glint), thunder a
 *     static gradient bolt — never animated
 *
 * Deliberately contains NO internal weather animation (no falling drops,
 * drifting clouds, flashing bolt or pulsing sun): the card's separate
 * wx-scene background owns all motion. This icon is a still 3D object.
 *
 * Driven by the REAL WMO conditionKey from weatherService via the
 * centralized map below — never by the displayed text. Unknown conditions
 * fall back to a calm layered 3D cloud. Used ONLY by the dashboard Weather
 * card; the floating Weather window keeps its own illustration untouched.
 */

const KIND_BY_CONDITION = {
    clear: "sun",
    mainlyClear: "sun",
    partlyCloudy: "partly",
    overcast: "overcast",
    fog: "fog",
    drizzle: "drizzle",
    freezingDrizzle: "drizzle",
    rain: "rain",
    freezingRain: "heavyRain",
    rainShowers: "heavyRain",
    snowfall: "snow",
    snowGrains: "snow",
    snowShowers: "snow",
    thunderstorm: "thunder",
    thunderstormHail: "thunder",
};

function kindFor(condition) {
    const raw = String(condition);
    const k = raw.toLowerCase();
    // Exact WMO keys are camelCase — try the raw key first, then the
    // lowercased form, then substring fallbacks.
    if (KIND_BY_CONDITION[raw]) return KIND_BY_CONDITION[raw];
    if (KIND_BY_CONDITION[k]) return KIND_BY_CONDITION[k];
    if (k.includes("thunder")) return "thunder";
    if (k.includes("fog")) return "fog";
    if (k.includes("snow")) return "snow";
    if (k.includes("shower")) return "heavyRain";
    if (k.includes("rain") || k.includes("drizzle")) return "rain";
    if (k.includes("part")) return "partly";
    if (k.includes("cloud")) return "overcast";
    if (k.includes("sun") || k.includes("clear")) return "sun";
    return "cloud"; // calm layered 3D cloud fallback
}

/* One volumetric cloud: three sphere-shaded puffs + pill base, darker
   shading pooling at the underside, a white top-surface highlight and a
   blurred ambient ground shadow (front layer only — the rear layer recedes
   with a cooler palette and no shadow so depth reads naturally). */
function CloudLayer({ url, x, y, s = 1, dark = false, rear = false }) {
    const puff = url(dark ? "puffD" : "puff");
    const base = url(dark ? "baseD" : "base");
    return (
        <g transform={`translate(${x} ${y}) scale(${s})`} opacity={rear ? 0.92 : 1}>
            {!rear && (
                <ellipse
                    className="wx3-shadow"
                    cx="1"
                    cy="22.5"
                    rx="19"
                    ry="3.4"
                    fill="#54657C"
                    opacity="0.16"
                    filter={url("soft")}
                />
            )}
            <circle cx="-12" cy="2" r="9.5" fill={puff} />
            <circle cx="0" cy="-5" r="12" fill={puff} />
            <circle cx="12" cy="1" r="10" fill={puff} />
            <path
                d="M-20 4 H20 A7 7 0 0 1 20 18 H-20 A7 7 0 0 1 -20 4 Z"
                fill={base}
            />
            <ellipse
                cx="0"
                cy="15"
                rx="14.5"
                ry="4"
                fill={dark ? "#7488A4" : "#8FA3BC"}
                opacity="0.26"
                filter={url("soft")}
            />
            <ellipse
                cx="-7"
                cy="-10.5"
                rx="7.5"
                ry="3.4"
                fill="#FFFFFF"
                opacity={dark ? 0.55 : 0.9}
                filter={url("soft")}
                transform="rotate(-10 -7 -10.5)"
            />
        </g>
    );
}

/* Static 3D droplet — gradient body + white glint. Never animated. */
function RainDrop({ url, x, y, s = 1 }) {
    return (
        <g transform={`translate(${x} ${y}) scale(${s})`}>
            <path
                d="M0 0 C-2.1 3.2 -3.3 5.2 -3.3 7.2 A3.3 3.3 0 0 0 3.3 7.2 C3.3 5.2 2.1 3.2 0 0 Z"
                fill={url("drop")}
            />
            <ellipse cx="-1.1" cy="6" rx="1" ry="1.5" fill="#FFFFFF" opacity="0.55" />
        </g>
    );
}

/* Soft blue "wet" pooling inside the cloud base for rain-family art. */
function WetGlow({ url, x, y, opacity = 0.38 }) {
    return (
        <ellipse
            cx={x}
            cy={y}
            rx="10"
            ry="4"
            fill="#7DD3FC"
            opacity={opacity}
            filter={url("soft")}
        />
    );
}

export function Weather3DIllustration({
    condition = "",
    size = 64,
    className = "",
}) {
    const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
    const url = (name) => `url(#wx3-${name}-${uid})`;
    const kind = kindFor(condition);

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`wx3-illustration ${className}`}
            aria-hidden="true"
        >
            <defs>
                {/* Sphere-shaded sun */}
                <radialGradient id={`wx3-sun-${uid}`} cx="38%" cy="32%" r="78%">
                    <stop offset="0%" stopColor="#FFF6D8" />
                    <stop offset="45%" stopColor="#FCD34D" />
                    <stop offset="100%" stopColor="#F59E0B" />
                </radialGradient>
                {/* Static warm halo */}
                <radialGradient id={`wx3-halo-${uid}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.45" />
                    <stop offset="60%" stopColor="#FBBF24" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
                </radialGradient>
                {/* Foreground cloud — bright, white top → cool gray-blue base */}
                <radialGradient id={`wx3-puff-${uid}`} cx="32%" cy="26%" r="82%">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="55%" stopColor="#F2F6FA" />
                    <stop offset="100%" stopColor="#C6D3E2" />
                </radialGradient>
                <linearGradient id={`wx3-base-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="100%" stopColor="#C9D5E3" />
                </linearGradient>
                {/* Rear/storm cloud — cooler, darker layer for depth */}
                <radialGradient id={`wx3-puffD-${uid}`} cx="32%" cy="26%" r="82%">
                    <stop offset="0%" stopColor="#F4F7FA" />
                    <stop offset="55%" stopColor="#DCE4EE" />
                    <stop offset="100%" stopColor="#9FAFC4" />
                </radialGradient>
                <linearGradient id={`wx3-baseD-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E7EDF4" />
                    <stop offset="100%" stopColor="#93A4BA" />
                </linearGradient>
                {/* Static cyan droplet + bolt gradients */}
                <linearGradient id={`wx3-drop-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7DD3FC" />
                    <stop offset="100%" stopColor="#0284C7" />
                </linearGradient>
                <linearGradient id={`wx3-bolt-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7DD3FC" />
                    <stop offset="100%" stopColor="#0369A1" />
                </linearGradient>
                <filter
                    id={`wx3-soft-${uid}`}
                    x="-60%"
                    y="-60%"
                    width="220%"
                    height="220%"
                >
                    <feGaussianBlur stdDeviation="2.4" />
                </filter>
            </defs>

            {kind === "sun" && (
                <g>
                    <circle cx="40" cy="38" r="27" fill={url("halo")} />
                    <g
                        stroke="#F59E0B"
                        strokeWidth="3"
                        strokeLinecap="round"
                        opacity="0.7"
                    >
                        <line x1="40" y1="12" x2="40" y2="17" />
                        <line x1="40" y1="59" x2="40" y2="64" />
                        <line x1="14" y1="38" x2="19" y2="38" />
                        <line x1="61" y1="38" x2="66" y2="38" />
                        <line x1="21.6" y1="19.6" x2="25" y2="23" />
                        <line x1="55" y1="23" x2="58.4" y2="19.6" />
                        <line x1="58.4" y1="56.4" x2="55" y2="53" />
                        <line x1="25" y1="53" x2="21.6" y2="56.4" />
                    </g>
                    <circle cx="40" cy="38" r="17" fill={url("sun")} />
                    <ellipse
                        cx="34"
                        cy="31.5"
                        rx="6"
                        ry="4.2"
                        fill="#FFFDF0"
                        opacity="0.85"
                        filter={url("soft")}
                        transform="rotate(-18 34 31.5)"
                    />
                </g>
            )}

            {kind === "partly" && (
                <g>
                    {/* Sun peeking from behind the cloud layers */}
                    <g transform="translate(52 26)">
                        <circle r="19" fill={url("halo")} />
                        <g
                            stroke="#F59E0B"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            opacity="0.75"
                        >
                            <line x1="0" y1="-17" x2="0" y2="-12.5" />
                            <line x1="12" y1="-12" x2="9" y2="-9" />
                            <line x1="17" y1="0" x2="12.5" y2="0" />
                            <line x1="-12" y1="-12" x2="-9" y2="-9" />
                        </g>
                        <circle r="11.5" fill={url("sun")} />
                        <ellipse
                            cx="-4"
                            cy="-4.5"
                            rx="4"
                            ry="2.8"
                            fill="#FFFDF0"
                            opacity="0.85"
                            filter={url("soft")}
                            transform="rotate(-18 -4 -4.5)"
                        />
                    </g>
                    {/* Rear cloud layer — smaller, cooler, receded */}
                    <CloudLayer url={url} x={24} y={31} s={0.55} rear dark />
                    {/* Foreground 3D cloud — bright, covers the sun's base */}
                    <CloudLayer url={url} x={38} y={43} s={0.98} />
                </g>
            )}

            {kind === "overcast" && (
                <g>
                    <CloudLayer url={url} x={52} y={28} s={0.6} rear dark />
                    <CloudLayer url={url} x={38} y={41} s={1.02} />
                </g>
            )}

            {kind === "cloud" && (
                <g>
                    <CloudLayer url={url} x={54} y={27} s={0.58} rear dark />
                    <CloudLayer url={url} x={38} y={40} s={1.05} />
                </g>
            )}

            {kind === "fog" && (
                <g>
                    <CloudLayer url={url} x={54} y={24} s={0.5} rear dark />
                    <CloudLayer url={url} x={40} y={30} s={0.92} />
                    <rect x="16" y="50" width="48" height="3.6" rx="1.8" fill="#B9C7D8" opacity="0.6" />
                    <rect x="22" y="58" width="36" height="3.4" rx="1.7" fill="#C7D3E2" opacity="0.5" />
                    <rect x="27" y="66" width="26" height="3.2" rx="1.6" fill="#D3DEEA" opacity="0.45" />
                </g>
            )}

            {kind === "drizzle" && (
                <g>
                    <CloudLayer url={url} x={53} y={27} s={0.55} rear dark />
                    <CloudLayer url={url} x={38} y={33} s={0.9} />
                    <WetGlow url={url} x={40} y={45} opacity={0.25} />
                    <RainDrop url={url} x={31} y={53} s={0.75} />
                    <RainDrop url={url} x={47} y={55} s={0.7} />
                </g>
            )}

            {kind === "rain" && (
                <g>
                    <CloudLayer url={url} x={54} y={26} s={0.58} rear dark />
                    <CloudLayer url={url} x={38} y={32} s={0.95} />
                    <WetGlow url={url} x={40} y={44} />
                    <RainDrop url={url} x={26} y={52} />
                    <RainDrop url={url} x={39} y={55} s={0.9} />
                    <RainDrop url={url} x={52} y={52} s={1.05} />
                </g>
            )}

            {kind === "heavyRain" && (
                <g>
                    {/* Darker, cooler cloud + more static droplets */}
                    <CloudLayer url={url} x={54} y={26} s={0.58} dark rear />
                    <CloudLayer url={url} x={38} y={32} s={0.95} dark />
                    <WetGlow url={url} x={40} y={44} opacity={0.5} />
                    <RainDrop url={url} x={24} y={51} />
                    <RainDrop url={url} x={32} y={56} s={0.85} />
                    <RainDrop url={url} x={41} y={52} s={1.05} />
                    <RainDrop url={url} x={49} y={57} s={0.8} />
                    <RainDrop url={url} x={55} y={51} s={0.95} />
                </g>
            )}

            {kind === "thunder" && (
                <g>
                    <CloudLayer url={url} x={54} y={24} s={0.55} rear dark />
                    <CloudLayer url={url} x={38} y={30} s={0.95} />
                    <WetGlow url={url} x={40} y={42} opacity={0.3} />
                    {/* Static stylized bolt — subtle blue gradient */}
                    <path
                        d="M43 45 L32 60 L39 60 L35 71 L48 55 L41 55 L45 45 Z"
                        fill={url("bolt")}
                        strokeLinejoin="round"
                    />
                </g>
            )}

            {kind === "snow" && (
                <g>
                    <CloudLayer url={url} x={54} y={24} s={0.55} rear dark />
                    <CloudLayer url={url} x={38} y={30} s={0.95} />
                    <WetGlow url={url} x={40} y={42} opacity={0.28} />
                    <g fill="#EFF8FF" stroke="#BFDBFE" strokeWidth="0.8">
                        <circle cx="24" cy="48" r="2.2" />
                        <circle cx="34" cy="53" r="1.8" />
                        <circle cx="45" cy="50" r="2.4" />
                        <circle cx="54" cy="54" r="1.9" />
                        <circle cx="39" cy="60" r="1.7" />
                    </g>
                </g>
            )}
        </svg>
    );
}
