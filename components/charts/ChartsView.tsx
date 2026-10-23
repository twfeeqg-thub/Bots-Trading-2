// Project Q — Phase 4: Multiple Charts Main View + Persistence
// Closed Specification: Multiple Charts, Add Chart, Duplicate Chart, Drag & Drop Reordering,
// Fullscreen (with Portrait/Landscape), Floating, Minimize (persistent), Close / Closed Charts,
// Restore, Delete Permanently, Horizontal Lines, and Auto-Save Persistence.
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Plus, 
  Archive, 
  ArrowLeft, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle,
  LayoutGrid
} from 'lucide-react';
import { 
  ChartItemConfig, 
  HorizontalLineConfig, 
  loadPersistedCharts, 
  savePersistedCharts, 
  DEFAULT_INITIAL_CHARTS,
  MAX_ACTIVE_CHARTS 
} from '@/lib/charts/chart-persistence';
import { ChartCard } from './ChartCard';
import { AddChartModal } from './AddChartModal';
import { ClosedChartsModal } from './ClosedChartsModal';
import { FullscreenChartModal } from './FullscreenChartModal';
import { FloatingChartWindow } from './FloatingChartWindow';
import { Candle, NativeTimeframe } from '@/lib/charts/types';
import { useTheme } from '@/components/theme/ThemeContext';

interface ChartsViewProps {
  initialSymbol?: string | null;
  onBackToScanner?: () => void;
}

