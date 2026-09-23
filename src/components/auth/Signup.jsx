/**
 * Signup.jsx — create-account page (PRESENTATION ONLY, spec §14).
 *
 * All auth behaviour comes from useAuth() → authService. On success with
 * email confirmation enabled, shows the "check your email" notice and
 * does NOT assume the user is authenticated (spec §6).
 */

import { useState } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { Mail, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { friendlyAuthError } from "../../lib/authService";
import { validateSignup, hasErrors } from "./authValidation";
import AuthLayout from "./AuthLayout";
import AuthField from "./AuthField";
import PasswordToggle from "./PasswordToggle";

export default function Signup() {
    const { signUp, signInWithGoogle, loading, isAuthenticated, initializing } = useAuth();
    const location = useLocation();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({ email: "", password: "", confirm: "" });
    const [formError, setFormError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [submitting, setSubmitting] = useState(false); // duplicate-submit guard
    const [googleBusy, setGoogleBusy] = useState(false);

    // Already signed in → into the app
    if (!initializing && isAuthenticated) {
        return <Navigate to={location.state?.from || "/"} replace />;
    }

    const handleSignup = async (e) => {
        e.preventDefault();
        if (submitting || loading) return; // prevent double submission
        setFormError("");
        setSuccessMsg("");

        const errs = validateSignup({ email, password, confirm });
        setFieldErrors(errs);
        if (hasErrors(errs)) return;

        setSubmitting(true);
        try {
            const { needsEmailConfirmation } = await signUp({ email: email.trim(), password });
            if (needsEmailConfirmation) {
                // Confirmation mail is on its way — do NOT treat as logged in.
                setSuccessMsg(
                    "Account created. Please check your email to confirm your account.",
                );
                setEmail("");
                setPassword("");
                setConfirm("");
            }
        } catch (err) {
            setFormError(friendlyAuthError(err, "signup"));
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogleSignup = async () => {
        if (googleBusy || submitting || loading) return;
        setFormError("");
        setGoogleBusy(true);
        try {
            await signInWithGoogle();
        } catch (err) {
            setFormError(friendlyAuthError(err, "google signup"));
            setGoogleBusy(false);
        }
    };

    const busy = submitting || loading;

    return (
        <AuthLayout
            title="Create your account"
            subtitle="Join Krisiveda — smart farming starts here"
            footer={
                <span>
                    Already have an account?{" "}
                    <Link to="/login" state={{ from: location.state?.from || "/" }}>
                        Log in
                    </Link>
                </span>
            }
        >
            {successMsg && (
                <p className="auth-alert auth-alert--success" role="status">
                    {successMsg}
                </p>
            )}
            {formError && (
                <p className="auth-alert auth-alert--error" role="alert">
                    {formError}
                </p>
            )}

            <form className="auth-form" onSubmit={handleSignup} noValidate>
                <AuthField
                    id="signup-email"
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
                    id="signup-password"
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={setPassword}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    error={fieldErrors.password}
                    icon={<Lock size={16} />}
                >
                    <PasswordToggle
                        visible={showPassword}
                        onToggle={() => setShowPassword(v => !v)}
                        label={showPassword ? "Hide password" : "Show password"}
                    />
                </AuthField>

                <AuthField
                    id="signup-confirm"
                    label="Confirm Password"
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={setConfirm}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    error={fieldErrors.confirm}
                    icon={<ShieldCheck size={16} />}
                />

                <button type="submit" className="auth-btn auth-btn--primary" disabled={busy}>
                    {submitting ? (
                        <>
                            <span className="auth-btn__spinner" aria-hidden="true" />
                            Creating account…
                        </>
                    ) : (
                        "Create Account"
                    )}
                </button>
            </form>

            <div className="auth-divider">
                <span>or</span>
            </div>

            <button
                type="button"
                className="auth-btn auth-btn--google"
                onClick={handleGoogleSignup}
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
