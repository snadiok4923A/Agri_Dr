/**
 * PasswordToggle.jsx — eye/eye-off visibility toggle for password fields.
 * Presentational only (spec §16 "if appropriate").
 */

import { Eye, EyeOff } from "lucide-react";

export default function PasswordToggle({ visible, onToggle, label }) {
    return (
        <button
            type="button"
            className="auth-field__toggle"
            onClick={onToggle}
            aria-label={label}
            title={label}
        >
            {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
    );
}
