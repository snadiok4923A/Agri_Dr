/**
 * PaddyIcon — variety-specific rice plant illustration.
 *
 * One semi-realistic panicle renderer, seven grain designs driven by the
 * `variant` prop (see src/data/riceVarieties.js). Each variety's grains
 * mirror its real character: basmati's long needle grains, black rice's
 * deep-purple caryopsis, red rice's rust panicle, white Sona Masuri,
 * fine-grained Samba Mahsuri, pale aromatic Joha, golden Swarna, the
 * dark-husked Kalanamak, Navara's russet, and coastal Pokkali.
 */
const GRAIN_STYLES = {
    basmati: { fill: "#E8B84B", deep: "#C89235", w: 2.1, h: 6.2, awns: 2.6 },
    golden: { fill: "#F0B93F", deep: "#D9962E", w: 2.9, h: 5.4, awns: 0.6 },
    common: { fill: "#E6C878", deep: "#C9A254", w: 2.7, h: 4.9, awns: 0 },
    white: { fill: "#EFE6C8", deep: "#D6C89E", w: 2.7, h: 4.7, awns: 0 },
    fine: { fill: "#F2E9D3", deep: "#D9CCA9", w: 2.2, h: 4.6, awns: 0.8 },
    black: { fill: "#5B4472", deep: "#2E1F44", w: 2.6, h: 5.0, awns: 1.6 },
    darkHusk: { fill: "#4A4038", deep: "#2B241F", w: 2.7, h: 5.0, awns: 2.2 },
    red: { fill: "#C97B52", deep: "#9E5533", w: 2.7, h: 4.9, awns: 1.2 },
    whiteGold: { fill: "#F3ECD5", deep: "#E0C375", w: 2.4, h: 4.4, awns: 0 },
    paleGold: { fill: "#EBD9A8", deep: "#D2B46E", w: 2.2, h: 4.8, awns: 1.4 },
    navara: { fill: "#B97F4E", deep: "#8E5A32", w: 2.6, h: 4.8, awns: 1.6 },
    pokkali: { fill: "#D9C48B", deep: "#B79F60", w: 2.5, h: 4.9, awns: 0.4 },
};

/* Per-group leaf/stem palettes — greens only, no blue */
const FOLIAGE = {
    gold: { leafA: "#7CBF6E", leafB: "#3E8E4F", stem: "#8FA05E" },
    leaf: { leafA: "#8FD6A0", leafB: "#4FA36A", stem: "#7D9463" },
    teal: { leafA: "#86C9A8", leafB: "#3C8668", stem: "#6F9470" },
};

/* Unique gradient ids per instance so multiple SVGs don't clash */
let uidCounter = 0;

export default function PaddyIcon({ tone = "leaf", variant = "golden", shape, size = 40, animated = true }) {
    const g = GRAIN_STYLES[variant] || GRAIN_STYLES.golden;
    const f = FOLIAGE[tone] || FOLIAGE.leaf;

    // Group silhouette: basmati droops tall & slender, specialty arcs gracefully
    const droop = variant === "basmati" ? 1.25 : variant === "fine" || variant === "paleGold" ? 1.1 : 1;
    const spread = variant === "basmati" ? 1.3 : variant === "whiteGold" ? 0.85 : 1;
    const uid = `pdy${++uidCounter}`;
    const sway = (cls) => (animated ? cls : undefined);
    const grainDefs = (
        <>
            <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={g.fill} />
                <stop offset="100%" stopColor={g.deep} />
            </linearGradient>
            <linearGradient id={`${uid}-lA`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={f.leafA} />
                <stop offset="100%" stopColor={f.leafB} />
            </linearGradient>
            <linearGradient id={`${uid}-lB`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={f.leafA} />
                <stop offset="100%" stopColor={f.leafB} />
            </linearGradient>
        </>
    );

    /* One panicle branch: stem arc + grains with optional awns */
    const branch = (bx, by, rot, n, len) => (
        <g transform={`rotate(${rot} ${bx} ${by})`}>
            <path
                d={`M${bx} ${by} C ${bx + len * 0.05} ${by - len * 0.45}, ${bx - len * 0.04} ${by - len * 0.8}, ${bx} ${by - len}`}
                stroke={`url(#${uid}-lB)`}
                strokeWidth="1.3"
                strokeLinecap="round"
                fill="none"
            />
            {Array.from({ length: n }).map((_, i) => {
                const t = (i + 1) / (n + 0.5);
                const y = by - len * t;
                const side = i % 2 === 0 ? 1 : -1;
                const x = bx + side * (2.2 + t * 2.6) * spread;
                const tilt = side * (26 + t * 16) * (droop > 1.2 ? 1.25 : 1);
                const w = g.w;
                const h = g.h * (0.82 + t * 0.3);
                return (
                    <g key={i}>
                        <ellipse
                            cx={x}
                            cy={y}
                            rx={w}
                            ry={h / 2}
                            fill={`url(#${uid}-g)`}
                            transform={`rotate(${tilt} ${x} ${y})`}
                        />
                        {g.awns > 0 && (
                            <line
                                x1={x}
                                y1={y - h / 2}
                                x2={x + side * g.awns}
                                y2={y - h / 2 - g.awns * 1.6}
                                stroke={g.deep}
                                strokeWidth="0.7"
                                strokeLinecap="round"
                            />
                        )}
                    </g>
                );
            })}
        </g>
    );

    return (
        <svg
            className="paddy-icon"
            width={size}
            height={size}
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
        >
            <defs>{grainDefs}</defs>

            {/* foliage */}
            <path
                d="M24 46 C 23.4 38, 23.2 30, 24 20"
                stroke={`url(#${uid}-lB)`}
                strokeWidth="1.8"
                strokeLinecap="round"
            />
            <path
                className={sway("agri-sway-left")}
                d="M24 38 C 18 34, 13 29, 11 21 C 17 25, 21 30, 24 36"
                fill={`url(#${uid}-lA)`}
            />
            <path
                className={sway("agri-sway-right")}
                d="M24 34 C 29 30, 34 25, 37 17 C 31 21, 27 27, 24 32"
                fill={`url(#${uid}-lA)`}
                opacity="0.85"
            />

            {/* panicle — branches fan from the top of the stem */}
            <g className={animated ? "paddy-icon__head" : undefined}>
                {branch(24, 20, -30, 4, 13)}
                {branch(24, 20, -10, 5, 15)}
                {branch(24, 20, 8, 5, 15)}
                {branch(24, 20, 26, 4, 12)}
            </g>
        </svg>
    );
}
