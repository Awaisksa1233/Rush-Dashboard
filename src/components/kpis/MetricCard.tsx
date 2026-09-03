import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Sparkles
} from 'lucide-react';
import { InfoTooltip } from '../common/Tooltip';

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({ 
  data, 
  color = '#10b981', 
  height = 36, 
  width = 90 
}) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

interface MetricCardProps {
  title: string;
  value: string | React.ReactNode;
  subtitle?: React.ReactNode;
  changePct?: number;
  changeLabel?: string;
  isPositive?: boolean;
  tooltipText?: string;
  sparklineData?: number[];
  sparklineColor?: string;
  badge?: string;
  onClick?: () => void;
  clickableHint?: string;
  children?: React.ReactNode;
  highlightBorder?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  changePct,
  changeLabel = 'vs comparison',
  isPositive = true,
  tooltipText,
  sparklineData,
  sparklineColor = '#10b981',
  badge,
  onClick,
  clickableHint,
  children,
  highlightBorder = false
}) => {
  const isUp = changePct !== undefined && changePct > 0;
  const isDown = changePct !== undefined && changePct < 0;

  // Good vs bad depending on isPositive flag
  const isGood = changePct !== undefined && ((isPositive && changePct >= 0) || (!isPositive && changePct < 0));

  return (
    <div 
      onClick={onClick}
      className={`glass-card rounded-xl p-5 flex flex-col justify-between transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-slate-400/80 hover:shadow-md active:scale-[0.99]' : ''
      } ${highlightBorder ? 'border-l-4 border-l-emerald-600' : ''}`}
    >
      <div>
        {/* Top bar: title + tooltip + badge */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              {title}
            </span>
            {tooltipText && <InfoTooltip text={tooltipText} />}
          </div>

          {badge && (
            <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {badge}
            </span>
          )}
        </div>

        {/* Value + Sparkline */}
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-2xl lg:text-[28px] font-bold tracking-tight text-slate-900 font-display">
            {value}
          </div>
          {sparklineData && sparklineData.length > 1 && (
            <div className="hidden sm:block shrink-0">
              <Sparkline 
                data={sparklineData} 
                color={isGood ? '#10b981' : '#f43f5e'} 
              />
            </div>
          )}
        </div>

        {/* Change comparison indicator */}
        {changePct !== undefined && (
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <span className={`inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded-md ${
              isGood 
                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60' 
                : 'text-rose-700 bg-rose-50 border border-rose-200/60'
            }`}>
              {isUp ? (
                <TrendingUp className="w-3 h-3 stroke-[2.5]" />
              ) : isDown ? (
                <TrendingDown className="w-3 h-3 stroke-[2.5]" />
              ) : (
                <Minus className="w-3 h-3 stroke-[2.5]" />
              )}
              {isUp ? `+${changePct.toFixed(1)}%` : `${changePct.toFixed(1)}%`}
            </span>
            <span className="text-slate-400 text-[11px]">
              {changeLabel}
            </span>
          </div>
        )}

        {/* Secondary subtitle / breakdown */}
        {subtitle && (
          <div className="mt-2 text-xs text-slate-500">
            {subtitle}
          </div>
        )}
      </div>

      {/* Optional custom child content (waterfall, breakdown, etc.) */}
      {children && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          {children}
        </div>
      )}

      {/* Clickable hint pill */}
      {onClick && clickableHint && (
        <div className="mt-2 text-[10px] font-medium text-emerald-700 flex items-center justify-end gap-1 opacity-80 hover:opacity-100">
          <span>{clickableHint}</span>
          <span>&rarr;</span>
        </div>
      )}
    </div>
  );
};
