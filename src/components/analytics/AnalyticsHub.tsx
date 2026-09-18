import React from 'react';
import { 
  ShoppingBag, 
  UserCheck, 
  Users, 
  Sparkles, 
  Gauge
} from 'lucide-react';
import { 
  Granularity, 
  LocationId, 
  PackageTier, 
  ModalDrilldownType 
} from '../../types/dashboard';
import { MembershipMovement } from '../charts/MembershipMovement';
import { MembershipSales } from '../charts/PackageMixChart';
import { ChurnBreakdown } from '../charts/ChurnBreakdown';
import { PackagePerformanceTable } from '../tables/PackagePerformanceTable';
import { RetentionAndValue } from '../tables/CohortRetentionTable';
import { WashUsageDashboard } from '../charts/WashUsageDashboard';
import { SalesTeamPerformance } from '../sales/SalesTeamPerformance';
import { RetentionDashboard } from '../cancellation/RetentionDashboard';

export type AnalyticsSubTab = 
  | 'sales' 
  | 'memberships' 
  | 'team' 
  | 'retention' 
  | 'usage';

interface AnalyticsHubProps {
  analytics: any;
  activeSubTab: AnalyticsSubTab;
  onSubTabChange: (tab: AnalyticsSubTab) => void;
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  showComparisonTrend: boolean;
  onToggleComparison: () => void;
  onPackageFilter: (pkg: PackageTier | 'all') => void;
  onLocationFilter: (loc: LocationId) => void;
  onDrilldown: (type: ModalDrilldownType) => void;
  onOpenCancelModalForMember: (member: any) => void;
}

export const AnalyticsHub: React.FC<AnalyticsHubProps> = ({
  analytics,
  activeSubTab,
  onSubTabChange,
  granularity,
  onGranularityChange,
  showComparisonTrend,
  onToggleComparison,
  onPackageFilter,
  onLocationFilter,
  onDrilldown,
  onOpenCancelModalForMember
}) => {
  const subTabs: { id: AnalyticsSubTab; label: string; icon: React.FC<{ className?: string }>; badge?: string }[] = [
    { id: 'sales', label: 'Sales & Growth', icon: ShoppingBag, badge: 'Key Focus' },
    { id: 'memberships', label: 'Membership & Churn', icon: UserCheck, badge: 'Retention' },
    { id: 'team', label: 'Sales Team', icon: Users },
    { id: 'retention', label: 'Save Offers & Retention', icon: Sparkles },
    { id: 'usage', label: 'Wash Usage & Fleet', icon: Gauge },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Bar for Analytics Hub */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-2xs">
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <div className="flex items-center gap-1.5 min-w-max">
            {subTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSubTabChange(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#c91e2f] text-white shadow-sm shadow-[#c91e2f]/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                      isActive ? 'bg-black/30 text-white' : 'bg-rose-50 text-[#c91e2f]'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 1. SALES & GROWTH */}
      {activeSubTab === 'sales' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6">
              <MembershipSales
                data={analytics.salesBreakdown}
                onPackageClick={(pkgId) => onPackageFilter(pkgId as PackageTier)}
                onViewTeam={() => onSubTabChange('team')}
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
            onPackageClick={(pkgId) => onPackageFilter(pkgId as PackageTier)}
          />

          <SalesTeamPerformance
            data={analytics.salesTeam}
            onPackageClick={(pkgId) => onPackageFilter(pkgId as PackageTier)}
            onLocationSelect={(locId) => onLocationFilter(locId as LocationId)}
          />
        </div>
      )}

      {/* 2. MEMBERSHIP & CHURN */}
      {activeSubTab === 'memberships' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6">
              <ChurnBreakdown
                data={analytics.churnAnalysis}
                onDrilldown={() => onDrilldown('voluntary_churn')}
                onGoToRetention={() => onSubTabChange('retention')}
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

      {/* 3. SALES TEAM */}
      {activeSubTab === 'team' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <SalesTeamPerformance
            data={analytics.salesTeam}
            onPackageClick={(pkgId) => onPackageFilter(pkgId as PackageTier)}
            onLocationSelect={(locId) => onLocationFilter(locId as LocationId)}
          />
        </div>
      )}

      {/* 5. RETENTION & SAVE FLOWS */}
      {activeSubTab === 'retention' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <RetentionDashboard onOpenCancelModalForMember={onOpenCancelModalForMember} />
        </div>
      )}

      {/* 6. WASH USAGE & FLEET */}
      {activeSubTab === 'usage' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <WashUsageDashboard
            usage={analytics.washUsage}
            onFilterSleepers={() => onDrilldown('valid_members')}
          />

          <PackagePerformanceTable
            rows={analytics.packageTable}
            onPackageClick={(pkgId) => onPackageFilter(pkgId as PackageTier)}
          />
        </div>
      )}
    </div>
  );
};
