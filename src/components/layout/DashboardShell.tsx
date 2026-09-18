import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  DollarSign, 
  ShoppingBag, 
  UserCheck, 
  Gauge, 
  Repeat, 
  Layers, 
  Users,
  Flag,
  Sparkles,
  FileText
} from 'lucide-react';
import { ActiveDomainTab } from './DashboardHeader';
import productionData from '../../data/productionCrmData.json';

interface DashboardShellProps {
  children: React.ReactNode;
  activeDomain: ActiveDomainTab;
  onDomainChange: (domain: ActiveDomainTab) => void;
  onDrilldown: (type: any) => void;
  isV1?: boolean;
  analyticsSubTab?: string;
  onSelectAnalyticsSubTab?: (subTab: any) => void;
}

interface DomainItem {
  id: string;
  label: string;
  icon: any;
  badge?: string;
  count?: string | number;
  alert?: boolean;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  children,
  activeDomain,
  onDomainChange,
  onDrilldown,
  isV1 = false,
  analyticsSubTab,
  onSelectAnalyticsSubTab
}) => {
  const validCount = (productionData.validMembers?.length || 0).toLocaleString();
  const failedCount = productionData.failedRenewals?.length || 0;

  const classicDomains: DomainItem[] = [
    { id: 'glance', label: 'Executive Glance', icon: LayoutDashboard, badge: 'Overview' },
    { id: 'revenue', label: 'Revenue & MRR', icon: DollarSign },
    { id: 'sales', label: 'Sales & Conversion', icon: ShoppingBag },
    { id: 'team', label: 'Sales Team & Reps', icon: Users, badge: 'Rep KPI' },
    { id: 'memberships', label: 'Memberships & Churn', icon: UserCheck, count: validCount },
    { id: 'retention', label: 'Retention & Save Flows', icon: Sparkles, badge: 'Churnkey' },
    { id: 'usage', label: 'Wash Usage & Fleet', icon: Gauge, alert: true },
    { id: 'baremetrics', label: 'Baremetrics SaaS', icon: Layers, badge: 'SaaS' },
  ];

  const v1SubItems: DomainItem[] = [
    { id: 'sales', label: 'Sales & Growth', icon: ShoppingBag, badge: 'Key' },
    { id: 'memberships', label: 'Membership, Churn & Retention', icon: UserCheck, count: validCount },
    { id: 'team', label: 'Sales Team', icon: Users },
    { id: 'usage', label: 'Wash Usage', icon: Gauge },
    { id: 'kpi_guide', label: 'KPI Guide (.md)', icon: FileText, badge: 'Docs' },
  ];

  const v1Domains: DomainItem[] = [
    { id: 'glance', label: 'Executive Glance', icon: LayoutDashboard, badge: 'Overview' },
    { id: 'analytics', label: 'Analytics Hub', icon: Layers, badge: 'Hub' },
  ];

  const domains: DomainItem[] = isV1 ? v1Domains : classicDomains;

  return (
    <div className="min-h-screen bg-[#f2f2f2] flex text-[#000000]">
      {/* SIDEBAR (Desktop) — RUSH Deep Black with Red Accents */}
      <aside className="hidden xl:flex flex-col w-64 bg-[#000000] text-white shrink-0 border-r border-[#222222] select-none">
        {/* Logo & Company — Official RUSH Typography */}
        <div className="p-5 border-b border-[#1f1f1f] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* RUSH Dynamic Logo Icon */}
            <div className="w-10 h-10 rounded-xl bg-[#c91e2f] text-white font-extrabold font-display text-xl flex items-center justify-center shadow-lg shadow-[#c91e2f]/25 tracking-tighter">
              R
            </div>
            <div>
              <div className="font-display font-black text-lg tracking-wider text-white flex items-center gap-1">
                <span>RUSH</span>
                <span className="text-[#c91e2f] text-sm">رش</span>
              </div>
              <div className="text-[9px] text-[#999999] uppercase tracking-widest font-semibold font-sans">
                Get in, Get Clean, Get Going
              </div>
            </div>
          </div>
        </div>

        {/* Domain Navigation */}
        <div className="px-3 py-4 flex-1 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#777777]">
            Analytics Domains
          </div>

          {domains.map((item) => {
            const Icon = item.icon;
            const isActive = activeDomain === item.id;
            return (
              <React.Fragment key={item.id}>
                <button
                  onClick={() => onDomainChange(item.id as ActiveDomainTab)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#c91e2f] text-white shadow-md shadow-[#c91e2f]/30'
                      : 'text-[#cccccc] hover:bg-[#161616] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#888888]'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isActive ? 'bg-black/30 text-white' : 'bg-[#1f1f1f] text-[#c91e2f]'
                    }`}>
                      {item.badge}
                    </span>
                  )}

                  {item.count && (
                    <span className="text-[10px] font-mono text-[#888888]">
                      {item.count}
                    </span>
                  )}

                  {item.alert && (
                    <span className="w-2 h-2 rounded-full bg-[#c91e2f] animate-pulse"></span>
                  )}
                </button>

                {/* Sub-items for Analytics Hub in V1 */}
                {isV1 && item.id === 'analytics' && activeDomain === 'analytics' && (
                  <div className="pl-3 pr-1 py-1 space-y-0.5 border-l border-[#262626] ml-4 my-1">
                    {v1SubItems.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = analyticsSubTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => {
                            onDomainChange('analytics');
                            onSelectAnalyticsSubTab?.(sub.id);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                            isSubActive
                              ? 'bg-[#1a1a1a] text-[#ff6b7b] font-bold'
                              : 'text-[#999999] hover:text-white hover:bg-[#141414]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <SubIcon className={`w-3.5 h-3.5 ${isSubActive ? 'text-[#c91e2f]' : 'text-[#666666]'}`} />
                            <span>{sub.label}</span>
                          </div>
                          {sub.badge && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-red-950/70 text-red-400 font-semibold">
                              {sub.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {/* Quick Action Queues */}
          <div className="pt-5 px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#777777]">
            Quick Action Queues
          </div>

          {!isV1 && (
            <button
              onClick={() => onDomainChange('retention')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-[#cccccc] hover:bg-[#161616] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Save Flows Center</span>
              </div>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 font-mono">
                54% Saved
              </span>
            </button>
          )}

          <button
            onClick={() => onDrilldown('failed_renewals')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-[#cccccc] hover:bg-[#161616] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Repeat className="w-3.5 h-3.5 text-[#c91e2f]" />
              <span>Retry Queue</span>
            </div>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#291417] text-[#ff6b7b] font-mono">
              {failedCount} Retries
            </span>
          </button>

          <button
            onClick={() => onDrilldown('valid_members')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-[#cccccc] hover:bg-[#161616] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Active Fleet</span>
            </div>
            <span className="text-[10px] font-mono text-[#888888]">{validCount} Cars</span>
          </button>

          {/* KPI Guide Link */}
          <div className="pt-4 px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#777777]">
            Documentation
          </div>

          <button
            onClick={() => {
              onDomainChange('analytics');
              onSelectAnalyticsSubTab?.('kpi_guide');
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-[#cccccc] hover:bg-[#161616] hover:text-white transition-colors cursor-pointer"
            title="Open KPI Calculations Guide"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>KPI Guide (.md)</span>
            </div>
            <span className="text-[10px] font-mono text-[#888888]">In-App</span>
          </button>
        </div>

        {/* Brand Promise Footer Quote from Guidelines */}
        <div className="p-4 border-t border-[#1f1f1f] bg-[#0a0a0a]">
          <div className="text-[10px] font-bold text-[#c91e2f] uppercase tracking-wider">
            RUSH Brand Essence
          </div>
          <div className="text-[11px] text-[#888888] mt-1 leading-snug">
            &ldquo;Efficient Speed, Exceptional Clean. Results in just 6 minutes.&rdquo;
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  );
};
