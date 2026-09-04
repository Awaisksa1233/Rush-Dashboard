import React from 'react';
import { PaymentHealthFunnel } from '../../types/dashboard';
import { formatSAR } from '../../services/analyticsService';
import { ShieldCheck, AlertTriangle, RefreshCw, XCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { InfoTooltip } from '../common/Tooltip';

interface PaymentHealthFunnelProps {
  data: PaymentHealthFunnel;
  onViewFailures?: () => void;
}

export const PaymentHealthFunnelComponent: React.FC<PaymentHealthFunnelProps> = ({
  data,
  onViewFailures
}) => {
  const {
    renewalsDue,
    firstTrySuccess,
    firstTrySuccessRate,
    initiallyFailed,
    initiallyFailedRate,
    recovered,
    finalFailed,
    recoveryRatePct,
    revenueRecovered,
    revenueLost,
    pendingRetries
  } = data;

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display font-bold text-base text-slate-900">
              Recurring Payment Health & Recovery
            </h3>
            <InfoTooltip text="Tracks the billing cycle lifecycle: initial charging success, automated card dunning retries, and ultimate recovery rate before involuntary churn occurs." />
          </div>
          <button
            onClick={onViewFailures}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
          >
            <span>Failure Queue ({initiallyFailed})</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Automated Mada/Credit retry recovery efficiency and involuntary churn prevention
        </p>

        {/* Funnel Flow Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-3.5 mb-4">
          {/* Step 1: Due */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[10px] uppercase font-semibold text-slate-400">1. Renewals Due</div>
            <div className="text-lg font-bold font-display text-slate-900 mt-1">{renewalsDue}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">100% Eligible</div>
          </div>

          {/* Step 2: 1st Try Success */}
          <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200/80">
            <div className="text-[10px] uppercase font-semibold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 2. 1st Try Pass
            </div>
            <div className="text-lg font-bold font-display text-emerald-900 mt-1">{firstTrySuccess}</div>
            <div className="text-[11px] text-emerald-700 font-medium mt-0.5">{firstTrySuccessRate}% Success</div>
          </div>

          {/* Step 3: Initially Failed */}
          <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200/80">
            <div className="text-[10px] uppercase font-semibold text-amber-700 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> 3. Init Failed
            </div>
            <div className="text-lg font-bold font-display text-amber-900 mt-1">{initiallyFailed}</div>
            <div className="text-[11px] text-amber-700 font-medium mt-0.5">{initiallyFailedRate}% Needs Retry</div>
          </div>

          {/* Step 4: Recovered */}
          <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200/80">
            <div className="text-[10px] uppercase font-semibold text-blue-700 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> 4. Recovered
            </div>
            <div className="text-lg font-bold font-display text-blue-900 mt-1">{recovered}</div>
            <div className="text-[11px] text-blue-700 font-medium mt-0.5">{recoveryRatePct}% Saved</div>
          </div>

          {/* Step 5: Final Failed */}
          <div className="p-3 bg-rose-50/60 rounded-lg border border-rose-200/80">
            <div className="text-[10px] uppercase font-semibold text-rose-700 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> 5. Final Failure
            </div>
            <div className="text-lg font-bold font-display text-rose-900 mt-1">{finalFailed}</div>
            <div className="text-[11px] text-rose-700 font-medium mt-0.5">Involuntary Churn</div>
          </div>
        </div>

        {/* Financial Recovered vs Lost Summary */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900 text-white rounded-xl">
          <div>
            <div className="text-[11px] text-emerald-300 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Revenue Saved (Recovered)
            </div>
            <div className="text-xl font-bold font-display text-emerald-400 mt-0.5">
              {formatSAR(revenueRecovered)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Saved via 3-step automated billing retry
            </div>
          </div>

          <div className="border-l border-slate-700 pl-3">
            <div className="text-[11px] text-rose-300 font-medium flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> Revenue Lost (Failed Renewals)
            </div>
            <div className="text-xl font-bold font-display text-rose-400 mt-0.5">
              {formatSAR(revenueLost)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Permanent bank decline / unrecoverable
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Active retry sequence window: <strong>7 Days (3 attempts)</strong></span>
        <span>Retry conversion: <strong className="text-blue-700">{recoveryRatePct}%</strong></span>
      </div>
    </div>
  );
};
