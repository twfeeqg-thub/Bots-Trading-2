// Project Q — Phase 4: Chart Card Component
// Closed Specification: Represents one chart in the multiple charts vertical list.
// Supports Drag & Drop reorder, Move up/down, Fullscreen, Floating, Minimize (persistent),
// Duplicate, Close (to Closed Charts), Timeframe selector, and Horizontal lines.
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { 
  GripVertical, 
  ChevronUp, 
  ChevronDown, 
  Maximize2, 
  Minimize2, 
  Copy, 
  X, 
  Plus, 
  Clock, 
  Wifi, 
  WifiOff, 
  ExternalLink, 
  Layers, 
  Sliders, 
  ChevronRight,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { ChartItemConfig, HorizontalLineConfig } from '@/lib/charts/chart-persistence';
import { useChart } from '@/hooks/use-chart';
import { BasicChart, RedrawRateOption } from './BasicChart';
import { HorizontalLineModal } from './HorizontalLineModal';
import { Candle, NativeTimeframe, VALID_TIMEFRAMES } from '@/lib/charts/types';
import { useTheme } from '@/components/theme/ThemeContext';

interface ChartCardProps {
  chartConfig: ChartItemConfig;
  index: number;
  totalCount: number;
  onUpdateConfig: (id: string, updates: Partial<ChartItemConfig>) => void;
  onCloseChart: (id: string) => void;
  onDuplicateChart: (chart: ChartItemConfig) => void;
  onFullscreenChart: (chart: ChartItemConfig, candles: Candle[], currentPrice: number | null, changePct: number) => void;
  onFloatingChart: (chart: ChartItemConfig, candles: Candle[], currentPrice: number | null, changePct: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDragStartItem: (e: React.DragEvent, index: number) => void;
  onDragOverItem: (e: React.DragEvent, index: number) => void;
  onDropItem: (e: React.DragEvent, index: number) => void;
}

const REDRAW_RATES: { label: string; value: RedrawRateOption }[] = [
  { label: 'فوري (0ms)', value: 0 },
  { label: '50ms', value: 50 },
  { label: '100ms', value: 100 },
  { label: '150ms', value: 150 },
  { label: '200ms', value: 200 },
  { label: '250ms', value: 250 },
  { label: '300ms', value: 300 },
];

export function ChartCard({
  chartConfig,
  index,
  totalCount,
  onUpdateConfig,
  onCloseChart,
  onDuplicateChart,
  onFullscreenChart,
  onFloatingChart,
  onMoveUp,
  onMoveDown,
  onDragStartItem,
  onDragOverItem,
  onDropItem,
}: ChartCardProps) {
  const { isLight } = useTheme();
  const {
    candles,
    currentPrice,
    connectionStatus,
    activeSource,
    isLoadingOlder,
    setTimeframe,
    loadOlderHistory,
  } = useChart({
    initialSymbol: chartConfig.symbol,
    initialTimeframe: chartConfig.timeframe,
  });

  const [hoverCandle, setHoverCandle] = useState<Candle | null>(null);
  const [lineModalOpen, setLineModalOpen] = useState<boolean>(false);
  const [selectedLineForEdit, setSelectedLineForEdit] = useState<HorizontalLineConfig | null>(null);

  // Timeframe change handler
  const handleTimeframeChange = (newTf: NativeTimeframe) => {
    setTimeframe(newTf);
    onUpdateConfig(chartConfig.id, { timeframe: newTf });
  };

  // Redraw rate change handler
  const handleRedrawRateChange = (newRate: RedrawRateOption) => {
    onUpdateConfig(chartConfig.id, { redrawRateMs: newRate });
  };

  // Toggle Minimized state (persistent)
  const handleToggleMinimize = () => {
    onUpdateConfig(chartConfig.id, { isMinimized: !chartConfig.isMinimized });
  };

  // Add a new horizontal line at current price
  const handleAddLineAtCurrentPrice = () => {
    const defaultPrice = currentPrice || (candles.length > 0 ? candles[candles.length - 1].close : 100);
    const newLine: HorizontalLineConfig = {
      id: `hl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      price: Number(defaultPrice.toFixed(4)),
      label: `مستوى ${chartConfig.horizontalLines.length + 1}`,
      color: '#10B981',
      textColor: '#FFFFFF',
      textSize: 12,
      lineWidth: 2,
      lineStyle: 'dashed',
    };

    const updatedLines = [...chartConfig.horizontalLines, newLine];
    onUpdateConfig(chartConfig.id, { horizontalLines: updatedLines });
    setSelectedLineForEdit(newLine);
    setLineModalOpen(true);
  };

  // Update existing line
  const handleUpdateLine = useCallback((lineId: string, updates: Partial<HorizontalLineConfig>) => {
    const updatedLines = chartConfig.horizontalLines.map((l) =>
      l.id === lineId ? { ...l, ...updates } : l
    );
    onUpdateConfig(chartConfig.id, { horizontalLines: updatedLines });
  }, [chartConfig.id, chartConfig.horizontalLines, onUpdateConfig]);

  // Delete line
  const handleDeleteLine = useCallback((lineId: string) => {
    const updatedLines = chartConfig.horizontalLines.filter((l) => l.id !== lineId);
    onUpdateConfig(chartConfig.id, { horizontalLines: updatedLines });
  }, [chartConfig.id, chartConfig.horizontalLines, onUpdateConfig]);

  // Open line editor for specific line
  const handleSelectLine = useCallback((line: HorizontalLineConfig) => {
    setSelectedLineForEdit(line);
    setLineModalOpen(true);
  }, []);

  // Compute price change % for the active timeframe
  const changePct = useMemo(() => {
    if (candles.length < 2) return 0;
    const firstClose = candles[0].open;
    const lastClose = currentPrice ?? candles[candles.length - 1].close;
    if (firstClose === 0) return 0;
    return ((lastClose - firstClose) / firstClose) * 100;
  }, [candles, currentPrice]);

  const isPositive = changePct >= 0;

  // Source Badge text & color
  const sourceBadge = useMemo(() => {
    if (activeSource === 'kraken') {
      return {
        text: 'Kraken Primary',
        color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      };
    }
    if (activeSource === 'binance') {
      return {
        text: 'Binance Fallback',
        color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      };
    }
    return {
      text: 'Reconnecting',
      color: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    };
  }, [activeSource]);

  // Display Candle for OHLCV
  const activeCandle = hoverCandle || (candles.length > 0 ? candles[candles.length - 1] : null);

  // -------------------------------------------------------------
  // MINIMIZED VIEW
  // -------------------------------------------------------------
  if (chartConfig.isMinimized) {
    return (
      <div
        draggable
        onDragStart={(e) => onDragStartItem(e, index)}
        onDragOver={(e) => onDragOverItem(e, index)}
        onDrop={(e) => onDropItem(e, index)}
        className={`w-full px-3 py-2.5 rounded-xl transition-all flex items-center justify-between gap-3 text-xs theme-card ${
          isLight
            ? 'border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-slate-300'
            : 'border border-slate-800 bg-slate-900/90 text-slate-100 shadow-sm hover:border-slate-700'
        }`}
      >
        {/* Left: Drag handle & Reorder */}
        <div className="flex items-center gap-1.5">
          <div
            className="cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-slate-300"
            title="اسحب لتغيير ترتيب الشارت"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onMoveUp(index)}
              className="p-0.5 text-slate-500 hover:text-slate-300 disabled:opacity-20 transition-colors"
              title="تحريك لأعلى"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={index === totalCount - 1}
              onClick={() => onMoveDown(index)}
              className="p-0.5 text-slate-500 hover:text-slate-300 disabled:opacity-20 transition-colors"
              title="تحريك لأسفل"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* Symbol & Timeframe */}
          <div className="flex items-center gap-2 mr-1">
            <span className="font-bold text-slate-100 font-mono text-sm tracking-wide">
              {chartConfig.symbol}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-emerald-400 border border-slate-700">
              {chartConfig.timeframe}
            </span>
          </div>
        </div>

        {/* Middle: Price & Lines */}
        <div className="flex items-center gap-3">
          {currentPrice !== null && (
            <div className="flex items-center gap-1.5 font-mono">
              <span className="font-bold text-slate-200">${currentPrice.toFixed(2)}</span>
              <span className={`text-[11px] font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositive ? '+' : ''}{changePct.toFixed(2)}%
              </span>
            </div>
          )}

          {chartConfig.horizontalLines.length > 0 && (
            <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700 items-center gap-1">
              <Layers className="w-2.5 h-2.5" />
              <span>{chartConfig.horizontalLines.length} خطوط</span>
            </span>
          )}

          <span className={`hidden md:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${sourceBadge.color}`}>
            {sourceBadge.text}
          </span>
        </div>

        {/* Right: Expand & Close */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleToggleMinimize}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium flex items-center gap-1 transition-colors"
            title="استعادة الشارت (Expand)"
          >
            <Maximize2 className="w-3 h-3" />
            <span>استعادة</span>
          </button>

          <button
            type="button"
            onClick={() => onCloseChart(chartConfig.id)}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            title="إغلاق الشارت"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // FULL EXPANDED VIEW
  // -------------------------------------------------------------
  return (
    <div
      draggable
      onDragStart={(e) => onDragStartItem(e, index)}
      onDragOver={(e) => onDragOverItem(e, index)}
      onDrop={(e) => onDropItem(e, index)}
      className={`w-full max-w-full rounded-2xl shadow-xl overflow-hidden transition-all flex flex-col space-y-2 p-3 sm:p-4 theme-card ${
        isLight
          ? 'border border-slate-200 bg-white text-slate-800 shadow-md'
          : 'border border-slate-800 bg-slate-900 text-slate-100'
      }`}
    >
      {/* Top Header Controls */}
      <div className={`flex flex-wrap items-center justify-between gap-2.5 border-b pb-3 ${
        isLight ? 'border-slate-200' : 'border-slate-800/80'
      }`}>
        {/* Left: Drag Handle, Symbol, Timeframe Selector, Price */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Reorder Drag Handle */}
          <div
            className={`cursor-grab active:cursor-grabbing p-1.5 rounded-lg border transition-colors ${
              isLight
                ? 'bg-slate-100 text-slate-500 hover:text-slate-800 border-slate-200'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
            title="اسحب لتغيير ترتيب الشارت (Drag & Drop)"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Quick Up/Down buttons */}
          <div className={`flex items-center rounded-lg p-0.5 border ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}>
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onMoveUp(index)}
              className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-20 transition-colors"
              title="تحريك لأعلى"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={index === totalCount - 1}
              onClick={() => onMoveDown(index)}
              className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-20 transition-colors"
              title="تحريك لأسفل"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Symbol */}
          <div className="flex items-center gap-1.5 ml-1">
            <span className={`text-base font-bold font-mono tracking-wide ${
              isLight ? 'text-slate-900' : 'text-slate-100'
            }`}>
              {chartConfig.symbol}
            </span>
          </div>

          {/* Independent Timeframe Selector */}
          <div className={`flex items-center rounded-lg p-0.5 border text-xs ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}>
            {VALID_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => handleTimeframeChange(tf)}
                className={`px-2 py-1 rounded-md font-semibold transition-colors ${
                  chartConfig.timeframe === tf
                    ? isLight
                      ? 'bg-white text-emerald-700 shadow-xs border border-emerald-500/40'
                      : 'bg-slate-800 text-emerald-400 shadow-sm'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Live Price & Change */}
          {currentPrice !== null && (
            <div className={`flex items-center gap-2 font-mono px-2 py-1 rounded-lg border ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800/80'
            }`}>
              <span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                ${currentPrice.toFixed(2)}
              </span>
              <span
                className={`text-xs font-semibold flex items-center gap-0.5 ${
                  isPositive ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{isPositive ? '+' : ''}{changePct.toFixed(2)}%</span>
              </span>
            </div>
          )}

          {/* Data Source Badge */}
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${sourceBadge.color}`}>
            {sourceBadge.text}
          </span>
        </div>

        {/* Right: Action Buttons (Add Line, Redraw Rate, Fullscreen, Floating, Minimize, Duplicate, Close) */}
        <div className="flex items-center flex-wrap gap-1.5">
          {/* Add Horizontal Line button */}
          <button
            type="button"
            onClick={handleAddLineAtCurrentPrice}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-colors shadow-sm"
            title="إضافة خط أفقي عند السعر الحالي"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ خط أفقي</span>
          </button>

          {/* Redraw Rate Selector */}
          <div className={`hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] ${
            isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}>
            <span>معدل التحديث:</span>
            <select
              value={chartConfig.redrawRateMs}
              onChange={(e) => handleRedrawRateChange(Number(e.target.value) as RedrawRateOption)}
              className="bg-transparent text-emerald-600 font-mono text-[11px] focus:outline-none cursor-pointer"
            >
              {REDRAW_RATES.map((r) => (
                <option key={r.value} value={r.value} className={isLight ? 'bg-white text-slate-800' : 'bg-slate-900 text-slate-200'}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Fullscreen button */}
          <button
            type="button"
            onClick={() => onFullscreenChart(chartConfig, candles, currentPrice, changePct)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
                : 'bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
            title="ملء الشاشة (Fullscreen)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Floating Window button */}
          <button
            type="button"
            onClick={() => onFloatingChart(chartConfig, candles, currentPrice, changePct)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
                : 'bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
            title="نافذة عائمة (Floating)"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          {/* Minimize button */}
          <button
            type="button"
            onClick={handleToggleMinimize}
            className={`p-1.5 rounded-lg border transition-colors ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
                : 'bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
            title="تصغير / طي الشارت (Minimize)"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>

          {/* Duplicate button */}
          <button
            type="button"
            onClick={() => onDuplicateChart(chartConfig)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
                : 'bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
            title="تكرار الشارت (Duplicate)"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={() => onCloseChart(chartConfig.id)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isLight
                ? 'bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border-slate-200 hover:border-rose-300'
                : 'bg-slate-950 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border-slate-800 hover:border-rose-500/30'
            }`}
            title="إغلاق الشارت ونقله إلى الشارتات المغلقة"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* OHLCV & Interactive Info Bar */}
      <div className={`flex flex-wrap items-center justify-between text-xs px-2 py-1 font-mono rounded-lg border ${
        isLight ? 'text-slate-600 bg-slate-50 border-slate-200' : 'text-slate-400 bg-slate-950/40 border-slate-800/50'
      }`}>
        <div className="flex items-center gap-3">
          {activeCandle ? (
            <>
              <span>O: <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>${activeCandle.open.toFixed(2)}</strong></span>
              <span>H: <strong className={isLight ? 'text-emerald-700' : 'text-emerald-400'}>${activeCandle.high.toFixed(2)}</strong></span>
              <span>L: <strong className={isLight ? 'text-rose-700' : 'text-rose-400'}>${activeCandle.low.toFixed(2)}</strong></span>
              <span>C: <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>${activeCandle.close.toFixed(2)}</strong></span>
              <span>V: <strong className={isLight ? 'text-slate-700' : 'text-slate-300'}>{Math.round(activeCandle.volume).toLocaleString()}</strong></span>
            </>
          ) : (
            <span>جاري تحميل بيانات الشموع...</span>
          )}
        </div>

        {/* Lines summary tag */}
        {chartConfig.horizontalLines.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">الخطوط:</span>
            <div className="flex items-center gap-1">
              {chartConfig.horizontalLines.map((line) => (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => handleSelectLine(line)}
                  className="px-1.5 py-0.2 rounded text-[10px] font-mono border hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    borderColor: line.color,
                    color: line.textColor,
                  }}
                  title="انقر لتعديل هذا الخط"
                >
                  {line.label} (${line.price.toFixed(2)})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BasicChart Canvas Component */}
      <BasicChart
        candles={candles}
        isLoadingOlder={isLoadingOlder}
        onLoadOlderHistory={loadOlderHistory}
        onHoverCandle={setHoverCandle}
        height={420}
        redrawRateMs={chartConfig.redrawRateMs}
        horizontalLines={chartConfig.horizontalLines}
        onUpdateLine={handleUpdateLine}
        onSelectLine={handleSelectLine}
      />

      {/* Line Customization Modal */}
      <HorizontalLineModal
        isOpen={lineModalOpen}
        onClose={() => {
          setLineModalOpen(false);
          setSelectedLineForEdit(null);
        }}
        line={selectedLineForEdit}
        onSave={(updated) => handleUpdateLine(updated.id, updated)}
        onDelete={(lineId) => handleDeleteLine(lineId)}
        currentPrice={currentPrice}
      />
    </div>
  );
}
