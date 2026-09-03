import React, { useState } from 'react';
import { RevenueSeriesPoint, Granularity } from '../../types/dashboard';
import { formatSAR } from '../../services/analyticsService';
import { Layers, Calendar, Eye, EyeOff } from 'lucide-react';

interface RevenueTrendChartProps {
  data: RevenueSeriesPoint[];
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  showComparison: boolean;
  onToggleComparison: () => void;
}

export const RevenueTrendChart: React.FC<RevenueTrendChartProps> = ({
  data,
  granularity,
  onGranularityChange,
  showComparison,
  onToggleComparison
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  // Find max value to scale graph
  const maxVal = Math.max(
    ...data.map(d => Math.max(d.totalRevenue, d.comparisonTotalRevenue || 0, d.mrr / 25))
  ) * 1.15;

  const width = 800;
  const height = 260;
  const padding = { top: 20, right: 20, bottom: 35, left: 55 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const getX = (index: number) => padding.left + (index / (data.length - 1 || 1)) * chartW;
  const getY = (val: number) => padding.top + chartH - (val / (maxVal || 1)) * chartH;

  // Build SVG path strings
  const totalPoints = data.map((d, i) => `${getX(i)},${getY(d.totalRevenue)}`).join(' ');
  const memPoints = data.map((d, i) => `${getX(i)},${getY(d.membershipRevenue)}`).join(' ');
  const singlePoints = data.map((d, i) => `${getX(i)},${getY(d.singleWashRevenue)}`).join(' ');
  const compPoints = showComparison ? data.map((d, i) => `${getX(i)},${getY(d.comparisonTotalRevenue || 0)}`).join(' ') : '';

  // Area under Total Revenue
  const totalArea = `${getX(0)},${padding.top + chartH} ` + totalPoints + ` ${getX(data.length - 1)},${padding.top + chartH}`;

  const hoveredPoint = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col justify-between">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display font-bold text-base text-slate-900">
              Revenue & Recurring Revenue Trend
            </h3>
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              SAR Collected
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Total collections vs recurring membership subscriptions & single-wash non-recurring
          </p>
        </div>

        {/* Controls: Granularity + Compare Toggle */}
        <div className="flex items-center gap-2">
          {/* Compare toggle */}
          <button
            type="button"
            onClick={onToggleComparison}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
              showComparison 
                ? 'bg-slate-100 text-slate-800 border-slate-300' 
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {showComparison ? <Eye className="w-3.5 h-3.5 text-slate-600" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
            <span>Prior Period</span>
          </button>

          {/* Granularity pills */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
            {(['daily', 'weekly', 'monthly'] as Granularity[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onGranularityChange(g)}
                className={`px-2.5 py-1 rounded-md capitalize transition-all ${
                  granularity === g 
                    ? 'bg-white text-slate-900 font-semibold shadow-xs' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs mb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1 bg-emerald-600 rounded-full"></span>
          <span className="text-slate-600 font-medium">Total Revenue</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1 bg-blue-500 rounded-full"></span>
          <span className="text-slate-600 font-medium">Membership (Recurring)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1 bg-amber-500 rounded-full"></span>
          <span className="text-slate-600 font-medium">Single-Wash Walk-ins</span>
        </div>
        {showComparison && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 border-t-2 border-dashed border-slate-400"></span>
            <span className="text-slate-500 font-medium">Comparison Period</span>
          </div>
        )}
      </div>

      {/* Chart SVG */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="totalRevenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines (horizontal) */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = padding.top + chartH * (1 - ratio);
            const val = maxVal * ratio;
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-sans"
                >
                  {formatSAR(Math.round(val), true).replace('SAR ', '')}
                </text>
              </g>
            );
          })}

          {/* Area fill for Total Revenue */}
          <polygon
            points={totalArea}
            fill="url(#totalRevenueGradient)"
          />

          {/* Comparison line */}
          {showComparison && (
            <polyline
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="4 4"
              points={compPoints}
            />
          )}

          {/* Membership Recurring line */}
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={memPoints}
          />

          {/* Single Wash line */}
          <polyline
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={singlePoints}
          />

          {/* Total Revenue line */}
          <polyline
            fill="none"
            stroke="#059669"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={totalPoints}
          />

          {/* Interactive vertical hover indicator & data circles */}
          {data.map((d, i) => {
            const x = getX(i);
            const isHovered = hoverIndex === i;
            return (
              <g 
                key={i} 
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              >
                {/* Hit area */}
                <rect
                  x={x - chartW / (data.length * 2)}
                  y={padding.top}
                  width={chartW / data.length}
                  height={chartH}
                  fill="transparent"
                />

                {isHovered && (
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={padding.top + chartH}
                    stroke="#64748b"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Point circle on Total line */}
                <circle
                  cx={x}
                  cy={getY(d.totalRevenue)}
                  r={isHovered ? 5 : 3.5}
                  fill="#ffffff"
                  stroke="#059669"
                  strokeWidth="2.5"
                />

                {/* X axis labels */}
                {(i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 7) === 0) && (
                  <text
                    x={x}
                    y={height - 8}
                    textAnchor="middle"
                    className="text-[11px] fill-slate-500 font-medium"
                  >
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && hoverIndex !== null && (
          <div 
            className="absolute z-20 pointer-events-none bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-lg shadow-xl border border-slate-700/60 text-xs transform -translate-x-1/2"
            style={{ 
              left: `${(getX(hoverIndex) / width) * 100}%`, 
              top: '10px' 
            }}
          >
            <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1.5 flex justify-between gap-4">
              <span>{hoveredPoint.label}</span>
              <span className="text-emerald-400 font-mono font-semibold">{formatSAR(hoveredPoint.totalRevenue)}</span>
            </div>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between gap-3 text-blue-300">
                <span>Recurring Membership:</span>
                <span>{formatSAR(hoveredPoint.membershipRevenue)}</span>
              </div>
              <div className="flex justify-between gap-3 text-amber-300">
                <span>Single Washes:</span>
                <span>{formatSAR(hoveredPoint.singleWashRevenue)}</span>
              </div>
              {showComparison && hoveredPoint.comparisonTotalRevenue && (
                <div className="flex justify-between gap-3 text-slate-400 pt-1 border-t border-slate-800">
                  <span>Prior Period:</span>
                  <span>{formatSAR(hoveredPoint.comparisonTotalRevenue)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
