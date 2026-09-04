import React, { useState } from 'react';
import { 
  ExecutiveMetrics, 
  RevenueSeriesPoint, 
  MembershipWaterfallData, 
  PaymentHealthFunnel, 
  PackageEconomicsRow,
  ModalDrilldownType,
  SalesBreakdown,
  ChurnAnalysis
} from '../../types/dashboard';
import { formatSAR } from '../../services/analyticsService';
import { 
  Users, 
  ShoppingBag, 
  DollarSign, 
  Repeat,
  Car,
  Sparkles,
  TrendingUp, 
  TrendingDown, 
  Info, 
  HelpCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Maximize2,
  Layers
} from 'lucide-react';
import { InfoTooltip } from '../common/Tooltip';
import { Sparkline } from '../kpis/MetricCard';
import { RevenueWashTrendsChart } from '../charts/RevenueWashTrendsChart';

interface FlexWashGlanceProps {
  metrics: ExecutiveMetrics;
  trendPoints: RevenueSeriesPoint[];
  salesBreakdown: SalesBreakdown;
  churnAnalysis: ChurnAnalysis;
  paymentHealth: PaymentHealthFunnel;
  packages: PackageEconomicsRow[];
  onDrilldown: (type: ModalDrilldownType) => void;
  onGoToAnalytics: () => void;
}

/**
 * Clean Donut with center badge tailored to the FlexWash visual language
 */
function MiniDonutWithCenterBadge({ 
  centerValue, 
  segments, 
  size = 78 
}: { 
  centerValue: string; 
  segments: { pct: number; color: string }[];
  size?: number;
}) {
  const strokeWidth = 11;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let accumulatedAngle = 0;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {segments.map((seg, idx) => {
          const dashArray = `${(seg.pct / 100) * circumference} ${circumference}`;
          const strokeDashoffset = -accumulatedAngle * (circumference / 100);
          accumulatedAngle += seg.pct;

          return (
            <circle
              key={idx}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          );
        })}
      </svg>
      {/* Center Circle with Value */}
      <div className="absolute inset-0 m-auto w-9 h-9 rounded-full bg-white shadow-2xs border border-slate-100 flex items-center justify-center text-[9px] font-bold font-mono text-slate-800 text-center leading-tight px-0.5">
        {centerValue}
      </div>
    </div>
  );
}

