import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Maximize2, ArrowRight, Calendar, Sparkles } from 'lucide-react';
import { formatSAR } from '../../services/analyticsService';

export interface TrendDataPoint {
  id: string;
  date: string; // ISO date or "2026-05-18"
  displayDate: string; // "May 18, 2026"
  shortDate: string; // "May 18"
  revenue: number; // e.g. 6850
  washes: number; // e.g. 182
  memberWashes: number;
  singleWashes: number;
  notes?: string;
}

// 31-day data for May 2026, crafted with realistic wash & revenue patterns
// including the May 18 peak from the screenshot
const DEFAULT_TREND_DATA: TrendDataPoint[] = [
  { id: '1', date: '2026-05-01', displayDate: 'May 01, 2026', shortDate: 'May 01', revenue: 3200, washes: 82, memberWashes: 65, singleWashes: 17 },
  { id: '2', date: '2026-05-02', displayDate: 'May 02, 2026', shortDate: 'May 02', revenue: 3450, washes: 90, memberWashes: 72, singleWashes: 18 },
  { id: '3', date: '2026-05-03', displayDate: 'May 03, 2026', shortDate: 'May 03', revenue: 2900, washes: 78, memberWashes: 60, singleWashes: 18 },
  { id: '4', date: '2026-05-04', displayDate: 'May 04, 2026', shortDate: 'May 04', revenue: 3100, washes: 85, memberWashes: 68, singleWashes: 17 },
  { id: '5', date: '2026-05-05', displayDate: 'May 05, 2026', shortDate: 'May 05', revenue: 3300, washes: 88, memberWashes: 70, singleWashes: 18 },
  { id: '6', date: '2026-05-06', displayDate: 'May 06, 2026', shortDate: 'May 06', revenue: 3600, washes: 95, memberWashes: 76, singleWashes: 19 },
  { id: '7', date: '2026-05-07', displayDate: 'May 07, 2026', shortDate: 'May 07', revenue: 4200, washes: 112, memberWashes: 89, singleWashes: 23 },
  { id: '8', date: '2026-05-08', displayDate: 'May 08, 2026', shortDate: 'May 08', revenue: 4500, washes: 120, memberWashes: 96, singleWashes: 24 },
  { id: '9', date: '2026-05-09', displayDate: 'May 09, 2026', shortDate: 'May 09', revenue: 3800, washes: 102, memberWashes: 81, singleWashes: 21 },
  { id: '10', date: '2026-05-10', displayDate: 'May 10, 2026', shortDate: 'May 10', revenue: 3250, washes: 86, memberWashes: 69, singleWashes: 17 },
  { id: '11', date: '2026-05-11', displayDate: 'May 11, 2026', shortDate: 'May 11', revenue: 3400, washes: 91, memberWashes: 73, singleWashes: 18 },
  { id: '12', date: '2026-05-12', displayDate: 'May 12, 2026', shortDate: 'May 12', revenue: 3650, washes: 98, memberWashes: 78, singleWashes: 20 },
  { id: '13', date: '2026-05-13', displayDate: 'May 13, 2026', shortDate: 'May 13', revenue: 3900, washes: 104, memberWashes: 83, singleWashes: 21 },
  { id: '14', date: '2026-05-14', displayDate: 'May 14, 2026', shortDate: 'May 14', revenue: 4100, washes: 110, memberWashes: 88, singleWashes: 22 },
  { id: '15', date: '2026-05-15', displayDate: 'May 15, 2026', shortDate: 'May 15', revenue: 3800, washes: 101, memberWashes: 80, singleWashes: 21 },
  // Core Focus Window from Screenshot (May 16 - May 22)
  { id: '16', date: '2026-05-16', displayDate: 'May 16, 2026', shortDate: 'May 16', revenue: 3600, washes: 96, memberWashes: 77, singleWashes: 19 },
  { id: '17', date: '2026-05-17', displayDate: 'May 17, 2026', shortDate: 'May 17', revenue: 4150, washes: 112, memberWashes: 90, singleWashes: 22 },
  { id: '18', date: '2026-05-18', displayDate: 'May 18, 2026', shortDate: 'May 18', revenue: 6850, washes: 182, memberWashes: 146, singleWashes: 36, notes: 'Peak Promotion Day' },
  { id: '19', date: '2026-05-19', displayDate: 'May 19, 2026', shortDate: 'May 19', revenue: 4850, washes: 130, memberWashes: 104, singleWashes: 26 },
  { id: '20', date: '2026-05-20', displayDate: 'May 20, 2026', shortDate: 'May 20', revenue: 3150, washes: 85, memberWashes: 68, singleWashes: 17 },
  { id: '21', date: '2026-05-21', displayDate: 'May 21, 2026', shortDate: 'May 21', revenue: 3450, washes: 93, memberWashes: 74, singleWashes: 19 },
  { id: '22', date: '2026-05-22', displayDate: 'May 22, 2026', shortDate: 'May 22', revenue: 3820, washes: 105, memberWashes: 84, singleWashes: 21 },
  // Remaining May points
  { id: '23', date: '2026-05-23', displayDate: 'May 23, 2026', shortDate: 'May 23', revenue: 4100, washes: 110, memberWashes: 88, singleWashes: 22 },
  { id: '24', date: '2026-05-24', displayDate: 'May 24, 2026', shortDate: 'May 24', revenue: 3700, washes: 99, memberWashes: 79, singleWashes: 20 },
  { id: '25', date: '2026-05-25', displayDate: 'May 25, 2026', shortDate: 'May 25', revenue: 3950, washes: 106, memberWashes: 85, singleWashes: 21 },
  { id: '26', date: '2026-05-26', displayDate: 'May 26, 2026', shortDate: 'May 26', revenue: 4400, washes: 118, memberWashes: 94, singleWashes: 24 },
  { id: '27', date: '2026-05-27', displayDate: 'May 27, 2026', shortDate: 'May 27', revenue: 6200, washes: 165, memberWashes: 132, singleWashes: 33, notes: 'Saudi Payroll Day' },
  { id: '28', date: '2026-05-28', displayDate: 'May 28, 2026', shortDate: 'May 28', revenue: 5800, washes: 154, memberWashes: 123, singleWashes: 31 },
  { id: '29', date: '2026-05-29', displayDate: 'May 29, 2026', shortDate: 'May 29', revenue: 5100, washes: 136, memberWashes: 109, singleWashes: 27 },
  { id: '30', date: '2026-05-30', displayDate: 'May 30, 2026', shortDate: 'May 30', revenue: 4600, washes: 122, memberWashes: 98, singleWashes: 24 },
  { id: '31', date: '2026-05-31', displayDate: 'May 31, 2026', shortDate: 'May 31', revenue: 4300, washes: 115, memberWashes: 92, singleWashes: 23 }
];

