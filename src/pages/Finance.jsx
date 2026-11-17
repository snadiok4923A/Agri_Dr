import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ArrowLeft, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { useAuth } from "../hooks/useAuth";
import { useOnboarding } from "../hooks/useOnboarding";
import { toAcres } from "../lib/financeCalc";
import {
    EXPENSE_CATEGORIES,
    fetchFinancialRecords,
    saveFinancialRecords,
} from "../lib/financeService";
import EmptyFarmNotice from "../components/onboarding/EmptyFarmNotice";
import "./Finance.css";

const COLORS = ["#4ade80", "#38bdf8", "#f59e0b", "#f472b6", "#a78bfa", "#fb7185"];
const today = () => new Date().toISOString().slice(0, 10);
const emptyEntry = () => ({
    key: `${Date.now()}-${Math.random()}`,
    category: "land_preparation",
    amount: "",
    description: "",
    date: today(),
});

/** Expense category label for the active language, falling back to the
 *  service's English label only if a key is ever missing. */
function categoryLabel(t, value) {
    const key = `finance.categories.${value}`;
    const label = t(key);
    if (label && label !== key) return label;
    return EXPENSE_CATEGORIES.find((category) => category.value === value)?.label || value;
}

/** Area unit ("acre", "bigha"…) through the shared units dictionary. */
function unitLabel(t, unit) {
    const key = `units.${unit || "acre"}`;
    const label = t(key);
    return label && label !== key ? label : unit || t("units.acre");
}

/** Stored ISO dates are rendered in the selected locale (input values stay
 *  ISO — the date picker itself is browser-native). */
function formatDate(locale, value) {
    if (!value) return "";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    try {
        return new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "short",
            year: "numeric",
        }).format(date);
    } catch {
        return value;
    }
}

function makeDraft(parcels, records) {
    return Object.fromEntries(
        parcels.map((parcel) => {
            const expenses = records.expenses
                .filter((entry) => entry.parcelId === parcel.id)
                .map((entry) => ({ ...entry, key: entry.id }));
            const target = records.targets.find((entry) => entry.parcelId === parcel.id);
            return [
                parcel.id,
                {
                    expenses,
                    target: target
                        ? {
                              ...target,
                              productionKg: String(target.productionKg),
                              pricePerQuintal: String(target.pricePerQuintal),
                          }
                        : { productionKg: "", pricePerQuintal: "", sellingDate: "" },
                },
            ];
        }),
    );
}

function calculate(parcels, records) {
    const byParcel = new Map(
        parcels.map((parcel) => [
            parcel.id,
            {
                parcel,
                cost: 0,
                productionKg: null,
                revenue: null,
                expenses: [],
            },
        ]),
    );
    records.expenses.forEach((entry) => {
        const row = byParcel.get(entry.parcelId);
        if (row) {
            row.cost += Number(entry.amount) || 0;
            row.expenses.push(entry);
        }
    });
    records.targets.forEach((target) => {
        const row = byParcel.get(target.parcelId);
        if (row) {
            row.productionKg = target.productionKg > 0 ? target.productionKg : null;
            if (row.productionKg && target.pricePerQuintal > 0) {
                row.revenue = (row.productionKg / 100) * target.pricePerQuintal;
            }
        }
    });
    const rows = [...byParcel.values()].map((row) => ({
        ...row,
        profit: row.revenue === null ? null : row.revenue - row.cost,
        margin:
            row.revenue > 0 ? ((row.revenue - row.cost) / row.revenue) * 100 : null,
    }));
    const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
    const revenueRows = rows.filter((row) => row.revenue !== null);
    const revenue = revenueRows.length
        ? revenueRows.reduce((sum, row) => sum + row.revenue, 0)
        : null;
    const acres = rows.reduce(
        (sum, row) => sum + (toAcres(row.parcel.area, row.parcel.unit) || 0),
        0,
    );
    const areaUnits = new Set(rows.map((row) => row.parcel.unit).filter(Boolean));
    const sameAreaUnit = areaUnits.size === 1 ? [...areaUnits][0] : null;
    const sameUnitArea =
        sameAreaUnit && rows.reduce((sum, row) => sum + Number(row.parcel.area || 0), 0);
    const costPerArea =
        sameUnitArea > 0
            ? totalCost / sameUnitArea
            : acres > 0
              ? totalCost / acres
              : null;
    const categoryMap = new Map();
    records.expenses.forEach((entry) => {
        categoryMap.set(
            entry.category,
            (categoryMap.get(entry.category) || 0) + Number(entry.amount),
        );
    });
    const categories = EXPENSE_CATEGORIES.map((category, index) => ({
        value: category.value,
        amount: categoryMap.get(category.value) || 0,
        color: COLORS[index % COLORS.length],
    })).filter((category) => category.amount > 0);
    return {
        rows,
        totals: {
            cost: totalCost,
            revenue,
            profit: revenue === null ? null : revenue - totalCost,
            margin: revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : null,
            costPerArea,
            costPerAreaLabel: sameAreaUnit || "acre",
        },
        categories,
    };
}

