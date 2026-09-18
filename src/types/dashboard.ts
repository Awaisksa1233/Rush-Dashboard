export type DateRangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom';
export type ComparisonType = 'previous_period' | 'previous_month' | 'previous_year';
export type Granularity = 'daily' | 'weekly' | 'monthly';

export type PackageTier = 'fresh' | 'shiny' | 'nano' | 'interior_addon';

export interface PackageDefinition {
  id: PackageTier;
  name: string;
  arabicName: string;
  monthlyPrice: number;
  color: string;
  accentBg: string;
  textColor: string;
  borderColor: string;
  tag: string;
}

export type LocationId = 'all' | 'loc_alkharj';

export interface LocationDefinition {
  id: LocationId;
  name: string;
  city: string;
}

export interface MetricValue {
  current: number;
  previous: number;
  changePct: number;
  trend: 'up' | 'down' | 'neutral';
  isPositive: boolean; // whether "up" is considered favorable
}

export interface ExecutiveMetrics {
  netRevenue: MetricValue & { sparkline: number[]; previousPeriodRevenue: number };
  mrr: {
    closingMrr: number;
    openingMrr: number;
    newMrr: number;
    reactivationMrr: number;
    expansionMrr: number;
    churnedMrr: number;
    failedPaymentMrr: number;
    netMovement: number;
    changePct: number;
  };
  validMemberships: {
    totalValid: number;
    changePct: number;
    changeVsStart: number;
    autoRenewCount: number;
    cancelledValidUntilExpiry: number;
    historicalTrend: number[];
  };
  netMemberGrowth: {
    netGrowth: number;
    newCount: number;
    reactivatedCount: number;
    voluntaryChurnCount: number;
    involuntaryChurnCount: number;
  };
  renewalCollectionRate: {
    ratePct: number;
    changePct: number;
    eligibleAttempts: number;
    successfulPayments: number;
    failedPayments: number;
    recoveredPayments: number;
  };
  churnRate: {
    totalRatePct: number;
    voluntaryRatePct: number;
    involuntaryRatePct: number;
    totalChurnCount: number;
    voluntaryChurnCount: number;
    involuntaryChurnCount: number;
    changePct: number;
  };
  heroAverages?: {
    recurringInflowPct: number;
    singleInflowPct: number;
    avgTotalWash: number;
    avgMemberSale: number;
    avgMemberWash: number;
    avgSingleWash: number;
    monthlyMrr: number;
  };
}

export interface RevenueSeriesPoint {
  date: string;
  label: string;
  totalRevenue: number;
  membershipRevenue: number;
  singleWashRevenue: number;
  mrr: number;
  comparisonTotalRevenue?: number;
}

export interface MembershipWaterfallData {
  opening: number;
  newMembers: number;
  reactivated: number;
  voluntaryChurn: number;
  involuntaryChurn: number;
  closing: number;
}

export interface SalesBreakdown {
  totalSales: number;
  revenueAdded: number;
  averageSellingPrice: number;
  newCount: number;
  reactivatedCount: number;
  upgradeCount: number;
  downgradeCount: number;
  packageDistribution: {
    packageId: PackageTier;
    name: string;
    count: number;
    revenue: number;
    pct: number;
    color: string;
  }[];
}

export interface ChurnAnalysis {
  totalChurn: number;
  voluntaryChurn: number;
  involuntaryChurn: number;
  churnRatePct: number;
  rateChangePct: number;
  averageTenureMonths?: number;
  voluntaryReasons: {
    reason: string;
    count: number;
    pct: number;
  }[];
  involuntaryReasons: {
    reason: string;
    count: number;
    pct: number;
  }[];
}

export interface PaymentHealthFunnel {
  renewalsDue: number;
  firstTrySuccess: number;
  firstTrySuccessRate: number;
  initiallyFailed: number;
  initiallyFailedRate: number;
  recovered: number;
  finalFailed: number;
  recoveryRatePct: number;
  revenueRecovered: number;
  revenueLost: number;
  pendingRetries: number;
}

export interface RevenueBreakdownCategory {
  id: string;
  label: string;
  amount: number;
  sharePct: number;
  comparisonChangePct: number;
  color: string;
}

export interface PackageEconomicsRow {
  packageId: PackageTier;
  packageName: string;
  arabicName: string;
  validMembers: number;
  mrr: number;
  mrrSharePct: number;
  newSales: number;
  churn: number;
  churnRatePct: number;
  avgSellingPrice: number;
  avgWashesPerMember: number; // calculated using exposure-based member-days / period-days
  avgActiveMemberships: number;
  revenuePerMember: number;
  washCount: number;
}

export interface CohortRetentionRow {
  cohortMonth: string; // e.g., 'Mar 2026'
  joinedMembers: number;
  month1Rate: number; // percentage
  month2Rate: number;
  month3Rate: number;
  month6Rate: number;
}

