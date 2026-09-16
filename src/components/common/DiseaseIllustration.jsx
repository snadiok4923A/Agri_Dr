/**
 * DiseaseIllustration.jsx — flat, symptom-true vector art for the Rice
 * Disease Library. Each illustration shows the REAL field symptom from the
 * app's dataset (no fake detection imagery):
 *
 *   blast  → green leaf with diamond-shaped spindle lesions,
 *            grayish-white centers + dark brown margins
 *   hopper → rice tiller base with brown hoppers + yellowing (hopperburn)
 *   sheath → leaf sheath near the waterline with snake-skin greenish-grey
 *            blotches
 */

const PALETTE = {
    leaf: "#3f7d4c",
    leafHi: "#5b9e66",
    stem: "#4a6b3f",
    lesionCenter: "#cfd6c4",
    lesionRim: "#4a2f22",
    yellow: "#d9c352",
    hopper: "#8a6a45",
    water: "#3b5f73",
};

function BlastArt() {
    return (
        <svg viewBox="0 0 200 120" className="disease-art__svg" role="img" aria-hidden="true">
            {/* background leaf */}
            <path
                d="M18 100 C 60 88, 120 62, 182 22"
                stroke={PALETTE.leaf}
                strokeWidth="26"
                strokeLinecap="round"
                fill="none"
            />
            <path
                d="M18 100 C 60 88, 120 62, 182 22"
                stroke={PALETTE.leafHi}
                strokeWidth="10"
                strokeLinecap="round"
                fill="none"
                opacity="0.5"
            />
            {/* midrib */}
            <path
                d="M22 98 C 62 86, 120 60, 178 26"
                stroke={PALETTE.stem}
                strokeWidth="2"
                fill="none"
                opacity="0.7"
            />
            {/* diamond-shaped spindle lesions: grayish-white center + dark rim */}
            {[
                { x: 58, y: 84, r: -18, s: 1 },
                { x: 96, y: 66, r: -24, s: 1.15 },
                { x: 134, y: 47, r: -28, s: 0.95 },
                { x: 163, y: 33, r: -30, s: 0.8 },
            ].map((p, i) => (
                <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.r}) scale(${p.s})`}>
                    <ellipse rx="11" ry="5.5" fill={PALETTE.lesionRim} opacity="0.9" />
                    <ellipse rx="8" ry="3.6" fill={PALETTE.lesionCenter} />
                </g>
            ))}
        </svg>
    );
}

function HopperArt() {
    return (
        <svg viewBox="0 0 200 120" className="disease-art__svg" role="img" aria-hidden="true">
            {/* tiller cluster */}
            {[
                { x: 60, tilt: -6 },
                { x: 100, tilt: 0 },
                { x: 140, tilt: 6 },
            ].map((t, i) => (
                <g key={i} transform={`translate(${t.x} 116) rotate(${t.tilt})`}>
                    <rect x="-4" y="-74" width="8" height="74" rx="4" fill={PALETTE.stem} />
                    <path
                        d="M-4 -18 C -22 -34, -26 -52, -20 -68"
                        stroke={PALETTE.yellow}
                        strokeWidth="7"
                        strokeLinecap="round"
                        fill="none"
                    />
                    <path
                        d="M4 -22 C 22 -40, 26 -56, 20 -70"
                        stroke={PALETTE.leaf}
                        strokeWidth="7"
                        strokeLinecap="round"
                        fill="none"
                    />
                </g>
            ))}
            {/* waterline */}
            <rect x="0" y="96" width="200" height="24" fill={PALETTE.water} opacity="0.25" />
            <line x1="0" y1="96" x2="200" y2="96" stroke={PALETTE.water} strokeWidth="2" opacity="0.5" />
            {/* brown planthoppers clustered at the base */}
            {[
                { x: 78, y: 88 },
                { x: 98, y: 94 },
                { x: 120, y: 86 },
                { x: 138, y: 95 },
            ].map((p, i) => (
                <g key={i} transform={`translate(${p.x} ${p.y})`}>
                    <ellipse rx="7.5" ry="4.5" fill={PALETTE.hopper} />
                    <ellipse cx="-1.5" cy="-2" rx="3.4" ry="1.8" fill="#a98a63" />
                    <circle cx="5" cy="-1.5" r="1.1" fill="#2c1f14" />
                </g>
            ))}
        </svg>
    );
}

function SheathArt() {
    return (
        <svg viewBox="0 0 200 120" className="disease-art__svg" role="img" aria-hidden="true">
            {/* sheath stalks */}
            {[
                { x: 70, tilt: -4 },
                { x: 110, tilt: 2 },
                { x: 148, tilt: 7 },
            ].map((t, i) => (
                <g key={i} transform={`translate(${t.x} 116) rotate(${t.tilt})`}>
                    <rect x="-6" y="-86" width="12" height="86" rx="6" fill={PALETTE.leaf} />
                    <rect x="-6" y="-86" width="5" height="86" rx="3" fill={PALETTE.leafHi} opacity="0.5" />
                </g>
            ))}
            {/* waterline */}
            <rect x="0" y="94" width="200" height="26" fill={PALETTE.water} opacity="0.25" />
            <line x1="0" y1="94" x2="200" y2="94" stroke={PALETTE.water} strokeWidth="2" opacity="0.5" />
            {/* snake-skin irregular greenish-grey blotches near the water line */}
            {[
                { x: 66, y: 66, r: 12 },
                { x: 74, y: 84, r: 9 },
                { x: 108, y: 74, r: 13 },
                { x: 118, y: 56, r: 8 },
                { x: 150, y: 68, r: 10 },
                { x: 144, y: 88, r: 7 },
            ].map((p, i) => (
                <ellipse
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    rx={p.r}
                    ry={p.r * 0.55}
                    fill="#9aa78f"
                    stroke="#6d7d64"
                    strokeWidth="2"
                    opacity="0.9"
                    transform={`rotate(${(i % 2 ? 14 : -12)} ${p.x} ${p.y})`}
                />
            ))}
        </svg>
    );
}

const ART = {
    blast: BlastArt,
    hopper: HopperArt,
    sheath: SheathArt,
};

/** Pick an illustration by the disease's `art` key (falls back to a plain leaf). */
export default function DiseaseIllustration({ kind, className = "" }) {
    const Art = ART[kind] || BlastArt;
    return (
        <div className={`disease-art ${className}`}>
            <Art />
        </div>
    );
}
