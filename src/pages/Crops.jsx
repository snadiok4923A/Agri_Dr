import { useLanguage } from "../hooks/useLanguage";
import { crops } from "../data/mockData";
import { useNavigate } from "react-router-dom";
import {
    Wheat,
    ArrowRight,
    Sprout,
    Bug,
    FlaskConical,
    TrendingUp,
} from "lucide-react";
import StatusBadge from "../components/common/StatusBadge";
import "./Crops.css";

export default function Crops() {
    const { t } = useLanguage();
    const navigate = useNavigate();

    return (
        <div className="page-container crops-page">
            <section className="crops-page__header section">
                <div>
                    <h1 className="crops-page__title">{t("nav.crops")}</h1>
                    <p className="crops-page__subtitle">
                        Variety-wise expected yield, estimated production, input
                        costs, net profit, and treatments
                    </p>
                </div>
            </section>

            <div className="crops-page__grid">
                {crops.map((crop) => (
                    <div
                        key={crop.id}
                        className="crops-page__card"
                        onClick={() => navigate(`/crops/${crop.id}`)}
                    >
                        <div className="crops-page__card-header">
                            <div className="crops-page__card-crop">
                                <Wheat size={18} />
                                <span className="crops-page__card-name">
                                    {crop.variety}
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

                        <div className="crops-page__card-meta-line">
                            <span>
                                {crop.field} · {crop.area} Acres
                            </span>
                            <span className="crops-page__mandi-tag">
                                Mandi: ₹{crop.marketPrice}/Q
                            </span>
                        </div>

                        {/* Growth & Stage progress */}
                        <div className="crops-page__card-progress">
                            <div className="crops-page__card-day">
                                <span className="crops-page__card-day-number">
                                    Day {crop.day} / {crop.totalDays}
                                </span>
                                <span className="crops-page__card-stage-tag">
                                    {crop.stage}
                                </span>
                            </div>
                            <div className="crops-page__card-bar">
                                <div
                                    className="crops-page__card-bar-fill"
                                    style={{
                                        width: `${(crop.day / crop.totalDays) * 100}%`,
                                    }}
                                />
                            </div>
                        </div>

                        {/* Production Metrics Grid */}
                        <div className="crops-page__financial-grid">
                            <div className="crops-page__stat-box">
                                <span className="crops-page__stat-lbl">
                                    {t("crops.expectedYield")}
                                </span>
                                <span className="crops-page__stat-val">
                                    {crop.expectedYield} Ton
                                </span>
                                <span className="crops-page__stat-sub">
                                    Max {crop.potentialYield} Ton
                                </span>
                            </div>
                            <div className="crops-page__stat-box">
                                <span className="crops-page__stat-lbl">
                                    {t("crops.expectedProfit")}
                                </span>
                                <span className="crops-page__stat-val crops-page__stat-val--profit">
                                    ₹
                                    {crop.expectedProfit.toLocaleString(
                                        "en-IN",
                                    )}
                                </span>
                                <span className="crops-page__stat-sub">
                                    {crop.profitMargin}% Margin
                                </span>
                            </div>
                            <div className="crops-page__stat-box">
                                <span className="crops-page__stat-lbl">
                                    {t("crops.estimatedCost")}
                                </span>
                                <span className="crops-page__stat-val">
                                    ₹
                                    {crop.estimatedCost.toLocaleString("en-IN")}
                                </span>
                                <span className="crops-page__stat-sub">
                                    Total inputs
                                </span>
                            </div>
                            <div className="crops-page__stat-box">
                                <span className="crops-page__stat-lbl">
                                    {t("crops.expectedRevenue")}
                                </span>
                                <span className="crops-page__stat-val">
                                    ₹
                                    {crop.expectedRevenue.toLocaleString(
                                        "en-IN",
                                    )}
                                </span>
                                <span className="crops-page__stat-sub">
                                    Selling value
                                </span>
                            </div>
                        </div>

                        {/* Requirements: Medicine & Fertilizer */}
                        <div className="crops-page__requirements">
                            <div className="crops-page__req-item">
                                <Bug size={14} color="var(--warning)" />
                                <span className="crops-page__req-text">
                                    <strong>Med:</strong> {crop.medicine} (₹
                                    {crop.medicineCost})
                                </span>
                            </div>
                            <div className="crops-page__req-item">
                                <FlaskConical size={14} color="var(--accent)" />
                                <span className="crops-page__req-text">
                                    <strong>Fert:</strong> {crop.fertilizer} (₹
                                    {crop.fertilizerCost})
                                </span>
                            </div>
                        </div>

                        <div className="crops-page__card-footer">
                            <span>View variety production breakdown</span>
                            <ArrowRight size={14} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
