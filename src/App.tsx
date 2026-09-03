import React, { useState, useMemo } from 'react';
import { 
  DateRangePreset, 
  ComparisonType, 
  LocationId, 
  PackageTier, 
  Granularity, 
  ModalDrilldownType, 
  AttentionAlert 
} from './types/dashboard';
import { calculateDashboardAnalytics, DashboardFilterState } from './services/analyticsService';
import { DashboardShell } from './components/layout/DashboardShell';
import { DashboardHeader, ActiveDomainTab } from './components/layout/DashboardHeader';
import { FlexWashGlance } from './components/layout/FlexWashGlance';
import { NeedsAttention } from './components/alerts/NeedsAttention';
import { RevenueTrendChart } from './components/charts/RevenueTrendChart';
import { MembershipMovement } from './components/charts/MembershipMovement';
import { MembershipSales } from './components/charts/PackageMixChart';
import { ChurnBreakdown } from './components/charts/ChurnBreakdown';
import { PaymentHealthFunnelComponent } from './components/charts/PaymentHealthFunnel';
import { RevenueBreakdown } from './components/charts/RevenueBreakdown';
import { PackagePerformanceTable } from './components/tables/PackagePerformanceTable';
import { RetentionAndValue } from './components/tables/CohortRetentionTable';
import { WashUsageDashboard } from './components/charts/WashUsageDashboard';
import { BaremetricsDashboard } from './components/charts/BaremetricsDashboard';
import { DrilldownModal } from './components/modals/DrilldownModal';

export function App() {
  // Domain Tab Navigation
  const [activeDomain, setActiveDomain] = useState<ActiveDomainTab>('glance');

  // Filter States
  const [dateRange, setDateRange] = useState<DateRangePreset>('thisMonth');
  const [comparison, setComparison] = useState<ComparisonType>('previous_period');
  const [location, setLocation] = useState<LocationId>('all');
  const [packageFilter, setPackageFilter] = useState<PackageTier | 'all'>('all');
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [showComparisonTrend, setShowComparisonTrend] = useState(true);

  // UI States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalType, setModalType] = useState<ModalDrilldownType | null>(null);

  // Centralized analytics engine invocation
  const filterState: DashboardFilterState = useMemo(() => ({
    dateRange,
    comparison,
    location,
    packageFilter,
    granularity
  }), [dateRange, comparison, location, packageFilter, granularity]);

  const analytics = useMemo(() => {
    return calculateDashboardAnalytics(filterState);
  }, [filterState]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 450);
  };

  const handleAlertAction = (alert: AttentionAlert) => {
    if (alert.targetFilter?.type === 'failed_renewals' || alert.targetFilter?.type === 'recoverable') {
      setModalType('failed_renewals');
    } else if (alert.targetFilter?.type === 'churn_nano') {
      setModalType('voluntary_churn');
    } else {
      setModalType('failed_renewals');
    }
  };

  return (
    <DashboardShell 
      activeDomain={activeDomain} 
      onDomainChange={setActiveDomain}
      onDrilldown={setModalType}
    >
      {/* Top sticky controls bar */}
      <DashboardHeader
        activeDomain={activeDomain}
        onDomainChange={setActiveDomain}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        comparison={comparison}
        onComparisonChange={setComparison}
        location={location}
        onLocationChange={setLocation}
        packageFilter={packageFilter}
        onPackageFilterChange={setPackageFilter}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Main Dashboard Canvas */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5">
        {/* SECTION 11 — NEEDS ATTENTION / RULE-BASED ALERTS */}
        <NeedsAttention 
          alerts={analytics.alerts} 
          onActionClick={handleAlertAction} 
        />

        {/* DOMAIN 1: EXECUTIVE AT A GLANCE (The FlexWash UX layout) */}
        {activeDomain === 'glance' && (
          <FlexWashGlance
            metrics={analytics.executiveMetrics}
            trendPoints={analytics.trendPoints}
            salesBreakdown={analytics.salesBreakdown}
            churnAnalysis={analytics.churnAnalysis}
            paymentHealth={analytics.paymentHealth}
            packages={analytics.packageTable}
            onDrilldown={setModalType}
            onGoToAnalytics={() => setActiveDomain('revenue')}
          />
        )}

        {/* DOMAIN 2: REVENUE & MRR ANALYTICS */}
        {activeDomain === 'revenue' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-7">
                <RevenueTrendChart
                  data={analytics.trendPoints}
                  granularity={granularity}
                  onGranularityChange={setGranularity}
                  showComparison={showComparisonTrend}
                  onToggleComparison={() => setShowComparisonTrend(!showComparisonTrend)}
                />
              </div>
              <div className="lg:col-span-5">
                <RevenueBreakdown
                  categories={analytics.revenueBreakdown}
                  totalRevenue={analytics.executiveMetrics.netRevenue.current}
                />
              </div>
            </div>

            <PaymentHealthFunnelComponent
              data={analytics.paymentHealth}
              onViewFailures={() => setModalType('failed_renewals')}
            />
          </div>
        )}

        {/* DOMAIN 3: MEMBERSHIP SALES & GROWTH */}
        {activeDomain === 'sales' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-6">
                <MembershipSales
                  data={analytics.salesBreakdown}
                  onPackageClick={(pkgId) => setPackageFilter(pkgId as PackageTier)}
                />
              </div>
              <div className="lg:col-span-6">
                <MembershipMovement 
                  data={analytics.membershipWaterfall} 
                />
              </div>
            </div>

            <PackagePerformanceTable
              rows={analytics.packageTable}
              onPackageClick={(pkgId) => setPackageFilter(pkgId as PackageTier)}
            />
          </div>
        )}

        {/* DOMAIN 4: MEMBERSHIPS, CHURN & RETENTION */}
        {activeDomain === 'memberships' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-6">
                <ChurnBreakdown
                  data={analytics.churnAnalysis}
                  onDrilldown={() => setModalType('voluntary_churn')}
                />
              </div>
              <div className="lg:col-span-6">
                <MembershipMovement 
                  data={analytics.membershipWaterfall} 
                />
              </div>
            </div>

            <RetentionAndValue
              cohorts={analytics.cohortRetention}
              managementValues={analytics.managementValues}
            />
          </div>
        )}

        {/* DOMAIN 5: CAR WASH USAGE & CAPACITY FLEET */}
        {activeDomain === 'usage' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <WashUsageDashboard
              usage={analytics.washUsage}
              onFilterSleepers={() => setModalType('valid_members')}
            />

            <PackagePerformanceTable
              rows={analytics.packageTable}
              onPackageClick={(pkgId) => setPackageFilter(pkgId as PackageTier)}
            />
          </div>
        )}

        {/* DOMAIN 6: BAREMETRICS SAAS INTELLIGENCE */}
        {activeDomain === 'baremetrics' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <BaremetricsDashboard
              metrics={analytics.executiveMetrics}
              trendPoints={analytics.revenueTrendSeries}
              salesBreakdown={analytics.salesBreakdown}
              churnAnalysis={analytics.churnAnalysis}
              paymentHealth={analytics.paymentHealth}
              packages={analytics.packageTable}
              onOpenDrilldown={(type) => setModalType(type)}
            />
          </div>
        )}
      </main>

      {/* DRILLDOWN MODAL */}
      <DrilldownModal
        type={modalType}
        onClose={() => setModalType(null)}
        selectedPackageFilter={packageFilter}
      />
    </DashboardShell>
  );
}

export default App;
