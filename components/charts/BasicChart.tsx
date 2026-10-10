// Basic Interactive Candlestick + Volume Chart for Project Q
// Built with lightweight-charts v5 and Tailwind CSS
'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  Time,
  LogicalRange,
  CandlestickData,
  HistogramData,
  LineStyle,
} from 'lightweight-charts';
import { Candle } from '@/lib/charts/types';
import { HorizontalLineConfig, RedrawRateOption } from '@/lib/charts/chart-persistence';
export type { RedrawRateOption };
import { GripVertical, Sliders } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeContext';

// Sanitize and guarantee strict ascending timestamps without duplicates for lightweight-charts
function sanitizeAndDeduplicateCandles(raw: Candle[]): Candle[] {
  if (!raw || raw.length === 0) return [];
  const map = new Map<number, Candle>();
  for (const c of raw) {
    if (typeof c.time !== 'number' || isNaN(c.time) || isNaN(c.close)) continue;
    const existing = map.get(c.time);
    if (!existing || (!existing.closed && c.closed) || c.volume >= existing.volume) {
      map.set(c.time, c);
    }
  }
  const sorted = Array.from(map.values()).sort((a, b) => a.time - b.time);

  // Guarantee strict ascending order: result[i].time > result[i-1].time
  const result: Candle[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (result.length === 0) {
      result.push(item);
    } else {
      const prev = result[result.length - 1];
      if (item.time > prev.time) {
        result.push(item);
      } else if (item.time === prev.time) {
        result[result.length - 1] = item;
      }
    }
  }
  return result;
}

interface BasicChartProps {
  candles: Candle[];
  isLoadingOlder?: boolean;
  onLoadOlderHistory?: () => void;
  onHoverCandle?: (candle: Candle | null) => void;
  height?: number;
  redrawRateMs?: RedrawRateOption;
  horizontalLines?: HorizontalLineConfig[];
  onUpdateLine?: (lineId: string, updates: Partial<HorizontalLineConfig>) => void;
  onSelectLine?: (line: HorizontalLineConfig) => void;
  isLight?: boolean;
}

type PriceLineInstance = ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']>;

