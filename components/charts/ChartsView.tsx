'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Plus,
  ArrowRight,
  Clock,
  RefreshCw,
  Sliders,
  Layers,
  ChevronDown,
  Trash2,
  Maximize2
} from 'lucide-react';
import { useTheme, ACCENT_PALETTES } from '@/components/theme/ThemeContext';
import { BasicChart, RedrawRateOption } from './BasicChart';
import { AddChartModal } from './AddChartModal';
import { Candle, NativeTimeframe, VALID_TIMEFRAMES } from '@/lib/charts/types';
import { HorizontalLineConfig, MAX_ACTIVE_CHARTS } from '@/lib/charts/chart-persistence';
import { sharedMarketDataStore } from '@/lib/market-data';

interface ChartsViewProps {
  initialSymbol?: string | null;
  onBackToScanner?: () => void;
}

interface ActiveChartTab {
  id: string;
  symbol: string;
  timeframe: NativeTimeframe;
  horizontalLines: HorizontalLineConfig[];
}

export function ChartsView({ initialSymbol, onBackToScanner }: ChartsViewProps) {
  const { isLight, accent } = useTheme();
  const palette = ACCENT_PALETTES[accent] || ACCENT_PALETTES.gold;

  const [activeCharts, setActiveCharts] = useState<ActiveChartTab[]>([
    {
      id: 'chart_1',
      symbol: initialSymbol || 'BTCUSDT',
      timeframe: '5m',
      horizontalLines: [],
    },
  ]);
  const [selectedChartId, setSelectedChartId] = useState<string>('chart_1');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

  const currentChart = activeCharts.find((c) => c.id === selectedChartId) || activeCharts[0];
  const currentSymbol = currentChart?.symbol || 'BTCUSDT';
  const currentTimeframe = currentChart?.timeframe || '5m';

  // Synchronize initialSymbol if provided
  useEffect(() => {
    if (initialSymbol) {
      setActiveCharts((prev) => {
        const exists = prev.find((c) => c.symbol === initialSymbol);
        if (exists) {
          setSelectedChartId(exists.id);
          return prev;
        }
        const newId = `chart_${Date.now()}`;
        setSelectedChartId(newId);
        return [
          ...prev,
          {
            id: newId,
            symbol: initialSymbol,
            timeframe: '5m',
            horizontalLines: [],
          },
        ];
      });
    }
  }, [initialSymbol]);

  // Fetch candle data from Binance proxy route or generate realistic candles
  const fetchCandles = useCallback(async (symbol: string, interval: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/binance/klines?symbol=${symbol}&interval=${interval}&limit=120`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const parsed: Candle[] = data.map((k: any) => ({
            time: typeof k[0] === 'number' ? Math.floor(k[0] / 1000) : Number(k.time || k.openTime),
            open: parseFloat(k[1] || k.open),
            high: parseFloat(k[2] || k.high),
            low: parseFloat(k[3] || k.low),
            close: parseFloat(k[4] || k.close),
            volume: parseFloat(k[5] || k.volume),
            closed: true,
          }));
          setCandles(parsed);
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // Fall through to mock generator
    }

    // High fidelity fallback candle generator for offline/rate-limit scenarios
    const livePrice = sharedMarketDataStore.getFreshPrice(symbol) || 67500;
    const nowSec = Math.floor(Date.now() / 1000);
    const intervalSec = interval === '1m' ? 60 : interval === '3m' ? 180 : interval === '5m' ? 300 : interval === '15m' ? 900 : 3600;

    const mock: Candle[] = [];
    let price = livePrice * 0.98;
    for (let i = 100; i >= 0; i--) {
      const t = nowSec - i * intervalSec;
      const variation = (Math.random() - 0.48) * (price * 0.006);
      const open = price;
      const close = price + variation;
      const high = Math.max(open, close) + Math.random() * (price * 0.003);
      const low = Math.min(open, close) - Math.random() * (price * 0.003);
      const volume = Math.random() * 50 + 10;
      price = close;
      mock.push({ time: t, open, high, low, close, volume, closed: i > 0 });
    }
    setCandles(mock);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCandles(currentSymbol, currentTimeframe);
    const interval = setInterval(() => {
      fetchCandles(currentSymbol, currentTimeframe);
    }, 15000);
    return () => clearInterval(interval);
  }, [currentSymbol, currentTimeframe, fetchCandles]);

  // Handle adding new chart
  const handleAddChart = (symbol: string, timeframe: NativeTimeframe) => {
    const newId = `chart_${Date.now()}`;
    const newTab: ActiveChartTab = {
      id: newId,
      symbol,
      timeframe,
      horizontalLines: [],
    };
    setActiveCharts((prev) => [...prev, newTab]);
    setSelectedChartId(newId);
    setShowAddModal(false);
  };

  // Close chart tab
  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeCharts.length <= 1) return;
    const remaining = activeCharts.filter((c) => c.id !== id);
    setActiveCharts(remaining);
    if (selectedChartId === id) {
      setSelectedChartId(remaining[0].id);
    }
  };

  // Timeframe change
  const handleChangeTimeframe = (tf: NativeTimeframe) => {
    setActiveCharts((prev) =>
      prev.map((c) => (c.id === selectedChartId ? { ...c, timeframe: tf } : c))
    );
  };

  // Add horizontal price line
  const handleAddHorizontalLine = () => {
    if (!currentChart || candles.length === 0) return;
    const lastClose = candles[candles.length - 1].close;
    const newLine: HorizontalLineConfig = {
      id: `line_${Date.now()}`,
      price: lastClose,
      color: '#f59e0b',
      lineWidth: 2,
      lineStyle: 'dashed',
      label: `هدف / دعم ${lastClose.toFixed(2)}`,
    };
    setActiveCharts((prev) =>
      prev.map((c) =>
        c.id === selectedChartId
          ? { ...c, horizontalLines: [...c.horizontalLines, newLine] }
          : c
      )
    );
  };

  const handleUpdateLine = (lineId: string, updates: Partial<HorizontalLineConfig>) => {
    setActiveCharts((prev) =>
      prev.map((c) =>
        c.id === selectedChartId
          ? {
              ...c,
              horizontalLines: c.horizontalLines.map((l) =>
                l.id === lineId ? { ...l, ...updates } : l
              ),
            }
          : c
      )
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Navigation & Chart Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-2 flex-wrap">
          {onBackToScanner && (
            <button
              type="button"
              onClick={onBackToScanner}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة للماسح</span>
            </button>
          )}

          {/* Active Chart Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-xl py-0.5">
            {activeCharts.map((chart) => {
              const isSelected = chart.id === selectedChartId;
              return (
                <div
                  key={chart.id}
                  onClick={() => setSelectedChartId(chart.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{chart.symbol}</span>
                  <span className="text-[10px] opacity-80 font-mono">({chart.timeframe})</span>
                  {activeCharts.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => handleCloseTab(chart.id, e)}
                      className="text-xs hover:text-rose-500 ml-1 p-0.5"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {activeCharts.length < MAX_ACTIVE_CHARTS && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
              title="إضافة شارت جديد"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>شارت جديد</span>
            </button>
          )}
        </div>

        {/* Timeframe selector & Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-xl p-0.5 border border-slate-200 dark:border-slate-800 text-xs">
            {VALID_TIMEFRAMES.slice(0, 6).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => handleChangeTimeframe(tf)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  currentTimeframe === tf
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddHorizontalLine}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            title="إضافة خط سعري أفقي قابل للسحب"
          >
            <Plus className="w-3.5 h-3.5 text-amber-500" />
            <span>خط أفقي</span>
          </button>

          <button
            type="button"
            onClick={() => fetchCandles(currentSymbol, currentTimeframe)}
            disabled={isLoading}
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            title="تحديث الشارت"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Hover Info Header */}
      {hoveredCandle && (
        <div className="px-4 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center gap-4 text-xs font-mono flex-wrap">
          <span className="text-slate-400 font-sans">بيانات الشمعة:</span>
          <span>افتتاح: <strong className="text-slate-900 dark:text-slate-100">{hoveredCandle.open.toFixed(4)}</strong></span>
          <span>أعلى: <strong className="text-emerald-500">{hoveredCandle.high.toFixed(4)}</strong></span>
          <span>أدنى: <strong className="text-rose-500">{hoveredCandle.low.toFixed(4)}</strong></span>
          <span>إغلاق: <strong className="text-slate-900 dark:text-slate-100">{hoveredCandle.close.toFixed(4)}</strong></span>
          <span>حجم: <strong className="text-amber-500">{hoveredCandle.volume.toFixed(2)}</strong></span>
        </div>
      )}

      {/* Main Interactive Candlestick Chart */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2 sm:p-4 shadow-xl overflow-hidden">
        <BasicChart
          candles={candles}
          height={520}
          horizontalLines={currentChart?.horizontalLines || []}
          onHoverCandle={setHoveredCandle}
          onUpdateLine={handleUpdateLine}
        />
      </div>

      {/* Add Chart Modal */}
      <AddChartModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddChart={handleAddChart}
        activeSymbols={activeCharts.map((c) => c.symbol)}
        activeChartsCount={activeCharts.length}
      />
    </div>
  );
}
