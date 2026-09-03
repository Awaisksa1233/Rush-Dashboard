import React from 'react';
import { WashUsageAnalytics } from '../../services/analyticsService';
import { formatSAR } from '../../services/analyticsService';
import { Car, Clock, ShieldAlert, Sparkles, Gauge, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { InfoTooltip } from '../common/Tooltip';

interface WashUsageDashboardProps {
  usage: WashUsageAnalytics;
  onFilterSleepers?: () => void;
}

export const WashUsageDashboard: React.FC<WashUsageDashboardProps> = ({ usage, onFilterSleepers }) => {
  return (
    <div className="space-y-4 font-sans select-none">
      {/* 
        ROW 1: USAGE FREQUENCY TIERS (Sleepers vs Regulars vs Super-users)
      */}
      <div className="glass-card rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-base text-slate-900">
                Subscriber Wash Frequency & Utilization Tiers
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#fde8ea] text-[#c91e2f] border border-[#c91e2f]/20 px-2 py-0.5 rounded-full">
                Active Fleet
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Identifying "Sleeper" churn risks vs profitable regulars vs high-capacity super-users
            </p>
          </div>

          <div className="text-right flex items-center gap-4">
            <div>
              <div className="text-lg font-bold font-display text-slate-900">
                {usage.avgWashesPerMemberMonth} Washes
              </div>
              <div className="text-[10px] text-slate-400">Avg Member Velocity / Mo</div>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <div className="text-lg font-bold font-display text-[#c91e2f]">
                SAR {usage.effectiveCostPerWash}
              </div>
              <div className="text-[10px] text-slate-400">Chemicals/Water COGS</div>
            </div>
          </div>
        </div>

        {/* 4 Usage Tier Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {usage.usageTiers.map((tier, idx) => {
            const isRisk = tier.status === 'risk';
            return (
              <div 
                key={idx}
                className={`p-4 rounded-xl border transition-all ${
                  isRisk 
                    ? 'bg-rose-50/50 border-rose-200' 
                    : 'bg-slate-50/70 border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isRisk ? 'text-rose-900' : 'text-slate-800'}`}>
                    {tier.label}
                  </span>
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                    style={{ backgroundColor: tier.color }} 
                  />
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-2xl font-black font-display text-slate-950">
                    {tier.membersCount}
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-600">
                    {tier.pctOfMembers}% of fleet
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  {tier.description}
                </p>

                {isRisk && onFilterSleepers && (
                  <button
                    onClick={onFilterSleepers}
                    className="mt-3 w-full py-1 text-[11px] font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Trigger Churn Re-engagement</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 
        ROW 2: TUNNEL HOURLY THROUGHPUT + VEHICLE FLEET TYPE
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Tunnel Hourly Cars-Per-Hour (CPH) with Interior Clean Broken Line */}
        <div className="lg:col-span-7 glass-card rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base text-slate-900">
                  Tunnel Throughput & Peak Capacity (Cars / Hr)
                </h3>
                <InfoTooltip text="Tracks physical exterior tunnel capacity (solid bar) alongside interior cleanings (broken/dashed line) to monitor bay vs detailing throughput." />
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                Peak: 18:00 - 21:00 (95% Cap)
              </span>
            </div>
            
            <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
              <p>
                Hourly volume pacing to optimize chemical dosing and staffing shifts
              </p>
              
              {/* Legend for Exterior Solid vs Interior Broken Line */}
              <div className="flex items-center gap-4 text-[11px] shrink-0 font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-2 rounded-xs bg-emerald-600"></span>
                  <span className="text-slate-700">Exterior Tunnel</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-0 border-t-2 border-dashed border-amber-500"></span>
                  <span className="text-amber-800 font-semibold">Interior Clean</span>
                </div>
              </div>
            </div>

            {/* Peak Hours Bars with Broken Line for Interior Clean */}
            <div className="space-y-3.5">
              {usage.peakHours.map((slot, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <div className="w-24 shrink-0 font-medium text-slate-600 font-mono text-[11px]">
                    {slot.hour}
                  </div>
                  
                  {/* Visual Bar Track */}
                  <div className="flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden flex items-center p-0.5 relative">
                    {/* 1. SOLID EXTERIOR WASH BAR */}
                    <div 
                      className={`h-full rounded-md transition-all duration-500 ${
                        slot.capacityPct >= 90 ? 'bg-rose-500' :
                        slot.capacityPct >= 75 ? 'bg-amber-500' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${slot.capacityPct}%` }}
                    />
                    
                    {/* 2. BROKEN / DASHED LINE FOR INTERIOR CLEAN (Different Color: Amber/Gold) */}
                    <div 
                      className="absolute left-1 top-0 bottom-0 flex items-center pointer-events-none"
                      style={{ width: `${Math.round((slot.interiorCarsPerHour / 80) * 100)}%` }}
                    >
                      <div className="w-full border-t-2 border-dashed border-amber-300 shadow-xs h-0"></div>
                      <div className="w-2 h-2 rounded-full bg-amber-400 border border-white shrink-0 -ml-1"></div>
                    </div>

                    {/* Numerical Metric Tag */}
                    <div className="absolute right-2 flex items-center gap-2 font-mono text-[11px]">
                      <span className="font-bold text-slate-800">
                        {slot.carsPerHour} cars/hr ({slot.capacityPct}%)
                      </span>
                      <span className="text-amber-700 font-semibold bg-amber-100/90 border border-amber-300/80 px-1.5 py-0.2 rounded text-[10px]">
                        {slot.interiorCarsPerHour} interior ({slot.interiorPct}%)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Express Tunnel Rated Speed: <strong>80 Cars / Hour</strong></span>
            <span>Avg Wait Time: <strong className="text-emerald-700 font-semibold">4.2 Mins</strong></span>
          </div>
        </div>

        {/* Vehicle Fleet Type Distribution */}
        <div className="lg:col-span-5 glass-card rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display font-bold text-base text-slate-900">
                Registered Vehicle Fleet Mix
              </h3>
              <span className="text-[11px] font-medium text-slate-500">Saudi Market</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              SUV/Truck prevalence directly impacts water and soap consumption
            </p>

            <div className="space-y-3">
              {usage.vehicleTypes.map((v, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-800">{v.type}</span>
                    <span className="font-mono font-bold text-slate-900">{v.count} ({v.pct}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#c91e2f] rounded-full" 
                      style={{ width: `${v.pct}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Saudi Fleet Bias: <strong>52% Full-Size SUV</strong></span>
            <span className="text-slate-600 font-medium">Soap Dosage Adjusted &check;</span>
          </div>
        </div>
      </div>
    </div>
  );
};
