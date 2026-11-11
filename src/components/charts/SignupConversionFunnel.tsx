import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownRight, Clock, Hourglass, RefreshCw, Target, TrendingUp, Users } from 'lucide-react';
import { FunnelSegmentRow, SignupFunnelData } from '../../types/dashboard';
import { fetchSignupFunnel } from '../../services/apiClient';
import { formatSAR } from '../../services/analyticsService';
import { InfoTooltip } from '../common/Tooltip';

const WINDOW_OPTIONS = [7, 30, 60, 90] as const;
// `days: null` = everything since subscription tracking began (the server clamps `from`).
const COHORT_OPTIONS = [
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: 'all', label: 'Since tracking began', days: null },
] as const;

const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtInt = (v: number) => v.toLocaleString('en-US');

/** YYYY-MM-DD in Riyadh time, `daysAgo` before now. */
function riyadhYmd(daysAgo: number): string {
  return new Date(Date.now() + 3 * 3600000 - daysAgo * 86400000).toISOString().slice(0, 10);
}

function fmtRiyadhDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short', year: 'numeric' });
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

export const SignupConversionFunnel: React.FC = () => {
  const [windowDays, setWindowDays] = useState<number>(30);
  const [cohortId, setCohortId] = useState<(typeof COHORT_OPTIONS)[number]['id']>('all');
  const [data, setData] = useState<SignupFunnelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const cohort = COHORT_OPTIONS.find(c => c.id === cohortId)!;
    try {
      // Cohort ends today; customers whose window hasn't closed are reported as "still in window".
      setData(await fetchSignupFunnel({ from: riyadhYmd(cohort.days ?? 3650), to: riyadhYmd(0), windowDays }));
    } catch (e: any) {
      setError(e?.message || 'Could not load funnel');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [cohortId, windowDays]);

  useEffect(() => { load(); }, [load]);

  const derived = useMemo(() => {
    if (!data) return null;
    const top = data.steps[0]?.users || 0;
    const steps = data.steps.map((s, i) => {
      const prev = i === 0 ? s.users : data.steps[i - 1].users;
      return {
        ...s,
        overallPct: pct(s.users, top),
        stepPct: i === 0 ? 100 : pct(s.users, prev),
        lost: i === 0 ? 0 : prev - s.users,
      };
    });
    const leak = steps.slice(1).reduce((worst, s) => (s.lost > (worst?.lost ?? -1) ? s : worst), null as (typeof steps)[number] | null);
    return { steps, top, leak, overall: pct(steps[steps.length - 1]?.users || 0, top) };
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header + filters (one row) */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-display font-bold text-base text-slate-900">Signup → Subscription Funnel</h3>
              <InfoTooltip text="Cohort view: customers who created an account in the selected range, followed for N days after their own signup date. Only customers whose window has fully closed are counted in the rates." />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {data
                ? <>
                    Signups {fmtRiyadhDate(data.cohort.from)} – {fmtRiyadhDate(data.cohort.to)} · {data.cohort.windowDays}-day conversion window · Riyadh time
                    {data.cohort.clampedToTrackingStart && (
                      <span className="block text-slate-400">Starts at {fmtRiyadhDate(data.cohort.trackingStart)}, when membership tracking went live; earlier signups have no subscription records.</span>
                    )}
                  </>
                : 'How new customers become members'}
            </p>
          </div>
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0">
            <label className="text-[11px] font-semibold text-slate-500 uppercase">Signups</label>
            <select
              value={cohortId}
              onChange={e => setCohortId(e.target.value as typeof cohortId)}
              className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              {COHORT_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <label className="text-[11px] font-semibold text-slate-500 uppercase ml-1">Window</label>
            <div className="flex bg-slate-100 rounded-lg p-0.5" role="group" aria-label="Conversion window">
              {WINDOW_OPTIONS.map(w => (
                <button
                  key={w}
                  onClick={() => setWindowDays(w)}
                  aria-pressed={windowDays === w}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${windowDays === w ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {w}d
                </button>
              ))}
            </div>
            <button
              onClick={load}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-emerald-700 hover:border-emerald-200"
              aria-label="Refresh funnel"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-xl p-6 flex items-start gap-3 border border-amber-200 bg-amber-50/60">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <div className="font-semibold text-sm text-slate-900">Funnel unavailable</div>
            <p className="text-xs text-slate-600 mt-0.5">{error}</p>
            <p className="text-xs text-slate-500 mt-1">Start the API with <code className="font-mono">npm run dev:full</code> and make sure the local MongoDB copy is running.</p>
          </div>
        </div>
      )}

      {loading && !data && !error && (
        <div className="glass-card rounded-xl p-10 text-center text-sm text-slate-500">Building funnel from local database…</div>
      )}

      {data && derived && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={Users} label="Signups (window closed)" value={fmtInt(derived.top)}
              sub={`${fmtInt(data.inWindow.signedUp)} more still inside window`} />
            <Kpi icon={Target} label="Signup → subscription" value={fmtPct(derived.overall)}
              sub={`${fmtInt(data.steps[3].users)} new members`} accent />
            <Kpi icon={Clock} label="Median time to subscribe" value={data.timeToConvert.medianDays == null ? '—' : `${data.timeToConvert.medianDays} d`}
              sub={`${fmtPct(pct(data.timeToConvert.buckets.sameDay, data.timeToConvert.converters))} subscribe on signup day`} />
            <Kpi icon={TrendingUp} label="MRR at stake" value={formatSAR(data.opportunity.monthlyRevenueAtStake, true)}
              sub={`${fmtInt(data.opportunity.repeatNotSubscribed)} repeat visitors × ${formatSAR(data.opportunity.avgSubscriptionPrice)} avg`}
              tooltip="Customers who washed 2+ times in the window but never subscribed, multiplied by the average first-membership price of those who did. An upper bound on monthly recurring revenue, not a forecast." />
          </div>

          {/* Funnel bars */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-display font-bold text-sm text-slate-900">Conversion by step</h4>
              <span className="text-[11px] text-slate-400">Bar length = share of all signups</span>
            </div>
            <div className="space-y-3">
              {derived.steps.map((s, i) => (
                <div key={s.id}>
                  {i > 0 && (
                    <div className={`flex items-center gap-1.5 text-[11px] mb-1.5 pl-1 ${derived.leak?.id === s.id ? 'text-rose-700 font-semibold' : 'text-slate-400'}`}>
                      <ArrowDownRight className="w-3 h-3" />
                      <span>{fmtInt(s.lost)} dropped ({fmtPct(100 - s.stepPct)})</span>
                      {derived.leak?.id === s.id && <span className="ml-1 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200">Biggest leak</span>}
                    </div>
                  )}
                  <div className="grid grid-cols-12 items-center gap-3 group" title={`${s.label}: ${fmtInt(s.users)} customers · ${fmtPct(s.overallPct)} of signups · ${fmtPct(s.stepPct)} of previous step`}>
                    <div className="col-span-12 sm:col-span-3">
                      <div className="text-xs font-semibold text-slate-800">{i + 1}. {s.label}</div>
                      <div className="text-[11px] text-slate-500 leading-tight">{s.description}</div>
                    </div>
                    <div className="col-span-8 sm:col-span-6">
                      <div className="h-7 bg-slate-100 rounded-md overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 group-hover:bg-emerald-700 rounded-r-[4px] transition-all duration-300"
                          style={{ width: `${Math.max(s.overallPct, 0.5)}%` }}
                        />
                      </div>
                    </div>
                    <div className="col-span-4 sm:col-span-3 text-right">
                      <div className="text-sm font-bold font-display text-slate-900">{fmtInt(s.users)}</div>
                      <div className="text-[11px] text-slate-500">{fmtPct(s.overallPct)}{i > 0 && <> · step {fmtPct(s.stepPct)}</>}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-4">
              Steps are cumulative: a customer who subscribes at signup also counts as “came back” and “repeat visitor”, because many members subscribe before their first recorded wash.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Monthly cohort trend */}
            <div className="lg:col-span-7 glass-card rounded-xl p-5">
              <h4 className="font-display font-bold text-sm text-slate-900 mb-1">Conversion by signup month</h4>
              <p className="text-[11px] text-slate-500 mb-4">Share of each month's signups who subscribed within {data.cohort.windowDays} days. Striped = some customers still inside their window.</p>
              <MonthlyBars rows={data.monthly} />
            </div>

            {/* Time to convert */}
            <div className="lg:col-span-5 glass-card rounded-xl p-5">
              <h4 className="font-display font-bold text-sm text-slate-900 mb-1">Time from signup to subscription</h4>
              <p className="text-[11px] text-slate-500 mb-4">
                {fmtInt(data.timeToConvert.converters)} converters · P75 {data.timeToConvert.p75Days ?? '—'} d · P95 {data.timeToConvert.p95Days ?? '—'} d
              </p>
              <LagBars buckets={data.timeToConvert.buckets} total={data.timeToConvert.converters} windowDays={data.cohort.windowDays} />
            </div>
          </div>

          {/* Segments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SegmentTable title="By signup source" rows={data.segments.source} />
            <SegmentTable title="By first visit type" rows={data.segments.firstVisit} />
          </div>

          {data.inWindow.signedUp > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
              <Hourglass className="w-3.5 h-3.5" />
              {fmtInt(data.inWindow.signedUp)} recent signups are still inside their {data.cohort.windowDays}-day window
              ({fmtInt(data.inWindow.subscribed)} subscribed so far) and are excluded from the rates above.
            </div>
          )}
        </>
      )}
    </div>
  );
};

const Kpi: React.FC<{ icon: React.FC<{ className?: string }>; label: string; value: string; sub: string; accent?: boolean; tooltip?: string }> = ({ icon: Icon, label, value, sub, accent, tooltip }) => (
  <div className={`glass-card rounded-xl p-4 ${accent ? 'border border-emerald-200' : ''}`}>
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-500">
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      {tooltip && <InfoTooltip text={tooltip} />}
    </div>
    <div className={`text-2xl font-bold font-display mt-1.5 ${accent ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</div>
    <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>
  </div>
);

const STRIPES = 'repeating-linear-gradient(45deg, rgb(5 150 105) 0 3px, rgb(167 243 208) 3px 6px)';

const MonthlyBars: React.FC<{ rows: SignupFunnelData['monthly'] }> = ({ rows }) => {
  const shown = rows.filter(r => r.mature > 0 || r.pending > 0);
  const values = shown.map(r => pct(r.subscribed, r.mature));
  const max = Math.max(5, ...values);
  if (!shown.length) return <div className="text-xs text-slate-400">No signups in range.</div>;
  return (
    <div>
      <div className="flex items-end gap-[2px] h-40 border-b border-slate-200">
        {shown.map((r, i) => {
          const v = values[i];
          const partial = r.pending > 0;
          return (
            <div key={r.month} className="flex-1 h-full flex flex-col justify-end items-center group relative min-w-0">
              <div className="text-[10px] font-semibold text-slate-600 mb-0.5">{r.mature ? fmtPct(v) : '—'}</div>
              <div
                className="w-full max-w-[28px] rounded-t-[4px] bg-emerald-600 group-hover:bg-emerald-700"
                style={{ height: `${(v / max) * 100}%`, minHeight: r.mature ? 2 : 0, background: partial ? STRIPES : undefined }}
              />
              <div className="absolute bottom-full mb-6 hidden group-hover:block z-20 bg-slate-900 text-white text-[11px] rounded-md px-2 py-1.5 whitespace-nowrap shadow-lg">
                <div className="font-semibold">{monthLabel(r.month)}</div>
                <div>{fmtInt(r.subscribed)} of {fmtInt(r.mature)} subscribed · {r.mature ? fmtPct(v) : '—'}</div>
                {partial && <div className="text-slate-300">{fmtInt(r.pending)} still in window</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-[2px] mt-1">
        {shown.map((r, i) => (
          <div key={r.month} className="flex-1 text-center text-[10px] text-slate-400 truncate">
            {shown.length > 8 && i % 2 === 1 ? '' : monthLabel(r.month)}
          </div>
        ))}
      </div>
    </div>
  );
};

const LagBars: React.FC<{ buckets: SignupFunnelData['timeToConvert']['buckets']; total: number; windowDays: number }> = ({ buckets, total, windowDays }) => {
  const rows = [
    { label: 'Signup day', n: buckets.sameDay },
    { label: '1–7 days', n: buckets.d1to7 },
    { label: '8–30 days', n: buckets.d8to30, hide: windowDays <= 7 },
    { label: '31+ days', n: buckets.d31plus, hide: windowDays <= 30 },
  ].filter(r => !r.hide);
  return (
    <div className="space-y-2.5">
      {rows.map(r => {
        const share = pct(r.n, total);
        return (
          <div key={r.label} className="grid grid-cols-12 items-center gap-2" title={`${r.label}: ${fmtInt(r.n)} (${fmtPct(share)})`}>
            <div className="col-span-3 text-xs text-slate-600">{r.label}</div>
            <div className="col-span-6 h-5 bg-slate-100 rounded overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-r-[4px]" style={{ width: `${share}%` }} />
            </div>
            <div className="col-span-3 text-right text-xs font-semibold text-slate-800">{fmtInt(r.n)} <span className="text-slate-400 font-normal">· {fmtPct(share)}</span></div>
          </div>
        );
      })}
    </div>
  );
};

const SegmentTable: React.FC<{ title: string; rows: FunnelSegmentRow[] }> = ({ title, rows }) => {
  const best = Math.max(0, ...rows.map(r => pct(r.subscribed, r.signedUp)));
  return (
    <div className="glass-card rounded-xl p-5 overflow-x-auto">
      <h4 className="font-display font-bold text-sm text-slate-900 mb-3">{title}</h4>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase text-slate-400 text-right">
            <th className="text-left font-semibold pb-2">Segment</th>
            <th className="font-semibold pb-2">Signups</th>
            <th className="font-semibold pb-2">Came back</th>
            <th className="font-semibold pb-2">Repeat</th>
            <th className="font-semibold pb-2 w-32">Subscribed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const conv = pct(r.subscribed, r.signedUp);
            return (
              <tr key={r.key} className="border-t border-slate-100 text-right">
                <td className="text-left py-2 pr-2 text-slate-700 font-medium">{r.label}</td>
                <td className="py-2 text-slate-600">{fmtInt(r.signedUp)}</td>
                <td className="py-2 text-slate-600">{fmtPct(pct(r.visited, r.signedUp))}</td>
                <td className="py-2 text-slate-600">{fmtPct(pct(r.repeat, r.signedUp))}</td>
                <td className="py-2">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${best ? (conv / best) * 100 : 0}%` }} />
                    </div>
                    <span className="font-semibold text-slate-900 w-11">{fmtPct(conv)}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
