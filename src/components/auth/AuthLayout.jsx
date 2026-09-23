/**
 * AuthLayout.jsx — minimal shared shell for the Login/Signup pages.
 *
 * INTENTIONALLY PLAIN (spec §14/§15): the auth LOGIC lives in
 * useAuth/authService; this component is presentation-only and is meant
 * to be redesigned freely. All styling sits in Auth.css — change
 * colors/layout/animation there without touching any logic.
 */

export default function AuthLayout({ title, subtitle, children, footer }) {
    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-card__head">
                    <h1 className="auth-card__title">{title}</h1>
                    {subtitle && <p className="auth-card__subtitle">{subtitle}</p>}
                </div>
                {children}
                {footer && <div className="auth-card__footer">{footer}</div>}
            </div>
        </div>
    );
}
