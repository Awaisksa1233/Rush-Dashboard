import React, { useState } from 'react';
import { PackageEconomicsRow } from '../../types/dashboard';
import { formatSAR } from '../../services/analyticsService';
import { InfoTooltip } from '../common/Tooltip';
import { ArrowUpDown, Download, Check } from 'lucide-react';
import { PACKAGES } from '../../data/packages';

interface PackagePerformanceTableProps {
  rows: PackageEconomicsRow[];
  onPackageClick?: (pkgId: string) => void;
}

type SortField = 'packageName' | 'validMembers' | 'mrr' | 'newSales' | 'churnRatePct' | 'avgWashesPerMember' | 'revenuePerMember';

export const PackagePerformanceTable: React.FC<PackagePerformanceTableProps> = ({ rows, onPackageClick }) => {
  const [sortField, setSortField] = useState<SortField>('mrr');
  const [sortAsc, setSortAsc] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  const sortedRows = [...rows].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc ? (Number(valA) - Number(valB)) : (Number(valB) - Number(valA));
  });

  function exportCSV() {
    const headers = [
      'Package', 'Valid Members', 'MRR (SAR)', 'MRR Share %', 'New Sales', 
      'Churn (Units)', 'Churn Rate %', 'Avg Price (SAR)', 'Avg Washes / Member (Exposure-Based)', 'Revenue / Member (SAR)'
    ];
    const csvContent = [
      headers.join(','),
      ...sortedRows.map(r => [
        `"${r.packageName}"`,
        r.validMembers,
        r.mrr,
        `${r.mrrSharePct}%`,
        r.newSales,
        r.churn,
        `${r.churnRatePct}%`,
        r.avgSellingPrice,
        r.avgWashesPerMember,
        r.revenuePerMember
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rush_package_economics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="glass-card rounded-xl p-5 overflow-hidden">
      {/* Header & CSV Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display font-bold text-base text-slate-900">
              Package Economics & Wash Utilization
            </h3>
            <span className="text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
              Exposure-Weighted
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Unit economics, MRR contribution, and wash utilization based on active member-days exposure
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs self-start sm:self-auto"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Download className="w-3.5 h-3.5 text-slate-500" />}
          <span>{copied ? 'Exported!' : 'Export CSV'}</span>
        </button>
      </div>

      {/* Exposure Note Callout */}
      <div className="mb-4 text-[11px] text-slate-600 bg-emerald-50/50 border border-emerald-200/60 rounded-lg p-2.5 flex items-center justify-between">
        <span>
          <strong className="text-emerald-900 font-semibold">Exposure Formula:</strong> Avg Washes / Member = Member Washes / Average Active Memberships (sum of valid member-days in period / calendar days).
        </span>
        <span className="text-slate-400 hidden md:inline">Saudi Standard Accounting</span>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 font-medium">
              <th className="pb-3 pr-4 cursor-pointer hover:text-slate-800" onClick={() => handleSort('packageName')}>
                <div className="flex items-center gap-1">
                  <span>Package Tier</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="pb-3 px-3 text-right cursor-pointer hover:text-slate-800" onClick={() => handleSort('validMembers')}>
                <div className="flex items-center justify-end gap-1">
                  <span>Valid Members</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="pb-3 px-3 text-right cursor-pointer hover:text-slate-800" onClick={() => handleSort('mrr')}>
                <div className="flex items-center justify-end gap-1">
                  <span>MRR (SAR)</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="pb-3 px-3 text-right">MRR Share</th>
              <th className="pb-3 px-3 text-right cursor-pointer hover:text-slate-800" onClick={() => handleSort('newSales')}>
                <div className="flex items-center justify-end gap-1">
                  <span>New Sales</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="pb-3 px-3 text-right cursor-pointer hover:text-slate-800" onClick={() => handleSort('churnRatePct')}>
                <div className="flex items-center justify-end gap-1">
                  <span>Churn %</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="pb-3 px-3 text-right">Avg Price</th>
              <th className="pb-3 px-3 text-right cursor-pointer hover:text-slate-800" onClick={() => handleSort('avgWashesPerMember')}>
                <div className="flex items-center justify-end gap-1">
                  <span>Avg Washes / Member</span>
                  <ArrowUpDown className="w-3 h-3 text-emerald-700" />
                </div>
              </th>
              <th className="pb-3 pl-3 text-right cursor-pointer hover:text-slate-800" onClick={() => handleSort('revenuePerMember')}>
                <div className="flex items-center justify-end gap-1">
                  <span>Rev / Member</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {sortedRows.map((row) => {
              const pkgDef = PACKAGES[row.packageId];
              return (
                <tr 
                  key={row.packageId} 
                  onClick={() => onPackageClick && onPackageClick(row.packageId)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <td className="py-3 pr-4 font-sans font-medium text-slate-800 flex items-center gap-2">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: pkgDef?.color || '#3b82f6' }}
                    />
                    <div>
                      <div className="font-semibold text-slate-900 group-hover:text-emerald-800 transition-colors">
                        {row.packageName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {row.arabicName}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-slate-800">
                    {row.validMembers.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {formatSAR(row.mrr)}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-500">
                    {row.mrrSharePct}%
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-700 font-semibold">
                    +{row.newSales}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                      row.churnRatePct > 4.5 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {row.churnRatePct}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600">
                    {formatSAR(row.avgSellingPrice)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-700">
                    {row.avgWashesPerMember} washes
                  </td>
                  <td className="py-3 pl-3 text-right font-semibold text-slate-800">
                    {formatSAR(row.revenuePerMember)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