export interface ManagementValueMetrics {
  arpm: number; // Average Revenue Per Member
  arpmChangePct: number;
  avgMembershipPrice: number;
  avgWashesPerMember: number;
  revenuePerWash: number;
  totalWashesInPeriod: number;
  estimatedLtv?: number;
}

export interface AttentionAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  metric: string;
  actionText?: string;
  targetFilter?: {
    type: 'failed_renewals' | 'churn_nano' | 'recoverable' | 'refunds' | 'renewals';
  };
}

export type ModalDrilldownType = 
  | 'valid_members'
  | 'failed_renewals'
  | 'voluntary_churn'
  | 'new_members'
  | 'package_detail'
  | 'revenue_breakdown'
  | 'sales_rep_activity';

export interface RepDealRecord {
  id: string;
  customerName: string;
  vehiclePlate: string;
  packageTier: PackageTier;
  packageName: string;
  amount: number;
  saleType: 'New' | 'Upgrade' | 'Reactivation' | 'Winback';
  daysInactive?: number;
  timestamp: string;
  commission: number;
  lane: string;
}

export interface SalesRepPerformance {
  id: string;
  name: string;
  arabicName: string;
  role: string;
  branchId: LocationId;
  branchName: string;
  shift: 'morning' | 'evening' | 'flexible';
  avatarInitials: string;
  avatarBg: string;
  // Volume
  totalSales: number;
  newSales: number;       // First-time new subscribers
  winbacks: number;       // Members who expired or cancelled >= 60 days (2 months) ago
  winbackRevenue: number; // Inflow from winbacks
  upgrades: number;
  reactivations: number;
  // Revenue & Quota
  revenueGenerated: number;
  targetRevenue: number;
  quotaAttainmentPct: number;
  // Efficiency & Conversions
  pitchesCount: number;
  newPitchesCount: number; // Pitches to new prospective drivers
  conversionRatePct: number; // Strictly New Member conversion rate: (newSales / newPitchesCount) * 100
  winbackRatePct?: number;  // Winbacks closed / Lapsed drivers pitched
  avgTicketPrice: number;
  commissionEarned: number;
  // Package breakdown counts
  tierSales: {
    fresh: number;
    shiny: number;
    nano: number;
    interior: number;
  };
  rank: number;
  rankScore: number;
  avgMembershipPrice: number;
  avgOneTimePrice: number;
  recentDeals: RepDealRecord[];
}

export interface BranchTeamComparison {
  branchId: LocationId;
  branchName: string;
  city: string;
  repCount: number;
  totalSales: number;
  revenue: number;
  quotaPct: number;
  avgConversionRate: number;
}

export interface SalesTeamAnalytics {
  totalReps: number;
  activeLanes: number;
  totalRepSales: number;
  totalRepRevenue: number;
  teamQuotaTarget: number;
  teamQuotaAttainmentPct: number;
  avgLaneConversionRate: number;
  totalCommissions: number;
  totalNewMembers: number;
  totalWinbacks: number;
  avgWinbackRate?: number;
  topPerformer: SalesRepPerformance;
  reps: SalesRepPerformance[];
  branchBreakdown: BranchTeamComparison[];
}

// ============================================================================
// RUSH MEMBERSHIP CANCELLATION SAVE ENGINE SPECIFICATION TYPES
// ============================================================================

export type CancellationReason =
  | 'price_budget'
  | 'not_using_enough'
  | 'travel_temporary_absence'
  | 'quality_complaint'
  | 'moved_or_sold_vehicle'
  | 'other';

export type UsageSegment = 'inactive' | 'light' | 'healthy' | 'high' | 'heavy';
export type UsageTrend = 'rising' | 'stable' | 'falling';
export type AprBand = 'low' | 'core' | 'high';
export type SaveOfferType = 'percentage' | 'freeze' | 'plan_switch' | 'service_credit';

export interface EligibilityResult {
  eligibleForAutomatedDiscount: boolean;
  blockingReasons: string[];
  monitoringFlags: string[];
  evaluatedAt: string;
  guardDetails: {
    twoRenewalsPassed: boolean;
    cooldown180dPassed: boolean;
    noActivePromoOrFreeze: boolean;
    noUnresolvedDispute: boolean;
    noCancelWithin90dOfSave: boolean;
    activeRecurringArrangement: boolean;
    noFraudFlag: boolean;
  };
}

export interface RetentionOffer {
  code: string;
  title: string;
  arabicTitle: string;
  description: string;
  badgeText?: string;
  packageId: string;
  packageName: string;
  discountType: 'percentage' | 'freeze';
  discountValue: number;
  billingCycles: number;
  normalPrice: number;
  discountedPrice: number;
  estimatedSavingsSar: number;
  preservesMrrSar: number;
  nextRenewalDate: string;
  returnToNormalDate: string;
  acceptedAt?: string;
  expiresAt: string;
}

