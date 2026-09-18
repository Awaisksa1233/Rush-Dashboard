import React from 'react';
import { CohortRetentionRow, ManagementValueMetrics } from '../../types/dashboard';
import { formatSAR } from '../../services/analyticsService';
import { InfoTooltip } from '../common/Tooltip';
import { Sparkles, Calendar, Layers, ShieldCheck, Award, Database } from 'lucide-react';

interface RetentionAndValueProps {
  cohorts: CohortRetentionRow[];
  managementValues: ManagementValueMetrics;
}

export const RetentionAndValue: React.FC<RetentionAndValueProps> = ({ cohorts, managementValues }) => {
  if (!cohorts || cohorts.length === 0) {
    return (
      <div className="glass-card rounded-xl p-5 border border-slate-200/90 shadow-2xs">
        <div className="text-center py-12 text-slate-400">
          <Database className="w-8 h-8 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium">No cohort retention data available from database</p>
          <p className="text-xs mt-1">Data will appear here when available in the database</p>
        </div>
      </div>
    );
  }

  const { arpm, arpmChangePct, avgMembershipPrice, avgWashesPerMember, revenuePerWash, totalWashesInPeriod, estimatedLtv } = managementValues || {};

  // Function to color cohort cell based on retention health
  const getCohortColor = (rate: number) => {
    if (rate === 0) return 'bg-slate-50 text-slate-300';
    if (rate >= 90) return 'bg-emerald-100 text-emerald-900 font-bold';
    if (rate >= 80) return 'bg-emerald-50 text-emerald-800 font-semibold';
    if (rate >= 70) return 'bg-blue-50 text-blue-800 font-medium';
    if (rate >= 60) return 'bg-amber-50 text-amber-800 font-medium';
    return 'bg-rose-50 text-rose-800 font-semibold';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* LEFT: COHORT RETENTION HEATMAP (7 COLS) */}
      <div className="glass-card rounded-xl p-5 lg:col-span-7 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <h3 className="font-display font-bold text-base text-slate-900">
                Membership Cohort Retention
              </h3>
              <InfoTooltip text="Tracks customer survival rates over 1, 2, 3, and 6 months. High Month 1 survival is vital to prove customers survived their first auto-renewal." />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              M1 Survival: 93.4%
            </span>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            Percentage of original cohort members remaining active through successive billing cycles
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2.5 font-semibold">Cohort</th>
                  <th className="pb-2.5 px-2 text-right font-semibold">Joined</th>
                  <th className="pb-2.5 px-2 text-center font-semibold">Month 1 (1st Renewal)</th>
                  <th className="pb-2.5 px-2 text-center font-semibold">Month 2</th>
                  <th className="pb-2.5 px-2 text-center font-semibold">Month 3</th>
                  <th className="pb-2.5 pl-2 text-center font-semibold">Month 6</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {cohorts.map((row) => (
                  <tr key={row.cohortMonth} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 font-sans font-medium text-slate-800">
                      {row.cohortMonth}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-600">
                      {row.joinedMembers}
                    </td>
                    <td className="py-2 px-1 text-center">
                      <span className={`px-2 py-1 rounded text-xs inline-block min-w-[54px] ${getCohortColor(row.month1Rate)}`}>
                        {row.month1Rate > 0 ? `${row.month1Rate}%` : '—'}
                      </span>
                    </td>
                    <td className="py-2 px-1 text-center">
                      <span className={`px-2 py-1 rounded text-xs inline-block min-w-[54px] ${getCohortColor(row.month2Rate)}`}>
                        {row.month2Rate > 0 ? `${row.month2Rate}%` : '—'}
                      </span>
                    </td>
                    <td className="py-2 px-1 text-center">
                      <span className={`px-2 py-1 rounded text-xs inline-block min-w-[54px] ${getCohortColor(row.month3Rate)}`}>
                        {row.month3Rate > 0 ? `${row.month3Rate}%` : '—'}
                      </span>
                    </td>
                    <td className="py-2 pl-1 text-center">
                      <span className={`px-2 py-1 rounded text-xs inline-block min-w-[54px] ${getCohortColor(row.month6Rate)}`}>
                        {row.month6Rate > 0 ? `${row.month6Rate}%` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex justify-between">
          <span>First-renewal hurdle rate improved +3.8% vs Q1</span>
          <span>Target M1 Retention: &gt;90%</span>
        </div>
      </div>

      {/* RIGHT: MEMBERSHIP UNIT ECONOMICS & VALUE (5 COLS) */}
      <div className="glass-card rounded-xl p-5 lg:col-span-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <h3 className="font-display font-bold text-base text-slate-900">
                Membership Value & Efficiency
              </h3>
              <InfoTooltip text="Key unit economics measuring member lifetime value, revenue realized per wash, and overall fleet usage intensity." />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              Executive
            </span>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            Yield management and wash capacity economics
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* ARPM */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                ARPM (Monthly)
              </div>
              <div className="text-xl font-bold font-display text-slate-900 mt-1">
                {formatSAR(arpm)}
              </div>
              <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                +{arpmChangePct}% vs last quarter
              </div>
            </div>

            {/* Avg Selling Price */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Avg Plan Price
              </div>
              <div className="text-xl font-bold font-display text-slate-900 mt-1">
                {formatSAR(avgMembershipPrice)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Weighted by tier mix
              </div>
            </div>

            {/* Revenue per wash */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Revenue / Wash
              </div>
              <div className="text-xl font-bold font-display text-slate-900 mt-1">
                {formatSAR(revenuePerWash)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Gross rev / {totalWashesInPeriod.toLocaleString()} washes
              </div>
            </div>

            {/* Estimated LTV */}
            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/80">
              <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
                Estimated LTV
              </div>
              <div className="text-xl font-bold font-display text-emerald-900 mt-1">
                {formatSAR(estimatedLtv || (arpm ? Math.round(arpm * 6.0) : 0))}
              </div>
              <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                Based on 6.0 mo avg tenure
              </div>
            </div>
          </div>
        </div>

        {/* Bottom wash utilization statement */}
        <div className="mt-4 p-3 bg-slate-900 text-white rounded-xl text-xs flex items-center justify-between">
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-semibold">Total Wash Events Recorded</div>
            <div className="font-bold text-base font-display text-emerald-400">
              {totalWashesInPeriod.toLocaleString()} Washes
            </div>
          </div>
          <div className="text-right">
            <div className="text-slate-400 text-[10px]">Avg Member Wash Velocity</div>
            <div className="font-semibold text-slate-200">
              {avgWashesPerMember} washes / month
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
