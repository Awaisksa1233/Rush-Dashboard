import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatSAR } from '../../services/analyticsService';
import { ModalDrilldownType } from '../../types/dashboard';

export interface NetRevenueHeroProps {
  currentRevenue?: number;
  priorRevenue?: number;
  changePct?: number;
  recurringInflowPct?: number;
  monthlyMrr?: number;
  avgTotalWash?: number;
  avgMemberSale?: number;
  avgMemberWash?: number;
  avgSingleWash?: number;
  onDrilldown?: (type: ModalDrilldownType) => void;
}

export const NetRevenueHero: React.FC<NetRevenueHeroProps> = ({
  currentRevenue = 467342,
  priorRevenue = 350464,
  changePct = 33.3,
  recurringInflowPct = 95,
  monthlyMrr = 250367,
  avgTotalWash = 34.44,
  avgMemberSale = 210.54,
  avgMemberWash = 32.65,
  avgSingleWash = 66.96,
  onDrilldown
}) => {
  const size = 76;
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  const greenPct = recurringInflowPct;
  const cyanPct = Math.max(0, 100 - greenPct);
  const greenDash = (greenPct / 100) * circumference;
  const cyanDash = (cyanPct / 100) * circumference;
  const greenOffset = 0;
  const cyanOffset = -greenDash;

  return (
    <div 
      onClick={() => onDrilldown && onDrilldown('revenue_breakdown')}
      className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer select-none"
    >
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 xl:gap-8">
        
        {/* ================================================================= */}
        {/* 1. LEFT SECTION: NET REVENUE HERO + BADGE + SPARKLINE + PRIOR    */}
        {/* ================================================================= */}
        <div className="shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="font-display font-extrabold text-xs uppercase tracking-wider text-emerald-800">
              NET REVENUE HERO
            </span>
          </div>

          <div className="text-3xl sm:text-4xl lg:text-[42px] font-black font-display text-slate-950 tracking-tight leading-none my-1.5">
            {formatSAR(currentRevenue)}
          </div>

          <div className="flex items-center gap-2.5 mt-2 flex-wrap">
            {/* Growth Pill Badge */}
            <span className="inline-flex items-center gap-1 font-bold text-xs px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
              {changePct >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 stroke-[2.5] text-emerald-700" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 stroke-[2.5] text-rose-600" />
              )}
              <span>{changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}% vs prior</span>
            </span>

            {/* Smooth Green Sparkline Wave */}
            <svg className="w-14 h-4 text-emerald-600 shrink-0" viewBox="0 0 56 16" fill="none">
              <path 
                d="M 2 11 Q 12 15, 22 8 T 42 6 T 54 3" 
                stroke="#059669" 
                strokeWidth="2.2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>

            {/* Prior Period Text */}
            <span className="text-xs text-slate-400 font-medium">
              Prior: {formatSAR(priorRevenue, true)}
            </span>
          </div>
        </div>

        {/* Divider 1 */}
        <div className="hidden xl:block w-px h-16 bg-slate-200/80 shrink-0" />

        {/* ================================================================= */}
        {/* 2. MIDDLE SECTION: 82% RECURRING INFLOW DONUT & MONTHLY MRR      */}
        {/* ================================================================= */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Dual-Color Donut with Center Badge */}
          <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
              {/* Green Segment */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="#10b981"
                strokeWidth={strokeWidth}
                strokeDasharray={`${greenDash} ${circumference}`}
                strokeDashoffset={greenOffset}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
              {/* Cyan Segment */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="#38bdf8"
                strokeWidth={strokeWidth}
                strokeDasharray={`${cyanDash} ${circumference}`}
                strokeDashoffset={cyanOffset}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </svg>
            {/* Center Percentage */}
            <div className="absolute inset-0 m-auto flex items-center justify-center text-xs font-bold font-mono text-slate-800">
              {recurringInflowPct}%
            </div>
          </div>

          <div>
            <div className="text-sm font-extrabold text-slate-900 leading-tight">
              {recurringInflowPct}% Recurring Inflow
            </div>
            <div className="text-xs text-slate-500 mt-0.5 leading-tight font-medium">
              Normalized Monthly MRR
            </div>
            <div className="text-sm font-mono font-bold text-emerald-700 mt-1 leading-tight">
              {formatSAR(monthlyMrr)}
            </div>
          </div>
        </div>

        {/* Divider 2 */}
        <div className="hidden xl:block w-px h-16 bg-slate-200/80 shrink-0" />

        {/* ================================================================= */}
        {/* 3. RIGHT SECTION: 4 COMPACT AVERAGE METRIC TILES                  */}
        {/* ================================================================= */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-3.5 min-w-[280px]">
          
          {/* Tile 1: Avg Total Wash */}
          <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100 flex flex-col justify-between">
            <div className="text-[11px] font-medium text-slate-500 leading-tight">
              Avg Total Wash
            </div>
            <div className="font-mono font-bold text-slate-950 text-sm sm:text-[15px] mt-1">
              SAR {avgTotalWash.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
              All bay visits
            </div>
          </div>

          {/* Tile 2: Avg Member Sale */}
          <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100 flex flex-col justify-between">
            <div className="text-[11px] font-medium text-slate-500 leading-tight">
              Avg Member Sale
            </div>
            <div className="font-mono font-bold text-emerald-700 text-sm sm:text-[15px] mt-1">
              SAR {avgMemberSale.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
              New join price
            </div>
          </div>

          {/* Tile 3: Avg Member Wash */}
          <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100 flex flex-col justify-between">
            <div className="text-[11px] font-medium text-slate-500 leading-tight">
              Avg Member Wash
            </div>
            <div className="font-mono font-bold text-slate-950 text-sm sm:text-[15px] mt-1">
              SAR {avgMemberWash.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
              Amortized price
            </div>
          </div>

          {/* Tile 4: Avg Single Wash */}
          <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100 flex flex-col justify-between">
            <div className="text-[11px] font-medium text-slate-500 leading-tight">
              Avg Single Wash
            </div>
            <div className="font-mono font-bold text-blue-600 text-sm sm:text-[15px] mt-1">
              SAR {avgSingleWash.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
              Retail ticket
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
