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
        name: category.label,
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

function Money({ value, formatNumber }) {
    return value === null || value === undefined
        ? "Data not available"
        : `₹${formatNumber(Math.round(value))}`;
}

function ExpenseForm({ userId, parcels, initial, onCancel, onSaved }) {
    const { formatNumber } = useLanguage();
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
            setError("Add at least one expense amount before saving.");
            return;
        }
        if (validExpenses.some((entry) => !entry.date || !entry.category)) {
            setError("Every expense needs a category and date.");
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
            setError("Enter both expected production and selling price, or leave both blank.");
            return;
        }
        setSaving(true);
        try {
            const next = await saveFinancialRecords(userId, {
                expenses: validExpenses,
                targets,
            });
            onSaved(next);
        } catch (saveError) {
            setError(saveError.message || "Could not save your records.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <form className="finance-form section" onSubmit={submit}>
            <button type="button" className="finance-page__text-btn" onClick={onCancel}>
                <ArrowLeft size={16} /> Back
            </button>
            <h2 className="finance-page__form-title">Enter Your Farming Expenses</h2>
            <p className="finance-page__form-intro">
                Enter your actual rice cultivation expenses to calculate production
                cost, expected selling revenue, and estimated net profit.
            </p>
            <label className="finance-form__label">
                Select farm / parcel
                <select
                    className="finance-form__input"
                    value={selectedId}
                    onChange={(event) => setSelectedId(event.target.value)}
                >
                    {parcels.map((parcel, index) => (
                        <option key={parcel.id} value={parcel.id}>
                            Parcel {formatNumber(index + 1)} · {parcel.area} {parcel.unit} ·{" "}
                            {parcel.riceVariety || "Rice variety not set"}
                        </option>
                    ))}
                </select>
            </label>
            <div className="finance-form__parcel-note">
                Area and rice variety are taken from My Farm and cannot be changed here.
            </div>
            <div className="finance-form__entries">
                <div className="finance-form__section-heading">
                    <h3>Expense entries</h3>
                    <button type="button" className="finance-page__small-btn" onClick={addEntry}>
                        <Plus size={15} /> Add expense
                    </button>
                </div>
                {selected.expenses.map((entry) => (
                    <div className="finance-form__entry" key={entry.key}>
                        <select
                            className="finance-form__input"
                            value={entry.category}
                            onChange={(event) => updateEntry(entry.key, { category: event.target.value })}
                            aria-label="Expense category"
                        >
                            {EXPENSE_CATEGORIES.map((category) => (
                                <option key={category.value} value={category.value}>
                                    {category.label}
                                </option>
                            ))}
                        </select>
                        <input
                            className="finance-form__input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="Amount (₹)"
                            value={entry.amount}
                            onChange={(event) => updateEntry(entry.key, { amount: event.target.value })}
                            aria-label="Expense amount in rupees"
                        />
                        <input
                            className="finance-form__input"
                            type="text"
                            placeholder="Description (optional)"
                            value={entry.description}
                            onChange={(event) => updateEntry(entry.key, { description: event.target.value })}
                            aria-label="Expense description"
                        />
                        <input
                            className="finance-form__input"
                            type="date"
                            value={entry.date || ""}
                            onChange={(event) => updateEntry(entry.key, { date: event.target.value })}
                            aria-label="Expense date"
                        />
                        <button type="button" className="finance-form__remove" onClick={() => removeEntry(entry.key)} aria-label="Remove expense">
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
                {!selected.expenses.length && (
                    <p className="finance-form__empty">No expenses added for this parcel yet.</p>
                )}
            </div>
            <div className="finance-form__selling">
                <h3>Expected selling information</h3>
                <p>These details are optional now, but are needed to calculate revenue and profit.</p>
                <div className="finance-form__selling-grid">
                    <label className="finance-form__label">
                        Expected production (kg)
                        <input className="finance-form__input" type="number" min="0.01" step="0.01" value={selected.target.productionKg || ""} onChange={(event) => updateSelected({ target: { ...selected.target, productionKg: event.target.value } })} />
                    </label>
                    <label className="finance-form__label">
                        Selling price per quintal (₹)
                        <input className="finance-form__input" type="number" min="0.01" step="0.01" value={selected.target.pricePerQuintal || ""} onChange={(event) => updateSelected({ target: { ...selected.target, pricePerQuintal: event.target.value } })} />
                    </label>
                    <label className="finance-form__label">
                        Expected selling date (optional)
                        <input className="finance-form__input" type="date" value={selected.target.sellingDate || ""} onChange={(event) => updateSelected({ target: { ...selected.target, sellingDate: event.target.value } })} />
                    </label>
                </div>
            </div>
            {error && <p className="finance-form__error" role="alert">{error}</p>}
            <button className="finance-page__primary-btn" type="submit" disabled={saving}>
                <Save size={16} /> {saving ? "Saving…" : "Save expense records"}
            </button>
        </form>
    );
}

export default function Finance() {
    const { t, formatNumber } = useLanguage();
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
            .catch((fetchError) => active && setError(fetchError.message))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [user?.id, refreshFarm]);

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
    if (loading) return <div className="page-container finance-page"><p>Loading your financial records…</p></div>;
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
                    <p className="dashboard__section-subtitle">Actual expenses and expected selling details from your farm.</p>
                </div>
                <div className="finance-page__actions">
                    <button type="button" className="finance-page__small-btn" onClick={() => setEditing(true)}><Pencil size={15} /> Edit records</button>
                    <button type="button" className="finance-page__primary-btn" onClick={() => setEditing(true)}><Plus size={15} /> Add expense</button>
                </div>
            </section>
            {error && <p className="finance-form__error" role="alert">{error}</p>}
            <section className="finance-page__summary section">
                <div className="finance-page__summary-card finance-page__summary-card--expense"><span className="finance-page__summary-label">Total Production Cost</span><span className="finance-page__summary-value"><Money value={calculation.totals.cost} formatNumber={formatNumber} /></span><span className="finance-page__summary-sub">{calculation.totals.costPerArea === null ? "Area not available" : `₹${formatNumber(Math.round(calculation.totals.costPerArea))} per ${calculation.totals.costPerAreaLabel}`}</span></div>
                <div className="finance-page__summary-card finance-page__summary-card--revenue"><span className="finance-page__summary-label">Expected Selling Revenue</span><span className="finance-page__summary-value"><Money value={calculation.totals.revenue} formatNumber={formatNumber} /></span><span className="finance-page__summary-sub">{calculation.totals.revenue === null ? "Complete your selling details" : "Based on recorded production and price"}</span></div>
                <div className="finance-page__summary-card finance-page__summary-card--profit"><span className="finance-page__summary-label">Expected Net Profit</span><span className="finance-page__summary-value"><Money value={calculation.totals.profit} formatNumber={formatNumber} /></span><span className="finance-page__summary-sub">{calculation.totals.margin === null ? "Data not available" : `${formatNumber(calculation.totals.margin)}% profit margin`}</span></div>
            </section>
            {calculation.totals.revenue === null && <div className="finance-page__incomplete section">Selling details are incomplete. Add expected production and selling price to see revenue, profit, and margin.</div>}
            <section className="finance-page__variety-table-section section">
                <h2 className="finance-page__section-title">Variety-wise Production &amp; Profit Breakdown</h2>
                <div className="finance-page__table-wrapper"><table className="finance-page__table"><thead><tr><th>Parcel / variety</th><th>Area</th><th>Production</th><th>Cost</th><th>Revenue</th><th>Profit</th></tr></thead><tbody>{calculation.rows.map((row) => <tr key={row.parcel.id}><td><strong>{row.parcel.riceVariety || "Rice variety not set"}</strong></td><td>{row.parcel.area} {row.parcel.unit}</td><td>{row.productionKg === null ? "Data not available" : `${formatNumber(row.productionKg)} kg`}</td><td>₹{formatNumber(Math.round(row.cost))}</td><td><Money value={row.revenue} formatNumber={formatNumber} /></td><td className={row.profit !== null && row.profit >= 0 ? "finance-page__profit" : ""}><Money value={row.profit} formatNumber={formatNumber} /></td></tr>)}</tbody></table></div>
            </section>
            <div className="finance-page__grid">
                <section className="finance-page__breakdown section"><h2 className="finance-page__section-title">Expense Breakdown</h2><div className="finance-page__chart-row">{calculation.categories.length ? <><ResponsiveContainer width={180} height={180}><PieChart><Pie data={calculation.categories} dataKey="amount" innerRadius={50} outerRadius={80} strokeWidth={0}>{calculation.categories.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip formatter={(value) => [`₹${formatNumber(value)}`, "Expense"]} /></PieChart></ResponsiveContainer><div className="finance-page__legend">{calculation.categories.map((item) => <div className="finance-page__legend-item" key={item.name}><span className="finance-page__legend-dot" style={{ background: item.color }} /><span className="finance-page__legend-label">{item.name}</span><strong>₹{formatNumber(Math.round(item.amount))}</strong></div>)}</div></> : <p>Data not available</p>}</div></section>
                <section className="finance-page__breakdown section"><h2 className="finance-page__section-title">Recorded Expenses</h2><div className="finance-page__record-list">{records.expenses.slice(0, 12).map((entry) => <div className="finance-page__record" key={entry.id}><span>{EXPENSE_CATEGORIES.find((category) => category.value === entry.category)?.label}</span><strong>₹{formatNumber(entry.amount)}</strong><small>{entry.date}{entry.description ? ` · ${entry.description}` : ""}</small></div>)}</div></section>
            </div>
        </div>
    );
}