export interface CancellationSession {
  id: string;
  membershipId: string;
  customerId: string;
  customerName: string;
  phone: string;
  vehiclePlate: string;
  packageId: string;
  packageName: string;
  normalPrice: number;
  initiatedAt: string;
  channel: 'portal' | 'pos' | 'staff';
  customerApr: number;
  aprBand: AprBand;
  usageLast30Days: number;
  usagePrevious30Days: number;
  usageSegment: UsageSegment;
  usageTrend: UsageTrend;
  totalWashesSinceJoining: number;
  monthsSinceJoining: number;
  totalRevenueCollected: number;
  realRetailSavingsSar: number;
  singleWashPrice?: number;
  lastPaidMembershipPrice?: number;
  retailWashValueLastPeriod?: number;
  lastPeriodSavingsSar?: number;
  isSavingGreaterThanMembership?: boolean;
  reason?: CancellationReason;
  freeText?: string;
  eligibility: EligibilityResult;
  offer?: RetentionOffer;
  outcome: 'started' | 'offer_accepted' | 'offer_declined' | 'cancelled' | 'manager_recovery';
  staffOverride?: {
    overrideByUserId: string;
    overrideReason: string;
    customDiscountPct: number;
    cycles: number;
    approvedAt: string;
  };
}

export interface QualityRecoveryTicket {
  id: string;
  sessionId?: string;
  membershipId: string;
  customerName: string;
  phone: string;
  vehiclePlate: string;
  branchId: string;
  branchName: string;
  lane?: string;
  washDateTime: string;
  issueCategory: 'spotting_film' | 'dryer_performance' | 'tunnel_equipment' | 'staff_service' | 'other';
  description: string;
  attachmentsCount: number;
  status: 'open' | 'callback_completed' | 'resolved_retained' | 'resolved_cancelled';
  callbackDueTime: string;
  createdAt: string;
  assignedManager?: string;
  managerNotes?: string;
  documentedRemedy?: 'rewash' | 'service_credit' | 'approved_discount' | 'none';
  remedyDetails?: string;
  memberDecision?: 'stay' | 'cancel';
  resolvedAt?: string;
}

export interface RetentionOfferHistory {
  id: string;
  membershipId: string;
  customerId: string;
  customerName: string;
  phone: string;
  plate: string;
  offerCode: string;
  discountType: 'percentage' | 'freeze';
  discountValue: number;
  billingCycles: number;
  cyclesCompleted: number;
  normalPrice: number;
  discountedPrice: number;
  acceptedAt: string;
  expiresAt: string;
  status: 'active' | 'completed' | 'cancelled' | 'durably_retained';
  postSaveMilestones: {
    day0NoticeSent: boolean;
    day7UsageReminderSent: boolean;
    day21FinalReminderSent: boolean;
    dayMinus14NoticeSent: boolean;
    firstNormalRenewalSuccess: boolean;
  };
}

export interface AdminRetentionConfig {
  aprThresholds: {
    lowMax: number;   // default 130
    coreMax: number;  // default 199
    highMin: number;  // default 200
  };
  discountTemplates: {
    SAVE_HEALTHY_CORE: { discountPct: number; cycles: number; active: boolean };
    SAVE_HEALTHY_HIGH: { discountPct: number; cycles: number; active: boolean };
    SAVE_HIGH_HIGH_APR: { discountPct: number; cycles: number; active: boolean };
  };
  freezePolicy: {
    defaultDays: number;
    maxAnnualDays: number;
  };
  guardrails: {
    minFullPriceRenewals: number;
    cooldownDays: number;
    postSaveCancelLockDays: number;
  };
}

export interface SpecificationMetricsSummary {
  totalCancellationAttempts: number;
  eligibleForDiscountCount: number;
  eligibilityRatePct: number;
  offerAcceptedCount: number;
  offerAcceptanceRatePct: number;
  cancellationCompletedCount: number;
  cancellationCompletionRatePct: number;
  retainedMrrAtDiscountedPrice: number;
  discountCostTotal: number;
  firstNormalPriceRenewalRatePct: number;
  durableSave90DayRatePct: number;
  repeatCancelsWithin90dCount: number;
  qualityTicketsCount: number;
  qualityTicketsResolvedCount: number;
  qualityResolutionRetentionRatePct: number;
  managerExceptionsCount: number;
  monitoringAbuseFlagsCount: number;
  aprBandBreakdown: { band: AprBand; label: string; count: number; pct: number; mrr: number }[];
  usageSegmentBreakdown: { segment: UsageSegment; label: string; count: number; pct: number; washesAvg: number }[];
  reasonBreakdown: { reason: CancellationReason; label: string; arabicLabel: string; count: number; pct: number; savedPct: number }[];
  offerCodeBreakdown: { code: string; label: string; acceptedCount: number; retainedMrr: number; cost: number }[];
  recentSessions: CancellationSession[];
  recentQualityTickets: QualityRecoveryTicket[];
  recentOfferHistories: RetentionOfferHistory[];
  adminConfig: AdminRetentionConfig;
}

