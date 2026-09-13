/**
 * PaddyIcon — a minimal vector rice sprig used across the Rice Varieties
 * page. Three panicle shapes give each variety group a distinct silhouette:
 *   "slender" — basmati-style long drooping grains
 *   "full"    — dense head of the high-yielding commons
 *   "curved"  — graceful arc of the regional/specialty varieties
 * The `tone` prop recolors grains + leaves from the app palette.
 */
const TONES = {
    gold: { grain: "#e8b84b", stem: "#8a9a6b", leaf: "#6faa72" },
    leaf: { grain: "#8fd6a0", stem: "#7d9463", leaf: "#5fae6f" },
    teal: { grain: "#7fd0c4", stem: "#6f9470", leaf: "#4f9e79" },
};

/* One drooping grain pair along the panicle stem */
function Grain({ x, y, r, fill }) {
    return (
        <ellipse
            cx={x}
            cy={y}
            rx={2.6}
            ry={5.4}
            fill={fill}
            transform={`rotate(${r} ${x} ${y})`}
        />
    );
}

export default function PaddyIcon({ tone = "leaf", shape = "full", size = 44, animated = true }) {
    const t = TONES[tone] || TONES.leaf;

    const panicles = {
        slender: [-26, -10, 6, 22, 38],
        full: [-32, -18, -5, 8, 20, 32],
        curved: [-24, -8, 8, 24],
    }[shape] || [];

    return (
        <svg
            className="paddy-icon"
            width={size}
            height={size}
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
        >
            {/* main stem */}
            <path
                d="M24 46 C 23.4 36, 23.2 26, 24 12"
                stroke={t.stem}
                strokeWidth="2"
                strokeLinecap="round"
            />
            {/* leaves */}
            <path
                className={animated ? "paddy-icon__leaf paddy-icon__leaf--left" : "paddy-icon__leaf"}
                d="M24 34 C 18 30, 13 25, 11 17 C 17 21, 21 26, 24 32"
                fill={t.leaf}
            />
            <path
                className={animated ? "paddy-icon__leaf paddy-icon__leaf--right" : "paddy-icon__leaf"}
                d="M24 30 C 29 26, 34 21, 37 13 C 31 17, 27 23, 24 28"
                fill={t.leaf}
                opacity="0.85"
            />
            {/* panicle head — grains fan out from the top of the stem */}
            <g className={animated ? "paddy-icon__head" : undefined}>
                {panicles.map((r, i) => (
                    <g key={i} transform={`translate(24 12) rotate(${r})`}>
                        <path d="M0 0 C 0.6 -3, 0.6 -6, 0 -9" stroke={t.stem} strokeWidth="1.2" strokeLinecap="round" />
                        <Grain x={0} y={-11.5} r={r} fill={t.grain} />
                        <Grain x={-2.4} y={-8} r={r - 18} fill={t.grain} opacity="0.9" />
                        <Grain x={2.4} y={-8} r={r + 18} fill={t.grain} opacity="0.9" />
                    </g>
                ))}
            </g>
        </svg>
    );
}
