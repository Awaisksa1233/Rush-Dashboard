import { 
  DateRangePreset, 
  ComparisonType, 
  LocationId, 
  PackageTier, 
  Granularity, 
  ExecutiveMetrics, 
  RevenueSeriesPoint, 
  MembershipWaterfallData, 
  SalesBreakdown, 
  ChurnAnalysis, 
  PaymentHealthFunnel, 
  RevenueBreakdownCategory, 
  PackageEconomicsRow, 
  CohortRetentionRow, 
  ManagementValueMetrics, 
  AttentionAlert 
} from '../types/dashboard';
import { PACKAGES } from '../data/packages';

export interface DashboardFilterState {
  dateRange: DateRangePreset;
  customStartDate?: string;
  customEndDate?: string;
  comparison: ComparisonType;
  location: LocationId;
  packageFilter: PackageTier | 'all';
  granularity: Granularity;
}

export function formatSAR(amount: number, compact = false): string {
  if (compact && Math.abs(amount) >= 1000) {
    return `SAR ${(amount / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
  }
  return `SAR ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatPercent(value: number, includeSign = true): string {
  const sign = includeSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function getDaysInPeriod(preset: DateRangePreset): number {
  switch (preset) {
    case 'today': return 1;
    case 'yesterday': return 1;
    case 'last7': return 7;
    case 'last30': return 30;
    case 'thisMonth': return 28;
    case 'lastMonth': return 31;
    case 'custom': return 14;
  }
}

export interface WashUsageAnalytics {
  totalWashesInPeriod: number;
  memberWashes: number;
  memberWashSharePct: number;
  singleWashes: number;
  singleWashSharePct: number;
  avgWashesPerMemberMonth: number;
  effectiveCostPerWash: number;
  revenuePerWash: number;
  // Wash usage frequency distribution
  usageTiers: {
    label: string;
    description: string;
    membersCount: number;
    pctOfMembers: number;
    avgWashes: number;
    status: 'risk' | 'healthy' | 'heavy' | 'super';
    color: string;
  }[];
  // Peak hourly tunnel throughput (Cars Per Hour)
  peakHours: {
    hour: string;
    carsPerHour: number;
    capacityPct: number;
    isPeak: boolean;
  }[];
  // Vehicle profile distribution
  vehicleTypes: {
    type: string;
    count: number;
    pct: number;
    avgWashes: number;
  }[];
}

export function calculateDashboardAnalytics(filters: DashboardFilterState) {
  const days = getDaysInPeriod(filters.dateRange);
  
  let locFactor = 1.0;
  if (filters.location === 'loc_riyadh_north') locFactor = 0.38;
  else if (filters.location === 'loc_riyadh_olaya') locFactor = 0.29;
  else if (filters.location === 'loc_jeddah_corniche') locFactor = 0.21;
  else if (filters.location === 'loc_dammam_corniche') locFactor = 0.12;

  let pkgFactor = 1.0;
  if (filters.packageFilter === 'fresh') pkgFactor = 0.28;
  else if (filters.packageFilter === 'shiny') pkgFactor = 0.44;
  else if (filters.packageFilter === 'nano') pkgFactor = 0.23;
  else if (filters.packageFilter === 'interior_addon') pkgFactor = 0.05;

  const combinedFactor = locFactor * (filters.packageFilter === 'all' ? 1.0 : pkgFactor);

  // 1. Memberships snapshot
  const baseValid = Math.round(3207 * combinedFactor);
  const autoRenew = Math.round(baseValid * 0.951);
  const cancelledValid = baseValid - autoRenew;
  const validChangePct = 4.2;
  const changeVsStart = Math.round(baseValid * 0.0403);

  // 2. MRR Waterfall
  const baseMRR = Math.round(684200 * combinedFactor);
  const openingMRR = Math.round(658400 * combinedFactor);
  const newMRR = Math.round(48250 * combinedFactor);
  const reactivationMRR = Math.round(7150 * combinedFactor);
  const expansionMRR = Math.round(3400 * combinedFactor);
  const churnedMRR = Math.round(21800 * combinedFactor);
  const failedPaymentMRR = Math.round(11200 * combinedFactor);
  const netMRRMovement = newMRR + reactivationMRR + expansionMRR - churnedMRR - failedPaymentMRR;
  const closingMRR = openingMRR + netMRRMovement;
  const mrrChangePct = parseFloat(((netMRRMovement / openingMRR) * 100).toFixed(2));

  // 3. Net Revenue in Period
  const periodRevenue = Math.round((closingMRR * (days / 30) + (138400 * (days / 30) * combinedFactor)));
  const prevPeriodRev = Math.round(periodRevenue * 0.923);
  const revChangePct = parseFloat((((periodRevenue - prevPeriodRev) / prevPeriodRev) * 100).toFixed(1));

  const sparkPointsCount = Math.min(days, 14);
  const revSparkline = Array.from({ length: sparkPointsCount }, (_, i) => {
    const baseline = periodRevenue / sparkPointsCount;
    const variation = 1 + Math.sin(i / 1.5) * 0.12 + (i / sparkPointsCount) * 0.08;
    return Math.round(baseline * variation);
  });

  // 4. Net Member Growth & Sales
  const newMembers = Math.round(230 * (days / 30) * combinedFactor);
  const reactivated = Math.round(32 * (days / 30) * combinedFactor);
  const voluntaryChurn = Math.round(81 * (days / 30) * combinedFactor);
  const involuntaryChurn = Math.round(57 * (days / 30) * combinedFactor);
  const netGrowth = newMembers + reactivated - voluntaryChurn - involuntaryChurn;

  // 5. Renewal Collection Rate & Payment Health
  const renewalsDue = Math.round(1240 * (days / 30) * combinedFactor);
  const firstTrySuccess = Math.round(1015 * (days / 30) * combinedFactor);
  const initiallyFailed = renewalsDue - firstTrySuccess;
  const recovered = Math.round(91 * (days / 30) * combinedFactor);
  const finalFailed = initiallyFailed - recovered;
  const renewalCollectionRate = renewalsDue > 0 ? parseFloat((((firstTrySuccess + recovered) / renewalsDue) * 100).toFixed(1)) : 93.8;
  const recoveryRatePct = initiallyFailed > 0 ? parseFloat(((recovered / initiallyFailed) * 100).toFixed(1)) : 40.4;
  const revenueRecovered = Math.round(recovered * 185);
  const revenueLost = Math.round(finalFailed * 210);

  // 6. Membership Churn Rate
  const openingMembers = baseValid - netGrowth;
  const totalChurn = voluntaryChurn + involuntaryChurn;
  const eligibleBase = Math.max(openingMembers + newMembers, 1);
  const totalChurnRate = parseFloat(((totalChurn / eligibleBase) * 100).toFixed(2));
  const voluntaryChurnRate = parseFloat(((voluntaryChurn / eligibleBase) * 100).toFixed(2));
  const involuntaryChurnRate = parseFloat(((involuntaryChurn / eligibleBase) * 100).toFixed(2));

  // 7. WASH USAGE & UTILIZATION ANALYTICS
  // Exposure-weighted monthly washes
  const avgWashesPerMemberMonth = 3.2;
  const memberWashes = Math.round(baseValid * avgWashesPerMemberMonth * (days / 30));
  const singleWashes = Math.round(2420 * (days / 30) * combinedFactor);
  const totalWashesInPeriod = memberWashes + singleWashes;
  const memberWashSharePct = totalWashesInPeriod > 0 ? Math.round((memberWashes / totalWashesInPeriod) * 100) : 81;
  const singleWashSharePct = 100 - memberWashSharePct;
  const revenuePerWash = totalWashesInPeriod > 0 ? parseFloat((periodRevenue / totalWashesInPeriod).toFixed(2)) : 38.5;
  const effectiveCostPerWash = 4.85; // Chemicals + Water + Power per wash

  const washUsage: WashUsageAnalytics = {
    totalWashesInPeriod,
    memberWashes,
    memberWashSharePct,
    singleWashes,
    singleWashSharePct,
    avgWashesPerMemberMonth,
    effectiveCostPerWash,
    revenuePerWash,
    // 4 Distinct usage tiers
    usageTiers: [
      {
        label: 'Inactive / At-Risk (0 Washes)',
        description: 'Have not washed in 30 days — high churn risk on next billing cycle',
        membersCount: Math.round(baseValid * 0.12),
        pctOfMembers: 12,
        avgWashes: 0,
        status: 'risk',
        color: '#ef4444'
      },
      {
        label: 'Light Regulars (1–2 Washes)',
        description: 'Occasional commuters with high gross profit margins',
        membersCount: Math.round(baseValid * 0.38),
        pctOfMembers: 38,
        avgWashes: 1.6,
        status: 'healthy',
        color: '#3b82f6'
      },
      {
        label: 'Healthy Core (3–5 Washes)',
        description: 'Optimal subscriber frequency and highest long-term retention',
        membersCount: Math.round(baseValid * 0.36),
        pctOfMembers: 36,
        avgWashes: 3.8,
        status: 'healthy',
        color: '#10b981'
      },
      {
        label: 'Super-Users (6+ Washes)',
        description: 'Chauffeurs & daily drivers with heavy tunnel utilization',
        membersCount: Math.round(baseValid * 0.14),
        pctOfMembers: 14,
        avgWashes: 7.4,
        status: 'super',
        color: '#8b5cf6'
      }
    ],
    // Peak tunnel throughput
    peakHours: [
      { hour: '09:00 - 12:00', carsPerHour: 34, capacityPct: 42, isPeak: false },
      { hour: '12:00 - 15:00', carsPerHour: 48, capacityPct: 60, isPeak: false },
      { hour: '15:00 - 18:00', carsPerHour: 68, capacityPct: 85, isPeak: true },
      { hour: '18:00 - 21:00', carsPerHour: 76, capacityPct: 95, isPeak: true },
      { hour: '21:00 - 24:00', carsPerHour: 52, capacityPct: 65, isPeak: false }
    ],
    // Vehicle types in Saudi Market
    vehicleTypes: [
      { type: 'SUVs & Large 4x4 (Land Cruiser, Tahoe, Patrol)', count: Math.round(baseValid * 0.52), pct: 52, avgWashes: 3.4 },
      { type: 'Sedans & Compacts (Camry, Elantra, Accord)', count: Math.round(baseValid * 0.36), pct: 36, avgWashes: 3.1 },
      { type: 'Luxury & Sports (Lexus, Mercedes, Porsche)', count: Math.round(baseValid * 0.12), pct: 12, avgWashes: 2.8 }
    ]
  };

  // Executive Metrics Object
  const executiveMetrics: ExecutiveMetrics = {
    netRevenue: {
      current: periodRevenue,
      previous: prevPeriodRev,
      changePct: revChangePct,
      trend: revChangePct >= 0 ? 'up' : 'down',
      isPositive: true,
      sparkline: revSparkline,
      previousPeriodRevenue: prevPeriodRev
    },
    mrr: {
      closingMrr: closingMRR,
      openingMrr: openingMRR,
      newMrr: newMRR,
      reactivationMrr: reactivationMRR,
      expansionMrr: expansionMRR,
      churnedMrr: churnedMRR,
      failedPaymentMrr: failedPaymentMRR,
      netMovement: netMRRMovement,
      changePct: mrrChangePct
    },
    validMemberships: {
      totalValid: baseValid,
      changePct: validChangePct,
      changeVsStart: changeVsStart,
      autoRenewCount: autoRenew,
      cancelledValidUntilExpiry: cancelledValid,
      historicalTrend: [2840, 2910, 2980, 3050, 3120, 3165, baseValid]
    },
    netMemberGrowth: {
      netGrowth: netGrowth,
      newCount: newMembers,
      reactivatedCount: reactivated,
      voluntaryChurnCount: voluntaryChurn,
      involuntaryChurnCount: involuntaryChurn
    },
    renewalCollectionRate: {
      ratePct: renewalCollectionRate,
      changePct: -1.8,
      eligibleAttempts: renewalsDue,
      successfulPayments: firstTrySuccess + recovered,
      failedPayments: finalFailed,
      recoveredPayments: recovered
    },
    churnRate: {
      totalRatePct: totalChurnRate,
      voluntaryRatePct: voluntaryChurnRate,
      involuntaryRatePct: involuntaryChurnRate,
      totalChurnCount: totalChurn,
      voluntaryChurnCount: voluntaryChurn,
      involuntaryChurnCount: involuntaryChurn,
      changePct: 0.4
    }
  };

  // Trend points
  const trendPoints: RevenueSeriesPoint[] = [];
  const pointsToGenerate = filters.granularity === 'daily' ? Math.min(days, 30) : (filters.granularity === 'weekly' ? 8 : 6);
  
  for (let i = 0; i < pointsToGenerate; i++) {
    const fraction = (i + 1) / pointsToGenerate;
    const dateLabel = filters.granularity === 'daily' 
      ? `Day ${i + 1}` 
      : (filters.granularity === 'weekly' ? `Wk ${i + 1}` : `M-${6 - i}`);

    const basePointTotal = (periodRevenue / pointsToGenerate) * (0.85 + Math.sin(i / 1.2) * 0.15 + (i * 0.04));
    const memRev = basePointTotal * 0.76;
    const singleRev = basePointTotal * 0.24;
    const mrrPoint = openingMRR + (netMRRMovement * fraction);
    const compTotal = basePointTotal * 0.91;

    trendPoints.push({
      date: `2026-08-${String(i + 1).padStart(2, '0')}`,
      label: dateLabel,
      totalRevenue: Math.round(basePointTotal),
      membershipRevenue: Math.round(memRev),
      singleWashRevenue: Math.round(singleRev),
      mrr: Math.round(mrrPoint),
      comparisonTotalRevenue: Math.round(compTotal)
    });
  }

  // Waterfall
  const membershipWaterfall: MembershipWaterfallData = {
    opening: openingMembers,
    newMembers: newMembers,
    reactivated: reactivated,
    voluntaryChurn: voluntaryChurn,
    involuntaryChurn: involuntaryChurn,
    closing: baseValid
  };

  // Sales Breakdown
  const totalSalesCount = newMembers + reactivated;
  const salesBreakdown: SalesBreakdown = {
    totalSales: totalSalesCount,
    revenueAdded: Math.round(totalSalesCount * 218),
    averageSellingPrice: 218,
    newCount: newMembers,
    reactivatedCount: reactivated,
    upgradeCount: Math.round(28 * (days / 30) * combinedFactor),
    downgradeCount: Math.round(6 * (days / 30) * combinedFactor),
    packageDistribution: [
      { packageId: 'fresh', name: 'Fresh Wash', count: Math.round(totalSalesCount * 0.28), revenue: Math.round(totalSalesCount * 0.28 * 149), pct: 28, color: PACKAGES.fresh.color },
      { packageId: 'shiny', name: 'Shiny Wash', count: Math.round(totalSalesCount * 0.44), revenue: Math.round(totalSalesCount * 0.44 * 199), pct: 44, color: PACKAGES.shiny.color },
      { packageId: 'nano', name: 'Nano Ceramic', count: Math.round(totalSalesCount * 0.23), revenue: Math.round(totalSalesCount * 0.23 * 289), pct: 23, color: PACKAGES.nano.color },
      { packageId: 'interior_addon', name: 'Interior Care', count: Math.round(totalSalesCount * 0.05), revenue: Math.round(totalSalesCount * 0.05 * 99), pct: 5, color: PACKAGES.interior_addon.color },
    ]
  };

  // Churn Analysis
  const churnAnalysis: ChurnAnalysis = {
    totalChurn: totalChurn,
    voluntaryChurn: voluntaryChurn,
    involuntaryChurn: involuntaryChurn,
    churnRatePct: totalChurnRate,
    rateChangePct: 0.3,
    voluntaryReasons: [
      { reason: 'Customer Relocated / Moved', count: Math.round(voluntaryChurn * 0.36), pct: 36 },
      { reason: 'Sold / Changed Vehicle', count: Math.round(voluntaryChurn * 0.28), pct: 28 },
      { reason: 'Price / Value Perception', count: Math.round(voluntaryChurn * 0.20), pct: 20 },
      { reason: 'Not washing frequently enough', count: Math.round(voluntaryChurn * 0.16), pct: 16 }
    ],
    involuntaryReasons: [
      { reason: 'Insufficient Funds (Mada / Credit)', count: Math.round(involuntaryChurn * 0.48), pct: 48 },
      { reason: 'Do Not Honour / Bank Decline', count: Math.round(involuntaryChurn * 0.24), pct: 24 },
      { reason: 'Expired Card / Card Changed', count: Math.round(involuntaryChurn * 0.16), pct: 16 },
      { reason: 'Technical / Gateway Timeout', count: Math.round(involuntaryChurn * 0.08), pct: 8 },
      { reason: 'Restricted / Stolen Card', count: Math.round(involuntaryChurn * 0.04), pct: 4 }
    ]
  };

  // Payment Health Funnel
  const paymentHealth: PaymentHealthFunnel = {
    renewalsDue: renewalsDue,
    firstTrySuccess: firstTrySuccess,
    firstTrySuccessRate: renewalsDue > 0 ? parseFloat(((firstTrySuccess / renewalsDue) * 100).toFixed(1)) : 81.9,
    initiallyFailed: initiallyFailed,
    initiallyFailedRate: renewalsDue > 0 ? parseFloat(((initiallyFailed / renewalsDue) * 100).toFixed(1)) : 18.1,
    recovered: recovered,
    finalFailed: finalFailed,
    recoveryRatePct: recoveryRatePct,
    revenueRecovered: revenueRecovered,
    revenueLost: revenueLost,
    pendingRetries: Math.round(initiallyFailed * 0.38)
  };

  // Revenue Breakdown
  const totalRevBreakdown = periodRevenue;
  const revenueBreakdown: RevenueBreakdownCategory[] = [
    { id: 'renewals', label: 'Membership Renewals', amount: Math.round(totalRevBreakdown * 0.58), sharePct: 58, comparisonChangePct: 5.4, color: '#10b981' },
    { id: 'new_sales', label: 'New Membership Sales', amount: Math.round(totalRevBreakdown * 0.18), sharePct: 18, comparisonChangePct: 8.2, color: '#3b82f6' },
    { id: 'single_wash', label: 'Single Wash Walk-ins', amount: Math.round(totalRevBreakdown * 0.12), sharePct: 12, comparisonChangePct: -3.1, color: '#6366f1' },
    { id: 'interior', label: 'Interior Add-on Services', amount: Math.round(totalRevBreakdown * 0.06), sharePct: 6, comparisonChangePct: 11.4, color: '#f59e0b' },
    { id: 'reactivations', label: 'Reactivations / Win-backs', amount: Math.round(totalRevBreakdown * 0.04), sharePct: 4, comparisonChangePct: 14.0, color: '#8b5cf6' },
    { id: 'upgrades', label: 'Tier Upgrades', amount: Math.round(totalRevBreakdown * 0.03), sharePct: 3, comparisonChangePct: 2.1, color: '#14b8a6' },
    { id: 'refunds', label: 'Refunds & Chargebacks', amount: -Math.round(totalRevBreakdown * 0.01), sharePct: 1, comparisonChangePct: -15.0, color: '#ef4444' }
  ];

  // Package Economics Table
  const packageTable: PackageEconomicsRow[] = [
    {
      packageId: 'fresh',
      packageName: PACKAGES.fresh.name,
      arabicName: PACKAGES.fresh.arabicName,
      validMembers: Math.round(baseValid * 0.28),
      mrr: Math.round(baseValid * 0.28 * 149),
      mrrSharePct: 20.1,
      newSales: Math.round(newMembers * 0.30),
      churn: Math.round(totalChurn * 0.34),
      churnRatePct: 4.8,
      avgSellingPrice: 149,
      avgActiveMemberships: Math.round(baseValid * 0.28 * 0.98),
      avgWashesPerMember: 2.4,
      revenuePerMember: 149,
      washCount: Math.round(baseValid * 0.28 * 0.98 * 2.4)
    },
    {
      packageId: 'shiny',
      packageName: PACKAGES.shiny.name,
      arabicName: PACKAGES.shiny.arabicName,
      validMembers: Math.round(baseValid * 0.44),
      mrr: Math.round(baseValid * 0.44 * 199),
      mrrSharePct: 43.8,
      newSales: Math.round(newMembers * 0.42),
      churn: Math.round(totalChurn * 0.38),
      churnRatePct: 3.6,
      avgSellingPrice: 199,
      avgActiveMemberships: Math.round(baseValid * 0.44 * 0.99),
      avgWashesPerMember: 3.2,
      revenuePerMember: 199,
      washCount: Math.round(baseValid * 0.44 * 0.99 * 3.2)
    },
    {
      packageId: 'nano',
      packageName: PACKAGES.nano.name,
      arabicName: PACKAGES.nano.arabicName,
      validMembers: Math.round(baseValid * 0.23),
      mrr: Math.round(baseValid * 0.23 * 289),
      mrrSharePct: 33.1,
      newSales: Math.round(newMembers * 0.24),
      churn: Math.round(totalChurn * 0.25),
      churnRatePct: 4.6,
      avgSellingPrice: 289,
      avgActiveMemberships: Math.round(baseValid * 0.23 * 0.98),
      avgWashesPerMember: 3.9,
      revenuePerMember: 289,
      washCount: Math.round(baseValid * 0.23 * 0.98 * 3.9)
    },
    {
      packageId: 'interior_addon',
      packageName: PACKAGES.interior_addon.name,
      arabicName: PACKAGES.interior_addon.arabicName,
      validMembers: Math.round(baseValid * 0.14),
      mrr: Math.round(baseValid * 0.14 * 99),
      mrrSharePct: 3.0,
      newSales: Math.round(newMembers * 0.12),
      churn: Math.round(totalChurn * 0.11),
      churnRatePct: 3.2,
      avgSellingPrice: 99,
      avgActiveMemberships: Math.round(baseValid * 0.14 * 0.97),
      avgWashesPerMember: 1.8,
      revenuePerMember: 99,
      washCount: Math.round(baseValid * 0.14 * 0.97 * 1.8)
    }
  ];

  // Cohort retention
  const cohortRetention: CohortRetentionRow[] = [
    { cohortMonth: 'Mar 2026', joinedMembers: 245, month1Rate: 88.2, month2Rate: 79.4, month3Rate: 74.1, month6Rate: 64.8 },
    { cohortMonth: 'Apr 2026', joinedMembers: 280, month1Rate: 89.6, month2Rate: 81.0, month3Rate: 75.5, month6Rate: 66.2 },
    { cohortMonth: 'May 2026', joinedMembers: 310, month1Rate: 90.1, month2Rate: 82.5, month3Rate: 77.0, month6Rate: 67.4 },
    { cohortMonth: 'Jun 2026', joinedMembers: 340, month1Rate: 91.2, month2Rate: 83.1, month3Rate: 78.4, month6Rate: 68.9 },
    { cohortMonth: 'Jul 2026', joinedMembers: 388, month1Rate: 92.0, month2Rate: 84.6, month3Rate: 79.8, month6Rate: 0 },
    { cohortMonth: 'Aug 2026', joinedMembers: 412, month1Rate: 93.4, month2Rate: 85.9, month3Rate: 0, month6Rate: 0 },
  ];

  const managementValues: ManagementValueMetrics = {
    arpm: baseValid > 0 ? Math.round(closingMRR / baseValid) : 213,
    arpmChangePct: 2.4,
    avgMembershipPrice: 216,
    avgWashesPerMember: avgWashesPerMemberMonth,
    revenuePerWash: Math.round(revenuePerWash),
    totalWashesInPeriod: totalWashesInPeriod,
    estimatedLtv: 2480
  };

  const alerts: AttentionAlert[] = [];

  if (renewalCollectionRate < 95.0) {
    alerts.push({
      id: 'alert_renewal_rate',
      severity: 'warning',
      title: `Renewal Collection Rate at ${renewalCollectionRate}%`,
      description: `Collection rate is down 1.8% vs prior period due to elevated initial bank card declines.`,
      metric: `${renewalCollectionRate}% Rate`,
      actionText: 'Inspect Payment Failures',
      targetFilter: { type: 'failed_renewals' }
    });
  }

  if (washUsage.usageTiers[0].membersCount > 200) {
    alerts.push({
      id: 'alert_inactive_members',
      severity: 'warning',
      title: `${washUsage.usageTiers[0].membersCount} Inactive Members (0 Washes in 30 Days)`,
      description: `12% of valid members have not visited this month. Send win-back / refresh SMS to protect next cycle renewals.`,
      metric: `${washUsage.usageTiers[0].membersCount} Inactive`,
      actionText: 'View Inactive Members',
      targetFilter: { type: 'recoverable' }
    });
  }

  return {
    executiveMetrics,
    trendPoints,
    membershipWaterfall,
    salesBreakdown,
    churnAnalysis,
    paymentHealth,
    revenueBreakdown,
    packageTable,
    cohortRetention,
    managementValues,
    washUsage,
    alerts
  };
}
