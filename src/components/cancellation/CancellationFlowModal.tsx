import React, { useState, useEffect } from 'react';
import { 
  X, 
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
  UserX 
} from 'lucide-react';
import { 
  CancellationReason, 
  CancellationSession 
} from '../../types/dashboard';
import { formatSAR, getSingleWashPrice } from '../../services/analyticsService';
import { 
  startCancellationSession, 
  evaluateCancellationSession, 
  acceptSaveOffer, 
  confirmVoluntaryCancellation, 
  createQualityRecoveryTicket 
} from '../../services/apiClient';

interface CancellationFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId?: string;
  customerData?: {
    id: string;
    customer: string;
    phone: string;
    car: string;
    package: string;
    packageId?: string;
    mrr: number;
    renewalDate?: string;
  };
  onSuccess?: () => void;
}

export const CancellationFlowModal: React.FC<CancellationFlowModalProps> = ({
  isOpen,
  onClose,
  memberId,
  customerData,
  onSuccess
}) => {
  // Modal Steps: loading -> affirmation (Step 1) -> survey (Step 2) -> branch (Step 3: offer / quality_ticket / heavy_washer / ineligible) -> post_save_roadmap (Step 4) -> cancelled_result
  const [step, setStep] = useState<'loading' | 'affirmation' | 'survey' | 'branch' | 'post_save_roadmap' | 'cancelled_result'>('loading');
  const [session, setSession] = useState<CancellationSession | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Survey Form State (Step 2)
  const [selectedReason, setSelectedReason] = useState<CancellationReason>('not_using_enough');
  const [freeformFeedback, setFreeformFeedback] = useState('');

  // Quality Ticket Form State (Section 6)
  const [ticketForm, setTicketForm] = useState({
    branchId: 'LOC-01',
    branchName: 'Al-Kharj Main Tunnel',
    lane: 'Lane 1 (Express)',
    washDateTime: new Date().toISOString().slice(0, 16),
    issueCategory: 'spotting_film' as const,
    description: ''
  });
  const [ticketCreated, setTicketCreated] = useState<any>(null);

  // Result state
  const [postSaveRoadmap, setPostSaveRoadmap] = useState<any[]>([]);

  // Initialize Session on Open
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

  useEffect(() => {
    if (!isOpen) return;
    setStep('loading');
    setTicketCreated(null);
    setFreeformFeedback('');

    const lookupId = memberId || customerData?.id;
    const lookupPhone = customerData?.phone;
    const lookupPlate = customerData?.car;

    startCancellationSession({ memberId: lookupId, phone: lookupPhone, searchPlate: lookupPlate, channel: 'portal' })
      .then((res) => {
        setSession(res.session);
        const dynamicReasons = getDynamicReasonsForSession(res.session);
        setSelectedReason(dynamicReasons[0] || 'not_using_enough');
        setStep('affirmation');
      })
      .catch((err) => {
        console.error('Error starting cancellation session:', err);
        setSelectedReason('not_using_enough');
        setStep('affirmation');
      });
  }, [isOpen, memberId, customerData]);

  // Survey reason catalog (Specification v1.0 Section 5)
  const surveyReasons: { id: CancellationReason; label: string; arabic: string; icon: string; detail: string }[] = [
    { 
      id: 'not_using_enough', 
      label: "I'm not using it often enough", 
      arabic: 'عدم استخدام الغسيل بشكل كافٍ', 
      icon: '⏳',
      detail: 'Felt I didn\'t make full use of the monthly washes'
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

  // Handle Survey Submission (Evaluate Guards & Route)
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

  // Handle Offer Acceptance (Step 3 -> Step 4 Post-Save Journey)
  const handleAcceptOffer = async () => {
    if (!session || !session.offer) return;
    setIsProcessing(true);

    try {
      const res = await acceptSaveOffer({
        sessionId: session.id,
        offerCode: session.offer.code
      });

      setPostSaveRoadmap(res.postSaveRoadmap || [
        { day: 0, title: 'Day 0 Confirmation', status: 'delivered', detail: 'Confirmation sent via SMS with new pricing & renewal terms.' },
        { day: 7, title: 'Day 7 Usage Prompt', status: 'scheduled', detail: 'Notification reminding you of active wash perks.' },
        { day: 21, title: 'Day 21 Check-In', status: 'scheduled', detail: 'Quick satisfaction check-in.' },
        { day: 76, title: 'Day -14 Normal Rate Warning', status: 'scheduled', detail: `Advance notice before standard SAR ${session.offer.normalPrice}/mo rate resumes.` },
        { day: 90, title: 'Durable Member Attainment', status: 'pending', detail: 'Thank you for continuing your journey with RUSH.' }
      ]);

      setStep('post_save_roadmap');
      if (onSuccess) onSuccess();
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
      if (onSuccess) onSuccess();
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
        description: ticketForm.description || freeformFeedback || 'Quality issue reported in cancellation flow.'
      });

      setTicketCreated(res.ticket);
    } catch (e) {
      console.error('Error creating quality ticket:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Top Header Bar */}
        <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-wide">
                RUSH Membership Management
              </h3>
              <p className="text-xs text-slate-400">
                {session?.customerName || 'Valued Member'} &bull; {session?.vehiclePlate || 'Active Vehicle'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Multi-Step Engine */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">

          {/* ================================================================= */}
          {/* LOADING STATE */}
          {/* ================================================================= */}
          {step === 'loading' && (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
              <div>
                <h4 className="text-base font-semibold text-white">Loading Member Profile...</h4>
                <p className="text-xs text-slate-400 mt-1">Retrieving wash telemetry and subscription status</p>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 1: ACCURATE VALUE AFFIRMATION / VALUE REMINDER (Section 5 Rule 1) */}
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
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <span className="px-3 py-1 text-xs font-semibold tracking-wider uppercase rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Step 1 of 3: Membership Summary
                  </span>
                  <h2 className="text-2xl font-bold text-white">
                    Before you make a decision, here is your RUSH wash journey:
                  </h2>
                  <p className="text-sm text-slate-400 max-w-lg mx-auto">
                    Your <strong className="text-amber-400">{session.packageName}</strong> subscription gives you unlimited exterior washes and vehicle protection.
                  </p>
                </div>

                {/* Value Metrics 3-Card Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-2">
                      <Car className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-bold text-white">{session.totalWashesSinceJoining}</div>
                    <div className="text-xs text-slate-400 mt-0.5">Washes Completed</div>
                    <div className="text-[11px] text-blue-400 mt-1">({session.usageLast30Days} washes in last 30d)</div>
                  </div>

                  {/* Show savings ONLY if saving > last paid membership price */}
                  {showSavings ? (
                    <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-4 text-center relative overflow-hidden">
                      <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold rounded uppercase tracking-wider border border-emerald-500/30">
                        Savings &gt; Fee
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div className="text-2xl font-bold text-emerald-400">{formatSAR(periodSavings)}</div>
                      <div className="text-xs text-emerald-200 mt-0.5 font-semibold">Saved on Last Membership</div>
                      <div className="text-[10px] text-emerald-400/80 mt-1">
                        {washCountInPeriod} washes @ {singleWashPrice} SAR = {formatSAR(retailWashValue)} vs {formatSAR(lastPaidPrice)} fee
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-2">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="text-2xl font-bold text-white">Unlimited</div>
                      <div className="text-xs text-slate-400 mt-0.5">{session.packageName} Clean Pass</div>
                      <div className="text-[11px] text-slate-500 mt-1">Single wash is {formatSAR(singleWashPrice)}/visit</div>
                    </div>
                  )}

                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto mb-2">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-bold text-white">{session.monthsSinceJoining} mo</div>
                    <div className="text-xs text-slate-400 mt-0.5">Active Tenure</div>
                    <div className="text-[11px] text-purple-400 mt-1">{formatSAR(lastPaidPrice)} / month locked</div>
                  </div>
                </div>

                {/* Notice Box */}
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300 space-y-1">
                    <p className="font-semibold text-white">Unlimited Clean Car Protection</p>
                    <p className="text-slate-400 leading-relaxed">
                      {showSavings
                        ? `Your last membership saved you ${formatSAR(periodSavings)} compared to single washes (${washCountInPeriod} washes at ${singleWashPrice} SAR single wash pricing). Cancelling means paying single wash retail rates on every visit.`
                        : `Cancelling your subscription means losing your locked-in monthly price of ${formatSAR(lastPaidPrice)}. Single washes for ${session.packageName} are priced at ${singleWashPrice} SAR per visit without an active plan.`
                      }
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <HeartHandshake className="w-4 h-4" />
                    I Love RUSH, Keep My Membership
                  </button>
                  <button
                    onClick={() => setStep('survey')}
                    className="py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    Continue Cancellation
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ================================================================= */}
          {/* STEP 2: CANCELLATION REASON SURVEY (Archetype-Tailored) */}
          {/* ================================================================= */}
          {step === 'survey' && session && (() => {
            const allowedReasonIds = (session.membershipId && ARCHETYPE_REASONS[session.membershipId]) || getDynamicReasonsForSession(session);
            const visibleSurveyReasons = surveyReasons.filter(r => allowedReasonIds.includes(r.id));

            return (
              <div className="space-y-6">
                <div className="text-center space-y-1.5">
                  <span className="px-3 py-1 text-xs font-semibold tracking-wider uppercase rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Step 2 of 3: Reason for Leaving
                  </span>
                  <h2 className="text-xl font-bold text-white">
                    Help us understand why you want to cancel
                  </h2>
                  <p className="text-xs text-slate-400">
                    Select the primary reason so we can tailor the best solution or process your request.
                  </p>
                </div>

                {/* Radio Options List (Filtered by Archetype / Profile) */}
                <div className="space-y-2.5">
                  {visibleSurveyReasons.map((r) => {
                    const isSelected = selectedReason === r.id;
                    return (
                      <label
                        key={r.id}
                        onClick={() => setSelectedReason(r.id)}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-sm shadow-amber-500/10' 
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
                            <span className="text-sm font-semibold flex items-center gap-2">
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
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Additional details or feedback (optional):</span>
                    <span className="text-[11px] text-slate-500">ملاحظات إضافية</span>
                  </label>
                  <textarea
                    value={freeformFeedback}
                    onChange={(e) => setFreeformFeedback(e.target.value)}
                    placeholder="Tell us what we could have done better or your upcoming travel plans..."
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-800/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
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
                    className="py-2.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ================================================================= */}
          {/* STEP 3: BRANCHING ENGINE (Quality Complaint / Heavy Washer / Offer / Ineligible) */}
          {/* ================================================================= */}
          {step === 'branch' && session && (
            <div className="space-y-6">

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
                              const name = e.target.value === 'LOC-01' ? 'Al-Kharj Main Tunnel' : e.target.value === 'LOC-02' ? 'Riyadh Ring Road' : 'Dammam Highway Hub';
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
                          className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Submit Quality Ticket & Request Manager Callback (24h SLA)
                        </button>
                        <button
                          onClick={handleConfirmCancellation}
                          disabled={isProcessing}
                          className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 border border-slate-700 hover:border-rose-800 text-xs font-semibold transition-colors"
                        >
                          Decline & Cancel Anyway
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-5 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-bold text-white">Quality Ticket Logged Successfully</h4>
                      <p className="text-xs text-slate-300 max-w-md mx-auto">
                        Ticket ID: <strong className="text-emerald-400">{ticketCreated.id}</strong>. Your branch operations lead has been dispatched. A 24-hour resolution SLA has been locked in.
                      </p>
                      <button
                        onClick={onClose}
                        className="py-2.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all"
                      >
                        Keep Membership Active & Close
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
                    <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-5 space-y-3 text-center">
                      <div className="w-12 h-12 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-white">VIP Heavy Washer Protection</h3>
                      <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                        You are one of our highest-volume members, completing <strong>{session.usageLast30Days} washes</strong> in the last 30 days. Under single-wash retail pricing ({singleWashPrice} SAR/wash for {session.packageName}), this volume would cost <strong>{formatSAR(retailTotal)}</strong>, saving you over <strong>{formatSAR(retailSavings)}</strong> compared to your {formatSAR(lastPaidPrice)} monthly membership fee.
                      </p>
                      <div className="inline-block px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 text-[11px] border border-purple-500/20 font-semibold">
                        Automated save discounts are not applicable to 10+ wash power users
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <HeartHandshake className="w-4 h-4" />
                        Keep My Power-User Membership
                      </button>
                      <button
                        onClick={handleConfirmCancellation}
                        disabled={isProcessing}
                        className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 text-xs font-semibold transition-colors"
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
                      onClick={onClose}
                      className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
                    >
                      Keep Membership Active
                    </button>
                    <button
                      onClick={handleConfirmCancellation}
                      disabled={isProcessing}
                      className="py-3 px-5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-semibold transition-colors"
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
                    <span className="px-3 py-1 text-xs font-semibold tracking-wider uppercase rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {session.offer.badgeText || 'Exclusive Member Retention Offer'}
                    </span>
                    <h2 className="text-xl font-bold text-white mt-1">
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
                        <div className="text-2xl font-extrabold text-emerald-400">
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
                      <span>Transparent guarantee: Standard price resumes automatically on {session.offer.returnToNormalDate}. No cancellation penalty.</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleAcceptOffer}
                      disabled={isProcessing}
                      className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Accept Offer & Stay Protected
                    </button>
                    <button
                      onClick={handleConfirmCancellation}
                      disabled={isProcessing}
                      className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-xs font-semibold transition-colors"
                    >
                      Decline & Complete Cancellation
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
            <div className="space-y-6 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-white">Save Offer Activated!</h2>
                <p className="text-xs text-slate-400">
                  Your special retention rate has been applied to vehicle <strong className="text-amber-400">{session.vehiclePlate}</strong>.
                </p>
              </div>

              {/* 90-Day Post-Save Roadmap Timeline */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 text-left space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  90-Day Retention Journey Schedule
                </h4>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700">
                  {postSaveRoadmap.map((milestone, idx) => (
                    <div key={idx} className="relative">
                      <div className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 ${
                        milestone.status === 'delivered' 
                          ? 'bg-emerald-500 border-slate-900 ring-2 ring-emerald-500/30' 
                          : 'bg-slate-700 border-slate-900'
                      }`} />
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{milestone.title}</span>
                        {milestone.status === 'delivered' && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px]">Delivered</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{milestone.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all"
              >
                Return to RUSH Dashboard
              </button>
            </div>
          )}

          {/* ================================================================= */}
          {/* RESULT: VOLUNTARY CANCELLATION COMPLETED (Section 1) */}
          {/* ================================================================= */}
          {step === 'cancelled_result' && (
            <div className="space-y-6 text-center py-6">
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

              <button
                onClick={onClose}
                className="py-2.5 px-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
              >
                Close Window
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
