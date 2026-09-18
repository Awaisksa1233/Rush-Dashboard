import React from 'react';
import { 
  FileText, 
  ExternalLink, 
  DollarSign, 
  Users, 
  UserCheck, 
  Gauge, 
  Award,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';

export const KpiGuideView: React.FC = () => {
  const sections = [
    {
      title: '1. Revenue & Growth',
      icon: DollarSign,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      kpis: [
        {
          name: 'Net Revenue',
          formula: 'Total Realized Inflow − Refunds & Chargebacks',
          description: 'Total revenue collected from subscription recurring billings, new signups, retail washes, and detail add-on services.'
        },
        {
          name: 'Monthly Recurring Revenue (MRR)',
          formula: '∑ (Active Members in Tier × Monthly Tier Price)',
          description: 'The predictable, normalized monthly subscription revenue committed across all active subscriber tiers.'
        },
        {
          name: 'MRR Net Movement',
          formula: 'New MRR + Expansion + Reactivations − Churned MRR − Delinquent MRR',
          description: 'Bridges MRR changes between the start and close of the measurement period.'
        }
      ]
    },
    {
      title: '2. Membership, Churn & Retention',
      icon: UserCheck,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      kpis: [
        {
          name: 'Active Valid Memberships',
          formula: 'Count of subscriptions with status = "active" & unexpired valid period',
          description: 'Total vehicles entitled to tunnel washes, split between automated auto-renewing and pending expiry.'
        },
        {
          name: 'Net Member Growth',
          formula: '(New Members + Reactivated Members) − (Voluntary Churn + Involuntary Churn)',
          description: 'The net expansion or contraction of the active customer roster over the period.'
        },
        {
          name: 'Renewal Collection Rate',
          formula: '[(First-Try Success + Recovered Payments) ÷ Total Renewals Scheduled] × 100%',
          description: 'Percentage of scheduled recurring renewal billings successfully collected.'
        },
        {
          name: 'Churn Rate',
          formula: '[(Voluntary Churn + Involuntary Churn) ÷ Starting Customer Base] × 100%',
          description: 'Rate of customer attrition across the month, distinguishing voluntary cancellations from card payment failures.'
        }
      ]
    },
    {
      title: '3. Customer Economics & Lifetime Value',
      icon: Users,
      color: 'text-violet-600 bg-violet-50 border-violet-200',
      kpis: [
        {
          name: 'Average Revenue Per Member (ARPM / ARPU)',
          formula: 'Total Monthly MRR ÷ Total Active Members',
          description: 'The normalized average monthly yield generated per active vehicle subscriber (typically SAR 135 – 145).'
        },
        {
          name: 'Customer Lifetime Value (LTV)',
          formula: 'ARPM × Average Customer Lifespan in Months',
          description: 'Total gross revenue expected from a member across their entire active relationship with RUSH (average lifespan is ~5–6 months).'
        },
        {
          name: 'Cohort Retention Rate',
          formula: '[Members Still Active in Month n ÷ Original Month Cohort Signups] × 100%',
          description: 'Tracks monthly signup groups over 1, 2, 3, and 6 months to measure onboarding strength and loyalty decay.'
        }
      ]
    },
    {
      title: '4. Wash Operations & Utilization',
      icon: Gauge,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      kpis: [
        {
          name: 'Average Washes per Member/Month',
          formula: 'Total Member Washes Completed ÷ Active Member Base',
          description: 'Frequency of tunnel usage per subscriber (healthy optimal range: 2.8 to 3.5 washes/month).'
        },
        {
          name: 'Revenue per Wash',
          formula: 'Total Net Revenue ÷ Total Tunnel Washes Completed',
          description: 'The realized revenue yield per vehicle wash across subscription and retail single washes.'
        },
        {
          name: 'Utilization Tiers',
          formula: 'Segmentation: 0 Washes (Sleepers), 1–2 (Casual), 3–5 (Optimal), 6+ (Power Users)',
          description: 'Categorizes members by tunnel frequency to identify high churn risks (0 washes) and promote engagement.'
        }
      ]
    },
    {
      title: '5. Sales Team & Rep Performance',
      icon: Award,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      kpis: [
        {
          name: 'Lane Conversion Rate',
          formula: '[Subscriptions Sold by Rep ÷ Customer Pitches Given] × 100%',
          description: 'Express lane sales efficiency converting one-time retail drivers into recurring monthly members.'
        },
        {
          name: 'Quota Attainment',
          formula: '[Actual Sales Units ÷ Target Monthly Quota] × 100%',
          description: 'Sales performance tracking against individual rep and branch monthly targets.'
        }
      ]
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-150 select-none">
      {/* Top Banner Card */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#c91e2f]"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#c91e2f]">
              Official Methodology Guide
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold font-display text-slate-900">
            Executive KPI Calculation Reference
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Business logic, mathematical definitions, and calculation rules across all RUSH dashboard metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/Awaisksa1233/Rush-Dashboard/blob/main/docs/KPI_CALCULATIONS_GUIDE.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-95"
          >
            <FileText className="w-3.5 h-3.5 text-[#ff6b7b]" />
            <span>Open docs/KPI_CALCULATIONS_GUIDE.md</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {sections.map((sec, idx) => {
          const Icon = sec.icon;
          return (
            <div 
              key={idx} 
              className={`bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between ${
                idx === sections.length - 1 ? 'md:col-span-2' : ''
              }`}
            >
              <div>
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-4">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${sec.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-display font-bold text-sm text-slate-900">
                    {sec.title}
                  </h3>
                </div>

                <div className="space-y-4">
                  {sec.kpis.map((kpi, kIdx) => (
                    <div key={kIdx} className="bg-slate-50/70 rounded-xl p-3 border border-slate-100">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-xs text-slate-900">{kpi.name}</span>
                        <ArrowUpRight className="w-3 h-3 text-slate-400" />
                      </div>
                      <div className="font-mono text-[11px] font-bold text-[#c91e2f] bg-white px-2 py-1 rounded border border-slate-200/60 mb-1.5 overflow-x-auto">
                        {kpi.formula}
                      </div>
                      <div className="text-[11px] text-slate-500 leading-relaxed">
                        {kpi.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
