import React, { useState } from 'react';
import { 
  DateRangePreset, 
  ComparisonType, 
  LocationId, 
  PackageTier 
} from '../../types/dashboard';
import { LOCATIONS } from '../../data/packages';
import { 
  Calendar, 
  MapPin, 
  ChevronDown, 
  RefreshCw, 
  LayoutDashboard, 
  DollarSign,
  UserCheck, 
  ShoppingBag, 
  Gauge 
} from 'lucide-react';

export type ActiveDomainTab = 'glance' | 'revenue' | 'sales' | 'memberships' | 'usage' | 'baremetrics';

interface DashboardHeaderProps {
  activeDomain: ActiveDomainTab;
  onDomainChange: (domain: ActiveDomainTab) => void;
  dateRange: DateRangePreset;
  onDateRangeChange: (preset: DateRangePreset) => void;
  comparison: ComparisonType;
  onComparisonChange: (comp: ComparisonType) => void;
  location: LocationId;
  onLocationChange: (loc: LocationId) => void;
  packageFilter: PackageTier | 'all';
  onPackageFilterChange: (pkg: PackageTier | 'all') => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  activeDomain,
  onDomainChange,
  dateRange,
  onDateRangeChange,
  comparison,
  onComparisonChange,
  location,
  onLocationChange,
  packageFilter,
  onPackageFilterChange,
  onRefresh,
  isRefreshing = false
}) => {
  const datePresets: { id: DateRangePreset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'last7', label: 'Last 7 Days' },
    { id: 'last30', label: 'Last 30 Days' },
    { id: 'thisMonth', label: 'This Month' },
    { id: 'lastMonth', label: 'Last Month' },
  ];

  const comparisonOptions: { id: ComparisonType; label: string }[] = [
    { id: 'previous_period', label: 'vs. Previous Period' },
    { id: 'previous_month', label: 'vs. Previous Month' },
    { id: 'previous_year', label: 'vs. Previous Year' },
  ];

  const domainTabs: { id: ActiveDomainTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'glance', label: 'At a Glance', icon: LayoutDashboard },
    { id: 'revenue', label: 'Revenue & MRR', icon: DollarSign },
    { id: 'sales', label: 'Sales & Growth', icon: ShoppingBag },
    { id: 'memberships', label: 'Memberships & Churn', icon: UserCheck },
    { id: 'usage', label: 'Wash Usage', icon: Gauge },
    { id: 'baremetrics', label: 'Baremetrics SaaS', icon: LayoutDashboard },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs backdrop-blur-md bg-white/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        {/* Top Row: Brand & Date / Location Filters */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-display font-extrabold text-sm shadow-xs">
              R
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold font-display text-slate-950 tracking-tight">
                  RUSH Car Wash CRM
                </span>
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-1.5 py-0.2 rounded">
                  Unlimited Wash Pro
                </span>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date Range Selector */}
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => onDateRangeChange(e.target.value as DateRangePreset)}
                className="appearance-none bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-semibold py-1.5 pl-8 pr-7 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer"
              >
                {datePresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Comparison Selector */}
            <div className="relative">
              <select
                value={comparison}
                onChange={(e) => onComparisonChange(e.target.value as ComparisonType)}
                className="appearance-none bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-medium py-1.5 pl-3 pr-7 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer"
              >
                {comparisonOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Location Filter */}
            <div className="relative">
              <select
                value={location}
                onChange={(e) => onLocationChange(e.target.value as LocationId)}
                className="appearance-none bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-medium py-1.5 pl-7 pr-7 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer"
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
              <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Package Filter */}
            <div className="relative">
              <select
                value={packageFilter}
                onChange={(e) => onPackageFilterChange(e.target.value as PackageTier | 'all')}
                className="appearance-none bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-medium py-1.5 pl-3 pr-7 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer"
              >
                <option value="all">All Packages</option>
                <option value="fresh">Fresh (SAR 149)</option>
                <option value="shiny">Shiny (SAR 199)</option>
                <option value="nano">Nano (SAR 289)</option>
                <option value="interior_addon">Interior (SAR 99)</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh"
              className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-700' : ''}`} />
            </button>
          </div>
        </div>

        {/* Bottom Row: 5 Specialized Domain Tabs (Glance, Revenue, Sales, Memberships, Usage) */}
        <div className="flex items-center gap-1.5 pt-2 overflow-x-auto no-scrollbar">
          {domainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeDomain === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onDomainChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
