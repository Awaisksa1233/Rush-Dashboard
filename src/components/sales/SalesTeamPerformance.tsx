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
  SlidersHorizontal,
  Database,
  Download
} from 'lucide-react';
import { InfoTooltip } from '../common/Tooltip';
import { PACKAGES } from '../../data/packages';

interface SalesTeamPerformanceProps {
  data: SalesTeamAnalytics;
  onPackageClick?: (pkgId: string) => void;
  onLocationSelect?: (locId: string) => void;
}

type SortField = 'score' | 'conversion' | 'winbacks' | 'membership_price' | 'onetime_price' | 'revenue' | 'sales' | 'attainment';

export const SalesTeamPerformance: React.FC<SalesTeamPerformanceProps> = ({
  data,
  onPackageClick,
  onLocationSelect
}) => {
  const {
    totalReps = 0,
    activeLanes = 0,
    totalRepSales = 0,
    totalRepRevenue = 0,
    teamQuotaTarget = 0,
    teamQuotaAttainmentPct = 0,
    avgLaneConversionRate = 0,
    totalCommissions = 0,
    totalNewMembers = 0,
    totalWinbacks = 0,
    avgWinbackRate = 0,
    topPerformer,
    reps = [],
    branchBreakdown = []
  } = data || {};

  // Local UI filters & view mode
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShift, setSelectedShift] = useState<'all' | 'morning' | 'evening'>('all');
  const [sortField, setSortField] = useState<SortField>('score');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [activeRepModal, setActiveRepModal] = useState<SalesRepPerformance | null>(null);

  const exportAdvisorDealsCsv = (rep: SalesRepPerformance) => {
    const headers = [
      "Deal ID",
      "Customer Name",
      "Vehicle Plate",
      "Package Tier",
      "Package Name",
      "Amount (SAR)",
      "Sale Type",
      "Days Inactive",
      "Timestamp",
      "Commission (SAR)",
      "Lane"
    ];
    const rows = (rep.recentDeals || []).map(d => [
      d.id,
      `"${(d.customerName || '').replace(/"/g, '""')}"`,
      `"${d.vehiclePlate}"`,
      d.packageTier,
      `"${(d.packageName || '').replace(/"/g, '""')}"`,
      d.amount,
      d.saleType,
      d.daysInactive ? `${d.daysInactive}d` : '',
      `"${d.timestamp}"`,
      d.commission,
      `"${(d.lane || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${rep.name.toLowerCase().replace(/\s+/g, '_')}_commission_deals.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filtered and sorted reps
  const filteredReps = useMemo(() => {
    let result = reps ? [...reps] : [];

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
        case 'conversion':
          return b.conversionRatePct - a.conversionRatePct;
        case 'winbacks':
          return (b.winbacks || 0) - (a.winbacks || 0);
        case 'membership_price':
          return (b.avgMembershipPrice || 0) - (a.avgMembershipPrice || 0);
        case 'onetime_price':
          return (b.avgOneTimePrice || 0) - (a.avgOneTimePrice || 0);
        case 'attainment':
          return b.quotaAttainmentPct - a.quotaAttainmentPct;
        case 'sales':
          return b.totalSales - a.totalSales;
        case 'revenue':
          return b.revenueGenerated - a.revenueGenerated;
        case 'score':
        default:
          return (b.rankScore || 0) - (a.rankScore || 0);
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

  if (!data?.reps || data.reps.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs">
        <div className="text-center py-12 text-slate-400">
          <Database className="w-8 h-8 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium">No sales team data available from database</p>
          <p className="text-xs mt-1">Data will appear here when available in the database</p>
        </div>
      </div>
    );
  }

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-5">
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

          {/* Card 3: New Member Pitch Conversion Rate */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span className="font-semibold text-slate-700">New Member Conversion</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-display text-emerald-700">
                {avgLaneConversionRate}%
              </span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">
                Strictly New
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              New prospective drivers converted ({totalNewMembers.toLocaleString()} new subs)
            </div>
          </div>

          {/* Card 4: Winbacks Lapsed >= 60 Days */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span className="font-semibold text-slate-700">Winbacks (≥2 Months)</span>
              <Sparkles className="w-4 h-4 text-teal-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-display text-teal-700">
                +{totalWinbacks.toLocaleString()}
              </span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px]">
                {avgWinbackRate}% winback rate
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Lapsed inactive &ge; 60 days</span>
              <span className="text-teal-700 font-semibold font-mono">Re-enrolled</span>
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
              <span className="text-slate-400 font-medium">Rank by:</span>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="bg-white border border-slate-200 text-slate-800 font-semibold py-1.5 px-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c91e2f]/20 focus:border-[#c91e2f] cursor-pointer"
              >
                <option value="score">Rank Score (Model A)</option>
                <option value="conversion">New Pitch Conversion % (30%)</option>
                <option value="winbacks">Winbacks Closed (≥2mo)</option>
                <option value="membership_price">Avg Membership Price (40%)</option>
                <option value="onetime_price">Avg One-Time Price (30%)</option>
                <option value="revenue">Revenue Generated</option>
                <option value="attainment">Quota Attainment %</option>
                <option value="sales">Units Sold</option>
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

        {/* Model A Formula Explainer Banner */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-amber-50/90 via-slate-50 to-blue-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-700 gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wide">
              Model A Ranking
            </span>
            <span className="text-xs text-slate-800">
              Rank calculated by: <strong className="text-emerald-800">30% New Member Conversion</strong> + <strong className="text-blue-800">40% Avg Membership Price</strong> + <strong className="text-amber-800">30% Avg One-Time Price</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-semibold font-sans text-[10px]">Winbacks (≥60d) Isolated</span>
            <span>Normalized 0–100 Index</span>
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
                  <th className="py-3 px-3 text-center w-12">Rank</th>
                  <th className="py-3 px-3 text-center">Score</th>
                  <th className="py-3 px-4">Sales Advisor</th>
                  <th className="py-3 px-3 text-center">New Conv. (30%)</th>
                  <th className="py-3 px-3 text-center">Winbacks (≥2mo)</th>
                  <th className="py-3 px-3 text-right">Avg Memb. (40%)</th>
                  <th className="py-3 px-3 text-right">Avg 1-Time (30%)</th>
                  <th className="py-3 px-4 text-right">Revenue</th>
                  <th className="py-3 px-3 text-center min-w-[120px]">Quota Pacing</th>
                  <th className="py-3 px-3 min-w-[100px]">Package Mix</th>
                  <th className="py-3 px-3 text-right">Commission</th>
                  <th className="py-3 px-2 text-center w-10">View</th>
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
                      <td className="py-3 px-3 text-center font-bold font-mono">
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

                      {/* Rank Score Column */}
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-slate-900 text-amber-400 shadow-2xs">
                          {rep.rankScore ?? '--'}
                        </span>
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
                              <span className="font-mono text-slate-400">{rep.branchName.split('—')[1]?.trim() || rep.branchName}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Lane Conversion (30% weight - strictly New Members) */}
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="font-bold text-emerald-800 text-xs">
                          {rep.conversionRatePct}%
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {rep.newSales ?? 0} new / {rep.newPitchesCount ?? rep.pitchesCount} pitches
                        </div>
                      </td>

                      {/* Winbacks (≥2 months lapsed) */}
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="inline-flex items-center gap-1 font-bold text-teal-800 text-xs px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200/80">
                          +{rep.winbacks ?? 0}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {rep.winbackRatePct ?? 0}% winback rate
                        </div>
                      </td>

                      {/* Avg Membership Sales Price (40% weight) */}
                      <td className="py-3 px-3 text-right font-mono">
                        <div className="font-bold text-blue-800 text-xs">
                          SAR {rep.avgMembershipPrice?.toFixed(1) || '--'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {rep.tierSales.fresh + rep.tierSales.shiny + rep.tierSales.nano} deals
                        </div>
                      </td>

                      {/* Avg One-Time Sales Price (30% weight) */}
                      <td className="py-3 px-3 text-right font-mono">
                        <div className="font-bold text-amber-800 text-xs">
                          SAR {rep.avgOneTimePrice?.toFixed(1) || '--'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          single / add-on
                        </div>
                      </td>

                      {/* Revenue */}
                      <td className="py-3 px-4 text-right font-mono">
                        <div className="font-bold text-slate-900 text-xs">
                          {formatSAR(rep.revenueGenerated)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {rep.totalSales} units
                        </div>
                      </td>

                      {/* Quota Progress */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                          <span className={`px-1.5 py-0.2 rounded-full font-bold text-[10px] ${attainmentStyle.bg} ${attainmentStyle.text} border ${attainmentStyle.border}`}>
                            {rep.quotaAttainmentPct}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${attainmentStyle.bar}`}
                            style={{ width: `${Math.min(rep.quotaAttainmentPct, 100)}%` }}
                          />
                        </div>
                      </td>

                      {/* Package Mix Multi-bar */}
                      <td className="py-3 px-3">
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex mb-1">
                          <div style={{ width: `${(rep.tierSales.fresh / rep.totalSales) * 100}%`, backgroundColor: PACKAGES.fresh?.color || '#3b82f6' }} title={`Fresh: ${rep.tierSales.fresh}`} />
                          <div style={{ width: `${(rep.tierSales.shiny / rep.totalSales) * 100}%`, backgroundColor: PACKAGES.shiny?.color || '#10b981' }} title={`Shiny: ${rep.tierSales.shiny}`} />
                          <div style={{ width: `${(rep.tierSales.nano / rep.totalSales) * 100}%`, backgroundColor: PACKAGES.nano?.color || '#8b5cf6' }} title={`Nano: ${rep.tierSales.nano}`} />
                          <div style={{ width: `${(rep.tierSales.interior / rep.totalSales) * 100}%`, backgroundColor: PACKAGES.interior_addon?.color || PACKAGES.interior_clean?.color || '#f59e0b' }} title={`Interior: ${rep.tierSales.interior}`} />
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                          <span>F:{rep.tierSales.fresh}</span>
                          <span>S:{rep.tierSales.shiny}</span>
                          <span>N:{rep.tierSales.nano}</span>
                        </div>
                      </td>

                      {/* Commission */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 text-xs">
                        {formatSAR(rep.commissionEarned)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-2 text-center">
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
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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

                      <div className="flex items-center gap-1.5">
                        <span className="font-bold font-mono text-[10px] px-2 py-0.5 rounded-md bg-slate-900 text-amber-400 shadow-2xs">
                          Score {rep.rankScore ?? '--'}
                        </span>
                        <span className="font-bold font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          #{rep.rank}
                        </span>
                      </div>
                    </div>

                    {/* Branch & Shift Badge */}
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{rep.branchName.split('—')[1]?.trim() || rep.branchName}</span>
                      <span className="text-slate-300">&bull;</span>
                      <span className="capitalize">{rep.shift}</span>
                    </div>

                    {/* Model A 3-Pillars Card Strip + Winbacks */}
                    <div className="mt-3 p-2 bg-slate-50 rounded-lg border border-slate-200/80 grid grid-cols-4 gap-1 text-center text-xs font-mono">
                      <div>
                        <span className="text-slate-400 text-[8.5px] block uppercase truncate">New (30%)</span>
                        <strong className="text-emerald-700 text-[11px]">{rep.conversionRatePct}%</strong>
                      </div>
                      <div className="border-l border-slate-200 pl-1">
                        <span className="text-slate-400 text-[8.5px] block uppercase truncate">Winback</span>
                        <strong className="text-teal-700 text-[11px]">+{rep.winbacks ?? 0}</strong>
                      </div>
                      <div className="border-l border-slate-200 pl-1">
                        <span className="text-slate-400 text-[8.5px] block uppercase truncate">Memb (40%)</span>
                        <strong className="text-blue-700 text-[11px]">SAR {rep.avgMembershipPrice?.toFixed(0) || '--'}</strong>
                      </div>
                      <div className="border-l border-slate-200 pl-1">
                        <span className="text-slate-400 text-[8.5px] block uppercase truncate">1-Time (30%)</span>
                        <strong className="text-amber-700 text-[11px]">SAR {rep.avgOneTimePrice?.toFixed(0) || '--'}</strong>
                      </div>
                    </div>

                    {/* Sales Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="text-[10px] text-slate-400">Total Units</div>
                        <div className="font-bold text-slate-900 text-sm mt-0.5 font-display">{rep.totalSales}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="text-[10px] text-slate-400">Total Revenue</div>
                        <div className="font-bold text-slate-900 text-xs mt-0.5 font-mono">{formatSAR(rep.revenueGenerated, true)}</div>
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
                    <span className="px-2 py-0.2 text-[10px] font-bold rounded bg-slate-900 text-amber-400 font-mono">
                      Score {activeRepModal.rankScore ?? '--'}
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
              {/* Model A Rank Formula Explainer Box */}
              <div className="p-3.5 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      Model A Performance Index
                    </span>
                    <span className="text-white font-bold text-base font-mono">
                      {activeRepModal.rankScore ?? '--'} <span className="text-xs text-slate-400 font-normal">/ 100</span>
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    Normalized 3-pillar calculation determining team leaderboard position
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center sm:text-right font-mono border-t sm:border-t-0 sm:border-l border-slate-800 pt-2 sm:pt-0 sm:pl-4">
                  <div>
                    <div className="text-[10px] text-slate-400">New Conv. (30%)</div>
                    <div className="font-bold text-emerald-400 text-xs mt-0.5">{activeRepModal.conversionRatePct}%</div>
                    <div className="text-[9px] text-slate-500">{activeRepModal.newSales ?? 0} new</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Winbacks (≥2mo)</div>
                    <div className="font-bold text-teal-400 text-xs mt-0.5">+{activeRepModal.winbacks ?? 0}</div>
                    <div className="text-[9px] text-slate-500">{activeRepModal.winbackRatePct ?? 0}% rate</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Avg Memb (40%)</div>
                    <div className="font-bold text-blue-400 text-xs mt-0.5">SAR {activeRepModal.avgMembershipPrice?.toFixed(1) || '--'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Avg 1-Time (30%)</div>
                    <div className="font-bold text-amber-400 text-xs mt-0.5">SAR {activeRepModal.avgOneTimePrice?.toFixed(1) || '--'}</div>
                  </div>
                </div>
              </div>

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
                            {deal.saleType === 'Winback' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-300">
                                Winback ({deal.daysInactive ? `${deal.daysInactive}d` : '≥60d'})
                              </span>
                            )}
                            {deal.saleType === 'New' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                New Member
                              </span>
                            )}
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

              {/* Calculation Rules Explainer */}
              <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-100 text-[11px] text-blue-900 leading-relaxed">
                <div className="font-bold text-blue-950 mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Subscription Renewal Commission Rules</span>
                </div>
                <div className="text-slate-600 space-y-0.5 text-[10.5px]">
                  <div>• <strong>Rates</strong>: Fresh: 2 SAR | Shiny: 6 SAR | Nano: 10 SAR | Interior Clean: 10 SAR</div>
                  <div>• <strong>Attribution</strong>: Earned on 1st full-price renewal. Upgrades split incremental difference (e.g. Fresh→Nano = 2 SAR orig + 8 SAR upg).</div>
                  <div>• <strong>Winbacks (≥2 Months)</strong>: 50% commission for lapsed members inactive ≥ 60 days. New Pitch Conversion strictly tracks first-time subscribers.</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">Advisor ID: {activeRepModal.id}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportAdvisorDealsCsv(activeRepModal)}
                  className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Deals (CSV)</span>
                </button>
                <button
                  onClick={() => setActiveRepModal(null)}
                  className="px-4 py-1.5 font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-2xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
