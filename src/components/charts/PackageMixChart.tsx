import React from 'react';
import { SalesBreakdown } from '../../types/dashboard';
import { formatSAR } from '../../services/analyticsService';
import { Sparkles, ArrowUpRight, ShoppingBag } from 'lucide-react';
import { InfoTooltip } from '../common/Tooltip';

interface MembershipSalesProps {
  data: SalesBreakdown;
  onPackageClick?: (pkgId: string) => void;
  onViewTeam?: () => void;
}

export const MembershipSales: React.FC<MembershipSalesProps> = ({ data, onPackageClick, onViewTeam }) => {
  const { totalSales, revenueAdded, averageSellingPrice, newCount, reactivatedCount, upgradeCount, packageDistribution } = data;

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display font-bold text-base text-slate-900">
              Membership Sales & Mix
            </h3>
            <InfoTooltip text="Gross sales velocity, recurring ARR/MRR added, and plan tier conversion breakdown." />
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            +{formatSAR(revenueAdded)} MRR Added
          </span>
        </div>

        {/* Large Sales Metric & Sub-stats */}
        <div className="flex items-baseline gap-4 mt-1 mb-4">
          <div className="text-3xl font-extrabold font-display text-slate-900">
            {totalSales}
          </div>
          <div className="text-xs text-slate-500">
            Total Sales Units (Avg Price: <strong className="text-slate-800 font-semibold">{formatSAR(averageSellingPrice)}</strong>)
          </div>
        </div>

        {/* Sub-breakdown pills */}
        <div className="grid grid-cols-3 gap-2 text-xs mb-5">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <div className="text-slate-400 text-[11px]">New Members</div>
            <div className="text-sm font-bold text-slate-800 mt-0.5">+{newCount}</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <div className="text-slate-400 text-[11px]">Win-backs</div>
            <div className="text-sm font-bold text-emerald-700 mt-0.5">+{reactivatedCount}</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <div className="text-slate-400 text-[11px]">Upgrades</div>
            <div className="text-sm font-bold text-blue-700 mt-0.5">+{upgradeCount}</div>
          </div>
        </div>

        {/* Package Mix Visual Bars */}
        <div className="mb-2">
          <div className="text-xs font-semibold text-slate-600 mb-2 flex justify-between">
            <span>Sales by Package Tier</span>
            <span className="text-[11px] text-slate-400">Share %</span>
          </div>

          {/* Continuous multi-segment bar */}
          <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex mb-3">
            {packageDistribution.map((pkg) => (
              <div 
                key={pkg.packageId}
                style={{ width: `${pkg.pct}%`, backgroundColor: pkg.color }}
                className="h-full transition-all duration-300 hover:opacity-85"
                title={`${pkg.name}: ${pkg.count} sales (${pkg.pct}%)`}
              />
            ))}
          </div>

          {/* Package items list */}
          <div className="space-y-2">
            {packageDistribution.map((pkg) => (
              <div 
                key={pkg.packageId}
                onClick={() => onPackageClick && onPackageClick(pkg.packageId)}
                className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                    style={{ backgroundColor: pkg.color }} 
                  />
                  <span className="font-medium text-slate-700">{pkg.name}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="text-slate-500">{pkg.count} units</span>
                  <span className="font-semibold text-slate-800">{formatSAR(pkg.revenue)}</span>
                  <span className="text-slate-400 w-8 text-right">{pkg.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Channel: 100% Lane & App Subscriptions</span>
        {onViewTeam ? (
          <button
            onClick={onViewTeam}
            className="text-[#c91e2f] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
          >
            <span>Sales Team Performance &rarr;</span>
          </button>
        ) : (
          <span>Al Kharj (SHP-00001)</span>
        )}
      </div>
    </div>
  );
};
