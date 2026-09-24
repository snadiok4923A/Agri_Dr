/**
 * AuthLayout.jsx — shared shell for the Login/Signup pages.
 *
 * PRESENTATION ONLY (spec §14): all auth logic lives in
 * useAuth/authService. Styling lives in Auth.css — restyle freely
 * without touching any logic.
 */

import "./Auth.css";

export default function AuthLayout({ title, subtitle, children, footer }) {
    const pcBg = `${import.meta.env.BASE_URL}logpic/pc.jpg`;
    const mobBg = `${import.meta.env.BASE_URL}logpic/mob.jpg`;

    return (
        <div 
            className="auth-page"
            style={{ 
                '--bg-desktop': `url(${pcBg})`,
                '--bg-mobile': `url(${mobBg})`
            }}
        >
            {/* Translucent readability overlay — above the photo, below the card */}
            <div className="auth-bg" aria-hidden="true" />

            <div className="auth-panel">
                <div className="auth-brand">
                    <div className="auth-brand__mark" aria-hidden="true">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M3 20h18M6 20V9l6-5 6 5v11"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <circle cx="12" cy="14" r="2.4" fill="currentColor" />
                        </svg>
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
