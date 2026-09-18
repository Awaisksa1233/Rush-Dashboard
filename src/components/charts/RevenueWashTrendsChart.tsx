import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Maximize2, ArrowRight, Calendar, Sparkles } from 'lucide-react';
import { formatSAR } from '../../services/analyticsService';
import productionData from '../../data/productionCrmData.json';

export interface TrendDataPoint {
  id: string;
  date: string;
  displayDate: string;
  shortDate: string;
  revenue: number;
  washes: number;
  memberWashes: number;
  singleWashes: number;
  notes?: string;
}

// Map 100% real daily revenue and wash series from MongoDB production dataset
const REAL_TREND_DATA: TrendDataPoint[] = (productionData.revenueTrend || []).map((pt: any, idx: number) => {
  const parts = pt.date.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthStr = monthNames[monthIdx] || parts[1];
  const dayStr = parts[2] || '01';
  const displayDate = `${monthStr} ${dayStr}, ${parts[0]}`;
  const shortDate = `${monthStr} ${dayStr}`;

  return {
    id: String(idx + 1),
    date: pt.date,
    displayDate,
    shortDate,
    revenue: pt.totalRevenue,
    washes: pt.washes || 1,
    memberWashes: pt.washes || 1,
    singleWashes: Math.round(pt.singleWashRevenue / 45),
    notes: pt.totalRevenue >= 7400 ? 'Peak Revenue' : undefined
  };
});

// Helper to generate smooth SVG cubic spline paths
function createSmoothSplinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  
  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];
    
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    
    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return path;
}

interface RevenueWashTrendsChartProps {
  onGoToAnalytics?: () => void;
  initialData?: TrendDataPoint[];
}

