/**
 * DiseaseIllustration.jsx — flat, symptom-true vector art for the Rice
 * Disease Library. Each illustration depicts the documented symptom of its
 * disease (no fake detection imagery). One art per disease — never reused.
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

/* ---------------- Library additions ---------------- */

/* Brown Spot: leaf dotted with small round brown spots */
function BrownSpotArt() {
    return (
        <svg viewBox="0 0 200 120" className="disease-art__svg" role="img" aria-hidden="true">
            <path d="M14 102 C 60 92, 128 62, 186 20" stroke={PALETTE.leaf} strokeWidth="24" strokeLinecap="round" fill="none" />
            <path d="M14 102 C 60 92, 128 62, 186 20" stroke={PALETTE.leafHi} strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.5" />
            <path d="M18 100 C 62 90, 126 60, 182 24" stroke={PALETTE.stem} strokeWidth="2" fill="none" opacity="0.7" />
            {[
                [48, 88, 5], [74, 78, 4], [100, 66, 5.5], [128, 52, 4.5],
                [152, 40, 5], [170, 30, 3.5], [62, 94, 3.5], [116, 58, 3.5],
            ].map(([x, y, r], i) => (
                <g key={i}>
                    <circle cx={x} cy={y} r={r} fill="#5a3a22" />
                    <circle cx={x} cy={y} r={r * 0.55} fill="#7d5433" />
                </g>
            ))}
        </svg>
    );
}

/* False Smut: grain cluster where individual grains became green/black
   velvety spore balls */
function SmutArt() {
    return (
        <svg viewBox="0 0 200 120" className="disease-art__svg" role="img" aria-hidden="true">
            {/* panicle branches */}
            <path d="M30 110 C 55 80, 80 60, 110 34" stroke={PALETTE.stem} strokeWidth="4" fill="none" />
            <path d="M30 110 C 70 96, 120 78, 172 56" stroke={PALETTE.stem} strokeWidth="4" fill="none" />
            {/* healthy golden grains */}
            {[[62, 82], [78, 72], [94, 60], [150, 60], [136, 70], [162, 50]].map(([x, y], i) => (
                <ellipse key={i} cx={x} cy={y} rx="8" ry="4.5" fill="#d9b451" transform={`rotate(-32 ${x} ${y})`} />
            ))}
            {/* smut balls: large velvety green + black spheres replacing grains */}
            {[[112, 44, 11, '#4a6741'], [124, 52, 9, '#2b3527'], [100, 52, 8, '#3d5238'], [142, 44, 10, '#242e22']].map(([x, y, r, c], i) => (
                <g key={`s${i}`}>
                    <circle cx={x} cy={y} r={r} fill={c} />
                    <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.35} fill="#6d8a5f" opacity="0.5" />
                </g>
            ))}
        </svg>
    );
}

/* Bakanae: one lanky, abnormally tall-thin seedling among normal ones */
function BakanaeArt() {
    return (
        <svg viewBox="0 0 200 120" className="disease-art__svg" role="img" aria-hidden="true">
            {[
                { x: 48, h: 52, c: PALETTE.leaf },
                { x: 152, h: 50, c: PALETTE.leaf },
                { x: 100, h: 92, c: '#8fae74' }, // the infected lanky plant
            ].map((p, i) => (
                <g key={i} transform={`translate(${p.x} 116)`}>
                    <rect x="-3.5" y={-p.h} width="7" height={p.h} rx="3.5" fill="#5d7a4b" />
                    <path d={`M-3 ${-p.h * 0.55} C -16 ${-p.h * 0.8}, -20 ${-p.h}, -14 ${-p.h - 8}`} stroke={p.c} strokeWidth="6" strokeLinecap="round" fill="none" />
                    <path d={`M3 ${-p.h * 0.6} C 16 ${-p.h * 0.85}, 20 ${-p.h - 4}, 14 ${-p.h - 12}`} stroke={p.c} strokeWidth="6" strokeLinecap="round" fill="none" />
                </g>
            ))}
            <rect x="0" y="102" width="200" height="18" fill={PALETTE.water} opacity="0.25" />
        </svg>
    );
}

/* Bacterial Leaf Blight: leaf with yellowing water-soaked streak that turns
   grayish-white from the tip */
function BlbArt() {
    return (
        <svg viewBox="0 0 200 120" className="disease-art__svg" role="img" aria-hidden="true">
            <path d="M16 104 C 66 92, 130 60, 184 18" stroke={PALETTE.leaf} strokeWidth="26" strokeLinecap="round" fill="none" />
            {/* yellowing band along the margins */}
            <path d="M40 98 C 90 86, 140 56, 178 26" stroke="#d9c352" strokeWidth="10" strokeLinecap="round" fill="none" opacity="0.65" />
            {/* grayish-white dried tip */}
            <path d="M132 52 C 152 40, 168 28, 184 18" stroke="#cfd6c4" strokeWidth="14" strokeLinecap="round" fill="none" opacity="0.9" />
            {/* wavy streak edge */}
            <path d="M60 94 C 84 88, 108 76, 128 60" stroke="#b8a94e" strokeWidth="2.5" strokeDasharray="6 4" fill="none" />
        </svg>
    );
}

