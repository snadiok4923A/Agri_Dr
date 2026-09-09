/**
 * Friendly agricultural vector illustrations designed specifically for Krisiveda.
 * Clean, modern, minimalist, with smooth SVG paths and subtle CSS animations.
 */

export function RicePlantIllustration({ className = '', size = 120 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`agri-rice-vector ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="riceGoldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="riceLeafGrad1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="100%" stopColor="#16A34A" />
        </linearGradient>
        <linearGradient id="riceLeafGrad2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#86EFAC" />
          <stop offset="100%" stopColor="#22C55E" />
        </linearGradient>
        <radialGradient id="riceAura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Gentle ambient halo */}
      <circle cx="80" cy="80" r="70" fill="url(#riceAura)" />

      {/* Ground base line */}
      <path
        d="M36 138 C56 135, 104 135, 124 138"
        stroke="var(--border)"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Main Center Stalk */}
      <path
        d="M80 138 Q80 85 82 48"
        stroke="url(#riceLeafGrad1)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Left Leaf (swaying) */}
      <path
        className="agri-sway-left"
        d="M80 105 C60 92 48 85 38 72 C35 68 40 65 48 69 C62 76 74 90 79 100"
        fill="url(#riceLeafGrad2)"
        opacity="0.9"
      />

      {/* Right Leaf (swaying) */}
      <path
        className="agri-sway-right"
        d="M80 115 C100 102 114 96 125 82 C128 78 123 75 115 79 C100 86 88 100 81 108"
        fill="url(#riceLeafGrad1)"
        opacity="0.95"
      />

      {/* Left Secondary Leaf */}
      <path
        className="agri-sway-left-sub"
        d="M80 82 C65 70 54 62 46 48 C43 44 48 42 55 46 C67 53 76 68 80 78"
        fill="url(#riceLeafGrad1)"
      />

      {/* Right Secondary Leaf */}
      <path
        className="agri-sway-right-sub"
        d="M81 90 C96 78 108 72 116 58 C119 54 114 52 107 55 C95 62 86 76 81 84"
        fill="url(#riceLeafGrad2)"
      />

      {/* Golden Rice Grain Cluster (Center Head - Curved) */}
      <g className="agri-grains">
        {/* Grain 1 */}
        <ellipse cx="82" cy="42" rx="4.5" ry="7" transform="rotate(-15 82 42)" fill="url(#riceGoldGrad)" />
        <ellipse cx="76" cy="34" rx="4.5" ry="7" transform="rotate(-30 76 34)" fill="url(#riceGoldGrad)" />
        <ellipse cx="88" cy="33" rx="4.5" ry="7" transform="rotate(25 88 33)" fill="url(#riceGoldGrad)" />
        <ellipse cx="73" cy="24" rx="4" ry="6.5" transform="rotate(-40 73 24)" fill="url(#riceGoldGrad)" />
        <ellipse cx="86" cy="22" rx="4" ry="6.5" transform="rotate(35 86 22)" fill="url(#riceGoldGrad)" />
        <ellipse cx="80" cy="15" rx="3.5" ry="6" transform="rotate(-5 80 15)" fill="url(#riceGoldGrad)" />

        {/* Grain awns / whiskers */}
        <path d="M72 20 L66 14" stroke="#F59E0B" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M87 18 L94 13" stroke="#F59E0B" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M79 11 L79 4" stroke="#F59E0B" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function WeatherSunCloudIllustration({ className = '', size = 44 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`agri-weather-vector ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sunGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* Sun glow */}
      <circle cx="38" cy="24" r="14" fill="url(#sunGrad)" className="agri-sun-pulse" />

      {/* Sun Rays */}
      <g stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" opacity="0.8">
        <line x1="38" y1="4" x2="38" y2="8" />
        <line x1="52" y1="10" x2="49" y2="13" />
        <line x1="58" y1="24" x2="54" y2="24" />
        <line x1="52" y1="38" x2="49" y2="35" />
      </g>

      {/* Friendly Cloud */}
      <path
        d="M20 50 H46 C51 50 54 46 54 41 C54 36.5 50.5 33 46.5 33 C46 27 41 22 34 22 C28.5 22 24 25.5 22.5 30 C17.5 30.5 14 34.5 14 39.5 C14 45.5 18 50 20 50 Z"
        fill="url(#cloudGrad)"
        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.08))"
      />
    </svg>
  );
}

export function AgriActionIcon({ type, size = 24 }) {
  if (type === 'medicine') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="7" y="3" width="10" height="18" rx="5" fill="#EF4444" fillOpacity="0.15" stroke="#EF4444" strokeWidth="2" />
        <line x1="7" y1="12" x2="17" y2="12" stroke="#EF4444" strokeWidth="2" />
        <circle cx="12" cy="7.5" r="1.5" fill="#EF4444" />
      </svg>
    );
  }
  if (type === 'fertilizer') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 21V12" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 12C9 9 4 10 4 10C4 10 5 15 8 16C10 16.7 11.5 14.5 12 12Z" fill="#10B981" fillOpacity="0.2" stroke="#10B981" strokeWidth="2" />
        <path d="M12 14C15 11 20 12 20 12C20 12 19 17 16 18C14 18.7 12.5 16.5 12 14Z" fill="#10B981" fillOpacity="0.25" stroke="#10B981" strokeWidth="2" />
      </svg>
    );
  }
  if (type === 'market') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9" fill="#F59E0B" fillOpacity="0.15" stroke="#F59E0B" strokeWidth="2" />
        <path d="M10 7H14M10 10H14M10 7V17M10 10C12.5 10 13.5 11.5 13.5 13C13.5 15 11.5 15 10 15L14 17" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  // Default: production/yield
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 19L8.5 13.5L12.5 17.5L21 7" stroke="#06B6D4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 7H21V13" stroke="#06B6D4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
