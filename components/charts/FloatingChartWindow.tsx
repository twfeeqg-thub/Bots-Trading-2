// Project Q — Phase 4: Floating Chart Window
// Closed Specification: Turns chart into a floating, draggable window above app interface.
// Temporary state (never persisted across sessions). Dock/Close returns to normal chart flow.
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Move, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  Layers, 
  Plus 
} from 'lucide-react';
import { ChartItemConfig, HorizontalLineConfig } from '@/lib/charts/chart-persistence';
import { BasicChart } from './BasicChart';
import { Candle } from '@/lib/charts/types';
import { useTheme } from '@/components/theme/ThemeContext';

interface FloatingChartWindowProps {
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
  price?: number;
  changePct?: number;
}

export function FloatingChartWindow({
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
  price,
  changePct,
}: FloatingChartWindowProps) {
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return { x: 8, y: 65 };
    }
    return { x: 16, y: 75 };
  });

  const [size, setSize] = useState<{ width: number; height: number }>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return { width: Math.max(280, window.innerWidth - 16), height: 360 };
    }
    return { width: 560, height: 420 };
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const { isLight } = useTheme();
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  if (!isOpen) return null;

  const isPositive = (changePct ?? 0) >= 0;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    const maxLeft = Math.max(8, window.innerWidth - size.width - 8);
    const maxTop = Math.max(8, window.innerHeight - 150);
    setPosition({
      x: Math.max(8, Math.min(maxLeft, dragStartRef.current.initialX + deltaX)),
      y: Math.max(8, Math.min(maxTop, dragStartRef.current.initialY + deltaY)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: 'calc(100dvh - 32px)',
        zIndex: 60,
      }}
      className={`theme-modal-dialog rounded-2xl backdrop-blur-md shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 ${
        isLight ? 'border border-slate-200 bg-white text-slate-800' : 'border border-slate-700 bg-slate-900/95 text-slate-100'
      }`}
    >
      {/* Floating Header (Draggable Handle) */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`theme-modal-header px-3 py-2 border-b flex items-center justify-between cursor-move select-none ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800/90 border-slate-700/80'
        }`}
      >
        <div className="flex items-center gap-2">
          <Move className={`w-3.5 h-3.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
          <span className={`font-bold text-xs font-mono ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{chartConfig.symbol}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            {chartConfig.timeframe}
          </span>
          {price !== undefined && price > 0 && (
            <span className={`text-[11px] font-mono ${isLight ? 'text-slate-900 font-bold' : 'text-slate-200'}`}>${price.toFixed(2)}</span>
          )}
        </div>

        <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
          {onAddLineAtCurrentPrice && (
            <button
              type="button"
              onClick={onAddLineAtCurrentPrice}
              className={`p-1 rounded transition-colors ${
                isLight ? 'text-slate-600 hover:text-emerald-700 hover:bg-slate-200' : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-700'
              }`}
              title="إضافة خط أفقي"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded transition-colors text-xs flex items-center gap-1 ${
              isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700'
            }`}
            title="إعادة الشارت إلى مكانه الطبيعي (Dock)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-[10px]">إرجاع</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded transition-colors ${
              isLight ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-400 hover:text-rose-400 hover:bg-slate-700'
            }`}
            title="إغلاق النافذة العائمة"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Chart Body */}
      <div className={`p-2 flex-1 ${isLight ? 'bg-white' : 'bg-slate-950'}`}>
        <BasicChart
          candles={candles}
          isLoadingOlder={isLoadingOlder}
          onLoadOlderHistory={onLoadOlderHistory}
          onHoverCandle={onHoverCandle}
          height={size.height - 70}
          redrawRateMs={chartConfig.redrawRateMs}
          horizontalLines={chartConfig.horizontalLines}
          onUpdateLine={onUpdateLine}
          onSelectLine={onSelectLine}
        />
      </div>
    </div>
  );
}
