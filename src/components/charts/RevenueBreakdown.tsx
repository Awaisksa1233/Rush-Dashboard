import React from 'react';
import { RevenueBreakdownCategory } from '../../types/dashboard';
import { formatSAR } from '../../services/analyticsService';
import { TrendingUp, TrendingDown, Layers } from 'lucide-react';
import { InfoTooltip } from '../common/Tooltip';

interface RevenueBreakdownProps {
  categories: RevenueBreakdownCategory[];
  totalRevenue: number;
}

export const RevenueBreakdown: React.FC<RevenueBreakdownProps> = ({ categories, totalRevenue }) => {
  const recurringAmount = categories.filter(c => c.id !== 'shiny').reduce((sum, c) => sum + Math.max(0, c.amount), 0);
  const totalAmount = categories.reduce((sum, c) => sum + Math.max(0, c.amount), 0);
  const recurringPct = totalAmount > 0 ? ((recurringAmount / totalAmount) * 100).toFixed(1) : '100.0';

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display font-bold text-base text-slate-900">
              Revenue Breakdown by Stream
            </h3>
            <InfoTooltip text="Granular view of recurring subscriptions vs transactional non-recurring revenue, upgrades, and refunds." />
          </div>
          <div className="text-sm font-bold font-display text-emerald-800">
            {formatSAR(totalRevenue)}
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Share of gross collections and period-over-period velocity
        </p>

        {/* Multi-segment bar */}
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex mb-4">
          {categories.filter(c => c.amount > 0).map((cat) => (
            <div
              key={cat.id}
              style={{ width: `${cat.sharePct}%`, backgroundColor: cat.color }}
              className="h-full transition-all duration-300 hover:opacity-80"
              title={`${cat.label}: ${cat.sharePct}%`}
            />
          ))}
        </div>

        {/* Detailed Stream List */}
        <div className="divide-y divide-slate-100">
          {categories.map((cat) => {
            const isNegative = cat.amount < 0;
            const isPositiveGrowth = cat.comparisonChangePct >= 0;

            return (
              <div key={cat.id} className="py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-medium text-slate-700 truncate">{cat.label}</span>
                </div>

                <div className="flex items-center gap-4 font-mono">
                  <span className={`font-semibold ${isNegative ? 'text-rose-600' : 'text-slate-900'}`}>
                    {isNegative ? `-${formatSAR(Math.abs(cat.amount))}` : formatSAR(cat.amount)}
                  </span>
                  
                  <span className="text-slate-400 w-10 text-right text-[11px]">
                    {cat.sharePct}%
                  </span>

                  <span className={`inline-flex items-center text-[10px] font-medium w-14 justify-end ${
                    isPositiveGrowth ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {isPositiveGrowth ? `+${cat.comparisonChangePct}%` : `${cat.comparisonChangePct}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex justify-between">
        <span>Recurring Revenue Ratio: <strong className="text-emerald-800">{recurringPct}%</strong></span>
        <span>Gateway Status: <strong className="text-slate-700">Moyasar Live</strong></span>
      </div>
    </div>
  );
};
