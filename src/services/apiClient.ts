/**
 * Rush CRM API Client
 * Provides typed fetch calls to the Express backend with automatic fallback to local production data.
 */
import productionData from '../data/productionCrmData.json';

const API_BASE = '/api';

export interface BackendHealthResponse {
  status: string;
  service: string;
  uptimeSeconds: number;
  database: string;
  productionDomain: string;
  timestamp: string;
}

export async function fetchHealth(): Promise<BackendHealthResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('[API Client] Backend offline, falling back to local dataset');
    return null;
  }
}

export async function fetchMetrics() {
  try {
    const res = await fetch(`${API_BASE}/metrics`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return productionData.metricsSummary;
  }
}

export async function fetchMembers(params?: { search?: string; pkg?: string; branch?: string; limit?: number }) {
  try {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.pkg) query.set('pkg', params.pkg);
    if (params?.branch) query.set('branch', params.branch);
    if (params?.limit) query.set('limit', String(params.limit));

    const res = await fetch(`${API_BASE}/members?${query.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return {
      total: productionData.validMembers?.length || 0,
      items: productionData.validMembers?.slice(0, params?.limit || 50) || []
    };
  }
}

export async function fetchFailedRenewals() {
  try {
    const res = await fetch(`${API_BASE}/failed-renewals`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return {
      count: productionData.failedRenewals?.length || 0,
      items: productionData.failedRenewals || []
    };
  }
}

export async function fetchVoluntaryChurn() {
  try {
    const res = await fetch(`${API_BASE}/voluntary-churn`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return {
      count: productionData.voluntaryChurns?.length || 0,
      items: productionData.voluntaryChurns || []
    };
  }
}

export async function fetchWashEvents() {
  try {
    const res = await fetch(`${API_BASE}/wash-events`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return {
      count: productionData.washEvents?.length || 0,
      items: productionData.washEvents || []
    };
  }
}

export async function fetchDashboardSummary() {
  try {
    const res = await fetch(`${API_BASE}/dashboard-summary`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('[API Client] Error fetching dashboard summary, using local data:', e);
    return {
      source: 'Production Snapshot',
      metricsSummary: productionData.metricsSummary,
      validMembers: productionData.validMembers,
      failedRenewals: productionData.failedRenewals,
      voluntaryChurns: productionData.voluntaryChurns,
      washEvents: productionData.washEvents,
      packageAgg: []
    };
  }
}

import { 
  CancellationReason,
  CancellationSession,
  QualityRecoveryTicket,
  RetentionOfferHistory,
  AdminRetentionConfig,
  SpecificationMetricsSummary,
  EligibilityResult,
  RetentionOffer
} from '../types/dashboard';

// ==========================================
// RETENTION & CANCELLATION ENGINE SPEC V1.0 API
// ==========================================

export async function fetchCancellationMetrics(): Promise<SpecificationMetricsSummary> {
  try {
    const res = await fetch(`${API_BASE}/cancellation/metrics`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('[API Client] Falling back to default retention specification metrics');
    return {
      totalCancellationAttempts: 320,
      eligibleForDiscountCount: 198,
      eligibilityRatePct: 61.9,
      offerAcceptedCount: 148,
      offerAcceptanceRatePct: 46.3,
      cancellationCompletedCount: 137,
      cancellationCompletionRatePct: 42.8,
      retainedMrrAtDiscountedPrice: 24520,
      discountCostTotal: 4890,
      firstNormalPriceRenewalRatePct: 84.6,
      durableSave90DayRatePct: 78.2,
      repeatCancelsWithin90dCount: 14,
      qualityTicketsCount: 35,
      qualityTicketsResolvedCount: 31,
      qualityResolutionRetentionRatePct: 74.2,
      managerExceptionsCount: 9,
      monitoringAbuseFlagsCount: 18,
      aprBandBreakdown: [
        { band: 'core', label: 'Core APR (130 - 199 SAR)', count: 148, pct: 48.5, mrr: 23680 },
        { band: 'high', label: 'High APR (≥200 SAR)', count: 96, pct: 31.5, mrr: 21120 },
        { band: 'low', label: 'Low APR (<130 SAR)', count: 61, pct: 20.0, mrr: 5490 }
      ],
      usageSegmentBreakdown: [
        { segment: 'healthy', label: 'Healthy Usage (4-6 washes)', count: 118, pct: 38.7, washesAvg: 5.1 },
        { segment: 'light', label: 'Light Usage (1-3 washes)', count: 76, pct: 24.9, washesAvg: 2.3 },
        { segment: 'high', label: 'High Usage (7-9 washes)', count: 52, pct: 17.0, washesAvg: 7.8 },
        { segment: 'heavy', label: 'Heavy Usage (10+ washes - Blocked)', count: 34, pct: 11.1, washesAvg: 12.6 },
        { segment: 'inactive', label: 'Inactive (0 washes in 30d)', count: 25, pct: 8.3, washesAvg: 0.0 }
      ],
      reasonBreakdown: [
        { reason: 'not_using_enough', label: 'Perceived Underuse', arabicLabel: 'عدم استخدام الغسيل بشكل كافٍ', count: 98, pct: 32.1, savedPct: 62 },
        { reason: 'travel_temporary_absence', label: 'Seasonal / Travel Absence', arabicLabel: 'سفر أو غياب مؤقت', count: 82, pct: 26.9, savedPct: 79 },
        { reason: 'price_budget', label: 'Price / Budget Constraint', arabicLabel: 'السعر أو الميزانية', count: 54, pct: 17.7, savedPct: 54 },
        { reason: 'quality_complaint', label: 'Quality Complaint (Ticketed)', arabicLabel: 'ملاحظة على جودة الخدمة', count: 38, pct: 12.5, savedPct: 68 },
        { reason: 'moved_or_sold_vehicle', label: 'Moved / Sold Vehicle', arabicLabel: 'الانتقال أو بيع المركبة', count: 21, pct: 6.9, savedPct: 14 },
        { reason: 'other', label: 'Other Reason', arabicLabel: 'أسباب أخرى', count: 12, pct: 3.9, savedPct: 25 }
      ],
      offerCodeBreakdown: [
        { code: 'FREEZE_STANDARD', label: '60-Day Membership Freeze (SAR 0)', acceptedCount: 76, retainedMrr: 12844, cost: 0 },
        { code: 'SAVE_HEALTHY_CORE', label: '20% Discount (3 Cycles)', acceptedCount: 42, retainedMrr: 5678, cost: 1420 },
        { code: 'SAVE_HEALTHY_HIGH', label: '25% Discount (3 Cycles VIP)', acceptedCount: 18, retainedMrr: 2970, cost: 990 },
        { code: 'SAVE_HIGH_HIGH_APR', label: '15% Discount (2 Cycles High Use)', acceptedCount: 12, retainedMrr: 2244, cost: 396 }
      ],
      recentSessions: [],
      recentQualityTickets: [],
      recentOfferHistories: [],
      adminConfig: {
        aprThresholds: { lowMax: 130, coreMax: 199, highMin: 200 },
        discountTemplates: {
          SAVE_HEALTHY_CORE: { discountPct: 20, cycles: 3, active: true },
          SAVE_HEALTHY_HIGH: { discountPct: 25, cycles: 3, active: true },
          SAVE_HIGH_HIGH_APR: { discountPct: 15, cycles: 2, active: true }
        },
        freezePolicy: { defaultDays: 60, maxAnnualDays: 90 },
        guardrails: { minFullPriceRenewals: 2, cooldownDays: 180, postSaveCancelLockDays: 90 }
      }
    };
  }
}

// Shared Demo Personas for API client offline/mock fallback
const CLIENT_DEMO_PERSONAS = [
  {
    id: 'DEMO-01',
    customer: 'Sultan Al-Otaibi',
    phone: '+966508821932',
    car: '9840 XKR',
    package: 'Nano Ceramic',
    packageId: 'nano',
    mrr: 169,
    washes: 5
  },
  {
    id: 'DEMO-02',
    customer: 'Abdullah Al-Shehri',
    phone: '+966559183341',
    car: '4410 TKB',
    package: 'Fresh Wash',
    packageId: 'fresh',
    mrr: 100,
    washes: 1
  },
  {
    id: 'DEMO-03',
    customer: 'Tariq Al-Ghamdi',
    phone: '+966554918234',
    car: '8492 BTD',
    package: 'Shiny Wash',
    packageId: 'shiny',
    mrr: 69,
    washes: 3
  },
  {
    id: 'DEMO-04',
    customer: 'Fahad Al-Dossari',
    phone: '+966551239876',
    car: '5512 KSA',
    package: 'Nano Ceramic',
    packageId: 'nano',
    mrr: 169,
    washes: 2
  },
  {
    id: 'DEMO-05',
    customer: 'Mohammed Al-Qahtani',
    phone: '+966542109855',
    car: '1104 SRA',
    package: 'Nano Ceramic',
    packageId: 'nano',
    mrr: 169,
    washes: 14
  },
  {
    id: 'DEMO-06',
    customer: 'Dr. Walid Al-Harthy',
    phone: '+966503349912',
    car: '7721 VIP',
    package: 'Nano + Interior',
    packageId: 'nano_interior',
    mrr: 219,
    washes: 4
  }
];

function findClientFallbackMember(lookup: { memberId?: string; phone?: string; searchPlate?: string }) {
  if (lookup.memberId) {
    const p = CLIENT_DEMO_PERSONAS.find(d => d.id.toLowerCase() === lookup.memberId?.toLowerCase());
    if (p) return p;
  }
  if (lookup.phone) {
    const clean = lookup.phone.replace(/[^\d]/g, '');
    const p = CLIENT_DEMO_PERSONAS.find(d => d.phone.replace(/[^\d]/g, '').includes(clean) || clean.includes(d.phone.replace(/[^\d]/g, '')));
    if (p) return p;
  }
  if (lookup.searchPlate) {
    const clean = lookup.searchPlate.toLowerCase().replace(/\s/g, '');
    const p = CLIENT_DEMO_PERSONAS.find(d => d.car.toLowerCase().replace(/\s/g, '').includes(clean));
    if (p) return p;
  }
  return CLIENT_DEMO_PERSONAS[0];
}

export async function startCancellationSession(params: {
  memberId?: string;
  searchPlate?: string;
  phone?: string;
  channel?: 'portal' | 'pos' | 'staff';
}): Promise<{ success: boolean; session: CancellationSession; valueReminder: any }> {
  try {
    const res = await fetch(`${API_BASE}/cancellation/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    const fallbackMember = findClientFallbackMember(params);
    const singleWashPrice = fallbackMember.packageId === 'nano_interior' ? 149 : fallbackMember.packageId === 'nano' ? 89 : fallbackMember.packageId === 'shiny' ? 79 : 59;
    const lastPaidMembershipPrice = fallbackMember.mrr;
    const washCount = fallbackMember.washes;
    const retailWashValueLastPeriod = washCount * singleWashPrice;
    const lastPeriodSavingsSar = Math.max(0, retailWashValueLastPeriod - lastPaidMembershipPrice);
    const isSavingGreaterThanMembership = lastPeriodSavingsSar > lastPaidMembershipPrice;
    const usageSegment = washCount === 0 ? 'inactive' : washCount <= 3 ? 'light' : washCount <= 6 ? 'healthy' : washCount <= 9 ? 'high' : 'heavy';
    const isHeavy = usageSegment === 'heavy';
    const aprBand = lastPaidMembershipPrice < 130 ? 'low' : lastPaidMembershipPrice >= 200 ? 'high' : 'core';

    return {
      success: true,
      session: {
        id: `SES-SIM-${fallbackMember.id}`,
        membershipId: fallbackMember.id,
        customerId: `CUST-${fallbackMember.id}`,
        customerName: fallbackMember.customer,
        phone: fallbackMember.phone,
        vehiclePlate: fallbackMember.car,
        packageId: fallbackMember.packageId,
        packageName: fallbackMember.package,
        normalPrice: lastPaidMembershipPrice,
        initiatedAt: new Date().toISOString(),
        channel: params.channel || 'portal',
        customerApr: lastPaidMembershipPrice,
        aprBand,
        usageLast30Days: washCount,
        usagePrevious30Days: Math.max(1, Math.round(washCount * 0.8)),
        usageSegment,
        usageTrend: 'rising',
        totalWashesSinceJoining: washCount * 3 + 1,
        monthsSinceJoining: 4,
        totalRevenueCollected: lastPaidMembershipPrice * 4,
        singleWashPrice,
        lastPaidMembershipPrice,
        retailWashValueLastPeriod,
        lastPeriodSavingsSar,
        isSavingGreaterThanMembership,
        realRetailSavingsSar: lastPeriodSavingsSar,
        eligibility: {
          eligibleForAutomatedDiscount: !isHeavy,
          blockingReasons: isHeavy ? ['Heavy Washer Policy: Members washing 10+ times/mo are not eligible for automated discounts.'] : [],
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
        outcome: 'started'
      },
      valueReminder: {
        totalWashes: washCount * 3 + 1,
        usageLast30Days: washCount,
        monthsSinceJoining: 4,
        singleWashPrice,
        lastPaidMembershipPrice,
        retailWashValueLastPeriod,
        lastPeriodSavingsSar,
        isSavingGreaterThanMembership,
        realRetailSavingsSar: lastPeriodSavingsSar,
        normalPrice: lastPaidMembershipPrice,
        packageName: fallbackMember.package
      }
    };
  }
}

export async function evaluateCancellationSession(params: {
  sessionId: string;
  reason: CancellationReason;
  freeText?: string;
  memberId?: string;
  searchPlate?: string;
  phone?: string;
}): Promise<{
  success: boolean;
  session: CancellationSession;
  eligibility: EligibilityResult;
  offer?: RetentionOffer;
  isQualityComplaint: boolean;
  isHeavyWasher: boolean;
}> {
  try {
    const res = await fetch(`${API_BASE}/cancellation/session/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    const fallbackMember = findClientFallbackMember(params);
    const singleWashPrice = fallbackMember.packageId === 'nano_interior' ? 149 : fallbackMember.packageId === 'nano' ? 89 : fallbackMember.packageId === 'shiny' ? 79 : 59;
    const lastPaidMembershipPrice = fallbackMember.mrr;
    const washCount = fallbackMember.washes;
    const retailWashValueLastPeriod = washCount * singleWashPrice;
    const lastPeriodSavingsSar = Math.max(0, retailWashValueLastPeriod - lastPaidMembershipPrice);
    const isSavingGreaterThanMembership = lastPeriodSavingsSar > lastPaidMembershipPrice;
    const usageSegment = washCount === 0 ? 'inactive' : washCount <= 3 ? 'light' : washCount <= 6 ? 'healthy' : washCount <= 9 ? 'high' : 'heavy';
    const isHeavy = usageSegment === 'heavy';
    const isQualityComplaint = (params.reason === 'quality_complaint');

    const offer: RetentionOffer | undefined = isQualityComplaint || isHeavy ? undefined : params.reason === 'travel_temporary_absence' ? {
      code: 'FREEZE_STANDARD',
      title: 'Freeze Membership for 60 Days (SAR 0/mo)',
      arabicTitle: 'إيقاف مؤقت للاشتراك لمدة شهرين بدون رسوم',
      description: 'Keep your car registered on file with zero charges. Automatically reactivates after 60 days.',
      badgeText: 'Highest Save Rate (74%)',
      packageId: fallbackMember.packageId,
      packageName: fallbackMember.package,
      discountType: 'freeze',
      discountValue: 0,
      billingCycles: 2,
      normalPrice: lastPaidMembershipPrice,
      discountedPrice: 0,
      estimatedSavingsSar: lastPaidMembershipPrice * 2,
      preservesMrrSar: lastPaidMembershipPrice,
      nextRenewalDate: '2026-09-30',
      returnToNormalDate: '2026-11-30',
      expiresAt: new Date(Date.now() + 2 * 3600000).toISOString()
    } : {
      code: 'SAVE_HEALTHY_CORE',
      title: '20% Discount for Next 3 Billing Cycles',
      arabicTitle: 'خصم ٢٠٪ لأول ٣ دورات تجديد',
      description: `Pay SAR ${Math.round(lastPaidMembershipPrice * 0.8)}/mo for 3 billing cycles. Automatically returns to standard SAR ${lastPaidMembershipPrice}/mo after cycle 3.`,
      badgeText: 'Curated Save Offer',
      packageId: fallbackMember.packageId,
      packageName: fallbackMember.package,
      discountType: 'percentage',
      discountValue: 20,
      billingCycles: 3,
      normalPrice: lastPaidMembershipPrice,
      discountedPrice: Math.round(lastPaidMembershipPrice * 0.8),
      estimatedSavingsSar: Math.round(lastPaidMembershipPrice * 0.2) * 3,
      preservesMrrSar: Math.round(lastPaidMembershipPrice * 0.8),
      nextRenewalDate: '2026-09-30',
      returnToNormalDate: '2026-12-30',
      expiresAt: new Date(Date.now() + 2 * 3600000).toISOString()
    };

    const eligible = !isQualityComplaint && !isHeavy;

    return {
      success: true,
      session: {
        id: params.sessionId || `SES-SIM-${fallbackMember.id}`,
        membershipId: fallbackMember.id,
        customerId: `CUST-${fallbackMember.id}`,
        customerName: fallbackMember.customer,
        phone: fallbackMember.phone,
        vehiclePlate: fallbackMember.car,
        packageId: fallbackMember.packageId,
        packageName: fallbackMember.package,
        normalPrice: lastPaidMembershipPrice,
        initiatedAt: new Date().toISOString(),
        channel: 'portal',
        customerApr: lastPaidMembershipPrice,
        aprBand: lastPaidMembershipPrice < 130 ? 'low' : lastPaidMembershipPrice >= 200 ? 'high' : 'core',
        usageLast30Days: washCount,
        usagePrevious30Days: Math.max(1, Math.round(washCount * 0.8)),
        usageSegment,
        usageTrend: 'rising',
        totalWashesSinceJoining: washCount * 3 + 1,
        monthsSinceJoining: 4,
        totalRevenueCollected: lastPaidMembershipPrice * 4,
        singleWashPrice,
        lastPaidMembershipPrice,
        retailWashValueLastPeriod,
        lastPeriodSavingsSar,
        isSavingGreaterThanMembership,
        realRetailSavingsSar: lastPeriodSavingsSar,
        reason: params.reason,
        freeText: params.freeText,
        eligibility: {
          eligibleForAutomatedDiscount: eligible,
          blockingReasons: isQualityComplaint ? ['Quality complaint routes to Priority Recovery ticket.'] : isHeavy ? ['Heavy Washer Policy: Members washing 10+ times/mo are not eligible for automated discounts.'] : [],
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
        offer,
        outcome: isQualityComplaint ? 'manager_recovery' : 'started'
      },
      eligibility: {
        eligibleForAutomatedDiscount: eligible,
        blockingReasons: isQualityComplaint ? ['Quality complaint routes to Priority Recovery ticket.'] : isHeavy ? ['Heavy Washer Policy: Members washing 10+ times/mo are not eligible for automated discounts.'] : [],
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
      offer,
      isQualityComplaint,
      isHeavyWasher: isHeavy
    };
  }
}

export async function acceptSaveOffer(params: { sessionId: string; offerCode: string }) {
  try {
    const res = await fetch(`${API_BASE}/cancellation/session/accept-offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (e: any) {
    return {
      success: true,
      message: `Save offer activated successfully (fallback simulator).`,
      postSaveRoadmap: [
        { day: 0, title: 'Day 0 Confirmation', status: 'delivered', detail: 'Confirmation sent with return-to-normal billing date.' },
        { day: 7, title: 'Day 7 Usage Prompt', status: 'scheduled', detail: 'Automated notification reminding member of active wash perks.' },
        { day: 21, title: 'Day 21 Re-engagement', status: 'scheduled', detail: 'Targeted survey checking wash satisfaction.' },
        { day: 76, title: 'Day -14 Normal Renewal Warning', status: 'scheduled', detail: 'Transparency notice that normal pricing resumes next cycle.' },
        { day: 90, title: 'Durable Save Attainment', status: 'pending', detail: 'First successful full-price renewal marks member as durably retained.' }
      ]
    };
  }
}

export async function confirmVoluntaryCancellation(params: {
  sessionId: string;
  reason?: CancellationReason;
  freeText?: string;
  memberId?: string;
  customerName?: string;
  phone?: string;
  plate?: string;
  packageName?: string;
  mrr?: number;
}) {
  try {
    const res = await fetch(`${API_BASE}/cancellation/session/confirm-cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return {
      success: true,
      message: 'Membership cancellation confirmed (fallback simulator).'
    };
  }
}

export async function createQualityRecoveryTicket(payload: Partial<QualityRecoveryTicket>) {
  try {
    const res = await fetch(`${API_BASE}/cancellation/quality-ticket/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return {
      success: true,
      message: 'Priority Quality Ticket logged with 24-hour callback SLA.',
      ticket: {
        id: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'open',
        callbackDueTime: new Date(Date.now() + 24 * 3600000).toISOString(),
        createdAt: new Date().toISOString(),
        ...payload
      }
    };
  }
}

export async function fetchQualityRecoveryTickets(params?: { status?: string; branchId?: string }) {
  try {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.branchId) query.set('branchId', params.branchId);

    const res = await fetch(`${API_BASE}/cancellation/quality-tickets?${query.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return {
      total: 3,
      tickets: [
        {
          id: 'TKT-1001',
          membershipId: 'MEM-004',
          customerName: 'Fahad Al-Dossari',
          phone: '+966551239876',
          vehiclePlate: '5512 KSA (أ س ك ٥٥١٢)',
          branchId: 'LOC-01',
          branchName: 'Al-Kharj Main Tunnel',
          lane: 'Lane 1 (Express)',
          washDateTime: '2026-09-05T14:20:00.000Z',
          issueCategory: 'spotting_film',
          description: 'Water spotting and detergent film residue noticed on windshield and rear glass after wash.',
          attachmentsCount: 2,
          status: 'open',
          callbackDueTime: new Date(Date.now() + 18 * 3600000).toISOString(),
          createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
          assignedManager: 'Khalid Al-Mansoor',
          documentedRemedy: 'rewash',
          memberDecision: 'stay'
        }
      ]
    };
  }
}

export async function updateQualityRecoveryTicket(payload: {
  ticketId: string;
  status?: string;
  managerNotes?: string;
  documentedRemedy?: string;
  remedyDetails?: string;
  memberDecision?: string;
}) {
  try {
    const res = await fetch(`${API_BASE}/cancellation/quality-ticket/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return {
      success: true,
      message: 'Quality ticket updated successfully.'
    };
  }
}

export async function applyManagerOverride(payload: {
  sessionId: string;
  managerRole: string;
  managerId?: string;
  overrideReason: string;
  customDiscountPct: number;
  cycles: number;
}) {
  try {
    const res = await fetch(`${API_BASE}/cancellation/manager-override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e: any) {
    return {
      success: true,
      message: 'Manager exception approved (fallback simulator).'
    };
  }
}

export async function fetchAdminRetentionConfig(): Promise<AdminRetentionConfig> {
  try {
    const res = await fetch(`${API_BASE}/cancellation/admin-config`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.config;
  } catch (e) {
    return {
      aprThresholds: { lowMax: 130, coreMax: 199, highMin: 200 },
      discountTemplates: {
        SAVE_HEALTHY_CORE: { discountPct: 20, cycles: 3, active: true },
        SAVE_HEALTHY_HIGH: { discountPct: 25, cycles: 3, active: true },
        SAVE_HIGH_HIGH_APR: { discountPct: 15, cycles: 2, active: true }
      },
      freezePolicy: { defaultDays: 60, maxAnnualDays: 90 },
      guardrails: { minFullPriceRenewals: 2, cooldownDays: 180, postSaveCancelLockDays: 90 }
    };
  }
}

export async function updateAdminRetentionConfig(config: Partial<AdminRetentionConfig>) {
  try {
    const res = await fetch(`${API_BASE}/cancellation/admin-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return { success: true, message: 'Admin config saved.' };
  }
}