export const FlexWashGlance: React.FC<FlexWashGlanceProps> = ({
  metrics,
  trendPoints,
  salesBreakdown,
  churnAnalysis,
  paymentHealth,
  packages,
  onDrilldown,
  onGoToAnalytics
}) => {
  const { netRevenue, mrr, validMemberships, netMemberGrowth, renewalCollectionRate, churnRate } = metrics;

  // Single Wash sales volume & total orders calculation
  const singleWashOrders = 2420;
  const membershipOrders = salesBreakdown.totalSales;
  const totalOrders = singleWashOrders + membershipOrders;

  // Estimated LTV Calculation: ARPM * 11.6 months average subscriber lifespan
  const arpm = Math.round(mrr.closingMrr / validMemberships.totalValid);
  const avgMembershipLifeMonths = 11.6;
  const estimatedLtv = Math.round(arpm * avgMembershipLifeMonths);

  // Washes metrics
  const memberExteriorWashes = 10262;
  const singleExteriorWashes = 2420;
  const totalExteriorWashes = memberExteriorWashes + singleExteriorWashes;
  const memberWashPct = Math.round((memberExteriorWashes / totalExteriorWashes) * 100);
  const singleWashPct = 100 - memberWashPct;
  const interiorCleaningsCount = 3550;
  const interiorCleaningPct = Math.round((interiorCleaningsCount / totalExteriorWashes) * 100);

  return (
    <div className="space-y-6 sm:space-y-7 lg:space-y-8 font-sans select-none">
      {/* ========================================================================= */}
      {/* HORIZONTAL HERO BANNER: NET REVENUE                                       */}
      {/* ========================================================================= */}
      <div 
        onClick={() => onDrilldown('revenue_breakdown')}
        className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer relative overflow-hidden bg-gradient-to-r from-emerald-50/30 via-white to-white"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* SECTION 1: HERO NUMBER & SPARKLINE */}
          <div className="lg:border-r border-slate-200/80 lg:pr-8 shrink-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-display font-extrabold text-xs uppercase tracking-widest text-emerald-800">
                Net Revenue Hero
              </span>
            </div>

            <div className="text-4xl lg:text-[44px] font-black font-display text-slate-950 tracking-tight leading-none">
              {formatSAR(netRevenue.current)}
            </div>

            <div className="flex items-center gap-3 mt-3">
              <span className="inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
                <TrendingUp className="w-3.5 h-3.5 stroke-[3]" />
                <span>+{netRevenue.changePct}% vs prior</span>
              </span>
              <div className="shrink-0 hidden sm:block">
                <Sparkline data={netRevenue.sparkline} color="#059669" width={100} height={26} />
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Prior: {formatSAR(netRevenue.previousPeriodRevenue, true)}
              </span>
            </div>
          </div>

          {/* SECTION 2: RECURRING RATIO & DONUT */}
          <div className="flex items-center gap-4 lg:border-r border-slate-200/80 lg:pr-8 shrink-0">
            <MiniDonutWithCenterBadge
              size={84}
              centerValue="82%"
              segments={[
                { pct: 82, color: '#10b981' }, // Recurring
                { pct: 18, color: '#38bdf8' }  // Single Washes
              ]}
            />
            <div>
              <div className="text-sm font-bold text-slate-900">82% Recurring Inflow</div>
              <div className="text-xs text-slate-500 mt-0.5">Normalized Monthly MRR</div>
              <div className="text-xs font-mono font-bold text-emerald-700 mt-1">
                {formatSAR(mrr.closingMrr)}
              </div>
            </div>
          </div>

          {/* SECTION 3: THE 4 UNIT PRICE TIERS */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-500 font-medium">Avg Total Wash</div>
              <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">SAR 38.50</div>
              <div className="text-[9px] text-slate-400">All bay visits</div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-500 font-medium">Avg Member Sale</div>
              <div className="font-mono font-bold text-emerald-800 text-sm mt-0.5">SAR 218.00</div>
              <div className="text-[9px] text-slate-400">New join price</div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-500 font-medium">Avg Member Wash</div>
              <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">SAR 46.80</div>
              <div className="text-[9px] text-slate-400">Amortized price</div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-500 font-medium">Avg Single Wash</div>
              <div className="font-mono font-bold text-blue-800 text-sm mt-0.5">SAR 55.00</div>
              <div className="text-[9px] text-slate-400">Retail ticket</div>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 2: The 4 Management Cards: Sales > Memberships > Renewals > Washes    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 sm:gap-6 items-stretch">
        
        {/* 1. SALES */}
        <div 
          onClick={() => onDrilldown('new_members')}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer relative flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-display font-bold text-slate-900 text-base">Sales</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-start justify-between gap-2 mt-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black font-display text-slate-950 tracking-tight">
                    {totalOrders.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Orders
                  </span>
                </div>

                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800 font-mono text-[11px] shrink-0">
                      {singleWashOrders.toLocaleString()}
                    </span>
                    <span className="text-slate-600 text-xs truncate">Single Wash</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 font-mono text-[11px] shrink-0">
                      {salesBreakdown.newCount}
                    </span>
                    <span className="text-slate-600 text-xs truncate">New Member</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 font-mono text-[11px] shrink-0">
                      {salesBreakdown.reactivatedCount}
                    </span>
                    <span className="text-slate-600 text-xs truncate">Win-back</span>
                  </div>
                </div>
              </div>

              <div className="pl-1 pt-1 flex flex-col items-center shrink-0">
                <MiniDonutWithCenterBadge
                  size={76}
                  centerValue="SAR 74"
                  segments={[
                    { pct: 72, color: '#38bdf8' },
                    { pct: 28, color: '#059669' },
                  ]}
                />
                <span className="text-[10px] text-slate-400 font-medium mt-1">Avg Order</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>+{formatSAR(salesBreakdown.revenueAdded, true)} MRR</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-0.5">View &rarr;</span>
          </div>
        </div>

        {/* 2. MEMBERSHIPS */}
        <div 
          onClick={() => onDrilldown('valid_members')}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer relative flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-display font-bold text-slate-900 text-base">Memberships</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-start justify-between gap-2 mt-1">
              <div className="flex-1 min-w-0">
                <div className="text-3xl font-black font-display text-slate-950 tracking-tight">
                  {validMemberships.totalValid.toLocaleString()}
                </div>

                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded font-bold bg-blue-100/80 text-blue-800 border border-blue-200/60 font-mono text-[11px] shrink-0">
                      8.60%
                    </span>
                    <span className="text-slate-600 text-xs truncate">Conv Rate</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono text-[11px] shrink-0">
                      SAR {estimatedLtv.toLocaleString()}
                    </span>
                    <span className="text-slate-700 text-xs font-semibold truncate">LTV</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded font-bold bg-purple-100 text-purple-800 border border-purple-200 font-mono text-[11px] shrink-0">
                      {avgMembershipLifeMonths} Mos
                    </span>
                    <span className="text-slate-700 text-xs font-semibold truncate">Life</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-800 border border-rose-200 font-mono text-[11px] shrink-0">
                      {churnAnalysis.totalChurn} ({churnRate.totalRatePct}%)
                    </span>
                    <span className="text-rose-700 text-xs font-semibold truncate">Total Churn</span>
                  </div>
                </div>
              </div>

              <div className="pl-1 pt-1 flex flex-col items-center shrink-0">
                <MiniDonutWithCenterBadge
                  size={76}
                  centerValue={`SAR ${arpm}`}
                  segments={[
                    { pct: 44, color: '#10b981' },
                    { pct: 28, color: '#3b82f6' },
                    { pct: 23, color: '#8b5cf6' },
                    { pct: 5, color: '#f59e0b' }
                  ]}
                />
                <span className="text-[10px] text-slate-400 font-medium mt-1">ARPM</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>{validMemberships.autoRenewCount.toLocaleString()} Auto</span>
            <span className="text-emerald-700 font-semibold">{validMemberships.cancelledValidUntilExpiry} to Expiry</span>
          </div>
        </div>

        {/* 3. RENEWALS */}
        <div 
          onClick={() => onDrilldown('failed_renewals')}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer relative flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-display font-bold text-slate-900 text-base">Renewals</span>
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <Repeat className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-start justify-between gap-2 mt-1">
              <div className="flex-1 min-w-0">
                <div className="text-3xl font-black font-display text-slate-950 tracking-tight">
                  {paymentHealth.firstTrySuccess + paymentHealth.recovered}
                </div>

                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded font-bold bg-teal-100 text-teal-800 border border-teal-200 font-mono text-[11px] shrink-0">
                      {renewalCollectionRate.ratePct}%
                    </span>
                    <span className="text-slate-600 text-xs truncate">Collection Rate</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono text-[11px] shrink-0">
                      {paymentHealth.firstTrySuccessRate}%
                    </span>
                    <span className="text-slate-600 text-xs truncate">1st Try Pass</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800 border border-blue-200 font-mono text-[11px] shrink-0">
                      +{paymentHealth.recovered}
                    </span>
                    <span className="text-slate-700 text-xs font-semibold truncate">Saved Retry</span>
                  </div>
                </div>
              </div>

              <div className="pl-1 pt-1 flex flex-col items-center shrink-0">
                <MiniDonutWithCenterBadge
                  size={76}
                  centerValue={`${renewalCollectionRate.ratePct}%`}
                  segments={[
                    { pct: paymentHealth.firstTrySuccessRate, color: '#0d9488' },
                    { pct: 8, color: '#3b82f6' },
                    { pct: 10, color: '#ef4444' }
                  ]}
                />
                <span className="text-[10px] text-slate-400 font-medium mt-1">Renewed</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>{paymentHealth.renewalsDue} Due</span>
            <span className="text-amber-700 font-semibold">{paymentHealth.pendingRetries} in Queue &rarr;</span>
          </div>
        </div>

        {/* 4. WASHES (INTERIOR REMOVED FROM MAIN BODY; EXCLUSIVELY IN FOOTER & DONUT) */}
        <div 
          onClick={onGoToAnalytics}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer relative flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-slate-900 text-base">Washes</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-50 text-blue-800 border border-blue-200 rounded">
                  Exterior
                </span>
              </div>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Car className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-start justify-between gap-2 mt-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black font-display text-slate-950 tracking-tight">
                    {totalExteriorWashes.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Total
                  </span>
                </div>

                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 font-mono text-[11px] shrink-0">
                      {memberExteriorWashes.toLocaleString()}
                    </span>
                    <span className="text-slate-600 text-xs truncate">({memberWashPct}%) Membership</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800 font-mono text-[11px] shrink-0">
                      {singleExteriorWashes.toLocaleString()}
                    </span>
                    <span className="text-slate-600 text-xs truncate">({singleWashPct}%) Single Wash</span>
                  </div>
                </div>
              </div>

              <div className="pl-1 pt-1 flex flex-col items-center shrink-0">
                <MiniDonutWithCenterBadge
                  size={76}
                  centerValue={`${interiorCleaningPct}%`}
                  segments={[
                    { pct: memberWashPct, color: '#10b981' },
                    { pct: singleWashPct, color: '#38bdf8' }
                  ]}
                />
                <span className="text-[10px] text-slate-400 font-medium mt-1">Interior Rate</span>
              </div>
            </div>
          </div>

          {/* FOOTER: DEDICATED INTERIOR METRIC */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">
              Interior: <strong className="text-amber-800 font-bold">{interiorCleaningsCount.toLocaleString()}</strong> ({interiorCleaningPct}%)
            </span>
            <span className="text-emerald-700 font-semibold flex items-center gap-0.5">Fleet Usage &rarr;</span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* ROW 3: REVENUE & WASH TRENDS DUAL-WAVE AREA CHART (INTERACTIVE)           */}
      {/* ========================================================================= */}
      <RevenueWashTrendsChart onGoToAnalytics={onGoToAnalytics} />
    </div>
  );
};
