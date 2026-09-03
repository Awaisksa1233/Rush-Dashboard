import React, { useState, useMemo } from 'react';
import { SalesTeamAnalytics, SalesRepPerformance, RepDealRecord } from '../../types/dashboard';
import { formatSAR } from '../../services/analyticsService';
import { 
  Trophy, 
  Users, 
  Target, 
  TrendingUp, 
  Award, 
  Search, 
  Filter, 
  ChevronRight, 
  CheckCircle2, 
  Sparkles, 
  ArrowUpRight, 
  Eye, 
  X, 
  Car, 
  Clock, 
  MapPin, 
  Briefcase,
  LayoutGrid,
  List,
  SlidersHorizontal
} from 'lucide-react';
import { InfoTooltip } from '../common/Tooltip';
import { PACKAGES } from '../../data/packages';

interface SalesTeamPerformanceProps {
  data: SalesTeamAnalytics;
  onPackageClick?: (pkgId: string) => void;
  onLocationSelect?: (locId: string) => void;
}

type SortField = 'attainment' | 'revenue' | 'sales' | 'conversion';

export const SalesTeamPerformance: React.FC<SalesTeamPerformanceProps> = ({
  data,
  onPackageClick,
  onLocationSelect
}) => {
  const {
    totalReps,
    activeLanes,
    totalRepSales,
    totalRepRevenue,
    teamQuotaTarget,
    teamQuotaAttainmentPct,
    avgLaneConversionRate,
    totalCommissions,
    topPerformer,
    reps,
    branchBreakdown
  } = data;

  // Local UI filters & view mode
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShift, setSelectedShift] = useState<'all' | 'morning' | 'evening'>('all');
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [activeRepModal, setActiveRepModal] = useState<SalesRepPerformance | null>(null);

  // Filtered and sorted reps
  const filteredReps = useMemo(() => {
    let result = [...reps];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.arabicName.toLowerCase().includes(q) ||
          r.branchName.toLowerCase().includes(q) ||
          r.role.toLowerCase().includes(q)
      );
    }

    if (selectedShift !== 'all') {
      result = result.filter((r) => r.shift === selectedShift || r.shift === 'flexible');
    }

    result.sort((a, b) => {
      switch (sortField) {
        case 'attainment':
          return b.quotaAttainmentPct - a.quotaAttainmentPct;
        case 'sales':
          return b.totalSales - a.totalSales;
        case 'conversion':
          return b.conversionRatePct - a.conversionRatePct;
        case 'revenue':
        default:
          return b.revenueGenerated - a.revenueGenerated;
      }
    });

    return result;
  }, [reps, searchQuery, selectedShift, sortField]);

  const getAttainmentColor = (pct: number) => {
    if (pct >= 110) return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-500' };
    if (pct >= 100) return { text: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200', bar: 'bg-teal-500' };
    if (pct >= 90) return { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', bar: 'bg-blue-500' };
    if (pct >= 80) return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-500' };
    return { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', bar: 'bg-rose-500' };
  };

  return (
    <div className="space-y-6">
      {/* SECTION HEADER WITH BRAND BADGE */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c91e2f] animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#c91e2f] bg-[#fde8ea] border border-[#c91e2f]/20 px-2.5 py-0.5 rounded-full">
                Drive-in Lane Advisors & POS Team
              </span>
              <span className="text-xs font-mono text-slate-400">
                {activeLanes} Active Lanes
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-display text-slate-900 tracking-tight flex items-center gap-2">
              <span>Sales Team Performance</span>
              <span className="text-slate-400 font-normal text-sm font-sans">
                أداء فريق المبيعات والمستشارين
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Real-time drive-in conversion tracking, quota pacing, advisor commissions, and branch sales velocity.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Incentive Pool</div>
              <div className="text-base font-bold font-mono text-emerald-700">
                {formatSAR(totalCommissions)}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <Trophy className="w-6 h-6 text-amber-500 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Top Advisor (MVP)</div>
                <div className="text-xs font-bold text-slate-900">{topPerformer?.name || 'Top Rep'}</div>
                <div className="text-[10px] text-emerald-700 font-medium">
                  {formatSAR(topPerformer?.revenueGenerated || 0)} ({topPerformer?.quotaAttainmentPct}% Quota)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 EXECUTIVE TEAM HIGHLIGHT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
          {/* Card 1: Total Rep Sales */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span className="font-semibold text-slate-700">Rep Sales Volume</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-display text-slate-900">
                {totalRepSales}
              </span>
              <span className="text-xs text-slate-500">units closed</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Revenue: <strong className="text-slate-800 font-mono">{formatSAR(totalRepRevenue)}</strong></span>
              <span className="text-emerald-700 font-semibold font-mono">+{Math.round((totalRepSales * 0.72))} New</span>
            </div>
          </div>

          {/* Card 2: Quota Attainment */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span className="font-semibold text-slate-700">Team Quota Attainment</span>
              <Target className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-black font-display ${teamQuotaAttainmentPct >= 100 ? 'text-emerald-700' : 'text-slate-900'}`}>
                {teamQuotaAttainmentPct}%
              </span>
              <span className="text-xs text-slate-400">of target</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(teamQuotaAttainmentPct, 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5 flex justify-between font-mono">
              <span>Goal: {formatSAR(teamQuotaTarget)}</span>
              <span>Actual: {formatSAR(totalRepRevenue)}</span>
            </div>
          </div>

          {/* Card 3: Lane Pitch Conversion Rate */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span className="font-semibold text-slate-700">Lane Pitch Conversion</span>
              <TrendingUp className="w-4 h-4 text-teal-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-display text-teal-700">
                {avgLaneConversionRate}%
              </span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px]">
                High Velocity
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Drive-in single wash drivers converted to recurring unlimited pass
            </div>
          </div>

          {/* Card 4: Top Tier Upsell Mix */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span className="font-semibold text-slate-700">Premium Tier Share</span>
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-display text-purple-700">
                67.2%
              </span>
              <span className="text-xs text-slate-500">Shiny & Nano</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Avg Ticket: <strong className="text-slate-800 font-mono">SAR 232</strong></span>
              <span className="text-purple-700 font-semibold font-mono">ASP +8.4%</span>
            </div>
          </div>
        </div>
      </div>

      {/* BRANCH TEAM MATRIX COMPARISON */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-bold text-base text-slate-900">
              Branch Sales Velocity & Team Pacing
            </h3>
            <InfoTooltip text="Comparative sales units, revenue, quota attainment, and drive-in pitch conversion across RUSH branches in Saudi Arabia." />
          </div>
          <span className="text-xs text-slate-400">
            4 Operational Hubs
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {branchBreakdown.map((b) => (
            <div 
              key={b.branchId}
              onClick={() => onLocationSelect && onLocationSelect(b.branchId)}
              className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 cursor-pointer transition-all hover:border-slate-300 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-[#c91e2f] uppercase tracking-wider">
                    {b.city}
                  </span>
                  <h4 className="font-bold text-slate-900 text-xs line-clamp-1 mt-0.5 group-hover:text-[#c91e2f] transition-colors">
                    {b.branchName.split('—')[1]?.trim() || b.branchName}
                  </h4>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 shrink-0">
                  {b.repCount} Reps
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <div className="text-lg font-black font-display text-slate-900">
                    {b.totalSales} <span className="text-xs font-normal text-slate-400">units</span>
                  </div>
                  <div className="text-xs font-mono font-semibold text-emerald-700">
                    {formatSAR(b.revenue)}
                  </div>
                </div>
                <div className="text-right font-mono">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    b.quotaPct >= 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {b.quotaPct}% Quota
                  </span>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {b.avgConversionRate}% Conv.
                  </div>
                </div>
              </div>

              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full ${b.quotaPct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(b.quotaPct, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* INTERACTIVE LEADERBOARD TABLE & FILTERS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Filter & Controls Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search advisor or branch..."
                className="w-full bg-white border border-slate-200 pl-8 pr-3 py-1.5 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#c91e2f]/20 focus:border-[#c91e2f] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Shift Filter Pills */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs font-semibold">
              <button
                onClick={() => setSelectedShift('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedShift === 'all' ? 'bg-[#c91e2f] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Shifts
              </button>
              <button
                onClick={() => setSelectedShift('morning')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedShift === 'morning' ? 'bg-[#c91e2f] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Morning
              </button>
              <button
                onClick={() => setSelectedShift('evening')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedShift === 'evening' ? 'bg-[#c91e2f] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Evening
              </button>
            </div>
          </div>

          {/* Sort & View Mode Controls */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium">Sort by:</span>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="bg-white border border-slate-200 text-slate-800 font-semibold py-1.5 px-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c91e2f]/20 focus:border-[#c91e2f] cursor-pointer"
              >
                <option value="revenue">Revenue Generated</option>
                <option value="attainment">Quota Attainment %</option>
                <option value="sales">Units Sold</option>
                <option value="conversion">Pitch Conversion %</option>
              </select>
            </div>

            {/* Table / Cards View Toggle */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('table')}
                title="Table View"
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'table' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                title="Card Grid View"
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'cards' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* RESULTS VIEW */}
        {filteredReps.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No sales advisors match your filter criteria.</p>
            <p className="text-xs mt-1">Try resetting the search query or selecting &ldquo;All Shifts&rdquo;.</p>
          </div>
        ) : viewMode === 'table' ? (
          /* LEADERBOARD TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/70 border-b border-slate-200 font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 text-center w-12">Rank</th>
                  <th className="py-3 px-4">Sales Advisor</th>
                  <th className="py-3 px-4">Branch & Shift</th>
                  <th className="py-3 px-4 text-center">Sales Units</th>
                  <th className="py-3 px-4 text-right">Revenue Generated</th>
                  <th className="py-3 px-4 text-center min-w-[150px]">Quota Pacing</th>
                  <th className="py-3 px-4 text-center">Lane Conv.</th>
                  <th className="py-3 px-4 min-w-[130px]">Package Mix</th>
                  <th className="py-3 px-4 text-right">Commission</th>
                  <th className="py-3 px-4 text-center w-20">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredReps.map((rep) => {
                  const attainmentStyle = getAttainmentColor(rep.quotaAttainmentPct);

                  return (
                    <tr 
                      key={rep.id} 
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setActiveRepModal(rep)}
                    >
                      {/* Rank Column */}
                      <td className="py-3 px-4 text-center font-bold font-mono">
                        {rep.rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs shadow-2xs">
                            🥇
                          </span>
                        ) : rep.rank === 2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 border border-slate-300 text-xs">
                            🥈
                          </span>
                        ) : rep.rank === 3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/15 text-amber-900 border border-amber-700/30 text-xs">
                            🥉
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold">#{rep.rank}</span>
                        )}
                      </td>

                      {/* Rep Name & Profile */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${rep.avatarBg} text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0`}>
                            {rep.avatarInitials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm group-hover:text-[#c91e2f] transition-colors flex items-center gap-1.5">
                              <span>{rep.name}</span>
                              <span className="text-slate-400 font-normal text-xs font-sans">({rep.arabicName})</span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2">
                              <span>{rep.role}</span>
                              <span>&bull;</span>
                              <span className="font-mono text-slate-400">{rep.id}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Branch & Shift */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 text-xs">
                          {rep.branchName.split('—')[1]?.trim() || rep.branchName}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase ${
                            rep.shift === 'morning' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                          }`}>
                            {rep.shift} shift
                          </span>
                        </div>
                      </td>

                      {/* Sales Units */}
                      <td className="py-3 px-4 text-center">
                        <div className="font-bold font-display text-base text-slate-900">
                          {rep.totalSales}
                        </div>
                        <div className="flex items-center justify-center gap-1 text-[10px] font-mono mt-0.5">
                          <span className="text-emerald-700" title="New Members">+{rep.newSales} new</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-blue-700" title="Upgrades">+{rep.upgrades} upg</span>
                        </div>
                      </td>

                      {/* Revenue */}
                      <td className="py-3 px-4 text-right font-mono">
                        <div className="font-bold text-slate-900 text-sm">
                          {formatSAR(rep.revenueGenerated)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          ASP: SAR {rep.avgTicketPrice}
                        </div>
                      </td>

                      {/* Quota Progress */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${attainmentStyle.bg} ${attainmentStyle.text} border ${attainmentStyle.border}`}>
                            {rep.quotaAttainmentPct}%
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            of {formatSAR(rep.targetRevenue, true)}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${attainmentStyle.bar}`}
                            style={{ width: `${Math.min(rep.quotaAttainmentPct, 100)}%` }}
                          />
                        </div>
                      </td>

                      {/* Lane Conversion */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="font-bold text-slate-900 text-xs">
                          {rep.conversionRatePct}%
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {rep.pitchesCount} pitches
                        </div>
                      </td>

                      {/* Package Mix Multi-bar */}
                      <td className="py-3 px-4">
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex mb-1">
                          <div style={{ width: `${(rep.tierSales.fresh / rep.totalSales) * 100}%`, backgroundColor: PACKAGES.fresh.color }} title={`Fresh: ${rep.tierSales.fresh}`} />
                          <div style={{ width: `${(rep.tierSales.shiny / rep.totalSales) * 100}%`, backgroundColor: PACKAGES.shiny.color }} title={`Shiny: ${rep.tierSales.shiny}`} />
                          <div style={{ width: `${(rep.tierSales.nano / rep.totalSales) * 100}%`, backgroundColor: PACKAGES.nano.color }} title={`Nano: ${rep.tierSales.nano}`} />
                          <div style={{ width: `${(rep.tierSales.interior / rep.totalSales) * 100}%`, backgroundColor: PACKAGES.interior_addon.color }} title={`Interior: ${rep.tierSales.interior}`} />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>F:{rep.tierSales.fresh}</span>
                          <span>S:{rep.tierSales.shiny}</span>
                          <span>N:{rep.tierSales.nano}</span>
                        </div>
                      </td>

                      {/* Commission */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 text-xs">
                        {formatSAR(rep.commissionEarned)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveRepModal(rep);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                          title="View Deals Log"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* CARD GRID VIEW */
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReps.map((rep) => {
              const attainmentStyle = getAttainmentColor(rep.quotaAttainmentPct);

              return (
                <div 
                  key={rep.id}
                  onClick={() => setActiveRepModal(rep)}
                  className="p-4 rounded-xl border border-slate-200/90 hover:border-slate-300 hover:shadow-xs bg-white cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-full ${rep.avatarBg} text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0`}>
                          {rep.avatarInitials}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm group-hover:text-[#c91e2f] transition-colors">
                            {rep.name}
                          </h4>
                          <span className="text-[11px] text-slate-400">{rep.role}</span>
                        </div>
                      </div>

                      <span className="font-bold font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        #{rep.rank}
                      </span>
                    </div>

                    {/* Branch & Shift Badge */}
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{rep.branchName.split('—')[1]?.trim() || rep.branchName}</span>
                      <span className="text-slate-300">&bull;</span>
                      <span className="capitalize">{rep.shift}</span>
                    </div>

                    {/* Sales Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 mt-3.5 text-center">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="text-[10px] text-slate-400">Units</div>
                        <div className="font-bold text-slate-900 text-sm mt-0.5 font-display">{rep.totalSales}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="text-[10px] text-slate-400">Revenue</div>
                        <div className="font-bold text-slate-900 text-xs mt-0.5 font-mono">{formatSAR(rep.revenueGenerated, true)}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="text-[10px] text-slate-400">Conv. Rate</div>
                        <div className="font-bold text-teal-700 text-xs mt-0.5 font-mono">{rep.conversionRatePct}%</div>
                      </div>
                    </div>

                    {/* Quota Progress */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                        <span className="text-slate-500">Quota Attainment</span>
                        <span className={`font-bold ${attainmentStyle.text}`}>{rep.quotaAttainmentPct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${attainmentStyle.bar}`}
                          style={{ width: `${Math.min(rep.quotaAttainmentPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono">Commission: <strong className="text-emerald-700">{formatSAR(rep.commissionEarned)}</strong></span>
                    <span className="text-slate-400 group-hover:text-[#c91e2f] font-semibold flex items-center gap-0.5 transition-colors">
                      Deals &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Table Footer Summary */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800">{filteredReps.length}</strong> of {reps.length} active drive-in advisors across the Kingdom
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>Total Units: <strong className="text-slate-900">{totalRepSales}</strong></span>
            <span>Total Inflow: <strong className="text-emerald-700">{formatSAR(totalRepRevenue)}</strong></span>
          </div>
        </div>
      </div>

      {/* INDIVIDUAL REP DEALS DRILLDOWN MODAL */}
      {activeRepModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setActiveRepModal(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${activeRepModal.avatarBg} text-white font-bold text-sm flex items-center justify-center shadow-xs`}>
                  {activeRepModal.avatarInitials}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-base text-slate-900">
                      {activeRepModal.name}
                    </h3>
                    <span className="text-xs text-slate-400 font-sans">({activeRepModal.arabicName})</span>
                    <span className="px-2 py-0.2 text-[10px] font-bold rounded bg-amber-100 text-amber-800 font-mono">
                      Rank #{activeRepModal.rank}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>{activeRepModal.role}</span>
                    <span>&bull;</span>
                    <span>{activeRepModal.branchName}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveRepModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Performance Stats Cards */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 text-[10px]">Sales Units</div>
                  <div className="text-base font-bold text-slate-900 font-display mt-0.5">{activeRepModal.totalSales}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 text-[10px]">Revenue Added</div>
                  <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">{formatSAR(activeRepModal.revenueGenerated)}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 text-[10px]">Attainment</div>
                  <div className="text-base font-bold text-blue-700 font-mono mt-0.5">{activeRepModal.quotaAttainmentPct}%</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 text-[10px]">Commission</div>
                  <div className="text-base font-bold text-purple-700 font-mono mt-0.5">{formatSAR(activeRepModal.commissionEarned)}</div>
                </div>
              </div>

              {/* Recent Closed Deals Ledger */}
              <div>
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Recent Closed Subscriptions & Upgrades</span>
                  <span className="text-[10px] text-slate-400 font-normal">Lane POS Attributed</span>
                </h4>

                <div className="space-y-2">
                  {activeRepModal.recentDeals.map((deal) => (
                    <div 
                      key={deal.id}
                      className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{deal.customerName}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                              {deal.vehiclePlate}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>{deal.lane}</span>
                            <span>&bull;</span>
                            <span className="text-slate-400">{deal.timestamp}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div className="font-bold text-slate-900">
                          {formatSAR(deal.amount)}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-semibold">
                          +SAR {deal.commission.toFixed(1)} comm.
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">Advisor ID: {activeRepModal.id}</span>
              <button
                onClick={() => setActiveRepModal(null)}
                className="px-4 py-1.5 font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-2xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
