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

export type LocationId = 'all' | 'loc_riyadh_north' | 'loc_riyadh_olaya' | 'loc_jeddah_corniche' | 'loc_dammam_corniche';

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
  saleType: 'New' | 'Upgrade' | 'Reactivation';
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
  newSales: number;
  upgrades: number;
  reactivations: number;
  // Revenue & Quota
  revenueGenerated: number;
  targetRevenue: number;
  quotaAttainmentPct: number;
  // Efficiency & Conversions
  pitchesCount: number;
  conversionRatePct: number;
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
  topPerformer: SalesRepPerformance;
  reps: SalesRepPerformance[];
  branchBreakdown: BranchTeamComparison[];
}