export function ChartsView({ initialSymbol, onBackToScanner }: ChartsViewProps) {
  const { isLight } = useTheme();
  // Master charts state loaded from persistence (client-side only component via ssr: false)
  const [charts, setCharts] = useState<ChartItemConfig[]>(() => loadPersistedCharts());

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isClosedModalOpen, setIsClosedModalOpen] = useState<boolean>(false);

  // Transient views (Never persisted across sessions)
  const [fullscreenData, setFullscreenData] = useState<{
    chartConfig: ChartItemConfig;
    candles: Candle[];
    price?: number;
    changePct?: number;
  } | null>(null);

  const [floatingData, setFloatingData] = useState<{
    chartConfig: ChartItemConfig;
    candles: Candle[];
    price?: number;
    changePct?: number;
  } | null>(null);

  // Duplicate prompt dialog for the "Duplicate" action
  const [duplicatePromptTarget, setDuplicatePromptTarget] = useState<ChartItemConfig | null>(null);

  // Drag & drop state for reordering
  const draggedItemIndexRef = useRef<number | null>(null);

  // Handle incoming initialSymbol from Scanner if provided
  useEffect(() => {
    if (!initialSymbol) return;
    const cleanSym = initialSymbol.trim().toUpperCase();

    const timer = setTimeout(() => {
      setCharts((prev) => {
        // Check if already active
        const existsActive = prev.some((c) => !c.isClosed && c.symbol === cleanSym);
        if (existsActive) return prev;

        // If active charts < 10, add it automatically
        const activeCount = prev.filter((c) => !c.isClosed).length;
        if (activeCount < MAX_ACTIVE_CHARTS) {
          const newChart: ChartItemConfig = {
            id: `chart_${Date.now()}_${cleanSym.toLowerCase()}`,
            symbol: cleanSym,
            timeframe: '5m',
            order: prev.length,
            isMinimized: false,
            isClosed: false,
            horizontalLines: [],
            redrawRateMs: 0,
          };
          const updated = [newChart, ...prev];
          savePersistedCharts(updated);
          return updated;
        }
        return prev;
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [initialSymbol]);

  // Active (non-closed) charts sorted by order
  const activeCharts = useMemo(() => {
    return charts
      .filter((c) => !c.isClosed)
      .sort((a, b) => a.order - b.order);
  }, [charts]);

  // Closed charts
  const closedCharts = useMemo(() => {
    return charts
      .filter((c) => c.isClosed)
      .sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));
  }, [charts]);

  // Currently active symbols (for duplicate detection in Add Modal)
  const activeSymbols = useMemo(() => {
    return activeCharts.map((c) => c.symbol);
  }, [activeCharts]);

  // Auto-save wrapper helper: updates state & persists immediately
  const updateChartsAndSave = useCallback((updater: (prev: ChartItemConfig[]) => ChartItemConfig[]) => {
    setCharts((prev) => {
      const next = updater(prev);
      savePersistedCharts(next);
      return next;
    });
  }, []);

  // Update specific chart config
  const handleUpdateConfig = useCallback((id: string, updates: Partial<ChartItemConfig>) => {
    updateChartsAndSave((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }, [updateChartsAndSave]);

  // Add new chart
  const handleAddChart = useCallback((symbol: string, timeframe: NativeTimeframe) => {
    updateChartsAndSave((prev) => {
      const newChart: ChartItemConfig = {
        id: `chart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        symbol: symbol.toUpperCase(),
        timeframe,
        order: prev.length,
        isMinimized: false,
        isClosed: false,
        horizontalLines: [],
        redrawRateMs: 0,
      };
      return [...prev, newChart];
    });
  }, [updateChartsAndSave]);

  // Duplicate chart
  const handleDuplicateChartClick = (chart: ChartItemConfig) => {
    setDuplicatePromptTarget(chart);
  };

  const handleConfirmDuplicate = () => {
    if (!duplicatePromptTarget) return;
    const source = duplicatePromptTarget;
    setDuplicatePromptTarget(null);

    updateChartsAndSave((prev) => {
      const activeCount = prev.filter((c) => !c.isClosed).length;
      if (activeCount >= MAX_ACTIVE_CHARTS) return prev;

      const duplicatedChart: ChartItemConfig = {
        id: `chart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        symbol: source.symbol,
        timeframe: source.timeframe,
        order: prev.length,
        isMinimized: false,
        isClosed: false,
        // Deep copy horizontal lines with fresh IDs
        horizontalLines: source.horizontalLines.map((hl, idx) => ({
          ...hl,
          id: `hl_dup_${Date.now()}_${idx}`,
        })),
        redrawRateMs: source.redrawRateMs,
      };
      return [...prev, duplicatedChart];
    });
  };

  // Close chart (moves to Closed Charts)
  const handleCloseChart = useCallback((id: string) => {
    updateChartsAndSave((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, isClosed: true, closedAt: Date.now() }
          : c
      )
    );
  }, [updateChartsAndSave]);

  // Restore chart from closed charts (Not subject to 10-limit as specified)
  const handleRestoreChart = useCallback((chartId: string) => {
    updateChartsAndSave((prev) => {
      return prev.map((c) =>
        c.id === chartId
          ? { ...c, isClosed: false, closedAt: undefined }
          : c
      );
    });
  }, [updateChartsAndSave]);

  // Permanently delete chart
  const handlePermanentDeleteChart = useCallback((chartId: string) => {
    updateChartsAndSave((prev) => prev.filter((c) => c.id !== chartId));
  }, [updateChartsAndSave]);

  // Move up
  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    updateChartsAndSave((prev) => {
      const active = prev.filter((c) => !c.isClosed).sort((a, b) => a.order - b.order);
      const closed = prev.filter((c) => c.isClosed);

      const item = active[index];
      const prevItem = active[index - 1];
      active[index] = prevItem;
      active[index - 1] = item;

      // Re-index orders
      active.forEach((c, idx) => {
        c.order = idx;
      });

      return [...active, ...closed];
    });
  }, [updateChartsAndSave]);

  // Move down
  const handleMoveDown = useCallback((index: number) => {
    updateChartsAndSave((prev) => {
      const active = prev.filter((c) => !c.isClosed).sort((a, b) => a.order - b.order);
      const closed = prev.filter((c) => c.isClosed);

      if (index >= active.length - 1) return prev;

      const item = active[index];
      const nextItem = active[index + 1];
      active[index] = nextItem;
      active[index + 1] = item;

      // Re-index orders
      active.forEach((c, idx) => {
        c.order = idx;
      });

      return [...active, ...closed];
    });
  }, [updateChartsAndSave]);

  // Drag and Drop handlers
  const handleDragStartItem = (e: React.DragEvent, index: number) => {
    draggedItemIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverItem = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropItem = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = draggedItemIndexRef.current;
    draggedItemIndexRef.current = null;
    if (sourceIndex === null || sourceIndex === targetIndex) return;

    updateChartsAndSave((prev) => {
      const active = prev.filter((c) => !c.isClosed).sort((a, b) => a.order - b.order);
      const closed = prev.filter((c) => c.isClosed);

      const [removed] = active.splice(sourceIndex, 1);
      active.splice(targetIndex, 0, removed);

      // Reassign sequential order numbers
      active.forEach((c, idx) => {
        c.order = idx;
      });

      return [...active, ...closed];
    });
  };

  // Fullscreen open
  const handleOpenFullscreen = (
    chart: ChartItemConfig,
    candles: Candle[],
    price: number | null,
    changePct: number
  ) => {
    setFullscreenData({
      chartConfig: chart,
      candles,
      price: price ?? undefined,
      changePct,
    });
  };

  // Floating open
  const handleOpenFloating = (
    chart: ChartItemConfig,
    candles: Candle[],
    price: number | null,
    changePct: number
  ) => {
    setFloatingData({
      chartConfig: chart,
      candles,
      price: price ?? undefined,
      changePct,
    });
  };

  return (
    <div id="charts-view-container" className="space-y-4 pb-12 max-w-full overflow-hidden">
      {/* Top Header Controls Bar */}
      <div
        className={`rounded-2xl p-3 sm:p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 theme-section ${
          isLight
            ? 'border border-slate-200 bg-white text-slate-800 shadow-sm'
            : 'border border-slate-800 bg-slate-900/80 backdrop-blur-sm text-slate-100'
        }`}
      >
        {/* Left: Title & Back Button */}
        <div className="flex items-center gap-2.5">
          {onBackToScanner && (
            <button
              type="button"
              onClick={onBackToScanner}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title="العودة إلى الرادار"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>الرادار</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-emerald-500" />
            <div>
              <h2 className={`theme-heading text-sm font-bold flex items-center gap-2 ${
                isLight ? 'text-slate-900' : 'text-slate-100'
              }`}>
                <span>الشارتات التفاعلية (Multiple Charts)</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  isLight
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}>
                  {activeCharts.length} / {MAX_ACTIVE_CHARTS} نشط
                </span>
              </h2>
            </div>
          </div>
        </div>

        {/* Right: Actions (Add Chart, Closed Charts, Auto-Save Status) */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Auto-save status pill */}
          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] ${
            isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>الحفظ التلقائي مفعّل</span>
          </div>

          {/* Closed Charts Button */}
          <button
            type="button"
            onClick={() => setIsClosedModalOpen(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors relative ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="عرض الشارتات المغلقة"
          >
            <Archive className="w-3.5 h-3.5 text-amber-500" />
            <span>الشارتات المغلقة</span>
            {closedCharts.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold border ${
                isLight
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                {closedCharts.length}
              </span>
            )}
          </button>

          {/* Add Chart Button */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            disabled={activeCharts.length >= MAX_ACTIVE_CHARTS}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm ${
              activeCharts.length >= MAX_ACTIVE_CHARTS
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950'
            }`}
            title={
              activeCharts.length >= MAX_ACTIVE_CHARTS
                ? `تم الوصول للحد الأقصى (${MAX_ACTIVE_CHARTS} شارتات نشطة)`
                : 'إضافة شارت جديد'
            }
          >
            <Plus className="w-4 h-4" />
            <span>+ إضافة شارت</span>
          </button>
        </div>
      </div>

      {/* 10-Chart Limit Notice when max reached */}
      {activeCharts.length >= MAX_ACTIVE_CHARTS && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              الحد الأقصى للشارتات النشطة هو <strong>10 شارتات</strong>. لإضافة شارت جديد، يرجى إغلاق أحد الشارتات النشطة أولاً.
            </span>
          </div>
          <span className="text-[11px] text-amber-400/80 hidden md:inline">
            (استعادة شارت مغلق مسموحة دائماً)
          </span>
        </div>
      )}

      {/* Duplicate Coin Confirmation Dialog (Triggered from ChartCard Duplicate button) */}
      {duplicatePromptTarget && (
        <div className="p-4 rounded-xl bg-blue-950/50 border border-blue-500/40 text-blue-200 text-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <span className="font-semibold block">
                العملة {duplicatePromptTarget.symbol} موجودة، فهل تريد إضافتها مرة أخرى؟
              </span>
              <span className="text-[11px] text-blue-300/80">
                سيتم إنشاء شارت مستقل جديد للعملة، بإعدادات وخطوط منفصلة لا تؤثر على الشارت الأصلي.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDuplicatePromptTarget(null)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
            >
              لا، إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirmDuplicate}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition-colors"
            >
              نعم، تكرار الشارت
            </button>
          </div>
        </div>
      )}

      {/* Zero Active Charts Empty State */}
      {activeCharts.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-200">لا توجد شارتات مضافة</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              يمكنك إضافة حتى 10 شارتات نشطة لمتابعة حركة العملات المختلفة بشكل عمودي متزامن.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs inline-flex items-center gap-2 transition-colors shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>+ إضافة شارت</span>
          </button>
        </div>
      ) : (
        /* Vertical List of Multiple Charts */
        <div className="space-y-4">
          {activeCharts.map((chart, index) => (
            <ChartCard
              key={chart.id}
              chartConfig={chart}
              index={index}
              totalCount={activeCharts.length}
              onUpdateConfig={handleUpdateConfig}
              onCloseChart={handleCloseChart}
              onDuplicateChart={handleDuplicateChartClick}
              onFullscreenChart={handleOpenFullscreen}
              onFloatingChart={handleOpenFloating}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onDragStartItem={handleDragStartItem}
              onDragOverItem={handleDragOverItem}
              onDropItem={handleDropItem}
            />
          ))}
        </div>
      )}

      {/* Add Chart Modal */}
      <AddChartModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddChart={handleAddChart}
        activeSymbols={activeSymbols}
        activeChartsCount={activeCharts.length}
      />

      {/* Closed Charts Modal */}
      <ClosedChartsModal
        isOpen={isClosedModalOpen}
        onClose={() => setIsClosedModalOpen(false)}
        closedCharts={closedCharts}
        onRestoreChart={handleRestoreChart}
        onPermanentDeleteChart={handlePermanentDeleteChart}
      />

      {/* Fullscreen Chart Modal */}
      {fullscreenData && (
        <FullscreenChartModal
          isOpen={true}
          onClose={() => setFullscreenData(null)}
          chartConfig={fullscreenData.chartConfig}
          candles={fullscreenData.candles}
          price={fullscreenData.price}
          changePct={fullscreenData.changePct}
          onAddLineAtCurrentPrice={() => {
            const currentPrice = fullscreenData.price || 100;
            const newLine: HorizontalLineConfig = {
              id: `hl_${Date.now()}`,
              price: Number(currentPrice.toFixed(4)),
              label: `مستوى ${fullscreenData.chartConfig.horizontalLines.length + 1}`,
              color: '#10B981',
              textColor: '#FFFFFF',
              textSize: 12,
              lineWidth: 2,
              lineStyle: 'dashed',
            };
            const updated = [...fullscreenData.chartConfig.horizontalLines, newLine];
            handleUpdateConfig(fullscreenData.chartConfig.id, { horizontalLines: updated });
            setFullscreenData({
              ...fullscreenData,
              chartConfig: { ...fullscreenData.chartConfig, horizontalLines: updated },
            });
          }}
          onUpdateLine={(lineId, updates) => {
            const updated = fullscreenData.chartConfig.horizontalLines.map((l) =>
              l.id === lineId ? { ...l, ...updates } : l
            );
            handleUpdateConfig(fullscreenData.chartConfig.id, { horizontalLines: updated });
            setFullscreenData({
              ...fullscreenData,
              chartConfig: { ...fullscreenData.chartConfig, horizontalLines: updated },
            });
          }}
        />
      )}

      {/* Floating Chart Window */}
      {floatingData && (
        <FloatingChartWindow
          isOpen={true}
          onClose={() => setFloatingData(null)}
          chartConfig={floatingData.chartConfig}
          candles={floatingData.candles}
          price={floatingData.price}
          changePct={floatingData.changePct}
          onAddLineAtCurrentPrice={() => {
            const currentPrice = floatingData.price || 100;
            const newLine: HorizontalLineConfig = {
              id: `hl_${Date.now()}`,
              price: Number(currentPrice.toFixed(4)),
              label: `مستوى ${floatingData.chartConfig.horizontalLines.length + 1}`,
              color: '#10B981',
              textColor: '#FFFFFF',
              textSize: 12,
              lineWidth: 2,
              lineStyle: 'dashed',
            };
            const updated = [...floatingData.chartConfig.horizontalLines, newLine];
            handleUpdateConfig(floatingData.chartConfig.id, { horizontalLines: updated });
            setFloatingData({
              ...floatingData,
              chartConfig: { ...floatingData.chartConfig, horizontalLines: updated },
            });
          }}
          onUpdateLine={(lineId, updates) => {
            const updated = floatingData.chartConfig.horizontalLines.map((l) =>
              l.id === lineId ? { ...l, ...updates } : l
            );
            handleUpdateConfig(floatingData.chartConfig.id, { horizontalLines: updated });
            setFloatingData({
              ...floatingData,
              chartConfig: { ...floatingData.chartConfig, horizontalLines: updated },
            });
          }}
        />
      )}
    </div>
  );
}
