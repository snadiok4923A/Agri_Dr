import { useLanguage } from '../hooks/useLanguage';
import { marketData } from '../data/mockData';
import { TrendingUp, TrendingDown, Store } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './Market.css';

export default function Market() {
  const { t } = useLanguage();


  return (
    <div className="page-container market-page">
      <section className="market-page__header section"><h1 className="market-page__title">{t('nav.market')}</h1></section>
      <div className="market-page__grid">
        {marketData.crops.map((crop, i) => (
          <div key={i} className="market-page__crop-card">
            <div className="market-page__crop-header">
              <div>
                <span className="market-page__crop-name">{crop.name}</span>
                <div className="market-page__crop-price">
                  <span className="market-page__crop-amount">{t('common.rupeeSymbol')}{crop.price}</span>
                  <span className="market-page__crop-unit">/ {t('common.quintal')}</span>
                </div>
              </div>
              <div className={`market-page__crop-change market-page__crop-change--${crop.trend}`}>
                {crop.trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span>{crop.change > 0 ? '+' : ''}{crop.change}%</span>
              </div>
            </div>
            <div className="market-page__chart">
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={crop.priceHistory}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={['dataMin - 50', 'dataMax + 50']} tick={{ fontSize: 10, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} hide />
                  <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 12 }} />
                  <Line type="monotone" dataKey="price" stroke={crop.trend === 'up' ? 'var(--accent)' : 'var(--danger)'} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="market-page__markets">
                <h4 className="market-page__markets-title">{t('market.nearbyMarkets')}</h4>
                {crop.markets.map((market, j) => (
                  <div key={j} className="market-page__market-row"><Store size={14} /><span className="market-page__market-name">{market.name}</span><span className="market-page__market-price">{t('common.rupeeSymbol')}{market.price}</span></div>
                ))}
              </div>
          </div>
        ))}
      </div>
    </div>
  );
}
