import React from 'react';
import { MetricCard } from './MetricCard';
import { ExecutiveMetrics, ModalDrilldownType } from '../../types/dashboard';
import { formatSAR } from '../../services/analyticsService';
import { 
  Users, 
  CreditCard, 
  TrendingUp, 
  AlertOctagon, 
  Repeat, 
  Sparkles,
  UserCheck,
  UserX,
  PlusCircle,
  RotateCcw
} from 'lucide-react';

interface ExecutiveKpiGridProps {
  metrics: ExecutiveMetrics;
  onDrilldown: (type: ModalDrilldownType) => void;
}

export const ExecutiveKpiGrid: React.FC<ExecutiveKpiGridProps> = ({
  metrics,
  onDrilldown
}) => {
  const { netRevenue, mrr, validMemberships, netMemberGrowth, renewalCollectionRate, churnRate } = metrics;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {/* CARD 1 — NET REVENUE */}
      <MetricCard
        title="Net Revenue"
        value={formatSAR(netRevenue.current)}
        changePct={netRevenue.changePct}
        changeLabel={`vs ${formatSAR(netRevenue.previous, true)}`}
        isPositive={true}
        sparklineData={netRevenue.sparkline}
        sparklineColor="#10b981"
        tooltipText="Revenue actually collected during the selected period, net of refunds where applicable."
        onClick={() => onDrilldown('revenue_breakdown')}
        clickableHint="View breakdown"
        highlightBorder={true}
      >
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Prev Period:</span>
          <span className="font-semibold text-slate-700">{formatSAR(netRevenue.previousPeriodRevenue)}</span>
        </div>
      </MetricCard>

      {/* CARD 2 — RECURRING REVENUE / MRR */}
      <MetricCard
        title="Recurring MRR"
        value={formatSAR(mrr.closingMrr)}
        changePct={mrr.changePct}
        changeLabel="MRR Growth"
        isPositive={true}
        tooltipText="Normalized monthly recurring value of currently active recurring subscriptions."
        onClick={() => onDrilldown('revenue_breakdown')}
        clickableHint="Waterfall view"
      >
        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between items-center text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> New & Win-back
            </span>
            <span className="font-medium text-emerald-700">+{formatSAR(mrr.newMrr + mrr.reactivationMrr, true)}</span>
          </div>
          <div className="flex justify-between items-center text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Churned & Failed
            </span>
            <span className="font-medium text-rose-700">-{formatSAR(mrr.churnedMrr + mrr.failedPaymentMrr, true)}</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-100 font-semibold text-slate-700">
            <span>Net MRR Movement:</span>
            <span className={mrr.netMovement >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
              {mrr.netMovement >= 0 ? '+' : ''}{formatSAR(mrr.netMovement)}
            </span>
          </div>
        </div>
      </MetricCard>

      {/* CARD 3 — VALID MEMBERSHIPS */}
      <MetricCard
        title="Valid Members"
        value={validMemberships.totalValid.toLocaleString()}
        changePct={validMemberships.changePct}
        changeLabel={`+${validMemberships.changeVsStart} vs start`}
        isPositive={true}
        tooltipText="Valid memberships are subscriptions entitled to use the service as of the selected snapshot date, regardless of whether payment occurred earlier."
        onClick={() => onDrilldown('valid_members')}
        clickableHint="View members"
      >
        <div className="space-y-1 text-[11px] text-slate-500">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Auto-Renew
            </span>
            <span className="font-semibold text-slate-700">{validMemberships.autoRenewCount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Active to Expiry
            </span>
            <span className="font-semibold text-amber-700">{validMemberships.cancelledValidUntilExpiry.toLocaleString()}</span>
          </div>
        </div>
      </MetricCard>

      {/* CARD 4 — NET MEMBER GROWTH */}
      <MetricCard
        title="Net Member Growth"
        value={
          <span className={netMemberGrowth.netGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
            {netMemberGrowth.netGrowth >= 0 ? `+${netMemberGrowth.netGrowth}` : netMemberGrowth.netGrowth}
          </span>
        }
        tooltipText="Formula: New memberships + Reactivations - Voluntary churn - Involuntary churn = Net member growth."
        onClick={() => onDrilldown('new_members')}
        clickableHint="Sales report"
      >
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-500">
          <div className="flex justify-between">
            <span className="text-slate-400">New:</span>
            <span className="font-semibold text-emerald-700">+{netMemberGrowth.newCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Reactivated:</span>
            <span className="font-semibold text-emerald-700">+{netMemberGrowth.reactivatedCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Voluntary:</span>
            <span className="font-semibold text-rose-600">-{netMemberGrowth.voluntaryChurnCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Failed Pay:</span>
            <span className="font-semibold text-rose-600">-{netMemberGrowth.involuntaryChurnCount}</span>
          </div>
        </div>
      </MetricCard>

      {/* CARD 5 — RENEWAL COLLECTION RATE */}
      <MetricCard
        title="Renewal Rate"
        value={`${renewalCollectionRate.ratePct}%`}
        changePct={renewalCollectionRate.changePct}
        changeLabel="vs target 95%"
        isPositive={renewalCollectionRate.ratePct >= 94.0}
        tooltipText="Successful renewal payments / eligible renewal attempts. Recurring payment failures are the primary driver of involuntary churn."
        onClick={() => onDrilldown('failed_renewals')}
        clickableHint="Failures & retries"
      >
        <div className="space-y-1 text-[11px] text-slate-500">
          <div className="flex justify-between">
            <span>Successful:</span>
            <span className="font-semibold text-emerald-700">{renewalCollectionRate.successfulPayments}</span>
          </div>
          <div className="flex justify-between">
            <span>Initially Failed:</span>
            <span className="font-semibold text-rose-600">{renewalCollectionRate.failedPayments + renewalCollectionRate.recoveredPayments}</span>
          </div>
          <div className="flex justify-between">
            <span>Recovered Retries:</span>
            <span className="font-semibold text-amber-600">{renewalCollectionRate.recoveredPayments}</span>
          </div>
        </div>
      </MetricCard>

      {/* CARD 6 — MEMBERSHIP CHURN */}
      <MetricCard
        title="Membership Churn"
        value={`${churnRate.totalRatePct}%`}
        changePct={churnRate.changePct}
        changeLabel="Total Churn Rate"
        isPositive={false} // Churn going up is negative
        tooltipText="Separated into Voluntary Churn (customer cancelled) and Involuntary Churn (payment failures after retries). Churned members / eligible members."
        onClick={() => onDrilldown('voluntary_churn')}
        clickableHint="Churn analysis"
      >
        <div className="space-y-1 text-[11px] text-slate-500">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span> Voluntary
            </span>
            <span className="font-semibold text-slate-700">{churnRate.voluntaryRatePct}% ({churnRate.voluntaryChurnCount})</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Involuntary
            </span>
            <span className="font-semibold text-slate-700">{churnRate.involuntaryRatePct}% ({churnRate.involuntaryChurnCount})</span>
          </div>
        </div>
      </MetricCard>
    </div>
  );
};
