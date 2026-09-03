import React from 'react';
import { ModalDrilldownType } from '../../types/dashboard';
import { MOCK_RECORDS, PACKAGES } from '../../data/packages';
import { formatSAR } from '../../services/analyticsService';
import { X, CheckCircle2, AlertTriangle, UserX, UserCheck, RefreshCw, Phone, Car } from 'lucide-react';

interface DrilldownModalProps {
  type: ModalDrilldownType | null;
  onClose: () => void;
  selectedPackageFilter?: string;
}

export const DrilldownModal: React.FC<DrilldownModalProps> = ({
  type,
  onClose,
  selectedPackageFilter
}) => {
  if (!type) return null;

  let title = 'Records Detail';
  let subtitle = 'Granular operational data records';

  if (type === 'valid_members') {
    title = 'Active Valid Memberships';
    subtitle = 'All subscriptions entitled to wash access at the snapshot date';
  } else if (type === 'failed_renewals') {
    title = 'Recurring Renewal Failure Queue';
    subtitle = 'Active retry schedule and bank decline root causes';
  } else if (type === 'voluntary_churn') {
    title = 'Voluntary Cancellation Log';
    subtitle = 'Customer-initiated cancellations and stated exit feedback';
  } else if (type === 'new_members') {
    title = 'New Membership Sales & Win-backs';
    subtitle = 'Subscriptions acquired during the current period';
  } else if (type === 'revenue_breakdown') {
    title = 'Revenue Transaction Ledger';
    subtitle = 'Audited breakdown of period collections and refund deductions';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <h3 className="font-display font-bold text-lg text-slate-900">
              {title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Contextual Lists */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* 1. VALID MEMBERS LIST */}
          {type === 'valid_members' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                <span>Showing {MOCK_RECORDS.validMembers.length} sample active records</span>
                <span className="font-medium text-emerald-700">All entitled to wash</span>
              </div>
              <div className="divide-y divide-slate-100">
                {MOCK_RECORDS.validMembers.map((m) => (
                  <div key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          <span>{m.customer}</span>
                          <span className="text-slate-400 font-mono text-[11px] font-normal">{m.id}</span>
                        </div>
                        <div className="text-slate-500 flex items-center gap-3 mt-0.5 text-[11px]">
                          <span className="flex items-center gap-1"><Car className="w-3 h-3 text-slate-400" /> {m.car}</span>
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {m.phone}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:text-right font-mono">
                      <div>
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {m.pkg}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {formatSAR(m.mrr)} / mo
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-semibold text-slate-700">Valid to: {m.validUntil}</div>
                        <div className="text-[10px] text-emerald-700">{m.washesUsedThisPeriod} washes used</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. FAILED RENEWALS LIST */}
          {type === 'failed_renewals' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                <span className="text-slate-500">Mada / Credit Auto-billing Exceptions</span>
                <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Dunning Sequence Active
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {MOCK_RECORDS.failedRenewals.map((f) => (
                  <div key={f.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          <span>{f.customer}</span>
                          <span className="text-slate-400 font-mono text-[11px] font-normal">{f.id}</span>
                        </div>
                        <div className="text-slate-500 flex items-center gap-3 mt-0.5 text-[11px]">
                          <span>{f.car}</span>
                          <span className="text-rose-600 font-semibold">Reason: {f.reason}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:text-right font-mono">
                      <div>
                        <div className="font-bold text-slate-900">{formatSAR(f.amount)}</div>
                        <div className="text-[10px] text-slate-400">Attempt {f.attempts} of 3</div>
                      </div>
                      <div className="min-w-[130px] text-right">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                          f.recoverable ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {f.status}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">{f.lastAttempt}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. VOLUNTARY CHURN LIST */}
          {type === 'voluntary_churn' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                <span className="text-slate-500">Customer Exit Interviews</span>
                <span className="text-orange-700 font-semibold">Average Lifetime: 4.7 Months</span>
              </div>
              <div className="divide-y divide-slate-100">
                {MOCK_RECORDS.voluntaryChurns.map((c) => (
                  <div key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        <UserX className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          {c.customer}
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          Feedback: <span className="font-medium text-slate-700">{c.reason}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right font-mono">
                      <div>
                        <div className="text-slate-500 text-[11px]">Tenure: {c.tenureMonths} mos</div>
                        <div className="font-bold text-emerald-800">LTV: {formatSAR(c.ltv)}</div>
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        Cancelled {c.churnDate}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. NEW MEMBERS SALES LIST */}
          {type === 'new_members' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                <span className="text-slate-500">Acquisition Log</span>
                <span className="text-emerald-700 font-semibold">High Multi-Vehicle Rate</span>
              </div>
              <div className="divide-y divide-slate-100">
                {MOCK_RECORDS.newSales.map((s) => (
                  <div key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <span>{s.customer}</span>
                        <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                          {s.type}
                        </span>
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        {s.car} &bull; Channel: {s.channel}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right font-mono">
                      <div>
                        <div className="font-bold text-slate-900">{formatSAR(s.amount)}</div>
                        <div className="text-[10px] text-slate-500">{s.pkg}</div>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {s.date}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. REVENUE BREAKDOWN LEDGER */}
          {type === 'revenue_breakdown' && (
            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Audited Settlement Cycle</div>
                  <div className="text-xl font-bold font-display text-emerald-400">SAR 728,400 Total Inflow</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Recurring Share</div>
                  <div className="text-base font-bold text-white">82.4% MRR Driven</div>
                </div>
              </div>

              <div className="pt-2">
                <h4 className="font-semibold text-slate-700 mb-2">Settlement Breakdown</h4>
                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-slate-900">Automated Recurring Membership Renewals</span>
                      <p className="text-[11px] text-slate-500">Mada / Visa auto-billing recurring collections</p>
                    </div>
                    <span className="font-mono font-bold text-slate-900 text-sm">SAR 422,472</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-slate-900">New Membership Initial Month Signups</span>
                      <p className="text-[11px] text-slate-500">On-site lane POS & mobile app signups</p>
                    </div>
                    <span className="font-mono font-bold text-slate-900 text-sm">SAR 131,112</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-slate-900">Walk-in Single Wash Tickets</span>
                      <p className="text-[11px] text-slate-500">Non-subscription one-off wash transactions</p>
                    </div>
                    <span className="font-mono font-bold text-slate-900 text-sm">SAR 87,408</span>
                  </div>

                  <div className="p-3 bg-rose-50/60 rounded-lg border border-rose-200 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-rose-900">Refunds & Disputed Charges</span>
                      <p className="text-[11px] text-rose-700">Bank chargebacks and operational goodwill refunds</p>
                    </div>
                    <span className="font-mono font-bold text-rose-700 text-sm">-SAR 7,284</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-400">RUSH Internal Management Analytics CRM</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-2xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
