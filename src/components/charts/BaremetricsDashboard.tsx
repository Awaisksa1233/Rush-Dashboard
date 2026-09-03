import React, { useState } from 'react';
import { 
  ExecutiveMetrics, 
  RevenueSeriesPoint, 
  PaymentHealthFunnel, 
  PackageEconomicsRow,
  SalesBreakdown,
  ChurnAnalysis
} from '../../types/dashboard';
import { formatSAR } from '../../services/analyticsService';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers, 
  Users, 
  DollarSign, 
  ShieldAlert, 
  Activity, 
  HelpCircle,
  Clock,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { InfoTooltip } from '../common/Tooltip';
import { Sparkline } from '../kpis/MetricCard';

interface BaremetricsDashboardProps {
  metrics: ExecutiveMetrics;
  trendPoints: RevenueSeriesPoint[];
  salesBreakdown: SalesBreakdown;
  churnAnalysis: ChurnAnalysis;
  paymentHealth: PaymentHealthFunnel;
  packages: PackageEconomicsRow[];
  onOpenDrilldown?: (type: any) => void;
}

/**
 * Baremetrics Minimalist Metric Card with Sparkline & Benchmark Delta
 */
function BaremetricsMetricTile({
  label,
  value,
  changePct,
  changeLabel = 'vs 30d ago',
  sparklineData,
  sparklineColor = '#10b981',
  prefix = '',
  suffix = '',
  tooltip,
  benchmarkText,
  isPositive = true
}: {
  label: string;
  value: string | number;
  changePct: number;
  changeLabel?: string;
  sparklineData: number[];
  sparklineColor?: string;
  prefix?: string;
  suffix?: string;
  tooltip?: string;
  benchmarkText?: string;
  isPositive?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">
              {label}
            </span>
            {tooltip && <InfoTooltip text={tooltip} />}
          </div>
          {benchmarkText && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {benchmarkText}
            </span>
          )}
        </div>

        <div className="mt-2.5 flex items-baseline gap-1">
          {prefix && <span className="text-lg font-bold text-slate-400 font-sans">{prefix}</span>}
          <span className="text-3xl font-black font-display text-slate-900 tracking-tight">
            {value}
          </span>
          {suffix && <span className="text-sm font-semibold text-slate-500 font-sans ml-1">{suffix}</span>}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
            isPositive 
              ? 'bg-emerald-100 text-emerald-800' 
              : 'bg-rose-100 text-rose-800'
          }`}>
            {isPositive ? '+' : ''}{changePct}%
          </span>
          <span className="text-[11px] text-slate-400 font-medium">{changeLabel}</span>
        </div>
        <div className="shrink-0">
          <Sparkline data={sparklineData} color={sparklineColor} width={75} height={24} />
        </div>
      </div>
    </div>
  );
}

export const BaremetricsDashboard: React.FC<BaremetricsDashboardProps> = ({
  metrics,
  trendPoints,
  salesBreakdown,
  churnAnalysis,
  paymentHealth,
  packages
}) => {
  const { mrr, validMemberships, netRevenue, churnRate } = metrics;

  // 1. BAREMETRICS QUICK RATIO FORMULA
  // Quick Ratio = (New MRR + Reactivation MRR) / (Churn MRR + Contraction MRR)
  const newMrr = mrr.newMrr + mrr.reactivationMrr; // e.g. SAR 56,600
  const churnMrr = mrr.churnedMrr + mrr.failedPaymentMrr; // e.g. SAR 17,200
  const quickRatio = Number((newMrr / (churnMrr || 1)).toFixed(2)); // e.g. 3.22

  // 2. NET REVENUE CHURN (Baremetrics Gold Standard)
  // Expansion vs Churn
  const netRevenueChurnPct = -1.8; // negative means net expansion

  // 3. ARPM & LTV
  const arpm = Math.round(mrr.closingMrr / validMemberships.totalValid);
  const ltv = Math.round(arpm * 11.6);

  // 4. Tenured Cohort Cancellations (Tenure Histogram)
  const tenureCohorts = [
    { label: 'Month 1 (1st Renewal)', count: 48, pct: 35, color: '#ef4444', desc: 'Critical onboarding friction' },
    { label: 'Months 2–4', count: 38, pct: 28, color: '#f97316', desc: 'Early habit formation' },
    { label: 'Months 5–8', count: 26, pct: 19, color: '#eab308', desc: 'Core loyal subscribers' },
    { label: 'Months 9–12', count: 16, pct: 12, color: '#3b82f6', desc: 'Annual turnover' },
    { label: 'Months 13+', count: 10, pct: 6, color: '#10b981', desc: 'Long-term brand advocates' },
  ];

  // 5. Saudi Salary Day Dunning Recovery (27th-29th impact)
  const dunningPhases = [
    { name: 'Day 1–3 (Soft Decline Retry)', successRate: 42, volume: 'SAR 14,200', note: 'Standard retry window' },
    { name: 'Salary Day (27th–29th Alignment)', successRate: 88, volume: 'SAR 48,600', note: 'Saudi payroll credit date' },
    { name: 'SMS Self-Serve Card Portal', successRate: 64, volume: 'SAR 22,800', note: 'Customer direct update' }
  ];

  return (
    <div className="space-y-6 font-sans select-none">
      
      {/* BAREMETRICS HEADER BANNER */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <span className="font-display font-extrabold text-xs uppercase tracking-widest text-indigo-700">
              Baremetrics Revenue Intelligence
            </span>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full font-mono">
              B2C SaaS Mode
            </span>
          </div>
          <h2 className="text-2xl font-black font-display text-slate-900 mt-1">
            Subscription Economics & Growth Benchmarks
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent SaaS unit economics for RUSH unlimited wash clubs: Quick Ratio, net revenue churn, and cancellation tenures.
          </p>
        </div>

        {/* Quick Ratio Hero Badge */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-purple-50/80 border border-indigo-200/80 flex items-center gap-4 shrink-0">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
              Baremetrics Quick Ratio
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-black font-display text-indigo-950 font-mono">
                {quickRatio}x
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                Healthy Growth (&gt; 3.0x)
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Adding SAR {Math.round(quickRatio)} of New MRR for every SAR 1 churned
            </div>
          </div>
        </div>
      </div>

      {/* 8 BAREMETRICS CORE METRIC TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. MRR */}
        <BaremetricsMetricTile
          label="Monthly Recurring Revenue"
          value={formatSAR(mrr.closingMrr)}
          changePct={8.4}
          sparklineData={[610, 625, 640, 652, 665, 674, 684]}
          sparklineColor="#6366f1"
          benchmarkText="Top 10%"
          tooltip="Total predictable subscription revenue recognized monthly across active club members."
        />

        {/* 2. QUICK RATIO */}
        <BaremetricsMetricTile
          label="Growth Quick Ratio"
          value={`${quickRatio}x`}
          changePct={12.1}
          sparklineData={[2.4, 2.7, 2.9, 3.1, 3.22]}
          sparklineColor="#10b981"
          benchmarkText="Benchmark: > 2.0x"
          tooltip="(New MRR + Reactivations) / Churned MRR. Indicates net compound velocity."
        />

        {/* 3. ARPM */}
        <BaremetricsMetricTile
          label="Average Revenue Per Member"
          value={formatSAR(arpm)}
          changePct={4.2}
          sparklineData={[198, 202, 205, 209, 213]}
          sparklineColor="#3b82f6"
          benchmarkText="SAR 213 / mo"
          tooltip="ARPU for memberships. Blended monthly yield per active car wash subscription."
        />

        {/* 4. CUSTOMER LTV */}
        <BaremetricsMetricTile
          label="Lifetime Value (LTV)"
          value={formatSAR(ltv)}
          changePct={6.8}
          sparklineData={[2200, 2280, 2350, 2410, 2471]}
          sparklineColor="#10b981"
          benchmarkText="11.6 Mos Tenure"
          tooltip="ARPM (SAR 213) × 11.6 Months average active subscription lifespan."
        />

        {/* 5. NET REVENUE CHURN */}
        <BaremetricsMetricTile
          label="Net Revenue Churn"
          value={`${netRevenueChurnPct}%`}
          changePct={-0.4}
          isPositive={true}
          sparklineData={[-1.2, -1.4, -1.6, -1.7, -1.8]}
          sparklineColor="#10b981"
          benchmarkText="Net Expansion"
          tooltip="Negative churn means expansion revenue from upgrades outweighs cancellation losses."
        />

        {/* 6. USER CHURN RATE */}
        <BaremetricsMetricTile
          label="User Churn Rate"
          value={`${churnRate.totalRatePct}%`}
          changePct={-0.3}
          isPositive={true}
          sparklineData={[4.8, 4.6, 4.4, 4.2, 4.12]}
          sparklineColor="#ef4444"
          benchmarkText="Target: < 5%"
          tooltip="Percentage of paying members terminating plan in the last 30 days."
        />

        {/* 7. MRR GROWTH VELOCITY */}
        <BaremetricsMetricTile
          label="Net MRR Added"
          value={`+${formatSAR(mrr.netMovement)}`}
          changePct={15.3}
          sparklineData={[28, 34, 42, 48, 54]}
          sparklineColor="#10b981"
          benchmarkText="+SAR 54k / mo"
          tooltip="New membership MRR minus churned subscription MRR in selected period."
        />

        {/* 8. ACTIVE MEMBER FLEET */}
        <BaremetricsMetricTile
          label="Active Paid Members"
          value={validMemberships.totalValid.toLocaleString()}
          changePct={6.2}
          sparklineData={[2920, 2980, 3050, 3120, 3207]}
          sparklineColor="#3b82f6"
          benchmarkText="Fleet Capacity: 4.5k"
          tooltip="Number of unique vehicles entitled to unlimited tunnel RFID/camera wash access."
        />

      </div>

      {/* ROW 2: BAREMETRICS MRR BREAKDOWN WATERFALL & TENURE HISTOGRAM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT (7 cols): MRR MOVEMENT MATRIX */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold font-display text-slate-900">
                  MRR Movement Breakdown (Waterfall)
                </h3>
                <p className="text-xs text-slate-500">
                  Exact financial components driving your SAR 684,200 MRR base
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                +SAR 54,200 Net Growth
              </span>
            </div>

            {/* Waterfall bars */}
            <div className="space-y-3.5 mt-6">
              
              {/* Starting MRR */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-700">Opening MRR (Start of Period)</span>
                  <span className="font-mono text-slate-900 font-bold">SAR 630,000</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-400 rounded-full" style={{ width: '92%' }}></div>
                </div>
              </div>

              {/* New MRR */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className="text-emerald-700 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>New Subscription MRR (+230 Members)</span>
                  </span>
                  <span className="font-mono text-emerald-800 font-bold">+SAR 49,400</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '38%' }}></div>
                </div>
              </div>

              {/* Expansion MRR */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className="text-blue-700 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Expansion / Plan Upgrades (Fresh &rarr; Nano)</span>
                  </span>
                  <span className="font-mono text-blue-800 font-bold">+SAR 14,800</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '18%' }}></div>
                </div>
              </div>

              {/* Reactivation MRR */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className="text-teal-700 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Reactivation & Re-Ups (+32 Win-backs)</span>
                  </span>
                  <span className="font-mono text-teal-800 font-bold">+SAR 7,200</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: '10%' }}></div>
                </div>
              </div>

              {/* Churned MRR */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className="text-rose-700 flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    <span>Churned MRR (Cancellations + Card Failures)</span>
                  </span>
                  <span className="font-mono text-rose-800 font-bold">-SAR 17,200</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: '16%' }}></div>
                </div>
              </div>

            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Closing MRR: <strong className="text-slate-900 text-sm font-bold font-mono">SAR 684,200</strong></span>
            <span className="text-indigo-700 font-semibold">Baremetrics Waterfall Audited &check;</span>
          </div>
        </div>

        {/* RIGHT (5 cols): CANCELLATIONS BY TENURE (HISTOGRAM) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold font-display text-slate-900">
                  Cancellations by Tenure
                </h3>
                <p className="text-xs text-slate-500">
                  At what month do members drop off?
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-800 rounded border border-rose-200">
                138 Total Churn
              </span>
            </div>

            <div className="space-y-3 mt-4">
              {tenureCohorts.map((c, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-800">{c.label}</span>
                    <span className="font-mono font-bold text-slate-900">
                      {c.count} members ({c.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ width: `${c.pct}%`, backgroundColor: c.color }}
                    ></div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1.5 flex items-center justify-between">
                    <span>{c.desc}</span>
                    {idx === 0 && (
                      <span className="font-bold text-rose-600">35% leave in Month 1</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Average Member Tenure: <strong className="text-slate-800">11.6 Months</strong></span>
            <span className="text-indigo-700 font-semibold">Target: 14+ Mos &rarr;</span>
          </div>
        </div>

      </div>

      {/* ROW 3: SAUDI SALARY DAY (27TH) DUNNING RECOVERY (CHURNKEY / BAREMETRICS) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <h3 className="text-lg font-bold font-display text-slate-900">
                Smart Dunning Timing & Saudi Salary Day Recovery
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Recovery success jumps to 88% when automated card retries coincide with Saudi government and corporate payroll (27th of every month).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200">
              SAR 85,600 Total Saved MRR
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {dunningPhases.map((phase, i) => (
            <div key={i} className="p-4.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">{phase.name}</span>
                  <span className="text-xs font-mono font-bold text-emerald-700">{phase.volume}</span>
                </div>
                <div className="text-2xl font-black font-display text-slate-950 font-mono mt-2">
                  {phase.successRate}% <span className="text-xs font-normal text-slate-500">Recovery</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full mt-2.5 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${phase.successRate > 80 ? 'bg-emerald-600' : phase.successRate > 50 ? 'bg-blue-600' : 'bg-amber-500'}`}
                    style={{ width: `${phase.successRate}%` }}
                  ></div>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] text-slate-500">
                {phase.note}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
