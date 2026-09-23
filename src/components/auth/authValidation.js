/**
 * authValidation.js — pure client-side form validation (no React).
 *
 * Returns field-level error strings for the Login/Signup UIs. Kept as a
 * separate tiny module so the rules are testable and the UI stays dumb.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email) {
    if (!email || !email.trim()) return "Email is required.";
    if (!EMAIL_RE.test(email.trim())) return "Please enter a valid email address.";
    return "";
}

export function validatePassword(password) {
    if (!password) return "Password is required.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    return "";
}

export function validateConfirmPassword(password, confirm) {
    if (!confirm) return "Please confirm your password.";
    if (password !== confirm) return "Passwords do not match.";
    return "";
}

/** Full login check → { email, password } error map (empty strings = ok). */
export function validateLogin({ email, password }) {
    return {
        email: validateEmail(email),
        password: validatePassword(password),
    };
}

/** Full signup check → { email, password, confirm } error map. */
export function validateSignup({ email, password, confirm }) {
    return {
        email: validateEmail(email),
        password: validatePassword(password),
        confirm: validateConfirmPassword(password, confirm),
    };
}

export const hasErrors = (map) => Object.values(map).some(Boolean);