/**
 * Creates smooth cubic Bézier spline command path string through points
 */
function createSmoothSplinePath(points: { x: number; y: number }[]): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;

  let path = `M ${points[0].x},${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];

    // Catmull-Rom to Cubic Bezier control points
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  return path;
}

interface RevenueWashTrendsChartProps {
  onGoToAnalytics?: () => void;
  initialData?: TrendDataPoint[];
}

export const RevenueWashTrendsChart: React.FC<RevenueWashTrendsChartProps> = ({
  onGoToAnalytics,
  initialData = DEFAULT_TREND_DATA
}) => {
  // Range slider window state: indices in initialData (0 to initialData.length - 1)
  // Default to May 16 (index 15) to May 22 (index 21) as shown in the screenshot
  const [startIndex, setStartIndex] = useState(15);
  const [endIndex, setEndIndex] = useState(21);

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
                onClick={() => handleSetPreset('focus')}
                className={`px-2.5 py-1 rounded-md transition-all text-[11px] font-semibold ${
                  startIndex === 15 && endIndex === 21
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="May 16 - May 22 Window"
              >
                May 16–22
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('7d')}
                className="px-2.5 py-1 rounded-md transition-all text-[11px] font-semibold text-slate-500 hover:text-slate-900"
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
                All May (31D)
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
