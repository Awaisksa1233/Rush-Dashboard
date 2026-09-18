import React from 'react';
import { MembershipWaterfallData } from '../../types/dashboard';
import { ArrowRight, Plus, Minus, UserCheck, HelpCircle } from 'lucide-react';
import { InfoTooltip } from '../common/Tooltip';

interface MembershipMovementProps {
  data: MembershipWaterfallData;
}

export const MembershipMovement: React.FC<MembershipMovementProps> = ({ data }) => {
  const { opening, newMembers, reactivated, voluntaryChurn, involuntaryChurn, closing } = data;
  const netGrowth = closing - opening;
  const maxBarVal = Math.max(opening, closing, newMembers * 5) * 1.05;

  const items = [
    { label: 'Opening', val: opening, type: 'base', change: null, color: 'bg-slate-700', text: 'text-slate-700' },
    { label: 'New', val: newMembers, type: 'add', change: `+${newMembers}`, color: 'bg-emerald-600', text: 'text-emerald-700' },
    { label: 'Reactivated', val: reactivated, type: 'add', change: `+${reactivated}`, color: 'bg-emerald-500', text: 'text-emerald-700' },
    { label: 'Voluntary', val: voluntaryChurn, type: 'sub', change: `-${voluntaryChurn}`, color: 'bg-orange-500', text: 'text-orange-700' },
    { label: 'Failed Pay', val: involuntaryChurn, type: 'sub', change: `-${involuntaryChurn}`, color: 'bg-rose-600', text: 'text-rose-700' },
    { label: 'Closing', val: closing, type: 'total', change: netGrowth >= 0 ? `+${netGrowth}` : `${netGrowth}`, color: 'bg-emerald-800', text: 'text-emerald-900' }
  ];

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="font-display font-bold text-base text-slate-900">
              Membership Movement
            </h3>
            <InfoTooltip text="Membership waterfall making it immediately obvious why subscriptions expanded or contracted between period start and period close." />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Net balance movement: <span className={`font-semibold ${netGrowth >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{netGrowth >= 0 ? `+${netGrowth}` : netGrowth} members</span>
          </p>
        </div>

        <div className="text-right">
          <div className="text-xl font-bold font-display text-slate-900">
            {closing.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Active at Period Close
          </div>
        </div>
      </div>

      {/* Movement Structured Bars */}
      <div className="space-y-2.5 my-2">
        {items.map((item, idx) => {
          const isAdd = item.type === 'add';
          const isSub = item.type === 'sub';
          const isTotal = item.type === 'total';
          const isBase = item.type === 'base';

          const pctWidth = Math.max((item.val / maxBarVal) * 100, 4);

          return (
            <div key={idx} className="flex items-center gap-3 text-xs">
              {/* Step label */}
              <div className="w-24 shrink-0 font-medium text-slate-600 flex items-center gap-1">
                {isAdd && <Plus className="w-3 h-3 text-emerald-600 shrink-0" />}
                {isSub && <Minus className="w-3 h-3 text-rose-600 shrink-0" />}
                {isTotal && <UserCheck className="w-3.5 h-3.5 text-emerald-800 shrink-0" />}
                <span className={isTotal ? 'font-bold text-slate-900' : ''}>{item.label}</span>
              </div>

              {/* Progress bar container */}
              <div className="flex-1 bg-slate-100 h-6 rounded-md overflow-hidden flex items-center p-0.5 relative">
                <div 
                  className={`h-full rounded-sm transition-all duration-500 ${item.color} ${isTotal ? 'opacity-90' : ''}`}
                  style={{ width: `${pctWidth}%` }}
                />
                <span className="absolute right-2 font-mono font-semibold text-[11px] text-slate-700">
                  {item.val.toLocaleString()}
                </span>
              </div>

              {/* Movement indicator */}
              <div className={`w-14 text-right font-mono font-bold text-xs ${item.text}`}>
                {item.change || '—'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary note */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Acquisition: <strong className="text-emerald-700 font-semibold">+{newMembers + reactivated}</strong></span>
        <span>Churn Losses: <strong className="text-rose-600 font-semibold">-{voluntaryChurn + involuntaryChurn}</strong></span>
        <span>Retention Efficiency: <strong className="text-slate-800 font-semibold">{opening > 0 ? ((1 - (voluntaryChurn + involuntaryChurn) / opening) * 100).toFixed(1) : '100.0'}%</strong></span>
      </div>
    </div>
  );
};
