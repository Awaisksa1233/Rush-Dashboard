import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BellRing, CalendarClock, Droplets, RefreshCw, Send, UserX } from 'lucide-react';
import { EngagementSummary } from '../../types/dashboard';
import { fetchEngagementSummary } from '../../services/apiClient';
import { formatSAR } from '../../services/analyticsService';
import { InfoTooltip } from '../common/Tooltip';

const PERIODS = [7, 30, 90] as const;
const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtInt = (v: number) => v.toLocaleString('en-US');

function fmtRiyadh(iso: string | null, withTime = false): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

function daysAgo(iso: string | null): string {
  if (!iso) return 'never';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'today' : `${d} d ago`;
}

export const EngagementDashboard: React.FC = () => {
  const [days, setDays] = useState<number>(30);
  const [tier, setTier] = useState<'all' | 'early' | 'established'>('all');
  const [data, setData] = useState<EngagementSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchEngagementSummary(days));
    } catch (e: any) {
      setError(e?.message || 'Could not load engagement data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const candidates = data?.nudgeCandidates.items.filter(c => tier === 'all' || c.tier === tier) ?? [];
  const nudgeRate = data && data.nudges.judgeable ? pct(data.nudges.worked, data.nudges.judgeable) : null;
  const reminderRate = data && data.reminders.judgeable ? pct(data.reminders.worked, data.reminders.judgeable) : null;

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-display font-bold text-base text-slate-900">Usage Nudges & Renewal Reminders</h3>
              <InfoTooltip text="Who needs a usage nudge right now, renewals coming up, and whether nudges and reminders logged from the Unifonic app actually worked." />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {data
                ? <>Active members {fmtInt(data.activeMembers)} · effectiveness over the last {data.periodDays} days · Riyadh time</>
                : 'Member engagement'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Period</span>
            <div className="flex bg-slate-100 rounded-lg p-0.5" role="group" aria-label="Effectiveness period">
              {PERIODS.map(p => (
                <button key={p} onClick={() => setDays(p)} aria-pressed={days === p}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${days === p ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {p}d
                </button>
              ))}
            </div>
            <button onClick={load} aria-label="Refresh"
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-emerald-700 hover:border-emerald-200">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-xl p-6 flex items-start gap-3 border border-amber-200 bg-amber-50/60">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <div className="font-semibold text-sm text-slate-900">Engagement data unavailable</div>
            <p className="text-xs text-slate-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading && !data && !error && (
        <div className="glass-card rounded-xl p-10 text-center text-sm text-slate-500">Loading member engagement…</div>
      )}

      {data && (
        <>
          {!data.logStartedAt && (
            <div className="glass-card rounded-xl p-4 flex items-start gap-3 border border-sky-200 bg-sky-50/60">
              <Send className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-700">
                <span className="font-semibold">No nudges or reminders logged yet.</span> Send them from the Unifonic app with
                <span className="font-semibold"> Purpose = Usage nudge / Renewal reminder</span> (and <code className="font-mono">CRM_API_URL</code> set),
                and effectiveness will appear here. The “needs a nudge” and “renewals due” lists below already work.
              </p>
            </div>
          )}

          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={UserX} label="Need a usage nudge now" value={fmtInt(data.nudgeCandidates.total)}
              sub={`${fmtPct(pct(data.nudgeCandidates.total, data.activeMembers - data.notYetJudged))} of judged members`}
              tooltip={`Months 1–2: fewer than 2 washes in the last ${data.rules.lookbackDays} days. Month 3+: no wash in the last ${data.rules.lookbackDays} days. Members in their first ${data.rules.lookbackDays} days (${fmtInt(data.notYetJudged)}) are not judged yet.`} accent />
            <Kpi icon={Droplets} label="Nudges that worked" value={nudgeRate == null ? '—' : fmtPct(nudgeRate)}
              sub={`${fmtInt(data.nudges.sent)} sent · ${fmtInt(data.nudges.worked)} of ${fmtInt(data.nudges.judgeable)} washed within ${data.rules.nudgeSuccessDays} d`}
              tooltip={`A nudge worked if the member washed within ${data.rules.nudgeSuccessDays} days after it. Only nudges at least ${data.rules.nudgeSuccessDays} days old are judged.`} />
            <Kpi icon={CalendarClock} label="Renewals due · next 7 days" value={fmtInt(data.renewalsDue.total)}
              sub={`${fmtInt(data.renewalsDue.reminded)} reminded · ${formatSAR(data.renewalsDue.mrr, true)} MRR`} />
            <Kpi icon={BellRing} label="Reminders that worked" value={reminderRate == null ? '—' : fmtPct(reminderRate)}
              sub={`${fmtInt(data.reminders.sent)} sent · ${fmtInt(data.reminders.worked)} of ${fmtInt(data.reminders.judgeable)} renewed within ${data.rules.reminderSuccessDays} d`}
              tooltip={`A reminder worked if a paid renewal for that subscription followed within ${data.rules.reminderSuccessDays} days. Only reminders at least ${data.rules.reminderSuccessDays} days old are judged.`} />
          </div>

          {/* Usage rule tiers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(['early', 'established'] as const).map(id => {
              const t = data.tiers[id];
              const share = pct(t.needNudge, t.members);
              return (
                <div key={id} className="glass-card rounded-xl p-4" title={`${t.needNudge} of ${t.members} members below target`}>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-800">{t.label}</div>
                    <div className="text-xs text-slate-500">{fmtInt(t.needNudge)} of {fmtInt(t.members)}</div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${share}%` }} />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">{fmtPct(share)} below their usage target</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Nudge list */}
            <div className="xl:col-span-7 glass-card rounded-xl p-5 overflow-x-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h4 className="font-display font-bold text-sm text-slate-900">Members to nudge</h4>
                <div className="flex bg-slate-100 rounded-lg p-0.5" role="group" aria-label="Tenure filter">
                  {([['all', 'All'], ['early', 'Months 1–2'], ['established', 'Month 3+']] as const).map(([id, label]) => (
                    <button key={id} onClick={() => setTier(id)} aria-pressed={tier === id}
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${tier === id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-400 text-left">
                    <th className="font-semibold pb-2">Member</th>
                    <th className="font-semibold pb-2">Package</th>
                    <th className="font-semibold pb-2 text-right">Tenure</th>
                    <th className="font-semibold pb-2 text-right">Washes 7d</th>
                    <th className="font-semibold pb-2 text-right">Last wash</th>
                    <th className="font-semibold pb-2 text-right">Last nudge</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.slice(0, 25).map(c => (
                    <tr key={c.subscriptionCode} className="border-t border-slate-100">
                      <td className="py-2 pr-2">
                        <div className="font-medium text-slate-800">{c.customer}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{c.customerCode || c.subscriptionCode}</div>
                      </td>
                      <td className="py-2 pr-2 text-slate-600">{c.package}</td>
                      <td className="py-2 text-right text-slate-600">{c.tenureDays} d</td>
                      <td className="py-2 text-right"><span className="font-semibold text-slate-900">{c.washesLast7Days}</span><span className="text-slate-400"> / {c.target}</span></td>
                      <td className="py-2 text-right text-slate-600">{daysAgo(c.lastWashAt)}</td>
                      <td className="py-2 text-right text-slate-600">{c.lastNudgeAt ? fmtRiyadh(c.lastNudgeAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-slate-400 mt-3">
                Showing {Math.min(25, candidates.length)} of {fmtInt(tier === 'all' ? data.nudgeCandidates.total : data.tiers[tier].needNudge)}, longest without a wash first.
              </p>
            </div>

            {/* Renewals due */}
            <div className="xl:col-span-5 glass-card rounded-xl p-5 overflow-x-auto">
              <h4 className="font-display font-bold text-sm text-slate-900 mb-3">Renewals due in the next 7 days</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-400 text-left">
                    <th className="font-semibold pb-2">Member</th>
                    <th className="font-semibold pb-2 text-right">Renews</th>
                    <th className="font-semibold pb-2 text-right">Amount</th>
                    <th className="font-semibold pb-2 text-right">Reminded</th>
                  </tr>
                </thead>
                <tbody>
                  {data.renewalsDue.items.slice(0, 25).map(r => (
                    <tr key={r.subscriptionCode} className="border-t border-slate-100">
                      <td className="py-2 pr-2">
                        <div className="font-medium text-slate-800">{r.customer}</div>
                        <div className="text-[10px] text-slate-400">{r.package}</div>
                      </td>
                      <td className="py-2 text-right text-slate-600">{fmtRiyadh(r.renewalDate)}</td>
                      <td className="py-2 text-right text-slate-600">{formatSAR(r.price)}</td>
                      <td className="py-2 text-right">
                        {r.remindedAt
                          ? <span className="text-emerald-700 font-semibold">✓ {fmtRiyadh(r.remindedAt)}</span>
                          : <span className="text-slate-400">Not yet</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-slate-400 mt-3">
                Showing {Math.min(25, data.renewalsDue.items.length)} of {fmtInt(data.renewalsDue.total)}, soonest first. “Reminded” = a renewal reminder logged in the last 10 days.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Kpi: React.FC<{ icon: React.FC<{ className?: string }>; label: string; value: string; sub: string; accent?: boolean; tooltip?: string }> = ({ icon: Icon, label, value, sub, accent, tooltip }) => (
  <div className={`glass-card rounded-xl p-4 ${accent ? 'border border-emerald-200' : ''}`}>
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-500">
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
      {tooltip && <InfoTooltip text={tooltip} />}
    </div>
    <div className={`text-2xl font-bold font-display mt-1.5 ${accent ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</div>
    <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>
  </div>
);
