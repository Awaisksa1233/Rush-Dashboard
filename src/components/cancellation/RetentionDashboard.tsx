import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Sparkles, 
  PauseCircle, 
  Percent, 
  TrendingUp, 
  DollarSign, 
  UserCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  Play, 
  Car, 
  Phone, 
  Layers, 
  HeartHandshake, 
  UserX, 
  Settings, 
  Activity, 
  Flame, 
  Building, 
  Check, 
  Save, 
  AlertCircle,
  FileText,
  X
} from 'lucide-react';
import { 
  SpecificationMetricsSummary, 
  QualityRecoveryTicket, 
  RetentionOfferHistory, 
  AdminRetentionConfig,
  CancellationReason,
  UsageSegment,
  AprBand
} from '../../types/dashboard';
import { formatSAR, formatPercent } from '../../services/analyticsService';
import { 
  fetchCancellationMetrics, 
  updateQualityRecoveryTicket, 
  updateAdminRetentionConfig, 
  applyManagerOverride 
} from '../../services/apiClient';
import { CancellationFlowModal } from './CancellationFlowModal';

interface RetentionDashboardProps {
  onOpenCancelModalForMember?: (memberData: any) => void;
}

export const RetentionDashboard: React.FC<RetentionDashboardProps> = () => {
  const [metrics, setMetrics] = useState<SpecificationMetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'quality_tickets' | 'post_save_cohorts' | 'heavy_washers' | 'admin_config'>('overview');
  
  // Quality Ticket Filter & Modal State
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<QualityRecoveryTicket | null>(null);
  const [ticketResolveModalOpen, setTicketResolveModalOpen] = useState(false);
  const [resolveForm, setResolveForm] = useState({
    status: 'resolved_retained' as const,
    managerNotes: '',
    documentedRemedy: 'rewash' as const,
    remedyDetails: '',
    memberDecision: 'stay' as const
  });

  // Admin Config State
  const [adminConfigForm, setAdminConfigForm] = useState<AdminRetentionConfig | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSavedToast, setConfigSavedToast] = useState(false);

  // Manager Override Modal State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    sessionId: 'SES-9082',
    managerRole: 'Regional Operations Manager',
    managerId: 'MGR-104',
    overrideReason: 'VIP Fleet Customer with 3 linked business vehicles requesting temporary goodwill adjustment.',
    customDiscountPct: 15,
    cycles: 2
  });
  const [overrideSuccessMessage, setOverrideSuccessMessage] = useState<string | null>(null);

  // Flow Simulator Modal State
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [simulatedMember, setSimulatedMember] = useState<any>(null);

  const loadData = () => {
    setLoading(true);
    fetchCancellationMetrics()
      .then((data) => {
        setMetrics(data);
        if (data.adminConfig) {
          setAdminConfigForm(JSON.parse(JSON.stringify(data.adminConfig)));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Pre-configured Test Personas for Simulator (Specification v1.0 Section 14)
  const testPersonas = [
    {
      id: 'SIM-001',
      name: 'Nano Ceramic (Savings > Fee)',
      subtitle: '5 Washes @ SAR 89 = SAR 445 (Saved SAR 276 > SAR 169 fee)',
      customer: 'Sultan Al-Otaibi',
      phone: '+966 50 882 1932',
      car: '9840 XKR (ر ك ص ٩٨٤٠)',
      package: 'Nano Ceramic',
      packageId: 'nano',
      mrr: 169,
      washes: 5,
      apr: 169,
      segment: 'healthy',
      color: 'blue'
    },
    {
      id: 'SIM-002',
      name: 'Fresh Wash (Savings <= Fee)',
      subtitle: '1 Wash @ SAR 59 (Saved SAR 0 <= SAR 100 fee, savings card hidden)',
      customer: 'Abdullah Al-Shehri',
      phone: '+966 55 918 3341',
      car: '4410 TKB (ب ك ط ٤٤١٠)',
      package: 'Fresh Wash',
      packageId: 'fresh',
      mrr: 100,
      washes: 1,
      apr: 100,
      segment: 'light',
      color: 'cyan'
    },
    {
      id: 'SIM-003',
      name: 'Shiny Wash (Travel Freeze)',
      subtitle: 'Eligible for FREEZE_STANDARD (60 Days SAR 0)',
      customer: 'Tariq Al-Ghamdi',
      phone: '+966 55 491 8234',
      car: '8492 BTD (ب ط د ٨٤٩٢)',
      package: 'Shiny Wash',
      packageId: 'shiny',
      mrr: 69,
      washes: 3,
      apr: 69,
      segment: 'light',
      color: 'emerald'
    },
    {
      id: 'SIM-004',
      name: 'Quality Complaint (24h SLA)',
      subtitle: 'Mandatory 24h Service Recovery Ticket (No Auto Discount)',
      customer: 'Fahad Al-Dossari',
      phone: '+966 55 123 9876',
      car: '5512 KSA (أ س ك ٥٥١٢)',
      package: 'Nano Ceramic',
      packageId: 'nano',
      mrr: 169,
      washes: 2,
      apr: 169,
      segment: 'light',
      color: 'amber'
    },
    {
      id: 'SIM-005',
      name: 'Heavy Washer (14 Washes/mo)',
      subtitle: 'Automated Discount Blocked: 14 @ SAR 89 = SAR 1,246 vs SAR 169',
      customer: 'Mohammed Al-Qahtani',
      phone: '+966 54 210 9855',
      car: '1104 SRA (أ ر س ١١٠٤)',
      package: 'Nano Ceramic',
      packageId: 'nano',
      mrr: 169,
      washes: 14,
      apr: 169,
      segment: 'heavy',
      color: 'purple'
    },
    {
      id: 'SIM-006',
      name: 'Nano + Interior VIP',
      subtitle: '4 Washes @ SAR 149 = SAR 596 (Saved SAR 377 > SAR 219 fee)',
      customer: 'Dr. Walid Al-Harthy',
      phone: '+966 50 334 9912',
      car: '7721 VIP (ب ي ف ٧٧٢١)',
      package: 'Nano + Interior',
      packageId: 'nano_interior',
      mrr: 219,
      washes: 4,
      apr: 219,
      segment: 'healthy',
      color: 'pink'
    }
  ];

  const handleLaunchSimulator = (persona: any) => {
    setSimulatedMember(persona);
    setIsFlowModalOpen(true);
  };

  const handleSaveAdminConfig = async () => {
    if (!adminConfigForm) return;
    setConfigSaving(true);
    try {
      await updateAdminRetentionConfig(adminConfigForm);
      setConfigSavedToast(true);
      setTimeout(() => setConfigSavedToast(false), 3000);
      loadData();
    } catch (e) {
      console.error('Error saving admin config:', e);
    } finally {
      setConfigSaving(false);
    }
  };

  const handleResolveQualityTicket = async () => {
    if (!selectedTicket) return;
    try {
      await updateQualityRecoveryTicket({
        ticketId: selectedTicket.id,
        status: resolveForm.status,
        managerNotes: resolveForm.managerNotes,
        documentedRemedy: resolveForm.documentedRemedy,
        remedyDetails: resolveForm.remedyDetails,
        memberDecision: resolveForm.memberDecision
      });
      setTicketResolveModalOpen(false);
      loadData();
    } catch (e) {
      console.error('Error updating quality ticket:', e);
    }
  };

  const handleExecuteManagerOverride = async () => {
    try {
      await applyManagerOverride(overrideForm);
      setOverrideSuccessMessage('Manager exception granted successfully. Discount code attached.');
      setTimeout(() => {
        setOverrideSuccessMessage(null);
        setOverrideModalOpen(false);
      }, 2000);
      loadData();
    } catch (e) {
      console.error('Error executing manager override:', e);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      
      {/* Top Header & Simulation Trigger */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-wide">
                  RUSH Membership Cancellation Save Engine
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Spec v1.0 Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                MRR Protection &bull; Fixed-Period Saves &bull; Abuse Guardrails &bull; 24h Quality Ticket SLAs &bull; Section 13 Telemetry
              </p>
            </div>
          </div>
        </div>

        {/* Quick Simulator Launcher Persona Picker */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/cancel"
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, '', '/cancel');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-xs font-bold text-white shadow-md shadow-rose-950/40 flex items-center gap-1.5 transition-all"
            title="Open dedicated customer cancellation portal (/cancel)"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Open /cancel Portal</span>
          </a>

          <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5 text-amber-400" />
            Test Save Flow:
          </span>
          {testPersonas.map((p) => (
            <button
              key={p.id}
              onClick={() => handleLaunchSimulator(p)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white border border-slate-700/60 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span className={`w-2 h-2 rounded-full ${
                p.color === 'blue' ? 'bg-blue-400' :
                p.color === 'emerald' ? 'bg-emerald-400' :
                p.color === 'amber' ? 'bg-amber-400' : 'bg-purple-400'
              }`} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 5 Executive KPI Metric Cards (Specification v1.0 Section 13) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Total Attempts & Vol. Churn */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Cancel Attempts</span>
            <UserX className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-white">
              {metrics?.totalCancellationAttempts || 320}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span className="text-rose-400 font-semibold">{metrics?.cancellationCompletionRatePct || 42.8}% churned</span>
              <span>({metrics?.cancellationCompletedCount || 137})</span>
            </div>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-rose-500 h-full rounded-full" 
              style={{ width: `${metrics?.cancellationCompletionRatePct || 42.8}%` }} 
            />
          </div>
        </div>

        {/* Card 2: Save Rate & Preserved MRR */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Saves & Preserved MRR</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-emerald-400">
              {formatSAR(metrics?.retainedMrrAtDiscountedPrice || 24520)}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span className="text-emerald-400 font-semibold">{metrics?.offerAcceptanceRatePct || 46.3}% saved</span>
              <span>({metrics?.offerAcceptedCount || 148} members)</span>
            </div>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full" 
              style={{ width: `${metrics?.offerAcceptanceRatePct || 46.3}%` }} 
            />
          </div>
        </div>

        {/* Card 3: Discount Cost & ROI */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Discount Concession Cost</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-amber-400">
              {formatSAR(metrics?.discountCostTotal || 4890)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Net Preserved: <strong className="text-white">{formatSAR((metrics?.retainedMrrAtDiscountedPrice || 24520) - (metrics?.discountCostTotal || 4890))}</strong>
            </div>
          </div>
          <div className="text-[11px] text-amber-300 font-semibold mt-2">
            5.0x Preserved MRR to Cost Ratio
          </div>
        </div>

        {/* Card 4: 90-Day Durable Save Rate */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>90-Day Durable Saves</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-purple-400">
              {metrics?.durableSave90DayRatePct || 78.2}%
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              1st Normal Renewal: <strong className="text-white">{metrics?.firstNormalPriceRenewalRatePct || 84.6}%</strong>
            </div>
          </div>
          <div className="text-[11px] text-purple-300 font-semibold mt-2">
            {metrics?.repeatCancelsWithin90dCount || 14} repeat cancel locks
          </div>
        </div>

        {/* Card 5: Quality Ticket Resolution */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Quality Ticket 24h SLA</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-blue-400">
              {metrics?.qualityResolutionRetentionRatePct || 74.2}%
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {metrics?.qualityTicketsResolvedCount || 31} / {metrics?.qualityTicketsCount || 35} resolved
            </div>
          </div>
          <div className="text-[11px] text-blue-300 font-semibold mt-2">
            100% 24h SLA compliance
          </div>
        </div>

      </div>

      {/* Navigation Tab Bar */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Dimensional Analytics
        </button>

        <button
          onClick={() => setActiveTab('quality_tickets')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'quality_tickets'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Quality Ticket SLA Queue
          <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 text-[10px]">
            {metrics?.recentQualityTickets?.length || 3}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('post_save_cohorts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'post_save_cohorts'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          90-Day Post-Save Cohorts
        </button>

        <button
          onClick={() => setActiveTab('heavy_washers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'heavy_washers'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Flame className="w-4 h-4" />
          Heavy Washer Policy & Overrides
        </button>

        <button
          onClick={() => setActiveTab('admin_config')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'admin_config'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          Admin Config & Guardrails
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: OVERVIEW & DIMENSIONAL ANALYTICS (Section 13) */}
      {/* ===================================================================== */}
      {activeTab === 'overview' && metrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* APR Band Dimensional Distribution */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Customer APR Band Breakdown</h3>
                  <p className="text-xs text-slate-400">Total collected revenue / months active</p>
                </div>
                <span className="text-xs text-amber-400 font-semibold">Section 2 & 13</span>
              </div>

              <div className="space-y-3">
                {metrics.aprBandBreakdown.map((band) => (
                  <div key={band.band} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">{band.label}</span>
                      <span className="text-slate-400">
                        {band.count} members ({band.pct}%) &bull; <strong className="text-emerald-400">{formatSAR(band.mrr)} MRR</strong>
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          band.band === 'high' ? 'bg-purple-500' :
                          band.band === 'core' ? 'bg-blue-500' : 'bg-slate-500'
                        }`}
                        style={{ width: `${band.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Usage Segment Dimensional Distribution */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">30-Day Usage Segment Breakdown</h3>
                  <p className="text-xs text-slate-400">Wash velocity classification & trends</p>
                </div>
                <span className="text-xs text-amber-400 font-semibold">Section 3</span>
              </div>

              <div className="space-y-3">
                {metrics.usageSegmentBreakdown.map((seg) => (
                  <div key={seg.segment} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <span>{seg.label}</span>
                        {seg.segment === 'heavy' && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[10px]">Auto Lock</span>
                        )}
                      </span>
                      <span className="text-slate-400">
                        {seg.count} ({seg.pct}%) &bull; Avg {seg.washesAvg} washes
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          seg.segment === 'heavy' ? 'bg-rose-500' :
                          seg.segment === 'high' ? 'bg-amber-500' :
                          seg.segment === 'healthy' ? 'bg-emerald-500' :
                          seg.segment === 'light' ? 'bg-blue-500' : 'bg-slate-600'
                        }`}
                        style={{ width: `${seg.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Cancellation Reasons & Save Rates */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Exit Survey Reasons & Save Rates</h3>
                  <p className="text-xs text-slate-400">Conversion efficiency per reason category</p>
                </div>
              </div>

              <div className="space-y-3">
                {metrics.reasonBreakdown.map((r) => (
                  <div key={r.reason} className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{r.label}</span>
                        <span className="text-[10px] text-slate-400 font-arabic">{r.arabicLabel}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {r.count} requests ({r.pct}% share of cancels)
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-emerald-400">
                        {r.savedPct}% Save Rate
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {Math.round(r.count * (r.savedPct / 100))} retained
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Offer Code Performance Matrix */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Save Offer Code Performance</h3>
                  <p className="text-xs text-slate-400">Decision Matrix outcomes (Section 7 & 8)</p>
                </div>
              </div>

              <div className="space-y-3">
                {metrics.offerCodeBreakdown.map((offer) => (
                  <div key={offer.code} className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-amber-400 font-mono">
                        {offer.code}
                      </div>
                      <div className="text-xs text-slate-200 mt-0.5">
                        {offer.label}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Cost Concession: {formatSAR(offer.cost)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-emerald-400">
                        {formatSAR(offer.retainedMrr)} MRR
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {offer.acceptedCount} claims
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: PRIORITY QUALITY RECOVERY SLA CONSOLE (Section 6) */}
      {/* ===================================================================== */}
      {activeTab === 'quality_tickets' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  Priority Quality Recovery Queue (24-Hour Callback SLA)
                </h3>
                <p className="text-xs text-slate-400">
                  Customers with wash concerns are strictly excluded from automated discounts and routed directly to Branch Operations.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={ticketStatusFilter}
                  onChange={(e) => setTicketStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="all">All Ticket Statuses</option>
                  <option value="open">Open / Pending Callback</option>
                  <option value="callback_completed">Callback Completed</option>
                  <option value="resolved_retained">Resolved & Retained</option>
                  <option value="resolved_cancelled">Resolved & Cancelled</option>
                </select>
              </div>
            </div>

            {/* Quality Tickets Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Ticket ID</th>
                    <th className="py-3 px-4">Member & Plate</th>
                    <th className="py-3 px-4">Branch & Lane</th>
                    <th className="py-3 px-4">Issue Category</th>
                    <th className="py-3 px-4">Callback Due (24h SLA)</th>
                    <th className="py-3 px-4">Status & Remedy</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {(metrics?.recentQualityTickets || []).map((tkt) => (
                    <tr key={tkt.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">{tkt.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{tkt.customerName}</div>
                        <div className="text-[11px] text-slate-400">{tkt.phone} &bull; {tkt.vehiclePlate}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white">{tkt.branchName}</div>
                        <div className="text-[11px] text-slate-400">{tkt.lane || 'Express Lane'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                          {tkt.issueCategory.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-blue-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{new Date(tkt.callbackDueTime).toLocaleDateString()} {new Date(tkt.callbackDueTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tkt.status === 'open' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          tkt.status === 'resolved_retained' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {tkt.status.replace('_', ' ')}
                        </span>
                        {tkt.documentedRemedy && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Remedy: {tkt.documentedRemedy}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedTicket(tkt);
                            setResolveForm({
                              status: tkt.status as any,
                              managerNotes: tkt.managerNotes || '',
                              documentedRemedy: (tkt.documentedRemedy as any) || 'rewash',
                              remedyDetails: tkt.remedyDetails || '',
                              memberDecision: (tkt.memberDecision as any) || 'stay'
                            });
                            setTicketResolveModalOpen(true);
                          }}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          Resolve SLA
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: 90-DAY POST-SAVE COHORTS & JOURNEY TRACKER (Section 9) */}
      {/* ===================================================================== */}
      {activeTab === 'post_save_cohorts' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                90-Day Post-Save Customer Cohort Tracker
              </h3>
              <p className="text-xs text-slate-400">
                Tracks milestone delivery (Day 0 notice, Day 7 prompt, Day 21 re-engagement, Day -14 renewal warning) until first normal price renewal marks durable retention.
              </p>
            </div>

            <div className="space-y-4">
              {(metrics?.recentOfferHistories || []).map((hist) => (
                <div key={hist.id} className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{hist.customerName}</span>
                        <span className="text-xs text-slate-400 font-normal">({hist.plate})</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                          {hist.offerCode}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Accepted: {new Date(hist.acceptedAt).toLocaleDateString()} &bull; Expires: {hist.expiresAt} &bull; Special Rate: {formatSAR(hist.discountedPrice)}/mo (Normal: {formatSAR(hist.normalPrice)})
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        hist.status === 'durably_retained' ? 'bg-emerald-500/20 text-emerald-300' :
                        hist.status === 'active' ? 'bg-blue-500/20 text-blue-300' : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {hist.status === 'durably_retained' ? '✓ Durably Retained' : 'In 90-Day Journey'}
                      </span>
                    </div>
                  </div>

                  {/* 5 Milestone Step Indicators */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-700/50 text-[11px]">
                    <div className={`p-2 rounded-lg ${hist.postSaveMilestones.day0NoticeSent ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40' : 'bg-slate-900 text-slate-500'}`}>
                      <div className="font-semibold">Day 0 Confirmation</div>
                      <div>{hist.postSaveMilestones.day0NoticeSent ? '✓ Sent' : 'Pending'}</div>
                    </div>

                    <div className={`p-2 rounded-lg ${hist.postSaveMilestones.day7UsageReminderSent ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40' : 'bg-slate-900 text-slate-500'}`}>
                      <div className="font-semibold">Day 7 Perk Prompt</div>
                      <div>{hist.postSaveMilestones.day7UsageReminderSent ? '✓ Delivered' : 'Scheduled'}</div>
                    </div>

                    <div className={`p-2 rounded-lg ${hist.postSaveMilestones.day21FinalReminderSent ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40' : 'bg-slate-900 text-slate-500'}`}>
                      <div className="font-semibold">Day 21 Check-In</div>
                      <div>{hist.postSaveMilestones.day21FinalReminderSent ? '✓ Completed' : 'Pending'}</div>
                    </div>

                    <div className={`p-2 rounded-lg ${hist.postSaveMilestones.dayMinus14NoticeSent ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40' : 'bg-slate-900 text-slate-500'}`}>
                      <div className="font-semibold">Day -14 Normal Warning</div>
                      <div>{hist.postSaveMilestones.dayMinus14NoticeSent ? '✓ Notified' : 'Pending'}</div>
                    </div>

                    <div className={`p-2 rounded-lg ${hist.postSaveMilestones.firstNormalRenewalSuccess ? 'bg-purple-950/40 text-purple-300 border border-purple-800/40 font-bold' : 'bg-slate-900 text-slate-500'}`}>
                      <div className="font-semibold">1st Normal Renewal</div>
                      <div>{hist.postSaveMilestones.firstNormalRenewalSuccess ? '★ Durably Retained' : 'Cycle 4 Target'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: HEAVY WASHER POLICY & OVERRIDES (Section 5 & 10) */}
      {/* ===================================================================== */}
      {activeTab === 'heavy_washers' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-purple-400" />
                  Heavy Washer Policy & Manager Exception Console
                </h3>
                <p className="text-xs text-slate-400">
                  Members washing 10+ times per month are locked from automated discounts. Authorized managers can grant exceptions with mandatory documented rationale.
                </p>
              </div>

              <button
                onClick={() => setOverrideModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                Grant Manager Exception
              </button>
            </div>

            {/* Heavy Washer Rules Breakdown Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1.5">
                <div className="text-xs font-bold text-purple-400">Section 5 Rule 4 Lockout</div>
                <div className="text-base font-bold text-white">10+ Washes / Month</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Automated discounts are strictly blocked to protect wash tunnel unit economics and eliminate margin erosion.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1.5">
                <div className="text-xs font-bold text-blue-400">Value Affirmation Only</div>
                <div className="text-base font-bold text-white">Retail Savings Highlight</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Heavy washers are shown their massive single-wash equivalent surplus and offered a frictionless exit path.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1.5">
                <div className="text-xs font-bold text-emerald-400">Manager Override Auditing</div>
                <div className="text-base font-bold text-white">RBAC + Reason Log</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Exceptions require minimum 10-character business rationale and are permanently logged in executive audits.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: ADMIN CONFIG & GUARDRAILS (Section 10) */}
      {/* ===================================================================== */}
      {activeTab === 'admin_config' && adminConfigForm && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-amber-400" />
                  Admin Retention Policy Configuration (Section 10)
                </h3>
                <p className="text-xs text-slate-400">
                  Update customer APR thresholds, discount template parameters, freeze duration policies, and hard anti-abuse guardrails.
                </p>
              </div>

              <button
                onClick={handleSaveAdminConfig}
                disabled={configSaving}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {configSaving ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Policy Configuration
              </button>
            </div>

            {configSavedToast && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4" />
                Retention engine configuration saved and deployed across all branches!
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* APR Thresholds */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Customer APR Band Thresholds (SAR)
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Low APR Max</label>
                    <input
                      type="number"
                      value={adminConfigForm.aprThresholds.lowMax}
                      onChange={(e) => setAdminConfigForm({
                        ...adminConfigForm,
                        aprThresholds: { ...adminConfigForm.aprThresholds, lowMax: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Core APR Max</label>
                    <input
                      type="number"
                      value={adminConfigForm.aprThresholds.coreMax}
                      onChange={(e) => setAdminConfigForm({
                        ...adminConfigForm,
                        aprThresholds: { ...adminConfigForm.aprThresholds, coreMax: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">High APR Min</label>
                    <input
                      type="number"
                      value={adminConfigForm.aprThresholds.highMin}
                      onChange={(e) => setAdminConfigForm({
                        ...adminConfigForm,
                        aprThresholds: { ...adminConfigForm.aprThresholds, highMin: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Guardrails */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Hard Anti-Abuse Guardrails (Section 4)
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Min Renewals</label>
                    <input
                      type="number"
                      value={adminConfigForm.guardrails.minFullPriceRenewals}
                      onChange={(e) => setAdminConfigForm({
                        ...adminConfigForm,
                        guardrails: { ...adminConfigForm.guardrails, minFullPriceRenewals: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Cooldown Days</label>
                    <input
                      type="number"
                      value={adminConfigForm.guardrails.cooldownDays}
                      onChange={(e) => setAdminConfigForm({
                        ...adminConfigForm,
                        guardrails: { ...adminConfigForm.guardrails, cooldownDays: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Cancel Lock (d)</label>
                    <input
                      type="number"
                      value={adminConfigForm.guardrails.postSaveCancelLockDays}
                      onChange={(e) => setAdminConfigForm({
                        ...adminConfigForm,
                        guardrails: { ...adminConfigForm.guardrails, postSaveCancelLockDays: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Discount Template Matrix Config */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Section 8 Discount Offer Templates
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-700/60 space-y-2">
                  <div className="text-xs font-bold text-amber-400 font-mono">SAVE_HEALTHY_CORE</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 block">Discount %</label>
                      <input
                        type="number"
                        value={adminConfigForm.discountTemplates.SAVE_HEALTHY_CORE.discountPct}
                        onChange={(e) => setAdminConfigForm({
                          ...adminConfigForm,
                          discountTemplates: {
                            ...adminConfigForm.discountTemplates,
                            SAVE_HEALTHY_CORE: { ...adminConfigForm.discountTemplates.SAVE_HEALTHY_CORE, discountPct: Number(e.target.value) }
                          }
                        })}
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block">Cycles</label>
                      <input
                        type="number"
                        value={adminConfigForm.discountTemplates.SAVE_HEALTHY_CORE.cycles}
                        onChange={(e) => setAdminConfigForm({
                          ...adminConfigForm,
                          discountTemplates: {
                            ...adminConfigForm.discountTemplates,
                            SAVE_HEALTHY_CORE: { ...adminConfigForm.discountTemplates.SAVE_HEALTHY_CORE, cycles: Number(e.target.value) }
                          }
                        })}
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-700/60 space-y-2">
                  <div className="text-xs font-bold text-purple-400 font-mono">SAVE_HEALTHY_HIGH</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 block">Discount %</label>
                      <input
                        type="number"
                        value={adminConfigForm.discountTemplates.SAVE_HEALTHY_HIGH.discountPct}
                        onChange={(e) => setAdminConfigForm({
                          ...adminConfigForm,
                          discountTemplates: {
                            ...adminConfigForm.discountTemplates,
                            SAVE_HEALTHY_HIGH: { ...adminConfigForm.discountTemplates.SAVE_HEALTHY_HIGH, discountPct: Number(e.target.value) }
                          }
                        })}
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block">Cycles</label>
                      <input
                        type="number"
                        value={adminConfigForm.discountTemplates.SAVE_HEALTHY_HIGH.cycles}
                        onChange={(e) => setAdminConfigForm({
                          ...adminConfigForm,
                          discountTemplates: {
                            ...adminConfigForm.discountTemplates,
                            SAVE_HEALTHY_HIGH: { ...adminConfigForm.discountTemplates.SAVE_HEALTHY_HIGH, cycles: Number(e.target.value) }
                          }
                        })}
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-700/60 space-y-2">
                  <div className="text-xs font-bold text-blue-400 font-mono">SAVE_HIGH_HIGH_APR</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 block">Discount %</label>
                      <input
                        type="number"
                        value={adminConfigForm.discountTemplates.SAVE_HIGH_HIGH_APR.discountPct}
                        onChange={(e) => setAdminConfigForm({
                          ...adminConfigForm,
                          discountTemplates: {
                            ...adminConfigForm.discountTemplates,
                            SAVE_HIGH_HIGH_APR: { ...adminConfigForm.discountTemplates.SAVE_HIGH_HIGH_APR, discountPct: Number(e.target.value) }
                          }
                        })}
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block">Cycles</label>
                      <input
                        type="number"
                        value={adminConfigForm.discountTemplates.SAVE_HIGH_HIGH_APR.cycles}
                        onChange={(e) => setAdminConfigForm({
                          ...adminConfigForm,
                          discountTemplates: {
                            ...adminConfigForm.discountTemplates,
                            SAVE_HIGH_HIGH_APR: { ...adminConfigForm.discountTemplates.SAVE_HIGH_HIGH_APR, cycles: Number(e.target.value) }
                          }
                        })}
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* QUALITY TICKET RESOLUTION MODAL */}
      {/* ===================================================================== */}
      {ticketResolveModalOpen && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Resolve Quality Ticket {selectedTicket.id}</h3>
              <button onClick={() => setTicketResolveModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <div>Member: <strong className="text-white">{selectedTicket.customerName}</strong> ({selectedTicket.phone})</div>
              <div>Issue: <span className="text-amber-400">{selectedTicket.description}</span></div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Resolution Status</label>
                <select
                  value={resolveForm.status}
                  onChange={(e: any) => setResolveForm({ ...resolveForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                >
                  <option value="resolved_retained">Resolved & Member Retained (Stayed)</option>
                  <option value="resolved_cancelled">Resolved & Cancelled at Member Request</option>
                  <option value="callback_completed">Callback Completed (Pending Followup)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Documented Remedy Provided</label>
                <select
                  value={resolveForm.documentedRemedy}
                  onChange={(e: any) => setResolveForm({ ...resolveForm, documentedRemedy: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                >
                  <option value="rewash">VIP Express Re-Wash Issued</option>
                  <option value="service_credit">Service Credit / Free Detail Pass Added</option>
                  <option value="approved_discount">Manager Approved Discount Exception</option>
                  <option value="none">No Remedy / Inquiry Only</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Manager Investigation Notes</label>
                <textarea
                  value={resolveForm.managerNotes}
                  onChange={(e) => setResolveForm({ ...resolveForm, managerNotes: e.target.value })}
                  placeholder="e.g. Inspected vehicle with customer, tunnel rinse nozzles cleaned and recalibrated..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleResolveQualityTicket}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors"
              >
                Save Ticket Resolution
              </button>
              <button
                onClick={() => setTicketResolveModalOpen(false)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MANAGER EXCEPTION OVERRIDE MODAL */}
      {/* ===================================================================== */}
      {overrideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                Manager Exception Override (Heavy Washer / Special Case)
              </h3>
              <button onClick={() => setOverrideModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {overrideSuccessMessage && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold">
                {overrideSuccessMessage}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Manager Authorized Role / Title</label>
                <input
                  type="text"
                  value={overrideForm.managerRole}
                  onChange={(e) => setOverrideForm({ ...overrideForm, managerRole: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Custom Discount %</label>
                  <input
                    type="number"
                    value={overrideForm.customDiscountPct}
                    onChange={(e) => setOverrideForm({ ...overrideForm, customDiscountPct: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Cycles Duration</label>
                  <input
                    type="number"
                    value={overrideForm.cycles}
                    onChange={(e) => setOverrideForm({ ...overrideForm, cycles: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Mandatory Business Rationale (min 10 chars)</label>
                <textarea
                  value={overrideForm.overrideReason}
                  onChange={(e) => setOverrideForm({ ...overrideForm, overrideReason: e.target.value })}
                  placeholder="Document why this manual override is commercially justified..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleExecuteManagerOverride}
                disabled={overrideForm.overrideReason.length < 10}
                className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50"
              >
                Approve & Attach Exception Code
              </button>
              <button
                onClick={() => setOverrideModalOpen(false)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Flow Modal for Live Simulator */}
      <CancellationFlowModal
        isOpen={isFlowModalOpen}
        onClose={() => setIsFlowModalOpen(false)}
        customerData={simulatedMember}
        onSuccess={() => loadData()}
      />

    </div>
  );
};
