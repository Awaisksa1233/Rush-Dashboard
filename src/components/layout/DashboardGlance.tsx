import React from 'react';
import { 
  ExecutiveMetrics, 
  RevenueSeriesPoint, 
  MembershipWaterfallData, 
  PaymentHealthFunnel, 
  PackageEconomicsRow,
  ModalDrilldownType 
} from '../../types/dashboard';
import { ExecutiveKpiGrid } from '../kpis/ExecutiveKpiGrid';
import { formatSAR } from '../../services/analyticsService';
import { 
  TrendingUp, 
  ArrowRight, 
  ShieldCheck, 
  AlertTriangle, 
  UserCheck, 
  Sparkles, 
  Layers, 
  Zap, 
  CheckCircle2, 
  Repeat 
} from 'lucide-react';
import { Sparkline } from '../kpis/MetricCard';

interface DashboardGlanceProps {
  metrics: ExecutiveMetrics;
  trendPoints: RevenueSeriesPoint[];
  waterfall: MembershipWaterfallData;
  paymentHealth: PaymentHealthFunnel;
  packages: PackageEconomicsRow[];
  onDrilldown: (type: ModalDrilldownType) => void;
  onGoToAnalytics: () => void;
}

export const DashboardGlance: React.FC<DashboardGlanceProps> = ({
  metrics,
  trendPoints,
  waterfall,
  paymentHealth,
  packages,
  onDrilldown,
  onGoToAnalytics
}) => {
  const { netRevenue, mrr, validMemberships, netMemberGrowth, renewalCollectionRate, churnRate } = metrics;

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* 1. EXECUTIVE KPI GRID (The 6 Essential Management Metrics) */}
      <section aria-label="Essential Executive KPIs">
        <ExecutiveKpiGrid metrics={metrics} onDrilldown={onDrilldown} />
      </section>

      {/* 2. THE 10-SECOND MANAGEMENT GLANCE BOARD (Compact High-Density Visual Summaries) */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6" aria-label="10-Second Management Signals">
        {/* SIGNAL 1: MRR Waterfall Pulse */}
        <div 
          onClick={onGoToAnalytics}
          className="glass-card rounded-xl p-4.5 hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">
                MRR Momentum
              </span>
              <span className="font-mono text-emerald-700 font-bold text-xs">
                +{formatSAR(mrr.netMovement)} Net
              </span>
            </div>

            <div className="space-y-1.5 font-mono text-xs my-3">
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-sans text-slate-500 text-[11px]">Opening MRR</span>
                <span>{formatSAR(mrr.openingMrr, true)}</span>
              </div>
              <div className="flex justify-between items-center text-emerald-700">
                <span className="font-sans text-[11px] font-medium">+ New & Win-backs</span>
                <span>+{formatSAR(mrr.newMrr + mrr.reactivationMrr, true)}</span>
              </div>
              <div className="flex justify-between items-center text-rose-600">
                <span className="font-sans text-[11px] font-medium">- Churn & Lost</span>
                <span>-{formatSAR(mrr.churnedMrr + mrr.failedPaymentMrr, true)}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center font-bold text-slate-900 text-sm">
                <span className="font-sans">Closing MRR</span>
                <span className="text-emerald-800">{formatSAR(mrr.closingMrr, true)}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[11px] font-semibold text-emerald-700 flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
            <span>Inspect MRR Trends</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* SIGNAL 2: Net Growth Composition */}
        <div 
          onClick={() => onDrilldown('new_members')}
          className="glass-card rounded-xl p-4.5 hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">
                Member Net Flow
              </span>
              <span className="font-bold text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                +{netMemberGrowth.netGrowth} Net
              </span>
            </div>

            <div className="my-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">Acquired:</span>
                <span className="font-mono font-bold text-emerald-700">+{netMemberGrowth.newCount + netMemberGrowth.reactivatedCount} members</span>
              </div>
              {/* Visual Flow Bar */}
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div 
                  className="bg-emerald-600 h-full" 
                  style={{ width: `${Math.round(((netMemberGrowth.newCount + netMemberGrowth.reactivatedCount) / (netMemberGrowth.newCount + netMemberGrowth.reactivatedCount + netMemberGrowth.voluntaryChurnCount + netMemberGrowth.involuntaryChurnCount)) * 100)}%` }} 
                />
                <div 
                  className="bg-rose-500 h-full" 
                  style={{ width: `${Math.round(((netMemberGrowth.voluntaryChurnCount + netMemberGrowth.involuntaryChurnCount) / (netMemberGrowth.newCount + netMemberGrowth.reactivatedCount + netMemberGrowth.voluntaryChurnCount + netMemberGrowth.involuntaryChurnCount)) * 100)}%` }} 
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">Total Churned:</span>
                <span className="font-mono font-bold text-rose-600">-{netMemberGrowth.voluntaryChurnCount + netMemberGrowth.involuntaryChurnCount} members</span>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[11px] font-semibold text-emerald-700 flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
            <span>View Acquisition Log</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* SIGNAL 3: Payment Dunning Health */}
        <div 
          onClick={() => onDrilldown('failed_renewals')}
          className="glass-card rounded-xl p-4.5 hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">
                Renewal Collection
              </span>
              <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                {renewalCollectionRate.ratePct}% Success
              </span>
            </div>

            <div className="my-3 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-600 text-[11px]">
                <span>1st Attempt Success</span>
                <span className="font-mono font-semibold text-emerald-700">{paymentHealth.firstTrySuccess}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 text-[11px]">
                <span>Initially Declined</span>
                <span className="font-mono font-semibold text-amber-700">{paymentHealth.initiallyFailed}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 text-[11px]">
                <span>Saved via Retry</span>
                <span className="font-mono font-semibold text-blue-700">+{paymentHealth.recovered} ({paymentHealth.recoveryRatePct}%)</span>
              </div>
              <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center font-bold text-xs">
                <span className="text-slate-700 text-[11px]">Revenue Saved</span>
                <span className="font-mono text-emerald-700">{formatSAR(paymentHealth.revenueRecovered)}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[11px] font-semibold text-amber-700 flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
            <span>Manage Retry Queue ({paymentHealth.pendingRetries})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* SIGNAL 4: Package Tier Revenue Share */}
        <div 
          onClick={onGoToAnalytics}
          className="glass-card rounded-xl p-4.5 hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">
                Package Mix Share
              </span>
              <span className="text-xs text-slate-400 font-medium">
                4 Active Tiers
              </span>
            </div>

            {/* Quick mini distribution bar */}
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex my-3">
              {packages.map((pkg) => (
                <div 
                  key={pkg.packageId} 
                  style={{ width: `${pkg.mrrSharePct}%` }}
                  className={`h-full ${
                    pkg.packageId === 'fresh' ? 'bg-blue-500' :
                    pkg.packageId === 'shiny' ? 'bg-emerald-500' :
                    pkg.packageId === 'nano' ? 'bg-purple-500' : 'bg-amber-500'
                  }`}
                />
              ))}
            </div>

            <div className="space-y-1 text-[11px]">
              {packages.slice(0, 3).map((pkg) => (
                <div key={pkg.packageId} className="flex justify-between items-center">
                  <span className="font-medium text-slate-700">{pkg.packageName}</span>
                  <span className="font-mono text-slate-500">{pkg.mrrSharePct}% MRR</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 text-[11px] font-semibold text-emerald-700 flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
            <span>View Economics Table</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </section>

      {/* 3. EXECUTIVE QUICK SUMMARY: Sparkline Trend + Movement Snapshot */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6" aria-label="Glance Quick Charts">
        {/* Net Revenue Snapshot Chart */}
        <div className="lg:col-span-8 glass-card rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-display font-bold text-base text-slate-900">
                Revenue Trajectory
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Daily collection velocity vs prior period baseline
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold font-display text-slate-900">
                {formatSAR(netRevenue.current)}
              </div>
              <div className="text-xs font-semibold text-emerald-700">
                +{netRevenue.changePct}% vs comparison
              </div>
            </div>
          </div>

          {/* Sparkline & Bars preview */}
          <div className="h-32 flex items-end gap-1.5 pt-4 pb-1">
            {trendPoints.map((pt, i) => {
              const maxPoint = Math.max(...trendPoints.map(p => p.totalRevenue));
              const heightPct = Math.max((pt.totalRevenue / maxPoint) * 100, 10);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div 
                    className="w-full bg-emerald-600/85 hover:bg-emerald-700 rounded-t-sm transition-all duration-200 cursor-pointer"
                    style={{ height: `${heightPct}%` }}
                    title={`${pt.label}: ${formatSAR(pt.totalRevenue)}`}
                  />
                  {/* Tooltip on bar hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-1 text-[10px] font-mono bg-slate-900 text-white px-2 py-1 rounded whitespace-nowrap z-20 pointer-events-none">
                    {pt.label}: {formatSAR(pt.totalRevenue)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Recurring Base: <strong className="text-slate-800">{formatSAR(mrr.closingMrr)} MRR</strong></span>
            <button
              onClick={onGoToAnalytics}
              className="text-emerald-700 font-bold hover:underline flex items-center gap-1 text-[11px]"
            >
              <span>Explore Multi-series & Granularity in Deep Analytics</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Churn & Retention Snapshot */}
        <div className="lg:col-span-4 glass-card rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-base text-slate-900">
                Retention Health
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                93.4% M1 Retention
              </span>
            </div>

            <div className="space-y-3 my-2 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600">Voluntary Churn</span>
                  <span className="font-bold text-orange-600">{churnRate.voluntaryRatePct}% ({churnRate.voluntaryChurnCount})</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-orange-400 h-full" style={{ width: `${churnRate.voluntaryRatePct * 15}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600">Involuntary Churn (Bank Decline)</span>
                  <span className="font-bold text-rose-600">{churnRate.involuntaryRatePct}% ({churnRate.involuntaryChurnCount})</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-full" style={{ width: `${churnRate.involuntaryRatePct * 15}%` }} />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mt-3 text-[11px]">
                <div className="font-semibold text-slate-700 mb-1">Primary Exit Reason:</div>
                <div className="text-slate-600">Customer Relocation (36%) & Insufficient Funds (48%)</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={() => onDrilldown('voluntary_churn')}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center justify-between w-full"
            >
              <span>Review Exit Logs</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
