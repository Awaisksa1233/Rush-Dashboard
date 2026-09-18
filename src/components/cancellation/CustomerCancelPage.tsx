import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Car, 
  DollarSign, 
  Loader2, 
  ArrowRight, 
  HeartHandshake, 
  Clock, 
  Send, 
  UserX,
  ArrowLeft,
  Search,
  Check,
  Building,
  Layers,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { 
  CancellationReason, 
  CancellationSession,
  RetentionOffer
} from '../../types/dashboard';
import { formatSAR, getSingleWashPrice } from '../../services/analyticsService';
import { 
  startCancellationSession, 
  evaluateCancellationSession, 
  acceptSaveOffer, 
  confirmVoluntaryCancellation, 
  createQualityRecoveryTicket 
} from '../../services/apiClient';

interface CustomerCancelPageProps {
  onBackToDashboard?: () => void;
}

export const CustomerCancelPage: React.FC<CustomerCancelPageProps> = ({
  onBackToDashboard
}) => {
  // Navigation & Session States
  const [step, setStep] = useState<'lookup' | 'loading' | 'affirmation' | 'survey' | 'branch' | 'post_save_roadmap' | 'cancelled_result'>('loading');
  const [session, setSession] = useState<CancellationSession | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Custom Lookup inputs
  const [searchPhone, setSearchPhone] = useState('');
  const [searchPlate, setSearchPlate] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Survey Form State (Step 2)
  const [selectedReason, setSelectedReason] = useState<CancellationReason>('not_using_enough');
  const [freeformFeedback, setFreeformFeedback] = useState('');

  // Quality Ticket Form State (Section 6)
  const [ticketForm, setTicketForm] = useState({
    branchId: 'LOC-01',
    branchName: 'Al-Kharj Main Express Tunnel',
    lane: 'Lane 1 (Express)',
    washDateTime: new Date().toISOString().slice(0, 16),
    issueCategory: 'spotting_film' as const,
    description: ''
  });
  const [ticketCreated, setTicketCreated] = useState<any>(null);

  // 90-Day Post-Save Roadmap State
  const [postSaveRoadmap, setPostSaveRoadmap] = useState<any[]>([]);

  // Active Archetype ID State for immediate UI reactivity
  const [activeArchetypeId, setActiveArchetypeId] = useState<string>('DEMO-01');

  // 6 Pre-configured Personas for instant testing of all logics
  const demoPersonas: {
    id: string;
    title: string;
    badge: string;
    customer: string;
    phone: string;
    car: string;
    pkg: string;
    pkgId: string;
    price: number;
    washes: number;
    defaultReason: CancellationReason;
    allowedReasons: CancellationReason[];
  }[] = [
    {
      id: 'DEMO-01',
      title: 'Nano Ceramic (Savings > Fee)',
      badge: '5 washes @ 89 SAR = 445 SAR retail (Saved 276 SAR > 169 SAR fee)',
      customer: 'Sultan Al-Otaibi',
      phone: '+966508821932',
      car: '9840 XKR',
      pkg: 'Nano Ceramic',
      pkgId: 'nano',
      price: 169,
      washes: 5,
      defaultReason: 'not_using_enough',
      allowedReasons: ['not_using_enough', 'price_budget', 'other']
    },
    {
      id: 'DEMO-02',
      title: 'Fresh Wash (Savings <= Fee)',
      badge: '1 wash @ 59 SAR = 59 SAR retail (Saved 0 SAR <= 100 SAR fee)',
      customer: 'Abdullah Al-Shehri',
      phone: '+966559183341',
      car: '4410 TKB',
      pkg: 'Fresh Wash',
      pkgId: 'fresh',
      price: 100,
      washes: 1,
      defaultReason: 'price_budget',
      allowedReasons: ['price_budget', 'not_using_enough', 'moved_or_sold_vehicle', 'other']
    },
    {
      id: 'DEMO-03',
      title: 'Traveler / Seasonal Absence',
      badge: 'Eligible for FREEZE_STANDARD (60 Days @ 0 SAR)',
      customer: 'Tariq Al-Ghamdi',
      phone: '+966554918234',
      car: '8492 BTD',
      pkg: 'Shiny Wash',
      pkgId: 'shiny',
      price: 69,
      washes: 3,
      defaultReason: 'travel_temporary_absence',
      allowedReasons: ['travel_temporary_absence', 'moved_or_sold_vehicle', 'other']
    },
    {
      id: 'DEMO-04',
      title: 'Quality Issue (24h SLA)',
      badge: 'Mandatory 24h SLA Ticket (Strictly 0 Automated Discount)',
      customer: 'Fahad Al-Dossari',
      phone: '+966551239876',
      car: '5512 KSA',
      pkg: 'Nano Ceramic',
      pkgId: 'nano',
      price: 169,
      washes: 2,
      defaultReason: 'quality_complaint',
      allowedReasons: ['quality_complaint', 'other']
    },
    {
      id: 'DEMO-05',
      title: 'Heavy Washer (14 Washes/mo)',
      badge: '14 @ 89 SAR = 1,246 SAR retail (Auto Discount Blocked by Heavy Policy)',
      customer: 'Mohammed Al-Qahtani',
      phone: '+966542109855',
      car: '1104 SRA',
      pkg: 'Nano Ceramic',
      pkgId: 'nano',
      price: 169,
      washes: 14,
      defaultReason: 'not_using_enough',
      allowedReasons: ['not_using_enough', 'moved_or_sold_vehicle', 'price_budget', 'other']
    },
    {
      id: 'DEMO-06',
      title: 'VIP Nano + Interior Clean',
      badge: '4 washes @ 149 SAR = 596 SAR retail (Saved 377 SAR > 219 SAR fee)',
      customer: 'Dr. Walid Al-Harthy',
      phone: '+966503349912',
      car: '7721 VIP',
      pkg: 'Nano + Interior',
      pkgId: 'nano_interior',
      price: 219,
      washes: 4,
      defaultReason: 'price_budget',
      allowedReasons: ['price_budget', 'travel_temporary_absence', 'quality_complaint', 'other']
    }
  ];

  // Helper to generate full realistic session for instant archetype switching
  const createSessionFromArchetype = (p: typeof demoPersonas[0]): CancellationSession => {
    const singleWashPrice = getSingleWashPrice(p.pkgId || p.pkg);
    const lastPaidPrice = p.price;
    const washCount = p.washes;
    const retailWashValue = washCount * singleWashPrice;
    const periodSavings = Math.max(0, retailWashValue - lastPaidPrice);
    const isSavingGreaterThanMembership = periodSavings > lastPaidPrice;
    const usageSegment = washCount === 0 ? 'inactive' : washCount <= 3 ? 'light' : washCount <= 6 ? 'healthy' : washCount <= 9 ? 'high' : 'heavy';
    const isHeavy = usageSegment === 'heavy';
    const aprBand = p.price < 130 ? 'low' : p.price >= 200 ? 'high' : 'core';

    return {
      id: `SES-PORTAL-${p.id}`,
      membershipId: p.id,
      customerId: `CUST-${p.id}`,
      customerName: p.customer,
      phone: p.phone,
      vehiclePlate: p.car,
      packageId: p.pkgId,
      packageName: p.pkg,
      normalPrice: p.price,
      initiatedAt: new Date().toISOString(),
      channel: 'portal',
      customerApr: p.price,
      aprBand,
      usageLast30Days: washCount,
      usagePrevious30Days: Math.max(1, Math.round(washCount * 0.8)),
      usageSegment,
      usageTrend: 'rising',
      totalWashesSinceJoining: washCount * 3 + 1,
      monthsSinceJoining: 4,
      totalRevenueCollected: p.price * 4,
      singleWashPrice,
      lastPaidMembershipPrice: lastPaidPrice,
      retailWashValueLastPeriod: retailWashValue,
      lastPeriodSavingsSar: periodSavings,
      isSavingGreaterThanMembership,
      realRetailSavingsSar: periodSavings,
      eligibility: {
        eligibleForAutomatedDiscount: !isHeavy,
        blockingReasons: isHeavy ? ['Heavy Washer Policy: Members washing 10+ times/mo are not eligible for automated discounts. Retail value reminder & cancellation path presented.'] : [],
        monitoringFlags: [],
        evaluatedAt: new Date().toISOString(),
        guardDetails: {
          twoRenewalsPassed: true,
          cooldown180dPassed: true,
          noActivePromoOrFreeze: true,
          noUnresolvedDispute: true,
          noCancelWithin90dOfSave: true,
          activeRecurringArrangement: true,
          noFraudFlag: true
        }
      },
      offer: p.defaultReason === 'travel_temporary_absence' ? {
        code: 'FREEZE_STANDARD',
        title: 'Freeze Membership for 60 Days (SAR 0/mo)',
        arabicTitle: 'إيقاف مؤقت للاشتراك لمدة شهرين بدون رسوم',
        description: 'Keep your car registered on file with zero charges. Automatically reactivates after 60 days.',
        badgeText: 'Highest Save Rate (74%)',
        packageId: p.pkgId,
        packageName: p.pkg,
        discountType: 'freeze',
        discountValue: 0,
        billingCycles: 2,
        normalPrice: p.price,
        discountedPrice: 0,
        estimatedSavingsSar: p.price * 2,
        preservesMrrSar: p.price,
        nextRenewalDate: '2026-09-30',
        returnToNormalDate: '2026-11-30',
        expiresAt: new Date(Date.now() + 2 * 3600000).toISOString()
      } : {
        code: 'SAVE_HEALTHY_CORE',
        title: '20% Discount for Next 3 Billing Cycles',
        arabicTitle: 'خصم 20٪ لأول 3 دورات تجديد',
        description: `Pay SAR ${Math.round(p.price * 0.8)}/mo for 3 billing cycles. Automatically resumes standard SAR ${p.price}/mo on 2026-12-30.`,
        badgeText: 'Curated Save Offer',
        packageId: p.pkgId,
        packageName: p.pkg,
        discountType: 'percentage',
        discountValue: 20,
        billingCycles: 3,
        normalPrice: p.price,
        discountedPrice: Math.round(p.price * 0.8),
        estimatedSavingsSar: Math.round(p.price * 0.2) * 3,
        preservesMrrSar: Math.round(p.price * 0.8),
        nextRenewalDate: '2026-09-30',
        returnToNormalDate: '2026-12-30',
        expiresAt: new Date(Date.now() + 2 * 3600000).toISOString()
      },
      outcome: 'started'
    };
  };

  // Instant Archetype Switcher Handler
  const handleSelectArchetype = (p: typeof demoPersonas[0]) => {
    setActiveArchetypeId(p.id);
    setStep('affirmation');
    setTicketCreated(null);
    setFreeformFeedback('');
    setSelectedReason(p.defaultReason || 'not_using_enough');
    
    // Immediately set reactive session in React DOM state
    const instantSession = createSessionFromArchetype(p);
    setSession(instantSession);

    // Call backend asynchronously to ensure session is recorded on server
    startCancellationSession({
      memberId: p.id,
      phone: p.phone,
      searchPlate: p.car,
      channel: 'portal'
    }).then(res => {
      if (res && res.session && res.session.membershipId === p.id) {
        setSession(res.session);
      }
    }).catch(e => {
      console.warn('Backend start session sync error:', e);
    });
  };

  // Initialize from URL Query Params or default to DEMO-01
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const memberId = urlParams.get('memberId');
    const phone = urlParams.get('phone');
    const plate = urlParams.get('plate');

    if (memberId) {
      const match = demoPersonas.find(p => p.id.toLowerCase() === memberId.toLowerCase());
      if (match) {
        handleSelectArchetype(match);
        return;
      }
    }
    if (phone) {
      const match = demoPersonas.find(p => p.phone.includes(phone) || phone.includes(p.phone));
      if (match) {
        handleSelectArchetype(match);
        return;
      }
    }

    // Default to DEMO-01
    handleSelectArchetype(demoPersonas[0]);
  }, []);

  // Archetype reasons mapping & dynamic telemetry helper
  const ARCHETYPE_REASONS: Record<string, CancellationReason[]> = {
    'DEMO-01': ['not_using_enough', 'price_budget', 'other'],
    'DEMO-02': ['price_budget', 'not_using_enough', 'moved_or_sold_vehicle', 'other'],
    'DEMO-03': ['travel_temporary_absence', 'moved_or_sold_vehicle', 'other'],
    'DEMO-04': ['quality_complaint', 'other'],
    'DEMO-05': ['not_using_enough', 'moved_or_sold_vehicle', 'price_budget', 'other'],
    'DEMO-06': ['price_budget', 'travel_temporary_absence', 'quality_complaint', 'other']
  };

  const getDynamicReasonsForSession = (s?: CancellationSession | null): CancellationReason[] => {
    if (!s) return ['not_using_enough', 'price_budget', 'travel_temporary_absence', 'other'];
    if (s.membershipId && ARCHETYPE_REASONS[s.membershipId]) return ARCHETYPE_REASONS[s.membershipId];
    if (s.usageLast30Days >= 10) return ['not_using_enough', 'moved_or_sold_vehicle', 'price_budget', 'other'];
    if (s.customerApr >= 200) return ['price_budget', 'travel_temporary_absence', 'quality_complaint', 'other'];
    if (s.usageLast30Days <= 1) return ['price_budget', 'not_using_enough', 'moved_or_sold_vehicle', 'other'];
    return ['not_using_enough', 'price_budget', 'travel_temporary_absence', 'other'];
  };

  const loadMemberSession = async (lookup: { memberId?: string; phone?: string; searchPlate?: string }) => {
    setStep('loading');
    setLookupError(null);
    setTicketCreated(null);
    setFreeformFeedback('');

    try {
      const res = await startCancellationSession({
        ...lookup,
        channel: 'portal'
      });
      if (res && res.session) {
        setSession(res.session);
        const dynamicReasons = getDynamicReasonsForSession(res.session);
        setSelectedReason(dynamicReasons[0] || 'not_using_enough');
        setStep('affirmation');
      } else {
        setLookupError('Member subscription not found. Please verify your phone or license plate.');
        setStep('lookup');
      }
    } catch (e: any) {
      console.warn('Session start fallback:', e);
      const p = demoPersonas[0];
      handleSelectArchetype(p);
    }
  };

  // Survey reason catalog
  const surveyReasons: { id: CancellationReason; label: string; arabic: string; icon: string; detail: string }[] = [
    { 
      id: 'not_using_enough', 
      label: "I'm not using it often enough", 
      arabic: 'عدم استخدام الغسيل بشكل كافٍ', 
      icon: '⏳',
      detail: 'Felt I didn\'t make full use of the monthly unlimited washes'
    },
    { 
      id: 'travel_temporary_absence', 
      label: "Traveling or temporary absence", 
      arabic: 'سفر أو غياب مؤقت عن المنطقة', 
      icon: '✈️',
      detail: 'Away on vacation, work travel, or seasonal hiatus'
    },
    { 
      id: 'price_budget', 
      label: "Too expensive / Tightening budget", 
      arabic: 'السعر مرتفع / ترشيد الميزانية الشخصية', 
      icon: '💰',
      detail: 'Looking to reduce recurring monthly expenses'
    },
    { 
      id: 'quality_complaint', 
      label: "Wash quality or tunnel equipment issue", 
      arabic: 'ملاحظة على جودة الغسيل أو أداء النفق', 
      icon: '⭐',
      detail: 'Water spots, incomplete drying, wheel cleaner, or staff service'
    },
    { 
      id: 'moved_or_sold_vehicle', 
      label: "Sold vehicle or moved away", 
      arabic: 'الانتقال خارج النطاق أو بيع المركبة', 
      icon: '🚗',
      detail: 'Vehicle changed or relocated away from RUSH branch locations'
    },
    { 
      id: 'other', 
      label: "Other reason", 
      arabic: 'سبب آخر', 
      icon: '📝',
      detail: 'Please tell us how we can improve'
    }
  ];

  // Handle Survey Submission (Evaluate Guards & Route to Step 3 Branch)
  const handleSurveySubmit = async () => {
    if (!session) return;
    setIsProcessing(true);

    try {
      const evalRes = await evaluateCancellationSession({
        sessionId: session.id,
        reason: selectedReason,
        freeText: freeformFeedback,
        memberId: session.membershipId,
        phone: session.phone,
        searchPlate: session.vehiclePlate
      });

      setSession(evalRes.session);
      setStep('branch');
    } catch (e) {
      console.error('Error evaluating cancellation reason:', e);
      setStep('branch');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Offer Acceptance (Step 3 -> Step 4 Post-Save Roadmap)
  const handleAcceptOffer = async () => {
    if (!session || !session.offer) return;
    setIsProcessing(true);

    try {
      const res = await acceptSaveOffer({
        sessionId: session.id,
        offerCode: session.offer.code
      });

      setPostSaveRoadmap(res.postSaveRoadmap || [
        { day: 0, title: 'Day 0 Confirmation', status: 'delivered', detail: 'Confirmation sent via SMS with your locked rate.' },
        { day: 7, title: 'Day 7 Usage Prompt', status: 'scheduled', detail: 'Notification reminding you of active wash perks.' },
        { day: 21, title: 'Day 21 Check-In', status: 'scheduled', detail: 'Quick quality satisfaction check-in.' },
        { day: 76, title: 'Day -14 Normal Rate Warning', status: 'scheduled', detail: `Advance notice before standard SAR ${session.offer.normalPrice}/mo rate resumes.` },
        { day: 90, title: 'Durable Member Attainment', status: 'pending', detail: 'Thank you for being a valued RUSH member!' }
      ]);

      setStep('post_save_roadmap');
    } catch (e) {
      console.error('Error accepting retention offer:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Frictionless Cancellation Confirmation
  const handleConfirmCancellation = async () => {
    if (!session) return;
    setIsProcessing(true);

    try {
      await confirmVoluntaryCancellation({
        sessionId: session.id,
        reason: selectedReason,
        freeText: freeformFeedback,
        memberId: session.membershipId,
        customerName: session.customerName,
        phone: session.phone,
        plate: session.vehiclePlate,
        packageName: session.packageName,
        mrr: session.normalPrice
      });

      setStep('cancelled_result');
    } catch (e) {
      console.error('Error confirming cancellation:', e);
      setStep('cancelled_result');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Quality Recovery Ticket Creation (Section 6)
  const handleCreateQualityTicket = async () => {
    if (!session) return;
    setIsProcessing(true);

    try {
      const res = await createQualityRecoveryTicket({
        sessionId: session.id,
        membershipId: session.membershipId,
        customerName: session.customerName,
        phone: session.phone,
        vehiclePlate: session.vehiclePlate,
        branchId: ticketForm.branchId,
        branchName: ticketForm.branchName,
        lane: ticketForm.lane,
        washDateTime: ticketForm.washDateTime,
        issueCategory: ticketForm.issueCategory,
        description: ticketForm.description || freeformFeedback || 'Quality issue reported in /cancel portal.'
      });

      setTicketCreated(res.ticket);
    } catch (e) {
      console.error('Error creating quality ticket:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Portal Banner */}
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#c91e2f] text-white flex items-center justify-center font-black text-lg shadow-md shadow-rose-950/40">
              R
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white tracking-wide text-base">RUSH رش</span>
                <span className="text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-md">
                  Customer Portal /cancel
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Membership Self-Service & Cancellation Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Management Dashboard
              </button>
            )}
          </div>
        </div>

        {/* Demo Archetype Switcher Bar */}
        <div className="bg-slate-900 border-t border-slate-800/80 px-4 py-2 overflow-x-auto">
          <div className="max-w-6xl mx-auto flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold flex items-center gap-1 flex-shrink-0 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Test Archetypes:
            </span>
            <div className="flex items-center gap-1.5">
              {demoPersonas.map((p) => {
                const isActive = activeArchetypeId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectArchetype(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 scale-[1.02]'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white hover:border-slate-600'
                    }`}
                    title={p.badge}
                  >
                    {p.title}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">

        {/* ================================================================= */}
        {/* LOADING STATE */}
        {/* ================================================================= */}
        {step === 'loading' && (
          <div className="py-24 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto" />
            <h3 className="text-lg font-bold text-white">Loading Subscription Information...</h3>
            <p className="text-xs text-slate-400">Verifying customer telemetry and membership records on MongoDB Atlas</p>
          </div>
        )}

        {/* ================================================================= */}
        {/* LOOKUP STATE */}
        {/* ================================================================= */}
        {step === 'lookup' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-2">
                <Car className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-white">Lookup Your RUSH Membership</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Enter your mobile number or vehicle plate registered with your unlimited wash subscription.
              </p>
            </div>

            {lookupError && (
              <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{lookupError}</span>
              </div>
            )}

            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Registered Mobile Number</label>
                <input
                  type="text"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  placeholder="e.g. +966508821932 or 0508821932"
                  className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Vehicle Plate Number (Optional)</label>
                <input
                  type="text"
                  value={searchPlate}
                  onChange={(e) => setSearchPlate(e.target.value)}
                  placeholder="e.g. 9840 XKR"
                  className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={() => loadMemberSession({ phone: searchPhone, searchPlate })}
                disabled={!searchPhone && !searchPlate}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                Find My Membership
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 1: VALUE REMINDER & MEMBERSHIP SUMMARY (Section 5 Rule 1) */}
        {/* ================================================================= */}
        {step === 'affirmation' && session && (() => {
          const singleWashPrice = session.singleWashPrice || getSingleWashPrice(session.packageId || session.packageName);
          const lastPaidPrice = session.lastPaidMembershipPrice || session.normalPrice;
          const washCountInPeriod = session.usageLast30Days;
          const retailWashValue = session.retailWashValueLastPeriod || (washCountInPeriod * singleWashPrice);
          const periodSavings = session.lastPeriodSavingsSar !== undefined 
            ? session.lastPeriodSavingsSar 
            : Math.max(0, retailWashValue - lastPaidPrice);
          const showSavings = session.isSavingGreaterThanMembership !== undefined
            ? session.isSavingGreaterThanMembership
            : periodSavings > lastPaidPrice;

          return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl animate-fadeIn">
              {/* Step indicator */}
              <div className="text-center space-y-2">
                <span className="px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Step 1 of 3: Membership Summary
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Before you cancel, here is your RUSH journey
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
                  Member: <strong className="text-white">{session.customerName}</strong> &bull; Plate: <strong className="text-amber-400">{session.vehiclePlate}</strong>
                </p>
              </div>

              {/* 3-Card Value Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Card 1: Washes */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 text-center">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-2">
                    <Car className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-black text-white">{session.totalWashesSinceJoining}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Washes Completed</div>
                  <div className="text-[11px] text-blue-400 font-semibold mt-1">
                    ({session.usageLast30Days} washes in last 30 days)
                  </div>
                </div>

                {/* Card 2: Retail Savings - ONLY SHOWN IF SAVING > LAST PAID MEMBERSHIP PRICE */}
                {showSavings ? (
                  <div className="bg-emerald-950/30 border-2 border-emerald-500/50 rounded-xl p-4 text-center relative overflow-hidden shadow-lg shadow-emerald-950/40">
                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-black rounded uppercase tracking-wider border border-emerald-500/40">
                      Savings &gt; Fee
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-black text-emerald-400">{formatSAR(periodSavings)}</div>
                    <div className="text-xs text-emerald-200 mt-0.5 font-bold">Saved on Last Membership</div>
                    <div className="text-[10px] text-emerald-400/90 mt-1">
                      {washCountInPeriod} washes @ {singleWashPrice} SAR = {formatSAR(retailWashValue)} vs {formatSAR(lastPaidPrice)} fee
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 text-center">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-2">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-black text-white">Unlimited</div>
                    <div className="text-xs text-slate-400 mt-0.5">{session.packageName} Clean Pass</div>
                    <div className="text-[11px] text-slate-400 mt-1">Single wash is {formatSAR(singleWashPrice)}/visit</div>
                  </div>
                )}

                {/* Card 3: Tenure & Locked Price */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 text-center">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto mb-2">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-black text-white">{session.monthsSinceJoining} mo</div>
                  <div className="text-xs text-slate-400 mt-0.5">Active Member Tenure</div>
                  <div className="text-[11px] text-purple-400 font-semibold mt-1">
                    {formatSAR(lastPaidPrice)} / month locked
                  </div>
                </div>
              </div>

              {/* Single Wash Retail Pricing Callout Notice */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 space-y-1">
                  <p className="font-bold text-white">Unlimited Clean Car Protection</p>
                  <p className="text-slate-400 leading-relaxed">
                    {showSavings
                      ? `Your last membership saved you ${formatSAR(periodSavings)} compared to single washes (${washCountInPeriod} washes at ${singleWashPrice} SAR single-wash retail price). Cancelling means paying ${singleWashPrice} SAR per single wash on your next visit.`
                      : `Cancelling your subscription means losing your locked-in monthly price of ${formatSAR(lastPaidPrice)}. Single express tunnel washes for ${session.packageName} are priced at ${singleWashPrice} SAR per visit without an active membership plan.`
                    }
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => {
                    alert('Thank you for staying with RUSH! Your unlimited membership remains active.');
                    if (onBackToDashboard) onBackToDashboard();
                  }}
                  className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <HeartHandshake className="w-4 h-4" />
                  I Love RUSH, Keep My Membership
                </button>
                <button
                  onClick={() => setStep('survey')}
                  className="py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                  Continue Cancellation
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* ================================================================= */}
        {/* STEP 2: SINGLE-SELECT CANCELLATION SURVEY (Archetype-Tailored) */}
        {/* ================================================================= */}
        {step === 'survey' && session && (() => {
          const activePersona = demoPersonas.find(p => p.id === activeArchetypeId);
          const allowedReasonIds = activePersona?.allowedReasons 
            || (session.membershipId && ARCHETYPE_REASONS[session.membershipId]) 
            || getDynamicReasonsForSession(session);
          const visibleSurveyReasons = surveyReasons.filter(r => allowedReasonIds.includes(r.id));

          return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl animate-fadeIn">
              <div className="text-center space-y-1.5">
                <span className="px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Step 2 of 3: Reason for Leaving
                </span>
                <h2 className="text-2xl font-extrabold text-white">
                  Help us understand why you want to cancel
                </h2>
                <p className="text-xs text-slate-400">
                  Please select your primary reason so we can tailor the best solution or process your request.
                </p>
                {activePersona && (
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-slate-300 shadow-sm">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Tailored options for: <strong className="text-amber-400">{activePersona.title}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Radio Options List (Filtered by Archetype) */}
              <div className="space-y-2.5">
                {visibleSurveyReasons.map((r) => {
                  const isSelected = selectedReason === r.id;
                  return (
                    <label
                      key={r.id}
                      onClick={() => setSelectedReason(r.id)}
                      className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-amber-500/10 border-amber-500/60 text-white shadow-md shadow-amber-500/10' 
                          : 'bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-800/80 hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancellationReason"
                        checked={isSelected}
                        onChange={() => setSelectedReason(r.id)}
                        className="mt-1 text-amber-500 focus:ring-amber-500 h-4 w-4 bg-slate-900 border-slate-700"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold flex items-center gap-2">
                            <span>{r.icon}</span>
                            {r.label}
                          </span>
                          <span className="text-xs text-slate-400 font-arabic">{r.arabic}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{r.detail}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Optional Comments */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Additional details or feedback (optional):</span>
                  <span className="text-[11px] text-slate-500">ملاحظات إضافية</span>
                </label>
                <textarea
                  value={freeformFeedback}
                  onChange={(e) => setFreeformFeedback(e.target.value)}
                  placeholder="Tell us what we could have done better or your upcoming travel schedule..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <button
                  onClick={() => setStep('affirmation')}
                  className="py-2.5 px-4 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition-colors"
                >
                  &larr; Back to Summary
                </button>
                <button
                  onClick={handleSurveySubmit}
                  disabled={isProcessing}
                  className="py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* ================================================================= */}
        {/* STEP 3: DYNAMIC BRANCHING ENGINE */}
        {/* ================================================================= */}
        {step === 'branch' && session && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl animate-fadeIn">

            {/* BRANCH A: QUALITY COMPLAINT (Section 6 Service Recovery Ticket) */}
            {selectedReason === 'quality_complaint' && (
              <div className="space-y-5">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Priority Service Recovery Ticket</h4>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                      Under RUSH quality policy, we do not issue automated discounts for wash concerns. Instead, our <strong>Branch Operations Manager</strong> will personally review your vehicle wash logs and contact you within <strong>24 hours</strong>.
                    </p>
                  </div>
                </div>

                {!ticketCreated ? (
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
                    <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Wash Incident Details
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Branch Location</label>
                        <select
                          value={ticketForm.branchId}
                          onChange={(e) => {
                            const name = e.target.value === 'LOC-01' ? 'Al-Kharj Main Express Tunnel' : e.target.value === 'LOC-02' ? 'Riyadh Ring Road Branch' : 'Dammam Highway Hub';
                            setTicketForm({ ...ticketForm, branchId: e.target.value, branchName: name });
                          }}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                        >
                          <option value="LOC-01">Al-Kharj Main Express Tunnel</option>
                          <option value="LOC-02">Riyadh Ring Road Branch</option>
                          <option value="LOC-03">Dammam Highway Hub</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Specific Issue Category</label>
                        <select
                          value={ticketForm.issueCategory}
                          onChange={(e: any) => setTicketForm({ ...ticketForm, issueCategory: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                        >
                          <option value="spotting_film">Water Spots / Film Residue</option>
                          <option value="dryer_performance">Dryer / Blower Performance</option>
                          <option value="tunnel_equipment">Tunnel Equipment / Wheel Wash</option>
                          <option value="staff_service">Staff / Bay Service Issue</option>
                          <option value="other">Other Wash Quality Issue</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Vehicle Plate</label>
                        <input
                          type="text"
                          value={session.vehiclePlate}
                          disabled
                          className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-400"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Approximate Wash Date / Time</label>
                        <input
                          type="datetime-local"
                          value={ticketForm.washDateTime}
                          onChange={(e) => setTicketForm({ ...ticketForm, washDateTime: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">Describe What Happened</label>
                      <textarea
                        value={ticketForm.description}
                        onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                        placeholder="e.g. Leftover soap residue on hood, blower shut down early..."
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                      <button
                        onClick={handleCreateQualityTicket}
                        disabled={isProcessing}
                        className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Submit Quality Ticket & Request Manager Callback (24h SLA)
                      </button>
                      <button
                        onClick={handleConfirmCancellation}
                        disabled={isProcessing}
                        className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 border border-slate-700 hover:border-rose-800 text-xs font-bold transition-colors"
                      >
                        Decline & Cancel Anyway
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h4 className="text-lg font-bold text-white">Quality Ticket Logged Successfully</h4>
                    <p className="text-xs text-slate-300 max-w-md mx-auto">
                      Ticket ID: <strong className="text-emerald-400">{ticketCreated.id}</strong>. Your branch operations lead has been dispatched. A 24-hour resolution SLA has been locked in.
                    </p>
                    <button
                      onClick={() => {
                        if (onBackToDashboard) onBackToDashboard();
                      }}
                      className="py-2.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all"
                    >
                      Keep Membership Active & Finish
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* BRANCH B: HEAVY WASHER LOCKOUT (Section 5 Rule 4) */}
            {selectedReason !== 'quality_complaint' && session.usageSegment === 'heavy' && (() => {
              const singleWashPrice = session.singleWashPrice || getSingleWashPrice(session.packageId || session.packageName);
              const lastPaidPrice = session.lastPaidMembershipPrice || session.normalPrice;
              const retailTotal = session.usageLast30Days * singleWashPrice;
              const retailSavings = Math.max(0, retailTotal - lastPaidPrice);

              return (
                <div className="space-y-5">
                  <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-6 space-y-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-white">VIP Heavy Washer Protection</h3>
                    <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                      You are one of our highest-volume members, completing <strong>{session.usageLast30Days} washes</strong> in the last 30 days. Under single-wash retail pricing ({singleWashPrice} SAR/wash for {session.packageName}), this volume would cost <strong>{formatSAR(retailTotal)}</strong>, saving you over <strong>{formatSAR(retailSavings)}</strong> compared to your {formatSAR(lastPaidPrice)} monthly membership fee.
                    </p>
                    <div className="inline-block px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 text-[11px] border border-purple-500/20 font-semibold">
                      Automated save discounts are not applicable to 10+ wash power users
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => {
                        alert('Thank you for staying with RUSH!');
                        if (onBackToDashboard) onBackToDashboard();
                      }}
                      className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <HeartHandshake className="w-4 h-4" />
                      Keep My Power-User Membership
                    </button>
                    <button
                      onClick={handleConfirmCancellation}
                      disabled={isProcessing}
                      className="py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 text-xs font-bold transition-colors"
                    >
                      Confirm Cancellation
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* BRANCH C: INELIGIBLE (7 Hard Guards Triggered) */}
            {selectedReason !== 'quality_complaint' && session.usageSegment !== 'heavy' && !session.eligibility.eligibleForAutomatedDiscount && (
              <div className="space-y-5">
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2.5 text-amber-400">
                    <ShieldAlert className="w-5 h-5" />
                    <h4 className="text-sm font-bold text-white">Discount Ineligibility Notice</h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Your account is currently not eligible for automated promotional discounts based on our membership terms:
                  </p>
                  <ul className="space-y-1.5 pl-2 text-xs text-slate-400">
                    {session.eligibility.blockingReasons.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-rose-400">&bull;</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => {
                      alert('Membership active.');
                      if (onBackToDashboard) onBackToDashboard();
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
                  >
                    Keep Membership Active
                  </button>
                  <button
                    onClick={handleConfirmCancellation}
                    disabled={isProcessing}
                    className="py-3 px-5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-bold transition-colors"
                  >
                    Proceed with Cancellation
                  </button>
                </div>
              </div>
            )}

            {/* BRANCH D: EXACTLY ONE PRIMARY RETENTION OFFER (Section 7 & 8) */}
            {selectedReason !== 'quality_complaint' && session.usageSegment !== 'heavy' && session.eligibility.eligibleForAutomatedDiscount && session.offer && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <span className="px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {session.offer.badgeText || 'Exclusive Member Retention Offer'}
                  </span>
                  <h2 className="text-2xl font-black text-white mt-1">
                    {session.offer.title}
                  </h2>
                  <p className="text-xs text-slate-400 font-arabic">
                    {session.offer.arabicTitle}
                  </p>
                </div>

                {/* Single Offer Presentation Card */}
                <div className="bg-gradient-to-b from-slate-800/90 to-slate-900 border-2 border-emerald-500/40 rounded-2xl p-5 space-y-4 shadow-xl shadow-emerald-950/30">
                  
                  {/* Price Comparison Row */}
                  <div className="flex items-center justify-between p-4 bg-slate-950/60 rounded-xl border border-slate-800">
                    <div>
                      <div className="text-xs text-slate-400">Regular Monthly Fee</div>
                      <div className="text-base font-semibold text-slate-400 line-through">
                        {formatSAR(session.offer.normalPrice)} / mo
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
                        {session.offer.discountType === 'freeze' ? 'Zero Fee Pause' : 'Your Special Rate'}
                      </div>
                      <div className="text-2xl font-black text-emerald-400">
                        {session.offer.discountType === 'freeze' ? 'SAR 0' : formatSAR(session.offer.discountedPrice)}
                        <span className="text-xs text-slate-400 font-normal"> / month</span>
                      </div>
                    </div>
                  </div>

                  {/* Terms Breakdown */}
                  <div className="space-y-2 text-xs text-slate-300">
                    <p className="leading-relaxed">
                      {session.offer.description}
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Duration:</span>
                        <span className="font-semibold text-white">
                          {session.offer.billingCycles} Billing Cycles ({session.offer.billingCycles * 30} Days)
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Total SAR Savings:</span>
                        <span className="font-semibold text-emerald-400">
                          {formatSAR(session.offer.estimatedSavingsSar)} saved
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Next Renewal:</span>
                        <span className="font-semibold text-white">{session.offer.nextRenewalDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Returns to Standard Price:</span>
                        <span className="font-semibold text-amber-400">{session.offer.returnToNormalDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Transparent Reassurance */}
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                    <span>Transparent guarantee: Standard price resumes automatically on {session.offer.returnToNormalDate}. No cancellation penalties.</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleAcceptOffer}
                    disabled={isProcessing}
                    className="flex-1 py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Accept Offer & Keep My Washes
                  </button>
                  <button
                    onClick={handleConfirmCancellation}
                    disabled={isProcessing}
                    className="py-3.5 px-5 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 border border-slate-700 hover:border-rose-800 text-xs font-bold transition-colors"
                  >
                    Decline & Finish Cancellation
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 4: 90-DAY POST-SAVE JOURNEY ROADMAP (Section 9) */}
        {/* ================================================================= */}
        {step === 'post_save_roadmap' && session && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-black text-white">Offer Activated Successfully!</h2>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Your discounted rate for <strong className="text-white">{session.packageName}</strong> is now live on your vehicle <strong className="text-amber-400">{session.vehiclePlate}</strong>.
              </p>
            </div>

            {/* 90-Day Milestones Timeline */}
            <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                90-Day Post-Save Member Journey (Section 9)
              </h4>
              <div className="space-y-2.5">
                {postSaveRoadmap.map((m, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                      m.status === 'delivered' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{m.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                          m.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {m.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{m.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                if (onBackToDashboard) onBackToDashboard();
              }}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-colors"
            >
              Done & Return
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 5: VOLUNTARY CANCELLATION CONFIRMED (Frictionless Exit) */}
        {/* ================================================================= */}
        {step === 'cancelled_result' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 text-center shadow-2xl animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <UserX className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Cancellation Confirmed</h2>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                Your voluntary cancellation request has been processed. You can continue enjoying unlimited washes until the end of your current billing period (<strong>{session?.offer?.nextRenewalDate || 'end of current billing cycle'}</strong>).
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 text-xs text-slate-400 max-w-md mx-auto">
              No hard feelings! You can re-activate your unlimited membership anytime from the RUSH portal or at any express lane terminal.
            </div>

            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="py-2.5 px-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
              >
                Return to Dashboard
              </button>
            )}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500 bg-slate-950">
        RUSH Car Wash &bull; Customer Retention & Cancellation System v1.0 &bull; Express Tunnel Fleet
      </footer>
    </div>
  );
};
