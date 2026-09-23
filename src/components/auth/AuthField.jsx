/**
 * AuthField.jsx — small presentational input + label + error trio.
 *
 * Pure markup helper so Login/Signup stay short. Contains NO auth
 * logic; restyle or replace freely (spec §14).
 */

export default function AuthField({ id, label, type = "text", value, onChange, placeholder, autoComplete, error, children }) {
    return (
        <div className="auth-field">
            <label className="auth-field__label" htmlFor={id}>
                {label}
            </label>
            <div className="auth-field__control">
                <input
                    id={id}
                    className={`auth-field__input ${error ? "auth-field__input--error" : ""}`}
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                />
                {children /* slot: e.g. password-visibility toggle */}
            </div>
            {error && (
                <p className="auth-field__error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
