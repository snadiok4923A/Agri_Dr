import { useLanguage } from '../hooks/useLanguage';
import { financeData } from '../data/mockData';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Finance.css';

export default function Finance() {
  const { t } = useLanguage();
  const { expenses, revenue, monthlyExpenses } = financeData;

  return (
    <div className="page-container finance-page">
      <section className="finance-page__header section"><h1 className="finance-page__title">{t('nav.finance')}</h1></section>
      <section className="finance-page__summary section">
        <div className="finance-page__summary-card finance-page__summary-card--expense">
          <span className="finance-page__summary-label">{t('finance.totalExpenses')}</span>
          <span className="finance-page__summary-value">{t('common.rupeeSymbol')}{expenses.total.toLocaleString('en-IN')}</span>
        </div>
        <div className="finance-page__summary-card finance-page__summary-card--revenue">
          <span className="finance-page__summary-label">{t('finance.expectedRevenue')}</span>
          <span className="finance-page__summary-value">{t('common.rupeeSymbol')}{revenue.expected.toLocaleString('en-IN')}</span>
        </div>
        <div className="finance-page__summary-card finance-page__summary-card--profit">
          <span className="finance-page__summary-label">{t('finance.estimatedProfit')}</span>
          <span className="finance-page__summary-value">{t('common.rupeeSymbol')}{revenue.estimatedProfit.toLocaleString('en-IN')}</span>
        </div>
      </section>
      <div className="finance-page__grid">
        <section className="finance-page__breakdown section">
          <h2 className="finance-page__section-title">{t('finance.expenses')}</h2>
          <div className="finance-page__chart-row">
            <div className="finance-page__pie">
              <ResponsiveContainer width={180} height={180}>
                <PieChart><Pie data={expenses.breakdown} dataKey="amount" cx="50%" cy="50%" innerRadius={50} outerRadius={80} strokeWidth={0}>{expenses.breakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="finance-page__legend">
              {expenses.breakdown.map((item, i) => (
                <div key={i} className="finance-page__legend-item">
                  <span className="finance-page__legend-dot" style={{ background: item.color }} />
                  <span className="finance-page__legend-label">{item.category}</span>
                  <span className="finance-page__legend-value">{t('common.rupeeSymbol')}{item.amount.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="finance-page__trend section">
          <h2 className="finance-page__section-title">Monthly Expenses</h2>
          <div className="finance-page__chart-container">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyExpenses}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 12 }} />
                <Bar dataKey="amount" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