export const RevenueWashTrendsChart: React.FC<RevenueWashTrendsChartProps> = ({
  onGoToAnalytics,
  initialData = REAL_TREND_DATA
}) => {
  // Range slider window state: indices in initialData (0 to initialData.length - 1)
  const defaultTotal = initialData.length;
  const [startIndex, setStartIndex] = useState(Math.max(0, defaultTotal - 14));
  const [endIndex, setEndIndex] = useState(Math.max(0, defaultTotal - 1));

  // Active series visibility toggles
  const [showRevenue, setShowRevenue] = useState(true);
  const [showWashes, setShowWashes] = useState(true);

  // Hover state on chart
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Dragging state for the range slider
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'pan' | null>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ clientX: number; startIdx: number; endIdx: number }>({ clientX: 0, startIdx: 0, endIdx: 0 });
  const chartSvgRef = useRef<SVGSVGElement>(null);

  const totalPointsCount = initialData.length;

  // Selected slice of data
  const visibleData = useMemo(() => {
    const s = Math.max(0, Math.min(startIndex, totalPointsCount - 2));
    const e = Math.min(totalPointsCount - 1, Math.max(endIndex, s + 1));
    return initialData.slice(s, e + 1);
  }, [startIndex, endIndex, totalPointsCount, initialData]);

  // Peak day in currently visible range
  const peakDay = useMemo(() => {
    if (visibleData.length === 0) return null;
    return visibleData.reduce((max, pt) => (pt.revenue > max.revenue ? pt : max), visibleData[0]);
  }, [visibleData]);

  // SVG Chart Dimensions
  const svgWidth = 700;
  const svgHeight = 240;
  const chartLeft = 55;
  const chartRight = 665;
  const chartTop = 30;
  const chartBottom = 200;
  const chartInnerW = chartRight - chartLeft;
  const chartInnerH = chartBottom - chartTop;

  // Scales
  const maxRevenueScale = 8000;
  const maxWashScale = 220; // 220 washes maps to max height for aesthetic balance with revenue

  // Calculate coordinates for visible points
  const pointsWithCoords = useMemo(() => {
    const count = visibleData.length;
    return visibleData.map((pt, idx) => {
      const x = count === 1 ? chartLeft + chartInnerW / 2 : chartLeft + (idx / (count - 1)) * chartInnerW;
      
      // Revenue Y coordinate
      const revClamped = Math.max(0, Math.min(pt.revenue, maxRevenueScale));
      const revY = chartBottom - (revClamped / maxRevenueScale) * chartInnerH;

      // Wash Y coordinate
      const washClamped = Math.max(0, Math.min(pt.washes, maxWashScale));
      const washY = chartBottom - (washClamped / maxWashScale) * chartInnerH;

      return {
        ...pt,
        idx,
        x,
        revY,
        washY
      };
    });
  }, [visibleData, chartLeft, chartInnerW, chartBottom, chartInnerH]);

  // Spline paths
  const revenuePoints = useMemo(() => pointsWithCoords.map(p => ({ x: p.x, y: p.revY })), [pointsWithCoords]);
  const washPoints = useMemo(() => pointsWithCoords.map(p => ({ x: p.x, y: p.washY })), [pointsWithCoords]);

  const revenueLinePath = useMemo(() => createSmoothSplinePath(revenuePoints), [revenuePoints]);
  const washLinePath = useMemo(() => createSmoothSplinePath(washPoints), [washPoints]);

  const revenueAreaPath = useMemo(() => {
    if (revenuePoints.length === 0) return '';
    const first = revenuePoints[0];
    const last = revenuePoints[revenuePoints.length - 1];
    return `${revenueLinePath} L ${last.x},${chartBottom} L ${first.x},${chartBottom} Z`;
  }, [revenueLinePath, revenuePoints, chartBottom]);

  const washAreaPath = useMemo(() => {
    if (washPoints.length === 0) return '';
    const first = washPoints[0];
    const last = washPoints[washPoints.length - 1];
    return `${washLinePath} L ${last.x},${chartBottom} L ${first.x},${chartBottom} Z`;
  }, [washLinePath, washPoints, chartBottom]);

  // Range Slider Handle Dragging logic
  const handleSliderPointerDown = (type: 'start' | 'end' | 'pan', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(type);
    dragStartRef.current = {
      clientX: e.clientX,
      startIdx: startIndex,
      endIdx: endIndex
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleSliderPointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging || !sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const trackWidth = rect.width;
    if (trackWidth <= 0) return;

    const deltaX = e.clientX - dragStartRef.current.clientX;
    const deltaRatio = deltaX / trackWidth;
    const deltaIndex = Math.round(deltaRatio * (totalPointsCount - 1));

    const minSpan = 2; // minimum 3 points visible

    if (isDragging === 'start') {
      const newStart = Math.max(0, Math.min(dragStartRef.current.startIdx + deltaIndex, endIndex - minSpan));
      setStartIndex(newStart);
    } else if (isDragging === 'end') {
      const newEnd = Math.min(totalPointsCount - 1, Math.max(dragStartRef.current.endIdx + deltaIndex, startIndex + minSpan));
      setEndIndex(newEnd);
    } else if (isDragging === 'pan') {
      const span = dragStartRef.current.endIdx - dragStartRef.current.startIdx;
      let newStart = dragStartRef.current.startIdx + deltaIndex;
      let newEnd = newStart + span;

      if (newStart < 0) {
        newStart = 0;
        newEnd = span;
      }
      if (newEnd > totalPointsCount - 1) {
        newEnd = totalPointsCount - 1;
        newStart = newEnd - span;
      }

      setStartIndex(newStart);
      setEndIndex(newEnd);
    }
  }, [isDragging, startIndex, endIndex, totalPointsCount]);

  const handleSliderPointerUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handleSliderPointerMove);
      window.addEventListener('pointerup', handleSliderPointerUp);
      return () => {
        window.removeEventListener('pointermove', handleSliderPointerMove);
        window.removeEventListener('pointerup', handleSliderPointerUp);
      };
    }
  }, [isDragging, handleSliderPointerMove, handleSliderPointerUp]);

  // Click on track to jump or adjust range
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || !sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetIdx = Math.round(clickRatio * (totalPointsCount - 1));

    const distToStart = Math.abs(targetIdx - startIndex);
    const distToEnd = Math.abs(targetIdx - endIndex);

    if (distToStart < distToEnd) {
      if (targetIdx < endIndex - 2) {
        setStartIndex(targetIdx);
      }
    } else {
      if (targetIdx > startIndex + 2) {
        setEndIndex(targetIdx);
      }
    }
  };

  // Quick Preset Handlers
  const handleSetPreset = (preset: '7d' | '14d' | 'all' | 'focus') => {
    if (preset === 'focus') {
      setStartIndex(15);
      setEndIndex(21);
    } else if (preset === '7d') {
      const end = totalPointsCount - 1;
      setStartIndex(Math.max(0, end - 6));
      setEndIndex(end);
    } else if (preset === '14d') {
      const end = totalPointsCount - 1;
      setStartIndex(Math.max(0, end - 13));
      setEndIndex(end);
    } else if (preset === 'all') {
      setStartIndex(0);
      setEndIndex(totalPointsCount - 1);
    }
  };

  // Mouse Move over chart to show interactive tooltip
  const handleChartMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartSvgRef.current || pointsWithCoords.length === 0) return;
    const rect = chartSvgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;
    const mouseY = ((e.clientY - rect.top) / rect.height) * svgHeight;

    // Find closest point by X coordinate
    let closestIdx = 0;
    let minDistance = Infinity;

    pointsWithCoords.forEach((p, idx) => {
      const dist = Math.abs(p.x - mouseX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });

    setHoverIndex(closestIdx);
    setHoverPos({ x: pointsWithCoords[closestIdx].x, y: mouseY });
  };

  const handleChartMouseLeave = () => {
    setHoverIndex(null);
    setHoverPos(null);
  };

  // Active hovered point
  const activeHoveredPoint = hoverIndex !== null && pointsWithCoords[hoverIndex] ? pointsWithCoords[hoverIndex] : null;

  // Percentage bounds for the active range bar on the slider
  const leftPct = (startIndex / (totalPointsCount - 1)) * 100;
  const rightPct = (endIndex / (totalPointsCount - 1)) * 100;
  const widthPct = Math.max(0, rightPct - leftPct);

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs flex flex-col justify-between select-none">
      <div>
        {/* ========================================================================= */}
        {/* HEADER: Title, Preset Pills & Maximize Button                             */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse"></span>
            <h3 className="text-xl font-bold font-display text-slate-900">
              Revenue & Wash Trends
            </h3>
            <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-mono hidden sm:inline-block">
              Dual-Wave
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Range Presets */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => handleSetPreset('14d')}
                className={`px-2.5 py-1 rounded-md transition-all text-[11px] font-semibold ${
                  startIndex === Math.max(0, totalPointsCount - 14)
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Recent 14 Days"
              >
                14 Days
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('7d')}
                className={`px-2.5 py-1 rounded-md transition-all text-[11px] font-semibold ${
                  startIndex === Math.max(0, totalPointsCount - 7)
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Last 7D
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('all')}
                className={`px-2.5 py-1 rounded-md transition-all text-[11px] font-semibold ${
                  startIndex === 0 && endIndex === totalPointsCount - 1
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Full Trend ({totalPointsCount}D)
              </button>
            </div>

            {onGoToAnalytics && (
              <button 
                onClick={onGoToAnalytics} 
                title="Expand to Deep Analytics"
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE DUAL-HANDLE RANGE SLIDER                                      */}
        {/* ========================================================================= */}
        <div className="px-6 mb-4">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mb-1.5 font-mono">
            <span>{initialData[startIndex]?.shortDate || 'Start'}</span>
            <span className="text-slate-600 font-semibold font-sans text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>{initialData[startIndex]?.displayDate} &mdash; {initialData[endIndex]?.displayDate}</span>
            </span>
            <span>{initialData[endIndex]?.shortDate || 'End'}</span>
          </div>

          <div 
            ref={sliderTrackRef}
            onClick={handleTrackClick}
            className="relative flex items-center h-6 cursor-pointer touch-none"
            title="Drag handles or scrub timeline"
          >
            {/* Background Full Track */}
            <div className="w-full h-1.5 bg-slate-200 rounded-full relative">
              {/* Highlighted Selected Range Bar (draggable to pan) */}
              <div 
                onPointerDown={(e) => handleSliderPointerDown('pan', e)}
                className="absolute top-0 h-full bg-slate-400/80 rounded-full cursor-grab active:cursor-grabbing hover:bg-slate-500 transition-colors"
                style={{ 
                  left: `${leftPct}%`, 
                  width: `${widthPct}%` 
                }}
              />
            </div>

            {/* Left Handle */}
            <div 
              onPointerDown={(e) => handleSliderPointerDown('start', e)}
              className="absolute w-3 h-5 bg-slate-400 hover:bg-slate-600 active:bg-purple-600 rounded-sm shadow-xs cursor-ew-resize transition-colors transform -translate-x-1/2 flex items-center justify-center z-10"
              style={{ left: `${leftPct}%` }}
              title={`Drag start date: ${initialData[startIndex]?.displayDate}`}
            >
              <div className="w-0.5 h-2.5 bg-white/70 rounded-full"></div>
            </div>

            {/* Right Handle */}
            <div 
              onPointerDown={(e) => handleSliderPointerDown('end', e)}
              className="absolute w-3 h-5 bg-slate-400 hover:bg-slate-600 active:bg-purple-600 rounded-sm shadow-xs cursor-ew-resize transition-colors transform -translate-x-1/2 flex items-center justify-center z-10"
              style={{ left: `${rightPct}%` }}
              title={`Drag end date: ${initialData[endIndex]?.displayDate}`}
            >
              <div className="w-0.5 h-2.5 bg-white/70 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* THE DUAL-WAVE INTERACTIVE SVG CHART                                       */}
        {/* ========================================================================= */}
        <div className="relative w-full h-64 overflow-visible select-none">
          <svg 
            ref={chartSvgRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
            className="w-full h-full overflow-visible cursor-crosshair"
            onMouseMove={handleChartMouseMove}
            onMouseLeave={handleChartMouseLeave}
          >
            <defs>
              {/* Purple Revenue Gradient */}
              <linearGradient id="flexRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.05" />
              </linearGradient>

              {/* Teal Wash Gradient */}
              <linearGradient id="flexWashGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.1" />
              </linearGradient>

              {/* Drop shadow filter for active point */}
              <filter id="pointGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.2" />
              </filter>
            </defs>

            {/* Y-Axis Grid Lines & Tick Labels (8k, 6k, 4k, 2k) */}
            {[
              { val: 8000, label: 'SAR 8,000', y: chartTop },
              { val: 6000, label: 'SAR 6,000', y: chartTop + chartInnerH * 0.25 },
              { val: 4000, label: 'SAR 4,000', y: chartTop + chartInnerH * 0.50 },
              { val: 2000, label: 'SAR 2,000', y: chartTop + chartInnerH * 0.75 },
            ].map((tick, idx) => (
              <g key={idx}>
                <line 
                  x1={chartLeft - 10} 
                  y1={tick.y} 
                  x2={chartRight + 15} 
                  y2={tick.y} 
                  stroke="#f1f5f9" 
                  strokeWidth="1" 
                />
                <text 
                  x={chartLeft - 15} 
                  y={tick.y + 3.5} 
                  textAnchor="end" 
                  className="text-[10px] fill-slate-400 font-mono"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* 1. Teal Wash Area Fill */}
            {showWashes && washAreaPath && (
              <path
                d={washAreaPath}
                fill="url(#flexWashGrad)"
                className="transition-all duration-300 pointer-events-none"
              />
            )}

            {/* 2. Purple Revenue Area Fill */}
            {showRevenue && revenueAreaPath && (
              <path
                d={revenueAreaPath}
                fill="url(#flexRevenueGrad)"
                className="transition-all duration-300 pointer-events-none"
              />
            )}

            {/* 3. Purple Revenue Spline Stroke */}
            {showRevenue && revenueLinePath && (
              <path
                d={revenueLinePath}
                fill="none"
                stroke="#7c3aed"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300 pointer-events-none"
              />
            )}

            {/* 4. Teal Wash Spline Stroke */}
            {showWashes && washLinePath && (
              <path
                d={washLinePath}
                fill="none"
                stroke="#0d9488"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300 pointer-events-none"
              />
            )}

            {/* 5. Revenue Circle Points */}
            {showRevenue && pointsWithCoords.map((pt, i) => {
              const isHovered = hoverIndex === i;
              return (
                <circle
                  key={`rev-${i}`}
                  cx={pt.x}
                  cy={pt.revY}
                  r={isHovered ? 6 : 4}
                  fill="#7c3aed"
                  stroke="#ffffff"
                  strokeWidth={isHovered ? 2.5 : 2}
                  filter={isHovered ? 'url(#pointGlow)' : undefined}
                  className="transition-all duration-150 cursor-pointer"
                />
              );
            })}

            {/* 6. Wash Circle Points */}
            {showWashes && pointsWithCoords.map((pt, i) => {
              const isHovered = hoverIndex === i;
              return (
                <circle
                  key={`wash-${i}`}
                  cx={pt.x}
                  cy={pt.washY}
                  r={isHovered ? 6 : 4}
                  fill="#0d9488"
                  stroke="#ffffff"
                  strokeWidth={isHovered ? 2.5 : 2}
                  filter={isHovered ? 'url(#pointGlow)' : undefined}
                  className="transition-all duration-150 cursor-pointer"
                />
              );
            })}

            {/* 7. Hover Crosshair Line */}
            {activeHoveredPoint && (
              <line
                x1={activeHoveredPoint.x}
                y1={chartTop - 10}
                x2={activeHoveredPoint.x}
                y2={chartBottom + 5}
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                className="pointer-events-none transition-all duration-75"
              />
            )}

            {/* 8. X-Axis Date Labels */}
            {pointsWithCoords.map((pt, i) => {
              // Smart label filtering to prevent overcrowding when many points are shown
              const count = pointsWithCoords.length;
              const shouldShowLabel = 
                count <= 8 || 
                i === 0 || 
                i === count - 1 || 
                (count <= 15 && i % 2 === 0) || 
                (count > 15 && i % Math.ceil(count / 6) === 0);

              if (!shouldShowLabel) return null;

              const isHovered = hoverIndex === i;
              const isPeak = peakDay?.id === pt.id;

              return (
                <text
                  key={`label-${i}`}
                  x={pt.x}
                  y={chartBottom + 22}
                  textAnchor="middle"
                  className={`text-[11px] transition-colors cursor-pointer ${
                    isHovered
                      ? 'fill-purple-700 font-bold'
                      : isPeak
                      ? 'fill-slate-900 font-bold'
                      : 'fill-slate-400 font-medium'
                  }`}
                >
                  {count > 12 ? pt.shortDate : pt.displayDate}
                </text>
              );
            })}
          </svg>

          {/* ========================================================================= */}
          {/* FLOATING RICH INTERACTIVE TOOLTIP                                         */}
          {/* ========================================================================= */}
          {activeHoveredPoint && (
            <div 
              className="absolute z-20 pointer-events-none transition-all duration-100 ease-out"
              style={{
                left: `${(activeHoveredPoint.x / svgWidth) * 100}%`,
                top: `${Math.min(Math.max((activeHoveredPoint.revY / svgHeight) * 100 - 30, 5), 65)}%`,
                transform: activeHoveredPoint.x > svgWidth * 0.7 
                  ? 'translate(-105%, -50%)' 
                  : 'translate(12px, -50%)'
              }}
            >
              <div className="bg-slate-900/95 text-white backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-700/80 text-xs min-w-[170px]">
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
                  <span className="font-bold text-slate-200">{activeHoveredPoint.displayDate}</span>
                  {activeHoveredPoint.notes && (
                    <span className="text-[9px] font-semibold bg-purple-500/30 text-purple-300 px-1.5 py-0.2 rounded border border-purple-400/40">
                      {activeHoveredPoint.notes}
                    </span>
                  )}
                </div>

                <div className="space-y-1 font-mono">
                  {showRevenue && (
                    <div className="flex items-center justify-between text-purple-300">
                      <span className="flex items-center gap-1.5 font-sans text-slate-400 text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span> Revenue:
                      </span>
                      <strong className="font-bold text-purple-200">
                        {formatSAR(activeHoveredPoint.revenue)}
                      </strong>
                    </div>
                  )}

                  {showWashes && (
                    <div className="flex items-center justify-between text-teal-300">
                      <span className="flex items-center gap-1.5 font-sans text-slate-400 text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-teal-400"></span> Washes:
                      </span>
                      <strong className="font-bold text-teal-200">
                        {activeHoveredPoint.washes}
                      </strong>
                    </div>
                  )}

                  <div className="pt-1 mt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-sans">
                    <span>Avg Ticket:</span>
                    <span className="font-mono text-slate-300 font-semibold">
                      SAR {(activeHoveredPoint.revenue / activeHoveredPoint.washes).toFixed(1)} / wash
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE LEGEND: Click to Toggle Series                                */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-center gap-6 mt-3 text-xs">
          <button
            type="button"
            onClick={() => setShowRevenue(!showRevenue)}
            className={`flex items-center gap-2 px-2 py-1 rounded-md transition-all cursor-pointer ${
              showRevenue 
                ? 'opacity-100 hover:bg-purple-50' 
                : 'opacity-40 hover:opacity-75 line-through'
            }`}
            title="Click to toggle Daily Revenue"
          >
            <span className="w-3 h-3 rounded-full bg-purple-600 shrink-0"></span>
            <span className="font-semibold text-slate-700">Daily Revenue (SAR)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowWashes(!showWashes)}
            className={`flex items-center gap-2 px-2 py-1 rounded-md transition-all cursor-pointer ${
              showWashes 
                ? 'opacity-100 hover:bg-teal-50' 
                : 'opacity-40 hover:opacity-75 line-through'
            }`}
            title="Click to toggle Wash Volume"
          >
            <span className="w-3 h-3 rounded-full bg-teal-600 shrink-0"></span>
            <span className="font-semibold text-slate-700">Wash Volume (Events)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FOOTER: Dynamic Peak Day Calculation & Deep Analytics Link                */}
      {/* ========================================================================= */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
        <div>
          {peakDay ? (
            <span>
              Peak Day: <strong className="text-slate-800">{peakDay.shortDate} ({formatSAR(peakDay.revenue)} &bull; {peakDay.washes} Washes)</strong>
            </span>
          ) : (
            <span>Select a valid date window above</span>
          )}
        </div>

        {onGoToAnalytics && (
          <button
            onClick={onGoToAnalytics}
            className="text-emerald-700 font-bold hover:underline flex items-center gap-1 text-[11px] self-end sm:self-auto"
          >
            <span>Explore Multi-Granularity & Package Mix in Analytics</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
