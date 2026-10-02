import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { useOnboarding } from "../../hooks/useOnboarding";
import { riceVarieties } from "../../data/riceVarieties";
import { CROP_STAGES } from "../../data/cropStages";
import { AREA_UNITS } from "../../lib/onboardingService";
import { X, Plus, Trash2 } from "lucide-react";
import "./EditFarmModal.css";

const MIN_PARCELS = 1;
const MAX_PARCELS = 20;

/* Exact variety-name set — the same rule the onboarding wizard enforces. */
const EXACT_NAMES = new Set(riceVarieties.map((v) => v.name.toLowerCase()));

/* Editor row shape (strings so inputs behave while typing). */
function rowFromParcel(p) {
    return {
        area: p && p.area != null ? String(p.area) : "",
        unit: (p && p.unit) || "acre",
        variety: (p && p.riceVariety) || "",
        stage: (p && p.stage) || "",
    };
}

export default function EditFarmModal({ open, onClose }) {
    const { t, formatNumber } = useLanguage();
    const { farm, completeOnboarding } = useOnboarding();

    /* Working copy — edits stay here until Save (Cancel = discard). */
    const [rows, setRows] = useState([]);
    const [errors, setErrors] = useState({});
    const [saveError, setSaveError] = useState("");
    const [saving, setSaving] = useState(false);
    const [closing, setClosing] = useState(false);
    const closeTimerRef = useRef(null);

    /* Seed/reset the draft each time the window opens. */
    useEffect(() => {
        if (open) {
            setRows((farm.parcels || []).map(rowFromParcel));
            setErrors({});
            setSaveError("");
            setSaving(false);
        }
    }, [open, farm.parcels]);

    /* Body scroll lock while open (same approach as the profile modal). */
    useEffect(() => {
        if (!open) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    const requestClose = () => {
        if (saving) return;
        setClosing(true);
        closeTimerRef.current = setTimeout(() => {
            setClosing(false);
            onClose();
        }, 280);
    };

    useEffect(() => () => clearTimeout(closeTimerRef.current), []);

    /* Escape closes (Cancel semantics — nothing is saved). */
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") requestClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, saving]);

    const setRow = (index, patch) => {
        setRows((prev) =>
            prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
        );
        setErrors((prev) => ({ ...prev, [index]: undefined }));
        setSaveError("");
    };

    const addField = () => {
        if (rows.length >= MAX_PARCELS) return;
        setRows((prev) => [...prev, rowFromParcel(null)]);
        setErrors((prev) => ({ ...prev, [rows.length]: undefined }));
        setSaveError("");
    };

    const removeField = (index) => {
        if (rows.length <= MIN_PARCELS) return;
        setRows((prev) => prev.filter((_, i) => i !== index));
        setErrors((prev) => {
            const next = {};
            Object.entries(prev).forEach(([k, v]) => {
                const ki = Number(k);
                if (ki === index) return;
                next[ki > index ? ki - 1 : ki] = v;
            });
            return next;
        });
        setSaveError("");
    };

    /* Same validation rules as the onboarding wizard. */
    const validate = () => {
        const next = {};
        rows.forEach((r, i) => {
            const area = parseFloat(r.area);
            if (!r.area || Number.isNaN(area) || area <= 0) {
                next[i] = t("onboarding.area.invalidArea");
            } else if (!EXACT_NAMES.has(r.variety.trim().toLowerCase())) {
                next[i] = t("onboarding.variety.invalid");
            } else if (!r.stage) {
                next[i] = t("onboarding.stage.invalid");
            }
        });
        return next;
    };

    const handleSave = async () => {
        const nextErrors = validate();
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length) return;
        setSaving(true);
        setSaveError("");
        try {
            /* The ONE canonical farm write (same as the wizard's Done):
               updates app state immediately, persists the user-scoped
               mirror and pushes to Supabase when tables exist. */
            await completeOnboarding({
                farmName: farm.name || "",
                parcels: rows.map((r, i) => ({
                    order: i,
                    area: parseFloat(r.area),
                    unit: r.unit,
                    riceVariety: r.variety.trim(),
                    stage: r.stage,
                })),
                selectedLanguage:
                    localStorage.getItem("krisiveda-lang") || undefined,
            });
            setSaving(false);
            requestClose();
        } catch (err) {
            /* Keep the window open and show the real failure — never
               pretend the data was saved. */
            setSaving(false);
            setSaveError(
                err?.message || t("editfarm.saveFailed"),
            );
        }
    };

    /* Live "Crops Being Cultivated" chips — derived from the DRAFT rows,
       so the list reflects unsaved edits while typing. */
    const cropChips = useMemo(() => {
        const groups = [];
        const byVariety = new Map();
        rows.forEach((r) => {
            const v = r.variety.trim();
            if (!v) return;
            if (!byVariety.has(v)) {
                byVariety.set(v, { variety: v, fields: [] });
                groups.push(byVariety.get(v));
            }
            byVariety.get(v).fields.push(r);
        });
        return groups;
    }, [rows]);

    if (!open) return null;

    const portalClass = `editfarm__portal${
        closing ? " editfarm__portal--closing" : ""
    }`;

    return createPortal(
        <div className={portalClass} role="presentation">
            <div className="editfarm__backdrop" onClick={requestClose} />
            <div className="editfarm__overlay">
                <div
                    className="editfarm__dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t("editfarm.title")}
                >
                    <div className="editfarm__scroll">
                        <header className="editfarm__head">
                            <h2 className="editfarm__title">
                                {t("editfarm.title")}
                            </h2>
                            <button
                                type="button"
                                className="editfarm__close"
                                aria-label={t("common.profile.cancel")}
                                onClick={requestClose}
                            >
                                <X size={16} />
                            </button>
                        </header>

                        <p className="editfarm__meta">
                            <span className="editfarm__meta-label">
                                {t("editfarm.totalFields")}
                            </span>
                            <span className="editfarm__meta-value">
                                {formatNumber(rows.length)}{" "}
                                {rows.length === 1
                                    ? t("editfarm.fieldOne")
                                    : t("editfarm.fieldMany")}
                            </span>
                        </p>

                        {/* Live crop chips — mirrors the page hierarchy
                            from the draft. */}
                        {cropChips.length > 0 && (
                            <section className="editfarm__crops">
                                <h3 className="editfarm__section-label">
                                    {t("editfarm.cropsCultivated")}
                                </h3>
                                <div className="editfarm__crop-chips">
                                    {cropChips.map((g) => (
                                        <div
                                            className="editfarm__crop-chip"
                                            key={g.variety}
                                        >
                                            <span className="editfarm__crop-name">
                                                {g.variety}
                                            </span>
                                            <span className="editfarm__crop-fields">
                                                {g.fields.map((f, fi) => (
                                                    <span key={fi}>
                                                        {fi > 0 && " · "}
                                                        {t(
                                                            "onboarding.area.parcelLabel",
                                                        )}{" "}
                                                        {formatNumber(
                                                            rows.indexOf(f) + 1,
                                                        )}{" "}
                                                        •{" "}
                                                        {formatNumber(
                                                            parseFloat(f.area) ||
                                                                0,
                                                        )}{" "}
                                                        {t(
                                                            `onboarding.unitNames.${f.unit}`,
                                                        )}
                                                    </span>
                                                ))}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="editfarm__fields">
                            <h3 className="editfarm__section-label">
                                {t("editfarm.yourFields")}
                            </h3>
                            {rows.map((r, i) => (
                                <article className="editfarm__field" key={i}>
                                    <div className="editfarm__field-head">
                                        <span className="editfarm__field-name">
                                            {t("onboarding.area.parcelLabel")}{" "}
                                            {formatNumber(i + 1)}
                                        </span>
                                        {rows.length > MIN_PARCELS && (
                                            <button
                                                type="button"
                                                className="editfarm__icon-btn editfarm__icon-btn--danger"
                                                aria-label={`${t("editfarm.removeField")} ${i + 1}`}
                                                onClick={() => removeField(i)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>

                                    <label className="editfarm__label">
                                        {t("farm.variety")}
                                        <input
                                            type="text"
                                            className="editfarm__input"
                                            list="editfarm-variety-list"
                                            value={r.variety}
                                            onChange={(e) =>
                                                setRow(i, {
                                                    variety: e.target.value,
                                                })
                                            }
                                            placeholder={t(
                                                "onboarding.variety.searchPlaceholder",
                                            )}
                                            autoComplete="off"
                                        />
                                    </label>

                                    <span className="editfarm__label">
                                        {t("farm.area")}
                                    </span>
                                    <span className="editfarm__area">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="editfarm__input"
                                            value={r.area}
                                            onChange={(e) =>
                                                setRow(i, {
                                                    area: e.target.value,
                                                })
                                            }
                                            inputMode="decimal"
                                        />
                                        <select
                                            className="editfarm__input editfarm__select"
                                            value={r.unit}
                                            onChange={(e) =>
                                                setRow(i, { unit: e.target.value })
                                            }
                                        >
                                            {AREA_UNITS.map((u) => (
                                                <option
                                                    key={u.value}
                                                    value={u.value}
                                                >
                                                    {u.label}
                                                </option>
                                            ))}
                                        </select>
                                    </span>

                                    <span className="editfarm__label">
                                        {t("farm.growthStage")}
                                    </span>
                                    <div
                                        className="editfarm__stages"
                                        role="group"
                                        aria-label={`${t("onboarding.area.parcelLabel")} ${i + 1} ${t("farm.growthStage")}`}
                                    >
                                        {CROP_STAGES.map((s) => (
                                            <button
                                                type="button"
                                                key={s.key}
                                                className={`editfarm__stage${
                                                    r.stage === s.key
                                                        ? " editfarm__stage--active"
                                                        : ""
                                                }`}
                                                onClick={() =>
                                                    setRow(i, { stage: s.key })
                                                }
                                                aria-pressed={
                                                    r.stage === s.key
                                                }
                                            >
                                                {t(`onboarding.stages.${s.key}`)}
                                            </button>
                                        ))}
                                    </div>

                                    {errors[i] && (
                                        <p className="editfarm__error">
                                            {errors[i]}
                                        </p>
                                    )}
                                </article>
                            ))}

                            <datalist id="editfarm-variety-list">
                                {riceVarieties.map((v) => (
                                    <option value={v.name} key={v.name} />
                                ))}
                            </datalist>

                            {rows.length < MAX_PARCELS && (
                                <button
                                    type="button"
                                    className="editfarm__add"
                                    onClick={addField}
                                >
                                    <Plus size={14} />
                                    {t("editfarm.addField")}
                                </button>
                            )}
                        </section>
                    </div>

                    <footer className="editfarm__foot">
                        {saveError && (
                            <p className="editfarm__error editfarm__error--foot">
                                {saveError}
                            </p>
                        )}
                        <div className="editfarm__foot-actions">
                            <button
                                type="button"
                                className="editfarm__btn editfarm__btn--ghost"
                                onClick={requestClose}
                                disabled={saving}
                            >
                                {t("common.profile.cancel")}
                            </button>
                            <button
                                type="button"
                                className="editfarm__btn editfarm__btn--primary"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving
                                    ? t("editfarm.saving")
                                    : t("editfarm.save")}
                            </button>
                        </div>
                    </footer>
                </div>
            </div>
        </div>,
        document.body,
    );
}
