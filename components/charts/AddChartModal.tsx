// Project Q — Phase 4: Add Chart Modal
// Closed Specification: Coin selector with search, Binance Spot/Convert executable assets,
// Timeframe selector (1m, 3m, 5m, 15m, 30m, 1h), 10-active-charts limit, duplicate coin prompt.
'use client';

import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Plus, 
  AlertCircle, 
  Check, 
  Coins, 
  Clock, 
  HelpCircle 
} from 'lucide-react';
import { DEFAULT_EXECUTABLE_UNIVERSE } from '@/lib/scanner/universe';
import { NativeTimeframe, VALID_TIMEFRAMES } from '@/lib/charts/types';
import { MAX_ACTIVE_CHARTS } from '@/lib/charts/chart-persistence';

interface AddChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddChart: (symbol: string, timeframe: NativeTimeframe) => void;
  activeSymbols: string[];
  activeChartsCount: number;
}

export function AddChartModal({
  isOpen,
  onClose,
  onAddChart,
  activeSymbols,
  activeChartsCount,
}: AddChartModalProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<NativeTimeframe>('5m');
  const [showDuplicatePrompt, setShowDuplicatePrompt] = useState<boolean>(false);

  // Available traded assets from Binance Spot / Convert universe
  const availableAssets = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return DEFAULT_EXECUTABLE_UNIVERSE;
    return DEFAULT_EXECUTABLE_UNIVERSE.filter(
      (a) => a.symbol.includes(q) || a.baseAsset.includes(q)
    );
  }, [searchQuery]);

  const isLimitReached = activeChartsCount >= MAX_ACTIVE_CHARTS;

  if (!isOpen) return null;

  const handleSelectCoin = (symbol: string) => {
    setSelectedSymbol(symbol);
    // Check if coin already exists among active charts
    if (activeSymbols.includes(symbol)) {
      setShowDuplicatePrompt(true);
    } else {
      setShowDuplicatePrompt(false);
    }
  };

  const handleConfirmAdd = () => {
    if (!selectedSymbol || isLimitReached) return;
    onAddChart(selectedSymbol, selectedTimeframe);
    handleResetAndClose();
  };

  const handleDuplicateConfirm = () => {
    if (!selectedSymbol || isLimitReached) return;
    onAddChart(selectedSymbol, selectedTimeframe);
    handleResetAndClose();
  };

  const handleDuplicateCancel = () => {
    setShowDuplicatePrompt(false);
    setSelectedSymbol(null);
  };

  const handleResetAndClose = () => {
    setSearchQuery('');
    setSelectedSymbol(null);
    setSelectedTimeframe('5m');
    setShowDuplicatePrompt(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150 overflow-hidden">
      <div className="theme-modal-dialog w-full max-w-lg rounded-2xl border shadow-2xl p-4 sm:p-5 text-slate-100 space-y-3.5 max-h-[90dvh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="theme-modal-header shrink-0 flex items-center justify-between border-b pb-3 -mx-4 -mt-4 px-4 pt-4 sm:-mx-5 sm:-mt-5 sm:px-5 sm:pt-5 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="theme-heading text-sm font-semibold">إضافة شارت جديد</h3>
              <p className="text-[11px] opacity-75">
                اختر العملة والفريم الزمني لإضافة شارت نشط (الحد الأقصى {MAX_ACTIVE_CHARTS} شارتات نشطة)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 10-Chart Limit Alert */}
        {isLimitReached && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span className="font-semibold block">تم الوصول إلى الحد الأقصى ({MAX_ACTIVE_CHARTS} شارتات نشطة).</span>
              <span className="text-[11px] text-amber-300/80">
                لا يمكن إضافة شارت نشط جديد حالياً. يمكنك إغلاق أو حذف شارت قديم لتوفير مساحة. (ملاحظة: استعادة شارت مغلق مسموحة دائماً).
              </span>
            </div>
          </div>
        )}

        {/* Duplicate Coin Confirmation Dialog */}
        {showDuplicatePrompt && (
          <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-200 text-xs space-y-2.5 animate-in fade-in">
            <div className="flex items-center gap-2 text-blue-300 font-semibold">
              <HelpCircle className="w-4 h-4 text-blue-400" />
              <span>العملة موجودة مسبقاً في قائمة الشارتات النشطة</span>
            </div>
            <p className="text-[11px] text-slate-300">
              العملة <strong className="text-emerald-400 font-mono">{selectedSymbol}</strong> موجودة بالفعل، فهل تريد إضافتها مرة أخرى كشارت مستقل وبإعدادات مستقلة؟
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleDuplicateCancel}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                لا، إلغاء
              </button>
              <button
                type="button"
                onClick={handleDuplicateConfirm}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition-colors"
              >
                نعم، إضافة شارت مستقل
              </button>
            </div>
          </div>
        )}

        {/* Coin Selection and Timeframe */}
        {!isLimitReached && !showDuplicatePrompt && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Step 1: Search Coins */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span>ابحث عن العملة (Binance Spot / Convert):</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="مثال: BTC, SOL, ETH, SUI..."
                  className="w-full pr-3 pl-9 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Step 2: Timeframe Selection */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>الفريم الزمني (Timeframe):</span>
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {VALID_TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setSelectedTimeframe(tf)}
                    className={`py-1.5 rounded-lg text-xs font-semibold text-center transition-all ${
                      selectedTimeframe === tf
                        ? 'bg-emerald-600 text-slate-950 font-bold shadow-sm'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Coin List */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-[120px] sm:min-h-[180px]">
              <label className="block text-[11px] font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-slate-400" />
                <span>قائمة العملات المتاحة ({availableAssets.length}):</span>
              </label>
              <div className="flex-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/60">
                {availableAssets.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    لا توجد عملة مطابقة لبحثك
                  </div>
                ) : (
                  availableAssets.map((asset) => {
                    const isAlreadyActive = activeSymbols.includes(asset.symbol);
                    const isSelected = selectedSymbol === asset.symbol;

                    return (
                      <button
                        key={asset.symbol}
                        type="button"
                        onClick={() => handleSelectCoin(asset.symbol)}
                        className={`w-full px-3 py-2 text-right text-xs flex items-center justify-between hover:bg-slate-800/60 transition-colors ${
                          isSelected ? 'bg-emerald-500/10 border-l-2 border-emerald-500' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200 font-mono">{asset.symbol}</span>
                          <span className="text-[10px] text-slate-400">({asset.baseAsset})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAlreadyActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              مضاف مسبقاً
                            </span>
                          )}
                          <span className="text-emerald-400 font-medium text-[11px] flex items-center gap-1">
                            <span>اختيار وإضافة</span>
                            <Plus className="w-3 h-3" />
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer info & manual direct add */}
        {selectedSymbol && !showDuplicatePrompt && !isLimitReached && (
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-400">
              المحدد: <strong className="text-emerald-400 font-mono">{selectedSymbol}</strong> بفريم <strong className="text-emerald-400">{selectedTimeframe}</strong>
            </div>
            <button
              type="button"
              onClick={handleConfirmAdd}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>إظهار الشارت مباشرة</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