function Money({ value, formatNumber, emptyLabel }) {
    return value === null || value === undefined
        ? emptyLabel
        : `₹${formatNumber(Math.round(value))}`;
}

function ExpenseForm({ userId, parcels, initial, onCancel, onSaved }) {
    const { t, formatNumber } = useLanguage();
    const [draft, setDraft] = useState(initial);
    const [selectedId, setSelectedId] = useState(parcels[0]?.id || "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const selected = draft[selectedId] || { expenses: [], target: {} };

    const updateSelected = (patch) =>
        setDraft((current) => ({
            ...current,
            [selectedId]: { ...current[selectedId], ...patch },
        }));
    const updateEntry = (key, patch) =>
        updateSelected({
            expenses: selected.expenses.map((entry) =>
                entry.key === key ? { ...entry, ...patch } : entry,
            ),
        });
    const addEntry = () =>
        updateSelected({ expenses: [...selected.expenses, emptyEntry()] });
    const removeEntry = (key) =>
        updateSelected({
            expenses: selected.expenses.filter((entry) => entry.key !== key),
        });

    async function submit(event) {
        event.preventDefault();
        setError("");
        const expenses = Object.entries(draft).flatMap(([parcelId, value]) =>
            value.expenses.map((entry) => ({ ...entry, parcelId })),
        );
        const validExpenses = expenses.filter((entry) => Number(entry.amount) > 0);
        if (!validExpenses.length) {
            setError(t("finance.errors.emptyExpenses"));
            return;
        }
        if (validExpenses.some((entry) => !entry.date || !entry.category)) {
            setError(t("finance.errors.categoryDate"));
            return;
        }
        const targets = Object.entries(draft)
            .filter(([, value]) => value.target?.productionKg || value.target?.pricePerQuintal)
            .map(([parcelId, value]) => ({ ...value.target, parcelId }));
        if (
            targets.some(
                (target) =>
                    Number(target.productionKg) <= 0 ||
                    Number(target.pricePerQuintal) <= 0,
            )
        ) {
            setError(t("finance.errors.targets"));
            return;
        }
        setSaving(true);
        try {
            const next = await saveFinancialRecords(userId, {
                expenses: validExpenses,
                targets,
            });
            onSaved(next);
        } catch {
            setError(t("finance.errors.save"));
        } finally {
            setSaving(false);
        }
    }

    return (
        <form className="finance-form section" onSubmit={submit}>
            <button type="button" className="finance-page__text-btn" onClick={onCancel}>
                <ArrowLeft size={16} /> {t("common.back")}
            </button>
            <h2 className="finance-page__form-title">{t("finance.form.title")}</h2>
            <p className="finance-page__form-intro">{t("finance.form.intro")}</p>
            <label className="finance-form__label">
                {t("finance.form.selectParcel")}
                <select
                    className="finance-form__input"
                    value={selectedId}
                    onChange={(event) => setSelectedId(event.target.value)}
                >
                    {parcels.map((parcel, index) => (
                        <option key={parcel.id} value={parcel.id}>
                            {t("finance.form.parcelOption", {
                                index: formatNumber(index + 1),
                                area: formatNumber(parcel.area),
                                unit: unitLabel(t, parcel.unit),
                                variety:
                                    parcel.riceVariety || t("finance.form.varietyNotSet"),
                            })}
                        </option>
                    ))}
                </select>
            </label>
            <div className="finance-form__parcel-note">{t("finance.form.parcelNote")}</div>
            <div className="finance-form__entries">
                <div className="finance-form__section-heading">
                    <h3>{t("finance.form.entries")}</h3>
                    <button type="button" className="finance-page__small-btn" onClick={addEntry}>
                        <Plus size={15} /> {t("finance.form.addExpense")}
                    </button>
                </div>
                {selected.expenses.map((entry) => (
                    <div className="finance-form__entry" key={entry.key}>
                        <select
                            className="finance-form__input"
                            value={entry.category}
                            onChange={(event) => updateEntry(entry.key, { category: event.target.value })}
                            aria-label={t("finance.form.categoryAria")}
                        >
                            {EXPENSE_CATEGORIES.map((category) => (
                                <option key={category.value} value={category.value}>
                                    {categoryLabel(t, category.value)}
                                </option>
                            ))}
                        </select>
                        <input
                            className="finance-form__input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder={t("finance.form.amountPlaceholder")}
                            value={entry.amount}
                            onChange={(event) => updateEntry(entry.key, { amount: event.target.value })}
                            aria-label={t("finance.form.amountAria")}
                        />
                        <input
                            className="finance-form__input"
                            type="text"
                            placeholder={t("finance.form.descriptionPlaceholder")}
                            value={entry.description}
                            onChange={(event) => updateEntry(entry.key, { description: event.target.value })}
                            aria-label={t("finance.form.descriptionAria")}
                        />
                        <input
                            className="finance-form__input"
                            type="date"
                            value={entry.date || ""}
                            onChange={(event) => updateEntry(entry.key, { date: event.target.value })}
                            aria-label={t("finance.form.dateAria")}
                        />
                        <button
                            type="button"
                            className="finance-form__remove"
                            onClick={() => removeEntry(entry.key)}
                            aria-label={t("finance.form.removeAria")}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
                {!selected.expenses.length && (
                    <p className="finance-form__empty">{t("finance.form.noExpenses")}</p>
                )}
            </div>
            <div className="finance-form__selling">
                <h3>{t("finance.form.sellingTitle")}</h3>
                <p>{t("finance.form.sellingNote")}</p>
                <div className="finance-form__selling-grid">
                    <label className="finance-form__label">
                        {t("finance.form.expectedProduction")}
                        <input
                            className="finance-form__input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={selected.target.productionKg || ""}
                            onChange={(event) =>
                                updateSelected({
                                    target: { ...selected.target, productionKg: event.target.value },
                                })
                            }
                        />
                    </label>
                    <label className="finance-form__label">
                        {t("finance.form.sellingPrice")}
                        <input
                            className="finance-form__input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={selected.target.pricePerQuintal || ""}
                            onChange={(event) =>
                                updateSelected({
                                    target: { ...selected.target, pricePerQuintal: event.target.value },
                                })
                            }
                        />
                    </label>
                    <label className="finance-form__label">
                        {t("finance.form.sellingDate")}
                        <input
                            className="finance-form__input"
                            type="date"
                            value={selected.target.sellingDate || ""}
                            onChange={(event) =>
                                updateSelected({
                                    target: { ...selected.target, sellingDate: event.target.value },
                                })
                            }
                        />
                    </label>
                </div>
            </div>
            {error && <p className="finance-form__error" role="alert">{error}</p>}
            <button className="finance-page__primary-btn" type="submit" disabled={saving}>
                <Save size={16} /> {saving ? t("finance.form.saving") : t("finance.form.save")}
            </button>
        </form>
    );
}

export default function Finance() {
    const { t, formatNumber, locale } = useLanguage();
    const { user } = useAuth();
    const { isFarmComplete, farm, refreshFarm } = useOnboarding();
    const [records, setRecords] = useState({ expenses: [], targets: [] });
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        refreshFarm();
        if (!user?.id) return undefined;
        fetchFinancialRecords(user.id)
            .then((next) => active && setRecords(next))
            .catch(() => active && setError(t("finance.errors.load")))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [user?.id, refreshFarm, t]);

    const parcels = farm?.parcels || [];
    const calculation = useMemo(() => calculate(parcels, records), [parcels, records]);
    const hasRecords = records.expenses.length > 0;

    if (!isFarmComplete || !parcels.length) {
        return (
            <div className="page-container finance-page">
                <h1 className="finance-page__title">{t("nav.finance")}</h1>
                <EmptyFarmNotice variant="page" finance />
            </div>
        );
    }
    if (loading) {
        return (
            <div className="page-container finance-page">
                <p>{t("finance.summary.loading")}</p>
            </div>
        );
    }
    if (editing || !hasRecords) {
        return (
            <div className="page-container finance-page">
                <section className="finance-page__header section">
                    <h1 className="finance-page__title">{t("nav.finance")}</h1>
                </section>
                {error && hasRecords && <p className="finance-form__error" role="alert">{error}</p>}
                <ExpenseForm
                    userId={user.id}
                    parcels={parcels.filter((parcel) => parcel.id)}
                    initial={makeDraft(parcels.filter((parcel) => parcel.id), records)}
                    onCancel={() => setEditing(false)}
                    onSaved={(next) => {
                        setRecords(next);
                        setEditing(false);
                        setError("");
                    }}
                />
            </div>
        );
    }

    return (
        <div className="page-container finance-page">
            <section className="finance-page__header section">
                <div>
                    <h1 className="finance-page__title">{t("nav.finance")}</h1>
                    <p className="dashboard__section-subtitle">{t("finance.summary.subtitle")}</p>
                </div>
                <div className="finance-page__actions">
                    <button type="button" className="finance-page__small-btn" onClick={() => setEditing(true)}>
                        <Pencil size={15} /> {t("finance.summary.editRecords")}
                    </button>
                    <button type="button" className="finance-page__primary-btn" onClick={() => setEditing(true)}>
                        <Plus size={15} /> {t("finance.form.addExpense")}
                    </button>
                </div>
            </section>
            {error && <p className="finance-form__error" role="alert">{error}</p>}
            <section className="finance-page__summary section">
                <div className="finance-page__summary-card finance-page__summary-card--expense">
                    <span className="finance-page__summary-label">{t("finance.totalExpenses")}</span>
                    <span className="finance-page__summary-value">
                        <Money
                            value={calculation.totals.cost}
                            formatNumber={formatNumber}
                            emptyLabel={t("finance.summary.dataUnavailable")}
                        />
                    </span>
                    <span className="finance-page__summary-sub">
                        {calculation.totals.costPerArea === null
                            ? t("finance.summary.areaUnavailable")
                            : t("finance.summary.perUnit", {
                                  amount: formatNumber(Math.round(calculation.totals.costPerArea)),
                                  unit: unitLabel(t, calculation.totals.costPerAreaLabel),
                              })}
                    </span>
                </div>
                <div className="finance-page__summary-card finance-page__summary-card--revenue">
                    <span className="finance-page__summary-label">{t("finance.expectedRevenue")}</span>
                    <span className="finance-page__summary-value">
                        <Money
                            value={calculation.totals.revenue}
                            formatNumber={formatNumber}
                            emptyLabel={t("finance.summary.dataUnavailable")}
                        />
                    </span>
                    <span className="finance-page__summary-sub">
                        {calculation.totals.revenue === null
                            ? t("finance.summary.completeSelling")
                            : t("finance.summary.revenueBasis")}
                    </span>
                </div>
                <div className="finance-page__summary-card finance-page__summary-card--profit">
                    <span className="finance-page__summary-label">{t("finance.estimatedProfit")}</span>
                    <span className="finance-page__summary-value">
                        <Money
                            value={calculation.totals.profit}
                            formatNumber={formatNumber}
                            emptyLabel={t("finance.summary.dataUnavailable")}
                        />
                    </span>
                    <span className="finance-page__summary-sub">
                        {calculation.totals.margin === null
                            ? t("finance.summary.dataUnavailable")
                            : t("finance.summary.marginPercent", {
                                  value: formatNumber(calculation.totals.margin),
                              })}
                    </span>
                </div>
            </section>
            {calculation.totals.revenue === null && (
                <div className="finance-page__incomplete section">{t("finance.summary.incomplete")}</div>
            )}
            <section className="finance-page__variety-table-section section">
                <h2 className="finance-page__section-title">{t("finance.summary.tableTitle")}</h2>
                <div className="finance-page__table-wrapper">
                    <table className="finance-page__table">
                        <thead>
                            <tr>
                                <th>{t("finance.summary.colParcel")}</th>
                                <th>{t("finance.summary.colArea")}</th>
                                <th>{t("finance.summary.colProduction")}</th>
                                <th>{t("finance.summary.colCost")}</th>
                                <th>{t("finance.summary.colRevenue")}</th>
                                <th>{t("finance.summary.colProfit")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {calculation.rows.map((row) => (
                                <tr key={row.parcel.id}>
                                    <td>
                                        <strong>
                                            {row.parcel.riceVariety || t("finance.form.varietyNotSet")}
                                        </strong>
                                    </td>
                                    <td>
                                        {formatNumber(row.parcel.area)} {unitLabel(t, row.parcel.unit)}
                                    </td>
                                    <td>
                                        {row.productionKg === null
                                            ? t("finance.summary.dataUnavailable")
                                            : `${formatNumber(row.productionKg)} ${t("units.kg")}`}
                                    </td>
                                    <td>₹{formatNumber(Math.round(row.cost))}</td>
                                    <td>
                                        <Money
                                            value={row.revenue}
                                            formatNumber={formatNumber}
                                            emptyLabel={t("finance.summary.dataUnavailable")}
                                        />
                                    </td>
                                    <td className={row.profit !== null && row.profit >= 0 ? "finance-page__profit" : ""}>
                                        <Money
                                            value={row.profit}
                                            formatNumber={formatNumber}
                                            emptyLabel={t("finance.summary.dataUnavailable")}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
            <div className="finance-page__grid">
                <section className="finance-page__breakdown section">
                    <h2 className="finance-page__section-title">{t("finance.summary.breakdownTitle")}</h2>
                    <div className="finance-page__chart-row">
                        {calculation.categories.length ? (
                            <>
                                <ResponsiveContainer width={180} height={180}>
                                    <PieChart>
                                        <Pie
                                            data={calculation.categories}
                                            dataKey="amount"
                                            innerRadius={50}
                                            outerRadius={80}
                                            strokeWidth={0}
                                        >
                                            {calculation.categories.map((entry) => (
                                                <Cell key={entry.value} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value) => [
                                                `₹${formatNumber(value)}`,
                                                t("finance.summary.expenseTooltip"),
                                            ]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="finance-page__legend">
                                    {calculation.categories.map((item) => (
                                        <div className="finance-page__legend-item" key={item.value}>
                                            <span
                                                className="finance-page__legend-dot"
                                                style={{ background: item.color }}
                                            />
                                            <span className="finance-page__legend-label">
                                                {categoryLabel(t, item.value)}
                                            </span>
                                            <strong>₹{formatNumber(Math.round(item.amount))}</strong>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <p>{t("finance.summary.dataUnavailable")}</p>
                        )}
                    </div>
                </section>
                <section className="finance-page__breakdown section">
                    <h2 className="finance-page__section-title">{t("finance.summary.recordedTitle")}</h2>
                    <div className="finance-page__record-list">
                        {records.expenses.slice(0, 12).map((entry) => (
                            <div className="finance-page__record" key={entry.id}>
                                <span>{categoryLabel(t, entry.category)}</span>
                                <strong>₹{formatNumber(entry.amount)}</strong>
                                <small>
                                    {formatDate(locale, entry.date)}
                                    {entry.description ? ` · ${entry.description}` : ""}
                                </small>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
