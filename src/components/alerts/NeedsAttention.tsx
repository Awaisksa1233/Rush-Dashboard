import React from 'react';
import { AttentionAlert, ModalDrilldownType } from '../../types/dashboard';
import { AlertTriangle, AlertOctagon, Info, CheckCircle, ArrowRight, ShieldAlert } from 'lucide-react';

interface NeedsAttentionProps {
  alerts: AttentionAlert[];
  onActionClick: (alert: AttentionAlert) => void;
}

export const NeedsAttention: React.FC<NeedsAttentionProps> = ({ alerts, onActionClick }) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="glass-card rounded-xl p-4 border-l-4 border-l-amber-500 bg-linear-to-r from-amber-50/40 via-white to-white">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Action Required — Measurable Anomalies ({alerts.length})
              </h4>
              <span className="text-[10px] bg-amber-200/70 text-amber-900 font-semibold px-2 py-0.5 rounded-full">
                Live Trigger
              </span>
            </div>

            {/* Dynamic Alert Items */}
            <div className="mt-1.5 space-y-1">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex flex-wrap items-center gap-x-2 text-xs">
                  <span className="font-semibold text-slate-800">{alert.title}:</span>
                  <span className="text-slate-600">{alert.description}</span>
                  {alert.actionText && (
                    <button
                      onClick={() => onActionClick(alert)}
                      className="text-emerald-700 font-bold hover:text-emerald-800 inline-flex items-center gap-0.5 underline text-[11px]"
                    >
                      <span>{alert.actionText}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