export function BasicChart({
  candles,
  isLoadingOlder = false,
  onLoadOlderHistory,
  onHoverCandle,
  height = 480,
  redrawRateMs = 0,
  horizontalLines = [],
  onUpdateLine,
  onSelectLine,
  isLight: propIsLight,
}: BasicChartProps) {
  const themeContext = useTheme();
  const isLight = propIsLight !== undefined ? propIsLight : themeContext.isLight;
  const isLightRef = useRef<boolean>(isLight);

  useEffect(() => {
    isLightRef.current = isLight;
  }, [isLight]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const lastCandlesLengthRef = useRef<number>(0);
  const isLoadingOlderRef = useRef<boolean>(isLoadingOlder);
  const isOffscreenRef = useRef<boolean>(false);
  const pendingCandlesRef = useRef<Candle[] | null>(null);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestThrottledCandlesRef = useRef<Candle[]>(candles);

  // Price lines references and dragging state
  const priceLinesMapRef = useRef<Map<string, PriceLineInstance>>(new Map());
  const [lineCoords, setLineCoords] = useState<{ id: string; y: number; line: HorizontalLineConfig }[]>([]);
  const draggingLineIdRef = useRef<string | null>(null);
  const [draggingInfo, setDraggingInfo] = useState<{ id: string; price: number; y: number } | null>(null);

  useEffect(() => {
    isLoadingOlderRef.current = isLoadingOlder;
  }, [isLoadingOlder]);

  const applyCandlesToSeries = useCallback((candlesToApply: Candle[]) => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candlesToApply.length === 0) {
      return;
    }

    const sanitized = sanitizeAndDeduplicateCandles(candlesToApply);
    if (sanitized.length === 0) {
      return;
    }

    const candleData: CandlestickData<Time>[] = sanitized.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData: HistogramData<Time>[] = sanitized.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color: isLightRef.current
        ? c.close >= c.open
          ? 'rgba(16, 185, 129, 0.55)'
          : 'rgba(239, 68, 68, 0.55)'
        : c.close >= c.open
        ? 'rgba(16, 185, 129, 0.4)'
        : 'rgba(244, 63, 94, 0.4)',
    }));

    const prevLength = lastCandlesLengthRef.current;
    const currentLength = sanitized.length;
    lastCandlesLengthRef.current = currentLength;

    // Initial load, historical batch, or prepended candles use setData
    if (prevLength === 0 || Math.abs(currentLength - prevLength) > 1) {
      candleSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);
    } else {
      // Single live tick update or single new candle
      try {
        const latestCandle = candleData[candleData.length - 1];
        const latestVolume = volumeData[volumeData.length - 1];
        candleSeriesRef.current.update(latestCandle);
        volumeSeriesRef.current.update(latestVolume);
      } catch {
        candleSeriesRef.current.setData(candleData);
        volumeSeriesRef.current.setData(volumeData);
      }
    }
  }, []);

  // Monitor visibility (Offscreen Chart Optimization)
  useEffect(() => {
    if (!containerRef.current || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const isVisible = entry.isIntersecting;
        isOffscreenRef.current = !isVisible;

        // When returning to screen, immediately apply any buffered pending candles
        if (isVisible && pendingCandlesRef.current) {
          if (candleSeriesRef.current) {
            applyCandlesToSeries(pendingCandlesRef.current);
            pendingCandlesRef.current = null;
          }
        }
      },
      { threshold: 0.05 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [applyCandlesToSeries]);

  // Helper to recompute visual coordinates of price lines
  const updateLineCoordinates = useCallback(() => {
    const series = candleSeriesRef.current;
    if (!series || !horizontalLines || horizontalLines.length === 0) {
      setLineCoords([]);
      return;
    }

    const coords: { id: string; y: number; line: HorizontalLineConfig }[] = [];
    for (const line of horizontalLines) {
      const y = series.priceToCoordinate(line.price);
      if (y !== null && !isNaN(y) && y >= 0 && y <= height) {
        coords.push({ id: line.id, y, line });
      }
    }
    setLineCoords(coords);
  }, [horizontalLines, height]);

  // Initialize the chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: isLightRef.current ? '#ffffff' : '#090d16' },
        textColor: isLightRef.current ? '#334155' : '#94a3b8',
        fontSize: 11,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      grid: {
        vertLines: { color: isLightRef.current ? 'rgba(226, 232, 240, 0.8)' : 'rgba(30, 41, 59, 0.45)' },
        horzLines: { color: isLightRef.current ? 'rgba(226, 232, 240, 0.8)' : 'rgba(30, 41, 59, 0.45)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: isLightRef.current ? '#94a3b8' : '#64748b',
          width: 1,
          style: 3,
          labelBackgroundColor: isLightRef.current ? '#334155' : '#1e293b',
        },
        horzLine: {
          color: isLightRef.current ? '#94a3b8' : '#64748b',
          width: 1,
          style: 3,
          labelBackgroundColor: isLightRef.current ? '#334155' : '#1e293b',
        },
      },
      rightPriceScale: {
        borderColor: isLightRef.current ? '#cbd5e1' : '#1e293b',
        scaleMargins: {
          top: 0.08,
          bottom: 0.22, // Space for volume bars
        },
        autoScale: true,
      },
      timeScale: {
        borderColor: isLightRef.current ? '#cbd5e1' : '#1e293b',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 8,
        minBarSpacing: 3,
      },
    });

    // 1. Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: isLightRef.current ? '#ef4444' : '#f43f5e',
      borderVisible: isLightRef.current,
      borderColor: isLightRef.current ? '#10b981' : undefined,
      borderUpColor: '#10b981',
      borderDownColor: isLightRef.current ? '#ef4444' : '#f43f5e',
      wickUpColor: '#10b981',
      wickDownColor: isLightRef.current ? '#ef4444' : '#f43f5e',
    });

    // 2. Volume Series (as bottom overlay)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay on separate visual scale
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8, // Volume bars reside in bottom 20%
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Immediately render current candles if available upon chart initialization
    if (latestThrottledCandlesRef.current.length > 0) {
      applyCandlesToSeries(latestThrottledCandlesRef.current);
    }

    // Crosshair hover callback
    chart.subscribeCrosshairMove((param) => {
      if (!onHoverCandle) return;

      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > containerRef.current!.clientWidth ||
        param.point.y < 0 ||
        param.point.y > height
      ) {
        onHoverCandle(null);
        return;
      }

      const seriesData = param.seriesData.get(candleSeries) as CandlestickData<Time> | undefined;
      const volumeData = param.seriesData.get(volumeSeries) as HistogramData<Time> | undefined;

      if (seriesData) {
        const timeSec = typeof seriesData.time === 'number' ? seriesData.time : Number(seriesData.time);
        onHoverCandle({
          time: timeSec,
          open: seriesData.open,
          high: seriesData.high,
          low: seriesData.low,
          close: seriesData.close,
          volume: volumeData ? volumeData.value : 0,
          closed: true,
        });
      } else {
        onHoverCandle(null);
      }
    });

    // Infinite scroll left: load older candles
    chart.timeScale().subscribeVisibleLogicalRangeChange((range: LogicalRange | null) => {
      if (range && range.from < 5 && onLoadOlderHistory && !isLoadingOlderRef.current) {
        onLoadOlderHistory();
      }
      updateLineCoordinates();
    });

    // Responsive sizing with ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !chartRef.current) return;
      const { width, height: containerHeight } = entries[0].contentRect;
      if (width > 0) {
        chartRef.current.applyOptions({
          width,
          height: containerHeight > 0 ? containerHeight : height,
        });
        updateLineCoordinates();
      }
    });

    const priceLinesMap = priceLinesMapRef.current;
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLinesMap.clear();
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    };
  }, [height, onHoverCandle, onLoadOlderHistory, applyCandlesToSeries, updateLineCoordinates]);

  // Dynamically update existing chart theme when toggling between Dark and Light mode
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    if (isLight) {
      // Light Mode chart appearance
      chartRef.current.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: '#ffffff' },
          textColor: '#334155',
        },
        grid: {
          vertLines: { color: 'rgba(226, 232, 240, 0.8)' },
          horzLines: { color: 'rgba(226, 232, 240, 0.8)' },
        },
        crosshair: {
          vertLine: {
            color: '#94a3b8',
            labelBackgroundColor: '#334155',
          },
          horzLine: {
            color: '#94a3b8',
            labelBackgroundColor: '#334155',
          },
        },
        rightPriceScale: {
          borderColor: '#cbd5e1',
        },
        timeScale: {
          borderColor: '#cbd5e1',
        },
      });

      candleSeriesRef.current.applyOptions({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: true,
        borderColor: '#10b981',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });
    } else {
      // Dark Mode chart appearance (original default)
      chartRef.current.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: '#090d16' },
          textColor: '#94a3b8',
        },
        grid: {
          vertLines: { color: 'rgba(30, 41, 59, 0.45)' },
          horzLines: { color: 'rgba(30, 41, 59, 0.45)' },
        },
        crosshair: {
          vertLine: {
            color: '#64748b',
            labelBackgroundColor: '#1e293b',
          },
          horzLine: {
            color: '#64748b',
            labelBackgroundColor: '#1e293b',
          },
        },
        rightPriceScale: {
          borderColor: '#1e293b',
        },
        timeScale: {
          borderColor: '#1e293b',
        },
      });

      candleSeriesRef.current.applyOptions({
        upColor: '#10b981',
        downColor: '#f43f5e',
        borderVisible: false,
        borderUpColor: '#10b981',
        borderDownColor: '#f43f5e',
        wickUpColor: '#10b981',
        wickDownColor: '#f43f5e',
      });
    }

    if (volumeSeriesRef.current && latestThrottledCandlesRef.current.length > 0) {
      const sanitized = sanitizeAndDeduplicateCandles(latestThrottledCandlesRef.current);
      const volumeData: HistogramData<Time>[] = sanitized.map((c) => ({
        time: c.time as Time,
        value: c.volume,
        color: isLight
          ? c.close >= c.open
            ? 'rgba(16, 185, 129, 0.55)'
            : 'rgba(239, 68, 68, 0.55)'
          : c.close >= c.open
          ? 'rgba(16, 185, 129, 0.4)'
          : 'rgba(244, 63, 94, 0.4)',
      }));
      volumeSeriesRef.current.setData(volumeData);
    }
  }, [isLight]);

  // Synchronize horizontal lines onto lightweight-charts
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    const currentIds = new Set(horizontalLines.map((l) => l.id));

    // Remove obsolete lines
    priceLinesMapRef.current.forEach((pl, id) => {
      if (!currentIds.has(id)) {
        try {
          series.removePriceLine(pl);
        } catch {}
        priceLinesMapRef.current.delete(id);
      }
    });

    // Create or update lines
    horizontalLines.forEach((line) => {
      const existing = priceLinesMapRef.current.get(line.id);
      const lineStyle =
        line.lineStyle === 'dashed'
          ? LineStyle.Dashed
          : line.lineStyle === 'dotted'
          ? LineStyle.Dotted
          : LineStyle.Solid;

      const options = {
        price: line.price,
        color: line.color,
        lineWidth: line.lineWidth,
        lineStyle,
        axisLabelVisible: true,
        title: line.label,
      };

      if (existing) {
        existing.applyOptions(options);
      } else {
        try {
          const pl = series.createPriceLine(options);
          priceLinesMapRef.current.set(line.id, pl);
        } catch (err) {
          console.warn('Error creating price line:', err);
        }
      }
    });

    updateLineCoordinates();
  }, [horizontalLines, updateLineCoordinates]);

  // Update line coordinates when candles change (scale updates)
  useEffect(() => {
    updateLineCoordinates();
  }, [candles, updateLineCoordinates]);

  // Handle pointer dragging of line handles
  const handlePointerDown = (e: React.PointerEvent, line: HorizontalLineConfig, currentY: number) => {
    e.preventDefault();
    e.stopPropagation();
    draggingLineIdRef.current = line.id;
    setDraggingInfo({ id: line.id, price: line.price, y: currentY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingLineIdRef.current || !containerRef.current || !candleSeriesRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relY = Math.max(10, Math.min(height - 10, e.clientY - rect.top));
    const newPrice = candleSeriesRef.current.coordinateToPrice(relY);
    if (newPrice !== null && !isNaN(newPrice) && newPrice > 0) {
      setDraggingInfo({ id: draggingLineIdRef.current, price: newPrice, y: relY });
      const entry = priceLinesMapRef.current.get(draggingLineIdRef.current);
      if (entry) {
        entry.applyOptions({ price: newPrice });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingLineIdRef.current) {
      const lineId = draggingLineIdRef.current;
      draggingLineIdRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}

      if (draggingInfo && draggingInfo.id === lineId) {
        const finalPrice = Number(draggingInfo.price.toFixed(4));
        onUpdateLine?.(lineId, { price: finalPrice });
      }
      setDraggingInfo(null);
      updateLineCoordinates();
    }
  };

  // Synchronize candles into chart series with offscreen & redraw throttle support
  useEffect(() => {
    if (candles.length === 0) return;
    latestThrottledCandlesRef.current = candles;

    // 1. Offscreen optimization: if chart is not in viewport, buffer data without redrawing canvas
    if (isOffscreenRef.current) {
      pendingCandlesRef.current = candles;
      return;
    }

    // 2. Initial load or large batch change: apply immediately without throttling
    const prevLength = lastCandlesLengthRef.current;
    const currentLength = candles.length;
    if (prevLength === 0 || Math.abs(currentLength - prevLength) > 1 || redrawRateMs === 0) {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      applyCandlesToSeries(candles);
      return;
    }

    // 3. Throttled Redraw Rate for live ticks (50ms, 100ms, 150ms, 200ms, 250ms, 300ms)
    if (!throttleTimerRef.current) {
      throttleTimerRef.current = setTimeout(() => {
        throttleTimerRef.current = null;
        if (!isOffscreenRef.current) {
          applyCandlesToSeries(latestThrottledCandlesRef.current);
        }
      }, redrawRateMs);
    }
  }, [candles, redrawRateMs, applyCandlesToSeries]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-slate-950 border border-slate-800/80">
      {/* Loading older data overlay banner */}
      {isLoadingOlder && (
        <div className="absolute top-2 left-2 z-20 px-2.5 py-1 rounded bg-slate-900/90 border border-slate-700 text-[10px] font-medium text-slate-300 shadow-md flex items-center gap-1.5 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span>جاري تحميل بيانات تاريخية أقدم...</span>
        </div>
      )}

      {/* Lightweight Charts Canvas Host */}
      <div
        id="tv-lightweight-chart-container"
        ref={containerRef}
        style={{ height: `${height}px` }}
        className="w-full relative"
      />

      {/* Interactive Drag Handles for Horizontal Lines */}
      {lineCoords.map(({ id, y, line }) => {
        const isDragging = draggingInfo?.id === id;
        const currentY = isDragging ? draggingInfo.y : y;
        const currentPrice = isDragging ? draggingInfo.price : line.price;

        return (
          <div
            key={id}
            style={{
              top: `${currentY}px`,
              transform: 'translateY(-50%)',
            }}
            className="absolute left-2 right-14 pointer-events-none z-20 flex items-center justify-between"
          >
            {/* Left Tag with Label and Edit Button */}
            <div
              className={`pointer-events-auto flex items-center gap-1.5 px-2 py-0.5 rounded shadow-md border cursor-pointer select-none transition-all ${
                isDragging ? 'scale-105 ring-2 ring-emerald-400' : 'hover:scale-102'
              }`}
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                borderColor: line.color,
                color: line.textColor,
                fontSize: `${line.textSize}px`,
              }}
              onClick={() => onSelectLine?.(line)}
              title="انقر لتعديل إعدادات الخط أو اسحبه لتغيير السعر"
            >
              <button
                type="button"
                onPointerDown={(e) => handlePointerDown(e, line, currentY)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="cursor-ns-resize p-0.5 text-slate-400 hover:text-slate-100"
                title="اسحب لأعلى أو لأسفل لتحريك الخط"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
              <span className="font-semibold">{line.label}</span>
              <span className="font-mono text-[10px] opacity-80">${currentPrice.toFixed(4)}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLine?.(line);
                }}
                className="p-0.5 hover:text-emerald-400"
                title="تخصيص الخط"
              >
                <Sliders className="w-3 h-3" />
              </button>
            </div>

            {/* Right Drag Handle near Price Scale */}
            <div
              onPointerDown={(e) => handlePointerDown(e, line, currentY)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="pointer-events-auto cursor-ns-resize px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1 border select-none transition-transform hover:scale-110 active:scale-110"
              style={{
                backgroundColor: line.color,
                color: line.textColor || '#000000',
                fontSize: '10px',
                fontWeight: 'bold',
              }}
              title="اسحب لتغيير السعر"
            >
              <GripVertical className="w-3 h-3 opacity-70" />
              <span className="font-mono">${currentPrice.toFixed(2)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
