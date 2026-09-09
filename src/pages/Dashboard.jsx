import { useLanguage } from "../hooks/useLanguage";
import {
    farmData,
    fields,
    crops,
    financeData,
    weatherData,
    recommendations,
    activityData,
    analyticsData,
} from "../data/mockData";
import { useNavigate } from "react-router-dom";
import {
    CloudSun,
    Droplets,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Wind,
    ArrowRight,
    Wheat,
    Coins,
    DollarSign,
    Sprout,
    Bug,
    FlaskConical,
    ShieldAlert,
    Sparkles,
    ChevronRight,
} from "lucide-react";
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import StatusBadge from "../components/common/StatusBadge";
import "./Dashboard.css";

const getGreeting = (t) => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.greeting");
    if (hour < 17) return t("dashboard.greetingAfternoon");
    return t("dashboard.greetingEvening");
};

export default function Dashboard() {
    const { t } = useLanguage();
    const navigate = useNavigate();

    const totalYield = farmData.expectedYield;
    const potentialYield = farmData.potentialYield;
    const currentEst = farmData.currentProductionEstimate;
    const yieldPct = Math.round((currentEst / totalYield) * 100);

    const yieldDonutData = [
        { name: "Achieved", value: yieldPct },
        { name: "Remaining", value: 100 - yieldPct },
    ];

    const criticalActions = recommendations.slice(0, 4);

    return (
        <div className="page-container dashboard adv-dashboard">
            {/* Greeting + Weather Advisory Row */}
            <div className="adv-greeting-row">
                <div>
                    <h1 className="adv-greeting-row__text">
                        {getGreeting(t)}, {farmData.owner}
                    </h1>
                    <p className="dashboard__greeting-sub">
                        {farmData.name} · {farmData.location}
                    </p>
                </div>
                <div
                    className="adv-card adv-weather-compact"
                    onClick={() => navigate("/weather")}
                    style={{ cursor: "pointer" }}
                >
                    <div className="adv-weather-compact__main">
                        <CloudSun
                            size={20}
                            className="adv-weather-compact__icon"
                        />
                        <div>
                            <span className="adv-weather-compact__temp">
                                {weatherData.current.temperature}°
                            </span>
                            <span className="adv-weather-compact__cond">
                                {weatherData.current.condition}
                            </span>
                        </div>
                    </div>
                    <div className="adv-weather-compact__row">
                        <span className="adv-weather-compact__chip">
                            <Droplets size={10} />{" "}
                            {weatherData.current.humidity}%
                        </span>
                        <span className="adv-weather-compact__chip">
                            <Wind size={10} /> {weatherData.current.wind} km/h
                        </span>
                    </div>
                </div>
            </div>

            {/* Priority 1 & 2: Overall Production & Expected Yield Card */}
            <div className="adv-top-grid adv-top-grid--1">
                <div className="adv-card adv-production-card">
                    {/* Donut progress */}
                    <div className="adv-production-card__left">
                        <div className="adv-production-card__donut">
                            <ResponsiveContainer
                                width="100%"
                                height="100%"
                                aspect={1}
                                minWidth={0}
                            >
                                <PieChart>
                                    <Pie
                                        data={yieldDonutData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="75%"
                                        outerRadius="100%"
                                        startAngle={90}
                                        endAngle={-270}
                                        dataKey="value"
                                        stroke="none"
                                        cornerRadius={6}
                                    >
                                        <Cell fill="var(--accent)" />
                                        <Cell fill="var(--bg-elevated)" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="adv-production-card__donut-center">
                                <span className="adv-production-card__donut-val">
                                    {yieldPct}%
                                </span>
                            </div>
                        </div>
                        <div
                            className="adv-production-card__status"
                            style={{ color: "var(--success)" }}
                        >
                            <span
                                className="adv-production-card__status-dot"
                                style={{ backgroundColor: "var(--success)" }}
                            ></span>
                            {t("common.healthy")}
                        </div>
                    </div>

                    {/* Data Comparison */}
                    <div className="adv-production-card__right">
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <span className="adv-card__label">
                                {t("dashboard.overallProduction")}
                            </span>
                            <span
                                style={{
                                    fontSize: 12,
                                    color: "var(--text-muted)",
                                }}
                            >
                                {farmData.totalLand} {t("dashboard.acres")} · 4{" "}
                                {t("dashboard.activeCrops")}
                            </span>
                        </div>

                        <div className="adv-production-card__comparison">
                            <div className="adv-production-card__column">
                                <span className="adv-production-card__col-label">
                                    ESTIMATED PROGRESS
                                </span>
                                <span className="adv-production-card__main-val">
                                    {currentEst}{" "}
                                    <span className="adv-production-card__unit">
                                        {t("dashboard.tons")}
                                    </span>
                                </span>
                                <span className="adv-production-card__sub-val">
                                    {(currentEst * 1000).toLocaleString()} kg in
                                    progress
                                </span>
                            </div>

                            <div className="adv-production-card__divider"></div>

                            <div className="adv-production-card__column">
                                <span className="adv-production-card__col-label">
                                    {t("dashboard.expectedYield")}
                                </span>
                                <span className="adv-production-card__main-val">
                                    {totalYield}{" "}
                                    <span className="adv-production-card__unit">
                                        {t("dashboard.tons")}
                                    </span>
                                </span>
                                <span className="adv-production-card__sub-val">
                                    {(totalYield * 1000).toLocaleString()} kg
                                    target
                                </span>
                            </div>

                            <div className="adv-production-card__divider"></div>

                            <div className="adv-production-card__column">
                                <span className="adv-production-card__col-label">
                                    {t("dashboard.potentialYield")}
                                </span>
                                <span className="adv-production-card__main-val">
                                    {potentialYield}{" "}
                                    <span className="adv-production-card__unit">
                                        {t("dashboard.tons")}
                                    </span>
                                </span>
                                <span className="adv-production-card__sub-val">
                                    {(potentialYield * 1000).toLocaleString()}{" "}
                                    kg maximum
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Priority 3: Expected Profit & Financial Highlights */}
            <div className="adv-finance-grid">
                <div
                    className="adv-finance-card"
                    onClick={() => navigate("/finance")}
                    style={{ cursor: "pointer" }}
                >
                    <div className="adv-finance-card__header">
                        <span className="adv-finance-card__label">
                            {t("dashboard.estimatedRevenue")}
                        </span>
                        <Coins size={16} color="var(--accent)" />
                    </div>
                    <div className="adv-finance-card__value">
                        ₹{farmData.estimatedRevenue.toLocaleString("en-IN")}
                    </div>
                    <div className="adv-finance-card__sub">
                        <span>Avg ₹3,886 / Quintal</span>
                    </div>
                </div>

                <div
                    className="adv-finance-card"
                    onClick={() => navigate("/finance")}
                    style={{ cursor: "pointer" }}
                >
                    <div className="adv-finance-card__header">
                        <span className="adv-finance-card__label">
                            {t("dashboard.productionCost")}
                        </span>
                        <DollarSign size={16} color="var(--warning)" />
                    </div>
                    <div className="adv-finance-card__value">
                        ₹{farmData.estimatedCost.toLocaleString("en-IN")}
                    </div>
                    <div className="adv-finance-card__sub">
                        <span>₹15,813 / Acre average</span>
                    </div>
                </div>

                <div
                    className="adv-finance-card adv-finance-card--highlight"
                    onClick={() => navigate("/finance")}
                    style={{ cursor: "pointer" }}
                >
                    <div className="adv-finance-card__header">
                        <span className="adv-finance-card__label">
                            {t("dashboard.expectedProfit")}
                        </span>
                        <span className="adv-finance-card__badge">
                            +{farmData.profitMargin}% Margin
                        </span>
                    </div>
                    <div
                        className="adv-finance-card__value"
                        style={{ color: "var(--success)" }}
                    >
                        ₹{farmData.expectedProfit.toLocaleString("en-IN")}
                    </div>
                    <div className="adv-finance-card__sub">
                        <TrendingUp size={12} color="var(--success)" />
                        <span>Net profit after all inputs</span>
                    </div>
                </div>

                <div
                    className="adv-finance-card"
                    onClick={() => navigate("/crops")}
                    style={{ cursor: "pointer" }}
                >
                    <div className="adv-finance-card__header">
                        <span className="adv-finance-card__label">
                            Active Varieties
                        </span>
                        <Wheat size={16} color="var(--accent)" />
                    </div>
                    <div className="adv-finance-card__value">4 Varieties</div>
                    <div className="adv-finance-card__sub">
                        <span>IR-64, Swarna, Basmati, Samba</span>
                    </div>
                </div>
            </div>

            {/* Production & Business Alerts */}
            <section className="section">
                <span className="adv-section-label">
                    Production & Treatment Actions
                </span>
                <div className="adv-actions">
                    {criticalActions.map((action) => (
                        <div
                            key={action.id}
                            className={`adv-action-chip adv-action-chip--${action.category}`}
                            onClick={() =>
                                navigate(
                                    action.title.includes("Medicine")
                                        ? "/disease"
                                        : action.title.includes("Fertilizer")
                                          ? "/fertilizer"
                                          : "/improve",
                                )
                            }
                        >
                            <div className="adv-action-chip__dot" />
                            <div>
                                <span className="adv-action-chip__title">
                                    {action.title}: {action.field}
                                </span>
                                <span className="adv-action-chip__field">
                                    {action.description} ({action.benefit})
                                </span>
                            </div>
                            <ArrowRight
                                size={14}
                                className="adv-action-chip__arrow"
                            />
                        </div>
                    ))}
                </div>
            </section>

            {/* Priority 4 & 5: Production Cost Breakdown + Medicine/Pesticide Requirements */}
            <div className="adv-mid-grid section">
                {/* Cost Breakdown */}
                <div className="adv-card adv-cost-card">
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <span className="adv-card__label">
                            Production Cost Breakdown
                        </span>
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--text-primary)",
                            }}
                        >
                            Total ₹1,36,000
                        </span>
                    </div>
                    <div className="adv-cost-list">
                        {financeData.expenses.breakdown.map((item, idx) => {
                            const pct = Math.round(
                                (item.amount / financeData.expenses.total) *
                                    100,
                            );
                            return (
                                <div key={idx} className="adv-cost-item">
                                    <div className="adv-cost-item__row">
                                        <span className="adv-cost-item__name">
                                            {item.category}
                                        </span>
                                        <span className="adv-cost-item__amount">
                                            ₹
                                            {item.amount.toLocaleString(
                                                "en-IN",
                                            )}{" "}
                                            ({pct}%)
                                        </span>
                                    </div>
                                    <div className="adv-cost-bar">
                                        <div
                                            className="adv-cost-bar__fill"
                                            style={{
                                                width: `${pct}%`,
                                                background: item.color,
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Medicine / Pesticide Requirements */}
                <div className="adv-card adv-medicine-widget">
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <span className="adv-card__label">
                            Medicine & Treatment Requirements
                        </span>
                        <span
                            style={{
                                fontSize: 12,
                                color: "var(--accent)",
                                cursor: "pointer",
                                fontWeight: 600,
                            }}
                            onClick={() => navigate("/disease")}
                        >
                            View All Treatments →
                        </span>
                    </div>
                    <div className="adv-medicine-list">
                        {fields.map((f) => (
                            <div
                                key={f.id}
                                className="adv-medicine-item"
                                onClick={() => navigate("/disease")}
                                style={{ cursor: "pointer" }}
                            >
                                <div className="adv-medicine-item__info">
                                    <span className="adv-medicine-item__name">
                                        {f.medicineRequirement.medicine}
                                    </span>
                                    <span className="adv-medicine-item__target">
                                        {f.name} · {f.variety} (
                                        {f.medicineRequirement.purpose})
                                    </span>
                                </div>
                                <div className="adv-medicine-item__meta">
                                    <span className="adv-medicine-item__cost">
                                        ₹{f.medicineRequirement.cost}
                                    </span>
                                    <span className="adv-medicine-item__qty">
                                        Qty: {f.medicineRequirement.quantity}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Production Trend + Yield Forecast Charts */}
            <div className="adv-charts-grid section">
                <div className="adv-card adv-chart-card">
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <span className="adv-card__label">
                            {t("dashboard.productionTrend")} (Apr - Sep)
                        </span>
                        <span
                            style={{ fontSize: 11, color: "var(--text-muted)" }}
                        >
                            Estimated Cumulative Production
                        </span>
                    </div>
                    <div className="adv-chart-card__stats">
                        <span className="adv-chart-card__stat">
                            <span
                                className="adv-chart-card__stat-dot"
                                style={{ background: "var(--accent)" }}
                            />
                            Projected Production (Ton)
                        </span>
                        <span className="adv-chart-card__stat">
                            <span
                                className="adv-chart-card__stat-dot"
                                style={{ background: "var(--text-muted)" }}
                            />
                            Potential (Ton)
                        </span>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={analyticsData.productionTrend}>
                            <defs>
                                <linearGradient
                                    id="advProdGrad"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="0%"
                                        stopColor="var(--accent)"
                                        stopOpacity={0.25}
                                    />
                                    <stop
                                        offset="100%"
                                        stopColor="var(--accent)"
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                stroke="var(--chart-grid)"
                                strokeDasharray="3 3"
                            />
                            <XAxis
                                dataKey="month"
                                tick={{
                                    fontSize: 10,
                                    fill: "var(--text-muted)",
                                }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                domain={[0, 20]}
                                tick={{
                                    fontSize: 10,
                                    fill: "var(--text-muted)",
                                }}
                                axisLine={false}
                                tickLine={false}
                                width={28}
                            />
                            <Tooltip
                                formatter={(val) => [
                                    `${val} Ton`,
                                    "Production",
                                ]}
                                contentStyle={{
                                    background: "var(--bg-elevated)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "var(--radius-md)",
                                    fontSize: 11,
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="production"
                                stroke="var(--accent)"
                                fill="url(#advProdGrad)"
                                strokeWidth={2}
                                dot={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="potential"
                                stroke="var(--text-muted)"
                                strokeWidth={1.5}
                                strokeDasharray="4 4"
                                dot={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="adv-card adv-chart-card">
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <span className="adv-card__label">
                            {t("dashboard.yieldForecast")} (Expected vs
                            Potential)
                        </span>
                        <span
                            style={{ fontSize: 11, color: "var(--text-muted)" }}
                        >
                            Per-Acre Yield Curve
                        </span>
                    </div>
                    <div className="adv-chart-card__stats">
                        <span className="adv-chart-card__stat">
                            <span
                                className="adv-chart-card__stat-dot"
                                style={{ background: "var(--accent)" }}
                            />
                            Expected: {totalYield}T Total
                        </span>
                        <span className="adv-chart-card__stat">
                            <span
                                className="adv-chart-card__stat-dot"
                                style={{ background: "var(--text-muted)" }}
                            />
                            Potential: {potentialYield}T Total
                        </span>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={analyticsData.yieldTrend}>
                            <CartesianGrid
                                stroke="var(--chart-grid)"
                                strokeDasharray="3 3"
                            />
                            <XAxis
                                dataKey="month"
                                tick={{
                                    fontSize: 10,
                                    fill: "var(--text-muted)",
                                }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                domain={[2, 5]}
                                tick={{
                                    fontSize: 10,
                                    fill: "var(--text-muted)",
                                }}
                                axisLine={false}
                                tickLine={false}
                                width={28}
                            />
                            <Tooltip
                                formatter={(val, name) => [
                                    `${val} Ton/ac`,
                                    name === "actual"
                                        ? "Expected"
                                        : "Potential",
                                ]}
                                contentStyle={{
                                    background: "var(--bg-elevated)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "var(--radius-md)",
                                    fontSize: 11,
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="actual"
                                stroke="var(--accent)"
                                strokeWidth={2}
                                dot={false}
                                name="Expected"
                            />
                            <Line
                                type="monotone"
                                dataKey="potential"
                                stroke="var(--text-muted)"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={false}
                                name="Potential"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Priority 6: Rice Varieties Performance Section */}
            <section className="adv-varieties-section section">
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <div>
                        <span className="adv-section-label">
                            Rice Variety Performance & Profit
                        </span>
                        <p className="dashboard__section-subtitle">
                            Field-wise expected yield, revenue, production cost,
                            and net profit
                        </p>
                    </div>
                    <button
                        className="dashboard__action-btn"
                        onClick={() => navigate("/crops")}
                    >
                        View All Varieties <ArrowRight size={14} />
                    </button>
                </div>

                <div className="adv-varieties-grid">
                    {crops.map((crop) => (
                        <div
                            key={crop.id}
                            className="adv-variety-card"
                            onClick={() => navigate(`/crops/${crop.id}`)}
                        >
                            <div className="adv-variety-card__header">
                                <div>
                                    <h3 className="adv-variety-card__name">
                                        {crop.variety}
                                    </h3>
                                    <span className="adv-variety-card__field">
                                        {crop.field} · {crop.area} Acres
                                    </span>
                                </div>
                                <StatusBadge
                                    status={
                                        crop.variety === "Swarna"
                                            ? "needs-attention"
                                            : "optimal"
                                    }
                                />
                            </div>

                            <div className="adv-variety-card__stats">
                                <div className="adv-variety-card__stat-col">
                                    <span className="adv-variety-card__stat-label">
                                        Expected Yield
                                    </span>
                                    <span className="adv-variety-card__stat-val">
                                        {crop.expectedYield} Ton
                                    </span>
                                </div>
                                <div className="adv-variety-card__stat-col">
                                    <span className="adv-variety-card__stat-label">
                                        Expected Profit
                                    </span>
                                    <span className="adv-variety-card__stat-val adv-variety-card__stat-val--profit">
                                        ₹
                                        {crop.expectedProfit.toLocaleString(
                                            "en-IN",
                                        )}
                                    </span>
                                </div>
                                <div className="adv-variety-card__stat-col">
                                    <span className="adv-variety-card__stat-label">
                                        Est. Revenue
                                    </span>
                                    <span className="adv-variety-card__stat-val">
                                        ₹
                                        {crop.expectedRevenue.toLocaleString(
                                            "en-IN",
                                        )}
                                    </span>
                                </div>
                                <div className="adv-variety-card__stat-col">
                                    <span className="adv-variety-card__stat-label">
                                        Est. Cost
                                    </span>
                                    <span className="adv-variety-card__stat-val">
                                        ₹
                                        {crop.estimatedCost.toLocaleString(
                                            "en-IN",
                                        )}
                                    </span>
                                </div>
                            </div>

                            <div className="adv-variety-card__footer">
                                <span className="adv-variety-card__stage">
                                    <Sprout size={13} /> {crop.stage} (Day{" "}
                                    {crop.day}/{crop.totalDays})
                                </span>
                                <span
                                    style={{
                                        fontWeight: 600,
                                        color: "var(--accent)",
                                    }}
                                >
                                    {crop.profitMargin}% Margin
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Row 7: Activity Log */}
            <section className="section">
                <span className="adv-section-label">
                    Recent Production Activity
                </span>
                <div className="adv-activity">
                    {activityData.slice(0, 5).map((activity) => (
                        <div key={activity.id} className="adv-activity__item">
                            <div className="adv-activity__dot" />
                            <span className="adv-activity__text">
                                {activity.action}
                            </span>
                            <span className="adv-activity__field">
                                {activity.field}
                            </span>
                            <span className="adv-activity__time">
                                {activity.time}
                            </span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
