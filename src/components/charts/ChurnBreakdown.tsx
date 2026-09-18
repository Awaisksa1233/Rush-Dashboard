import React from 'react';
import { ChurnAnalysis } from '../../types/dashboard';
import { InfoTooltip } from '../common/Tooltip';
import { AlertCircle, UserMinus } from 'lucide-react';

interface ChurnBreakdownProps {
  data: ChurnAnalysis;
  onDrilldown?: () => void;
  onGoToRetention?: () => void;
}

export const ChurnBreakdown: React.FC<ChurnBreakdownProps> = ({ data, onDrilldown, onGoToRetention }) => {
  const { totalChurn, voluntaryChurn, involuntaryChurn, churnRatePct, voluntaryReasons, involuntaryReasons } = data;

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display font-bold text-base text-slate-900">
              Churn Root-Cause Breakdown
            </h3>
            <InfoTooltip text="Separating voluntary cancellations from involuntary payment dropoffs to prevent confusing product issues with bank card failures." />
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            {churnRatePct}% Monthly Churn
          </span>
        </div>

        {/* Top Summary Bar */}
        <div className="flex items-center gap-4 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200/80">
          <div className="flex-1">
            <div className="text-[11px] text-slate-500 font-medium">Voluntary (Intentional)</div>
            <div className="text-lg font-bold font-display text-orange-600 flex items-center justify-between">
              <span>{voluntaryChurn} <span className="text-xs font-normal text-slate-400">({Math.round((voluntaryChurn / totalChurn) * 100 || 58)}%)</span></span>
              {onGoToRetention && (
                <button
                  onClick={onGoToRetention}
                  className="text-[10px] font-bold text-[#c91e2f] bg-[#c91e2f]/10 hover:bg-[#c91e2f]/20 px-2 py-0.5 rounded transition-colors cursor-pointer"
                >
                  Save Flows &rarr;
                </button>
              )}
            </div>
          </div>
          <div className="w-px h-8 bg-slate-200"></div>
          <div className="flex-1">
            <div className="text-[11px] text-slate-500 font-medium">Involuntary (Billing Decline)</div>
            <div className="text-lg font-bold font-display text-rose-600">
              {involuntaryChurn} <span className="text-xs font-normal text-slate-400">({Math.round((involuntaryChurn / totalChurn) * 100 || 42)}%)</span>
            </div>
          </div>
        </div>

        {/* Reasons breakdown: Two columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Voluntary Reasons */}
          <div>
            <div className="font-semibold text-slate-700 mb-2 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span> Voluntary Reasons
            </div>
            <div className="space-y-2">
              {voluntaryReasons.map((r, i) => (
                <div key={i}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-600 truncate max-w-[150px]">{r.reason}</span>
                    <span className="font-mono text-slate-700 font-semibold">{r.count} ({r.pct}%)</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-400 rounded-full" style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Involuntary Reasons */}
          <div>
            <div className="font-semibold text-slate-700 mb-2 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> Involuntary Decline Reasons
            </div>
            <div className="space-y-2">
              {involuntaryReasons.map((r, i) => (
                <div key={i}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-600 truncate max-w-[150px]">{r.reason}</span>
                    <span className="font-mono text-slate-700 font-semibold">{r.count} ({r.pct}%)</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Avg lifespan before churn: <strong className="text-slate-700">{data.averageTenureMonths || 6.0} mo</strong></span>
        <div className="flex items-center gap-3">
          {onGoToRetention && (
            <button 
              onClick={onGoToRetention} 
              className="text-[#c91e2f] font-bold hover:underline cursor-pointer"
            >
              Retention Engine &rarr;
            </button>
          )}
          {onDrilldown && (
            <button 
              onClick={onDrilldown} 
              className="text-slate-600 hover:text-slate-900 font-semibold hover:underline cursor-pointer"
            >
              Review logs &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

