// Project Q — Phase 4: Fullscreen Chart with Portrait/Landscape Orientation
// Closed Specification: Fullscreen view, other charts temporarily hidden,
// Portrait / Landscape orientation toggle inside Fullscreen only (transient, not saved),
// Exit Fullscreen restores normal charts list without any changes.
'use client';

import React, { useState } from 'react';
import { 
  X, 
  Maximize2, 
  Minimize2, 
  Smartphone, 
  Monitor, 
  Plus, 
  Layers 
} from 'lucide-react';
import { ChartItemConfig, HorizontalLineConfig } from '@/lib/charts/chart-persistence';
import { BasicChart, RedrawRateOption } from './BasicChart';
import { Candle } from '@/lib/charts/types';
import { useTheme } from '@/components/theme/ThemeContext';

interface FullscreenChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartConfig: ChartItemConfig;
  candles: Candle[];
  isLoadingOlder?: boolean;
  onLoadOlderHistory?: () => void;
  onHoverCandle?: (candle: Candle | null) => void;
  onAddLineAtCurrentPrice?: () => void;
  onUpdateLine?: (lineId: string, updates: Partial<HorizontalLineConfig>) => void;
  onSelectLine?: (line: HorizontalLineConfig) => void;
  sourceBadgeText?: string;
  sourceBadgeColor?: string;
  price?: number;
  changePct?: number;
}

export function FullscreenChartModal({
  isOpen,
  onClose,
  chartConfig,
  candles,
  isLoadingOlder,
  onLoadOlderHistory,
  onHoverCandle,
  onAddLineAtCurrentPrice,
  onUpdateLine,
  onSelectLine,
  sourceBadgeText,
  sourceBadgeColor,
  price,
  changePct,
}: FullscreenChartModalProps) {
  // Transient orientation state for Fullscreen (Portrait or Landscape). Not persisted.
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const { isLight } = useTheme();

  if (!isOpen) return null;

  const isPositive = (changePct ?? 0) >= 0;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col animate-in fade-in duration-150 overflow-hidden max-w-full ${
        isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Fullscreen Header */}
      <div
        className={`theme-modal-header px-4 py-2.5 border-b flex items-center justify-between z-30 shrink-0 ${
          isLight ? 'bg-white border-slate-200 text-slate-900 shadow-xs' : 'bg-slate-900/90 border-slate-800 text-slate-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`text-base font-bold font-mono tracking-wide ${
              isLight ? 'text-slate-900' : 'text-slate-100'
            }`}>
              {chartConfig.symbol}
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {chartConfig.timeframe}
            </span>
          </div>

          {price !== undefined && price > 0 && (
            <div className="flex items-center gap-2 font-mono text-sm">
              <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>${price.toFixed(2)}</span>
              {changePct !== undefined && (
                <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}`}>
                  {isPositive ? '+' : ''}{changePct.toFixed(2)}%
                </span>
              )}
            </div>
          )}

          {sourceBadgeText && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${sourceBadgeColor || (isLight ? 'bg-slate-100 text-slate-600 border-slate-300' : 'bg-slate-800 text-slate-400 border-slate-700')}`}>
              {sourceBadgeText}
            </span>
          )}
        </div>

        {/* Orientation and Controls */}
        <div className="flex items-center gap-2">
          {/* Portrait / Landscape orientation buttons */}
          <div className={`flex items-center rounded-lg p-0.5 border text-xs ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}>
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors ${
                orientation === 'landscape'
                  ? isLight
                    ? 'bg-white text-emerald-700 font-semibold shadow-xs border border-emerald-300'
                    : 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="عرض أفقي (Landscape)"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>أفقي</span>
            </button>
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors ${
                orientation === 'portrait'
                  ? isLight
                    ? 'bg-white text-emerald-700 font-semibold shadow-xs border border-emerald-300'
                    : 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="عرض عمودي (Portrait)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>عمودي</span>
            </button>
          </div>

          {/* Add Horizontal Line */}
          {onAddLineAtCurrentPrice && (
            <button
              type="button"
              onClick={onAddLineAtCurrentPrice}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="إضافة خط أفقي عند السعر الحالي"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-500" />
              <span>خط أفقي</span>
            </button>
          )}

          {/* Exit Fullscreen */}
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs border ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-slate-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border-slate-700'
            }`}
            title="خروج من وضع ملء الشاشة (ESC)"
          >
            <Minimize2 className="w-4 h-4" />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas Area adapting to selected orientation */}
      <div className="flex-1 w-full h-full p-2 flex items-center justify-center overflow-hidden bg-slate-950">
        <div
          className={`w-full h-full transition-all duration-300 flex flex-col justify-center ${
            orientation === 'portrait' ? 'max-w-2xl mx-auto' : 'max-w-full'
          }`}
        >
          <BasicChart
            candles={candles}
            isLoadingOlder={isLoadingOlder}
            onLoadOlderHistory={onLoadOlderHistory}
            onHoverCandle={onHoverCandle}
            height={orientation === 'portrait' ? 680 : 780}
            redrawRateMs={chartConfig.redrawRateMs}
            horizontalLines={chartConfig.horizontalLines}
            onUpdateLine={onUpdateLine}
            onSelectLine={onSelectLine}
          />
        </div>
      </div>
    </div>
  );
}
