/**
 * Login.jsx — sign-in page (PRESENTATION ONLY, spec §14).
 *
 * All auth behaviour comes from useAuth() → authService. This component
 * only: renders inputs, runs client-side validation, manages loading/
 * error/success UI, and calls the auth actions. Redesign freely.
 */

import { useState } from "react";
import { Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { friendlyAuthError } from "../../lib/authService";
import { validateLogin, hasErrors } from "./authValidation";
import AuthLayout from "./AuthLayout";
import AuthField from "./AuthField";
import PasswordToggle from "./PasswordToggle";

export default function Login() {
    const { signIn, signInWithGoogle, loading, isAuthenticated, initializing } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
    const [formError, setFormError] = useState("");
    const [notice, setNotice] = useState(location.state?.notice || "");
    const [submitting, setSubmitting] = useState(false); // duplicate-submit guard
    const [googleBusy, setGoogleBusy] = useState(false);

    // Already signed in → straight into the app (e.g. after Google return)
    if (!initializing && isAuthenticated) {
        const from = location.state?.from || "/";
        return <Navigate to={from} replace />;
    }

    const whereTo = location.state?.from || "/";

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        if (submitting || loading) return; // prevent double submission
        setFormError("");
        setNotice("");

        const errs = validateLogin({ email, password });
        setFieldErrors(errs);
        if (hasErrors(errs)) return;

        setSubmitting(true);
        try {
            await signIn({ email: email.trim(), password });
            navigate(whereTo, { replace: true });
        } catch (err) {
            setFormError(friendlyAuthError(err, "login"));
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogleLogin = async () => {
        if (googleBusy || submitting || loading) return;
        setFormError("");
        setNotice("");
        setGoogleBusy(true);
        try {
            await signInWithGoogle();
            // Successful OAuth redirects the tab to Google — nothing to do.
        } catch (err) {
            setFormError(friendlyAuthError(err, "google login"));
            setGoogleBusy(false);
        }
    };

    const busy = submitting || loading;

    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Sign in to continue to Krisiveda"
            footer={
                <span>
                    Don&apos;t have an account?{" "}
                    <Link to="/signup" state={{ from: whereTo }}>
                        Sign up
                    </Link>
                </span>
            }
        >
            {notice && (
                <p className="auth-alert auth-alert--success" role="status">
                    {notice}
                </p>
            )}
            {formError && (
                <p className="auth-alert auth-alert--error" role="alert">
                    {formError}
                </p>
            )}

            <form className="auth-form" onSubmit={handleEmailLogin} noValidate>
                <AuthField
                    id="login-email"
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@example.com"
                    autoComplete="email"
                    error={fieldErrors.email}
                    icon={<Mail size={16} />}
                />
            

                <AuthField
                    id="login-password"
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={setPassword}
                    placeholder="Your password"
                    autoComplete="current-password"
                    error={fieldErrors.password}
                    icon={<Lock size={16} />}
                >
                    <PasswordToggle
                        visible={showPassword}
                        onToggle={() => setShowPassword(v => !v)}
                        label={showPassword ? "Hide password" : "Show password"}
                    />
                </AuthField>

                <button type="submit" className="auth-btn auth-btn--primary" disabled={busy}>
                    {submitting ? (
                        <>
                            <span className="auth-btn__spinner" aria-hidden="true" />
                            Signing in…
                        </>
                    ) : (
                        "Login"
                    )}
               </button>
            </form>

            <div className="auth-divider">
                <span>or</span>
            </div>

            <button
                type="button"
                className="auth-btn auth-btn--google"
                onClick={handleGoogleLogin}
                disabled={busy}
            >
                <svg className="auth-btn__google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z" />
                    <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5.1L1.3 17.2C3.3 21.2 7.3 24 12 24z" />
                    <path fill="#FBBC05" d="M5.2 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.3 6.8C.5 8.4 0 10.1 0 12s.5 3.6 1.3 5.2l3.9-2.9z" />
                    <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.8 1.3 6.8l3.9 2.9c.9-2.9 3.6-5 6.8-5z" />
                </svg>
                {googleBusy ? (
                    <>
                        <span className="auth-btn__spinner" aria-hidden="true" />
                        Connecting to Google…
                    </>
                ) : (
                    "Continue with Google"
                )}
            </button>
        </AuthLayout>
    );
}