/* Bacterial Leaf Streak: narrow translucent streaks running between veins */
function BlsArt() {
    return (
    <svg viewBox="0 0 200 120" className="disease-art__svg" role="img" aria-hidden="true">
            <path d="M16 104 C 66 92, 130 60, 184 18" stroke={PALETTE.leaf} strokeWidth="26" strokeLinecap="round" fill="none" />
            <path d="M22 100 C 70 90, 128 60, 180 24" stroke={PALETTE.stem} strokeWidth="2" fill="none" opacity="0.7" />
            {/* streaks drawn along the leaf angle */}
            {[
                { x1: 44, y1: 96, x2: 104, y2: 78, w: 5 },
                { x1: 58, y1: 104, x2: 126, y2: 86, w: 4 },
                { x1: 96, y1: 70, x2: 152, y2: 52, w: 5 },
                { x1: 118, y1: 60, x2: 166, y2: 44, w: 3.5 },
            ].map((s, i) => (
                <line key={`st${i}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                    stroke="#c9b45e" strokeWidth={s.w} strokeLinecap="round" opacity="0.85" />
            ))}
        </svg>
    );
}

/* Tungro: stunted plant with yellow-orange discoloration from leaf tips */
function TungroArt() {
    return (
        <svg viewBox="0 0 200 120" className="disease-art__svg" role="img" aria-hidden="true">
            {[
                { x: 66, tilt: -8, c: '#d9a83f' },
                { x: 100, tilt: 0, c: '#cf9a3a' },
                { x: 134, tilt: 8, c: '#d9a83f' },
            ].map((t, i) => (
                <g key={i} transform={`translate(${t.x} 116) rotate(${t.tilt})`}>
                    <rect x="-3" y="-46" width="6" height="46" rx="3" fill="#6d7d4f" />
                    <path d="M-3 -20 C -14 -30, -18 -40, -12 -48" stroke={t.c} strokeWidth="6" strokeLinecap="round" fill="none" />
                    <path d="M3 -24 C 14 -34, 18 -44, 12 -52" stroke={t.c} strokeWidth="6" strokeLinecap="round" fill="none" />
                </g>
            ))}
            {/* healthy reference plant in the background, noticeably taller */}
            <g transform="translate(172 116)" opacity="0.45">
                <rect x="-3" y="-84" width="6" height="84" rx="3" fill="#5d7a4b" />
                <path d="M-3 -46 C -14 -60, -18 -74, -12 -84" stroke={PALETTE.leaf} strokeWidth="6" strokeLinecap="round" fill="none" />
                <path d="M3 -50 C 14 -64, 18 -78, 12 -88" stroke={PALETTE.leaf} strokeWidth="6" strokeLinecap="round" fill="none" />
            </g>
            <rect x="0" y="104" width="200" height="16" fill={PALETTE.water} opacity="0.25" />
        </svg>
    );
}

/* Yellow Dwarf: tiny grassy bushy plant with excessive thin tillers */
function YellowDwarfArt() {
    return (
        <svg viewBox="0 0 200 120" className="disease-art__svg" role="img" aria-hidden="true">
            {[-30, -18, -8, 0, 8, 18, 30].map((tilt, i) => (
                <g key={i} transform={`translate(100 112) rotate(${tilt})`}>
                    <path d="M0 0 C 0 -22, 0 -34, 0 -40" stroke="#9fae62" strokeWidth="3" strokeLinecap="round" fill="none" />
                    <path d="M0 -8 C -7 -18, -9 -26, -6 -34" stroke="#aab96d" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    <path d="M0 -8 C 7 -18, 9 -26, 6 -34" stroke="#aab96d" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                </g>
            ))}
            {/* normal plant reference */}
            <g transform="translate(168 116)" opacity="0.45">
                <rect x="-3" y="-80" width="6" height="80" rx="3" fill="#5d7a4b" />
                <path d="M-3 -44 C -14 -58, -18 -72, -12 -82" stroke={PALETTE.leaf} strokeWidth="6" strokeLinecap="round" fill="none" />
                <path d="M3 -48 C 14 -62, 18 -76, 12 -86" stroke={PALETTE.leaf} strokeWidth="6" strokeLinecap="round" fill="none" />
            </g>
            <rect x="0" y="104" width="200" height="16" fill={PALETTE.water} opacity="0.25" />
        </svg>
    );
}

/* Ufra: twisted, knotted leaf emerging distorted from the sheath */
function UfraArt() {
    return (
        <svg viewBox="0 0 200 120" className="disease-art__svg" role="img" aria-hidden="true">
            <rect x="88" y="52" width="24" height="64" rx="10" fill={PALETTE.leaf} />
            <rect x="92" y="52" width="9" height="64" rx="4" fill={PALETTE.leafHi} opacity="0.5" />
            {/* twisted emerging leaf — an S-shaped curl */}
            <path d="M100 56 C 100 38, 122 40, 118 26 C 115 14, 96 16, 98 4"
                stroke="#c9c47a" strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M104 58 C 104 44, 126 44, 122 30"
                stroke="#8fae74" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.7" />
            {/* side tiller */}
            <path d="M96 96 C 76 88, 62 74, 60 58" stroke={PALETTE.leaf} strokeWidth="7" strokeLinecap="round" fill="none" />
            <path d="M108 92 C 128 86, 142 74, 146 60" stroke={PALETTE.leaf} strokeWidth="7" strokeLinecap="round" fill="none" />
            <rect x="0" y="106" width="200" height="14" fill={PALETTE.water} opacity="0.25" />
        </svg>
    );
}

/* Root-Knot: root system with distinct swelling galls */
function RootKnotArt() {
    return (
        <svg viewBox="0 0 200 120" className="disease-art__svg" role="img" aria-hidden="true">
            {/* soil cross-section */}
            <rect x="0" y="0" width="200" height="120" fill="#4a3b2a" opacity="0.35" />
            <rect x="0" y="0" width="200" height="10" fill="#5d7a4b" opacity="0.5" />
            {/* plant above */}
            <g transform="translate(100 14)">
                <rect x="-3" y="0" width="6" height="20" rx="3" fill="#5d7a4b" />
                <path d="M-3 8 C -12 2, -16 -4, -12 -10" stroke={PALETTE.leaf} strokeWidth="5" strokeLinecap="round" fill="none" />
                <path d="M3 8 C 12 2, 16 -4, 12 -10" stroke={PALETTE.leaf} strokeWidth="5" strokeLinecap="round" fill="none" />
            </g>
            {/* roots with galls */}
            <path d="M100 34 C 84 52, 66 62, 48 70" stroke="#c9a97a" strokeWidth="5" fill="none" />
            <path d="M100 34 C 116 52, 134 62, 152 70" stroke="#c9a97a" strokeWidth="5" fill="none" />
            <path d="M100 34 C 98 58, 96 78, 98 96" stroke="#c9a97a" strokeWidth="5" fill="none" />
            {[[74, 58, 8], [120, 56, 7], [98, 76, 9], [140, 66, 6], [56, 68, 6]].map(([x, y, r], i) => (
                <circle key={i} cx={x} cy={y} r={r} fill="#d8b98c" stroke="#a9835a" strokeWidth="2.5" />
            ))}
        </svg>
    );
}

/* Khaira: leaf with rusty brown patches + a stunted habit */
function KhairaArt() {
    return (
        <svg viewBox="0 0 200 120" className="disease-art__svg" role="img" aria-hidden="true">
            <path d="M20 104 C 68 94, 130 62, 182 22" stroke={PALETTE.leaf} strokeWidth="24" strokeLinecap="round" fill="none" />
            {[
                [58, 88, 9, 5], [86, 76, 12, 6], [118, 58, 10, 5.5], [148, 42, 8, 4.5],
            ].map(([x, y, rx, ry], i) => (
                <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill="#8a5a2e" opacity="0.9"
                    transform={`rotate(${-22 + i * 2} ${x} ${y})`} />
            ))}
            {/* stunted young tiller beside it */}
            <g transform="translate(174 112)" opacity="0.6">
                <rect x="-2.5" y="-26" width="5" height="26" rx="2.5" fill="#5d7a4b" />
                <path d="M-2 -14 C -8 -20, -10 -26, -7 -30" stroke={PALETTE.leaf} strokeWidth="4" strokeLinecap="round" fill="none" />
            </g>
        </svg>
    );
}

/* Iron Toxicity: leaf bronzing — purplish-brown discoloration from tips */
function IronToxArt() {
    return (
        <svg viewBox="0 0 200 120" className="disease-art__svg" role="img" aria-hidden="true">
            <path d="M16 104 C 66 92, 130 60, 184 18" stroke="#7a6a3f" strokeWidth="26" strokeLinecap="round" fill="none" />
            {/* bronzing gradient toward the tip */}
            <path d="M52 96 C 100 84, 146 56, 182 22" stroke="#8a5a2e" strokeWidth="14" strokeLinecap="round" fill="none" opacity="0.75" />
            <path d="M96 78 C 136 64, 162 44, 182 24" stroke="#6d3f4e" strokeWidth="12" strokeLinecap="round" fill="none" opacity="0.8" />
            <path d="M136 56 C 158 42, 172 30, 184 20" stroke="#59304a" strokeWidth="12" strokeLinecap="round" fill="none" opacity="0.9" />
            {/* tiny orange-brown speckles */}
            {[[80, 88], [104, 74], [128, 58], [150, 42]].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="2.5" fill="#a9713a" opacity="0.9" />
            ))}
        </svg>
    );
}

const ART = {
    blast: BlastArt,
    hopper: HopperArt,
    sheath: SheathArt,
    brownspot: BrownSpotArt,
    smut: SmutArt,
    bakanae: BakanaeArt,
    blb: BlbArt,
    bls: BlsArt,
    tungro: TungroArt,
    yellowdwarf: YellowDwarfArt,
    ufra: UfraArt,
    rootknot: RootKnotArt,
    khaira: KhairaArt,
    irontox: IronToxArt,
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
