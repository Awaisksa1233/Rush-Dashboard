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
import { fetchDashboardSummary } from './services/apiClient';
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
import { SalesTeamPerformance } from './components/sales/SalesTeamPerformance';
import { RetentionDashboard } from './components/cancellation/RetentionDashboard';
import { CancellationFlowModal } from './components/cancellation/CancellationFlowModal';
import { CustomerCancelPage } from './components/cancellation/CustomerCancelPage';
import { DrilldownModal } from './components/modals/DrilldownModal';
import { AnalyticsHub, AnalyticsSubTab } from './components/analytics/AnalyticsHub';

export function App() {
  // Path / Route state (handles /cancel, /v1, and /)
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      const h = window.location.hash;
      const q = new URLSearchParams(window.location.search).get('route');
      if (p.startsWith('/cancel') || h.startsWith('#/cancel') || h === '#cancel' || q === 'cancel') {
        return '/cancel';
      }
      if (p.startsWith('/v1') || h.startsWith('#/v1') || h === '#v1' || q === 'v1') {
        return p.startsWith('/v1') ? p : '/v1/';
      }
    }
    return '/';
  });

  // Listen to browser navigation changes
  React.useEffect(() => {
    const handleLocationChange = () => {
      const p = window.location.pathname;
      const h = window.location.hash;
      const q = new URLSearchParams(window.location.search).get('route');
      if (p.startsWith('/cancel') || h.startsWith('#/cancel') || h === '#cancel' || q === 'cancel') {
        setCurrentPath('/cancel');
      } else if (p.startsWith('/v1') || h.startsWith('#/v1') || h === '#v1' || q === 'v1') {
        setCurrentPath(p.startsWith('/v1') ? p : '/v1/');
      } else {
        setCurrentPath(p || '/');
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
  };

  const isV1 = currentPath.startsWith('/v1');

  // Domain Tab Navigation
  const [activeDomain, setActiveDomain] = useState<ActiveDomainTab>('glance');
  // SubTab Navigation within Analytics Hub
  const [analyticsSubTab, setAnalyticsSubTab] = useState<AnalyticsSubTab>('sales');

  // React to URL changes for tab / subtab deep linking
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      const h = window.location.hash;
      const q = new URLSearchParams(window.location.search).get('tab');
      if (p.includes('/analytics') || h.includes('analytics') || q === 'analytics') {
        setActiveDomain('analytics');
      }
      const sub = new URLSearchParams(window.location.search).get('sub');
      if (sub && ['sales', 'memberships', 'team', 'usage'].includes(sub)) {
        setAnalyticsSubTab(sub as AnalyticsSubTab);
      }
    }
  }, [currentPath]);

  const handleDomainChange = (domain: ActiveDomainTab) => {
    if (isV1) {
      if (domain === 'glance') {
        setActiveDomain('glance');
      } else if (domain === 'analytics') {
        setActiveDomain('analytics');
      } else {
        setActiveDomain('analytics');
        setAnalyticsSubTab(domain as AnalyticsSubTab);
      }
    } else {
      setActiveDomain(domain);
    }
  };

  const handleToggleV1 = () => {
    if (isV1) {
      navigate('/');
    } else {
      navigate('/v1/');
    }
  };

  // Filter States
  const [dateRange, setDateRange] = useState<DateRangePreset>('thisMonth');
  const [comparison, setComparison] = useState<ComparisonType>('previous_period');
  const [location, setLocation] = useState<LocationId>('all');
  const [packageFilter, setPackageFilter] = useState<PackageTier | 'all'>('all');
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [showComparisonTrend, setShowComparisonTrend] = useState(true);

  // Live Data State from MongoDB Atlas
  const [liveData, setLiveData] = useState<any>(null);

  // UI States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalType, setModalType] = useState<ModalDrilldownType | null>(null);
  const [cancelModalMember, setCancelModalMember] = useState<any>(null);

  // Initial fetch of live MongoDB data
  React.useEffect(() => {
    fetchDashboardSummary().then(data => {
      if (data) setLiveData(data);
    });
  }, []);

  // Centralized analytics engine invocation
  const filterState: DashboardFilterState = useMemo(() => ({
    dateRange,
    comparison,
    location,
    packageFilter,
    granularity
  }), [dateRange, comparison, location, packageFilter, granularity]);

  const analytics = useMemo(() => {
    return calculateDashboardAnalytics(filterState, liveData);
  }, [filterState, liveData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchDashboardSummary();
      if (data) setLiveData(data);
    } catch (e) {
      console.warn('Refresh error:', e);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 450);
    }
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

  if (currentPath === '/cancel') {
    return <CustomerCancelPage onBackToDashboard={() => navigate('/')} />;
  }

  return (
    <DashboardShell 
      activeDomain={activeDomain} 
      onDomainChange={handleDomainChange}
      onDrilldown={setModalType}
      isV1={isV1}
      analyticsSubTab={analyticsSubTab}
      onSelectAnalyticsSubTab={(sub) => {
        setActiveDomain('analytics');
        setAnalyticsSubTab(sub);
      }}
    >
      {/* Top sticky controls bar */}
      <DashboardHeader
        activeDomain={activeDomain}
        onDomainChange={handleDomainChange}
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
        onOpenCancelPortal={() => navigate('/cancel')}
        isV1={isV1}
        onToggleV1={handleToggleV1}
      />

      {/* Main Dashboard Canvas */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8">
        {/* SECTION — NEEDS ATTENTION / RULE-BASED ALERTS */}
        <NeedsAttention 
          alerts={analytics.alerts} 
          onActionClick={handleAlertAction} 
        />

        {/* V1 STREAMLINED MODE: At a Glance + Consolidated Analytics */}
        {isV1 ? (
          <>
            {activeDomain === 'glance' && (
              <FlexWashGlance
                metrics={analytics.executiveMetrics}
                trendPoints={analytics.trendPoints}
                salesBreakdown={analytics.salesBreakdown}
                churnAnalysis={analytics.churnAnalysis}
                paymentHealth={analytics.paymentHealth}
                packages={analytics.packageTable}
                onDrilldown={setModalType}
                onGoToAnalytics={() => {
                  setActiveDomain('analytics');
                  setAnalyticsSubTab('sales');
                }}
              />
            )}

            {activeDomain === 'analytics' && (
              <AnalyticsHub
                analytics={analytics}
                activeSubTab={analyticsSubTab}
                onSubTabChange={setAnalyticsSubTab}
                granularity={granularity}
                onGranularityChange={setGranularity}
                showComparisonTrend={showComparisonTrend}
                onToggleComparison={() => setShowComparisonTrend(!showComparisonTrend)}
                onPackageFilter={(pkg) => setPackageFilter(pkg)}
                onLocationFilter={(loc) => setLocation(loc)}
                onDrilldown={setModalType}
                onOpenCancelModalForMember={(m) => setCancelModalMember(m)}
              />
            )}
          </>
        ) : (
          /* CLASSIC ALL-TABS MODE */
          <>
            {/* DOMAIN 1: EXECUTIVE AT A GLANCE */}
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6">
                <MembershipSales
                  data={analytics.salesBreakdown}
                  onPackageClick={(pkgId) => setPackageFilter(pkgId as PackageTier)}
                  onViewTeam={() => setActiveDomain('team')}
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

            {/* SECTION: SALES TEAM PERFORMANCE */}
            <SalesTeamPerformance
              data={analytics.salesTeam}
              onPackageClick={(pkgId) => setPackageFilter(pkgId as PackageTier)}
              onLocationSelect={(locId) => setLocation(locId as LocationId)}
            />
          </div>
        )}

        {/* DOMAIN: SALES TEAM DEDICATED VIEW */}
        {activeDomain === 'team' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <SalesTeamPerformance
              data={analytics.salesTeam}
              onPackageClick={(pkgId) => setPackageFilter(pkgId as PackageTier)}
              onLocationSelect={(locId) => setLocation(locId as LocationId)}
            />
          </div>
        )}

        {/* DOMAIN 4: MEMBERSHIPS, CHURN & RETENTION */}
        {activeDomain === 'memberships' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6">
                <ChurnBreakdown
                  data={analytics.churnAnalysis}
                  onDrilldown={() => setModalType('voluntary_churn')}
                  onGoToRetention={() => setActiveDomain('retention')}
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

        {/* DOMAIN: RETENTION, SAVE OFFERS & ABUSE GUARDS */}
        {activeDomain === 'retention' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <RetentionDashboard onOpenCancelModalForMember={(m) => setCancelModalMember(m)} />
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
              trendPoints={analytics.trendPoints}
              salesBreakdown={analytics.salesBreakdown}
              churnAnalysis={analytics.churnAnalysis}
              paymentHealth={analytics.paymentHealth}
              packages={analytics.packageTable}
              onOpenDrilldown={(type) => setModalType(type)}
            />
          </div>
        )}
          </>
        )}
      </main>

      {/* DRILLDOWN MODAL */}
      <DrilldownModal
        type={modalType}
        onClose={() => setModalType(null)}
        selectedPackageFilter={packageFilter}
        onOpenCancelFlow={(m) => {
          setModalType(null);
          setCancelModalMember(m);
        }}
      />

      {/* CANCELLATION FLOW & SAVE OFFERS MODAL */}
      <CancellationFlowModal
        isOpen={!!cancelModalMember}
        onClose={() => setCancelModalMember(null)}
        customerData={cancelModalMember}
        onSuccess={handleRefresh}
      />
    </DashboardShell>
  );
}

export default App;
