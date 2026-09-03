import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  DollarSign, 
  ShoppingBag, 
  UserCheck, 
  Gauge, 
  Repeat, 
  Layers, 
  Users
} from 'lucide-react';
import { ActiveDomainTab } from './DashboardHeader';

interface DashboardShellProps {
  children: React.ReactNode;
  activeDomain: ActiveDomainTab;
  onDomainChange: (domain: ActiveDomainTab) => void;
  onDrilldown: (type: any) => void;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  children,
  activeDomain,
  onDomainChange,
  onDrilldown
}) => {
  const domains = [
    { id: 'glance', label: 'Executive Glance', icon: LayoutDashboard, badge: 'Overview' },
    { id: 'revenue', label: 'Revenue & MRR', icon: DollarSign },
    { id: 'sales', label: 'Sales & Conversion', icon: ShoppingBag },
    { id: 'memberships', label: 'Memberships & Churn', icon: UserCheck, count: '3,207' },
    { id: 'usage', label: 'Wash Usage & Fleet', icon: Gauge, alert: true },
    { id: 'baremetrics', label: 'Baremetrics SaaS', icon: Layers, badge: 'New' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* SIDEBAR (Desktop) */}
      <aside className="hidden xl:flex flex-col w-64 bg-[#101a14] text-white shrink-0 border-r border-slate-800 select-none">
        {/* Logo & Company */}
        <div className="p-5 border-b border-[#1c2c22] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#83d4a7] text-[#101a14] font-extrabold font-display text-lg flex items-center justify-center shadow-md shadow-emerald-950/40">
              R
            </div>
            <div>
              <div className="font-display font-extrabold text-base tracking-wide text-white">
                RUSH <span className="text-[#83d4a7]">WASH</span>
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Saudi CRM & Analytics
              </div>
            </div>
          </div>
        </div>

        {/* Domain Navigation */}
        <div className="px-3 py-4 flex-1 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Analytics Domains
          </div>

          {domains.map((item) => {
            const Icon = item.icon;
            const isActive = activeDomain === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onDomainChange(item.id as ActiveDomainTab)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#203628] text-white font-bold shadow-inner'
                    : 'text-slate-300 hover:bg-[#16251c] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#83d4a7]' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#345c43] text-[#83d4a7]">
                    {item.badge}
                  </span>
                )}

                {item.count && (
                  <span className="text-[10px] font-mono text-slate-400">
                    {item.count}
                  </span>
                )}

                {item.alert && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                )}
              </button>
            );
          })}

          {/* Quick Drilldown Triggers */}
          <div className="pt-5 px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Quick Action Queues
          </div>

          <button
            onClick={() => onDrilldown('failed_renewals')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-[#16251c] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Repeat className="w-3.5 h-3.5 text-amber-400" />
              <span>Retry Queue</span>
            </div>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-900/60 text-amber-300 font-mono">
              34 Retries
            </span>
          </button>

          <button
            onClick={() => onDrilldown('valid_members')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-[#16251c] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Member Directory</span>
            </div>
          </button>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-[#1c2c22] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-900 border border-emerald-700 text-[#83d4a7] flex items-center justify-center font-bold text-xs font-mono">
            HQ
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              Operations Director
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              RUSH Car Wash KSA
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-w-0 flex flex-col">
        {children}
      </div>
    </div>
  );
};
