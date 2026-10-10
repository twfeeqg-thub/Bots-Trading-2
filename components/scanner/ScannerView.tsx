// Scanner View Component for Project Q
'use client';

import React, { useState } from 'react';
import { useScanner } from '@/hooks/use-scanner';
import { 
  SUPPORTED_PERIODS, 
  TimePeriod 
} from '@/lib/scanner/types';
import { 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Bell, 
  BellRing, 
  Radio, 
  Database,
  ExternalLink,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface ScannerViewProps {
  onSelectAssetForChart?: (symbol: string) => void;
  onSelectAssetForTrade?: (symbol: string, currentPrice?: number) => void;
}

export function ScannerView({ onSelectAssetForChart, onSelectAssetForTrade }: ScannerViewProps) {
  const { state, setPeriod, setAlertThreshold, setSort, setFilter } = useScanner();
  const [selectedAssetModal, setSelectedAssetModal] = useState<string | null>(null);
  const [customThresholdInput, setCustomThresholdInput] = useState<string>(state.alertThreshold.toString());

  const handleThresholdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customThresholdInput);
    if (!isNaN(val) && val > 0) {
      setAlertThreshold(val);
    }
  };

  const formatPrice = (price: number | null): string => {
    if (price === null || isNaN(price)) return '—';
    if (price >= 1000) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (price >= 1) {
      return price.toFixed(4);
    }
    return price.toFixed(6);
  };

  const formatChange = (change: number | null): string => {
    if (change === null || isNaN(change)) return '—';
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  const getSortIcon = (field: 'changePercent' | 'currentPrice' | 'asset') => {
    if (state.sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60" />;
    }
    return state.sortDirection === 'ASC' ? (
      <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
    );
  };

  return (
    <div id="scanner-view-container" className="space-y-4">
      {/* Top Controls Bar */}
      <div id="scanner-controls-panel" className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        {/* Row 1: Connection & Periods */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Indicators */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div 
              id="ws-status-indicator" 
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 font-medium"
            >
              <span className={`w-2 h-2 rounded-full ${
                state.connectionStatus === 'CONNECTED' 
                  ? 'bg-emerald-400 animate-pulse' 
                  : state.connectionStatus === 'RECONNECTING' || state.connectionStatus === 'CONNECTING'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-400'
              }`} />
              <span className="text-slate-300">
                {state.connectionStatus === 'CONNECTED' && 'بث السوق الحي (WebSocket مركزي)'}
                {state.connectionStatus === 'RECONNECTING' && 'جاري إعادة الاتصال التلقائي...'}
                {state.connectionStatus === 'CONNECTING' && 'جاري الاتصال بالسوق...'}
                {state.connectionStatus === 'DISCONNECTED' && 'غير متصل بالسوق'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">!miniTicker@arr</span>
            </div>

            {state.activeAlertCount > 0 && (
              <div 
                id="active-alerts-indicator" 
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium"
              >
                <BellRing className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                <span>{state.activeAlertCount} أصول متجاوزة للنسبة</span>
              </div>
            )}
          </div>

          {/* Periods Selector (9 Closed Periods as per Spec Section 16) */}
          <div id="period-selector" className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-slate-400 font-medium ml-1 hidden sm:inline">الفترة:</span>
            {SUPPORTED_PERIODS.map((p) => {
              const isSelected = state.selectedPeriod === p;
              return (
                <button
                  key={p}
                  id={`period-btn-${p}`}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20 font-bold'
                      : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Threshold & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          {/* Alert Threshold Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <Bell className="w-3.5 h-3.5 text-slate-400" />
              نسبة التنبيه (Threshold):
            </span>

            {/* Quick Presets */}
            {[0.5, 1.0, 2.0, 3.0].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setAlertThreshold(val);
                  setCustomThresholdInput(val.toString());
                }}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  state.alertThreshold === val
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-semibold'
                    : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                +{val}%
              </button>
            ))}

            {/* Custom Input */}
            <form onSubmit={handleThresholdSubmit} className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="50"
                value={customThresholdInput}
                onChange={(e) => setCustomThresholdInput(e.target.value)}
                className="w-16 px-2 py-0.5 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200 text-center focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-2 py-0.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
              >
                تطبيق
              </button>
            </form>
          </div>

          {/* Search Filter */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="بحث في الأصول (مثال: BTC, SOL)..."
              value={state.filterQuery}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pr-9 pl-3 py-1.5 text-xs rounded-lg bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Main Scanner Table (Spec Sections 29, 30, 31) */}
      <div id="scanner-table-wrapper" className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400">
                <th className="py-3 px-3 sm:px-4 font-semibold w-12 text-center">#</th>
                
                <th className="py-3 px-3 sm:px-4 font-semibold">
                  <button 
                    type="button" 
                    onClick={() => setSort('asset')}
                    className="flex items-center gap-1.5 hover:text-slate-200"
                  >
                    <span>الأصل (Asset)</span>
                    {getSortIcon('asset')}
                  </button>
                </th>

                <th className="py-3 px-3 sm:px-4 font-semibold text-left">
                  <button 
                    type="button" 
                    onClick={() => setSort('currentPrice')}
                    className="flex items-center gap-1.5 ml-auto hover:text-slate-200"
                  >
                    <span>السعر الحالي (USDT)</span>
                    {getSortIcon('currentPrice')}
                  </button>
                </th>

                <th className="py-3 px-3 sm:px-4 font-semibold text-left">
                  <div className="flex items-center gap-1 justify-end">
                    <span>السعر المرجعي ({state.selectedPeriod})</span>
                    <Clock className="w-3 h-3 text-slate-500" />
                  </div>
                </th>

                <th className="py-3 px-3 sm:px-4 font-semibold text-left">
                  <button 
                    type="button" 
                    onClick={() => setSort('changePercent')}
                    className="flex items-center gap-1.5 ml-auto hover:text-slate-200"
                  >
                    <span>التغير % (Change)</span>
                    {getSortIcon('changePercent')}
                  </button>
                </th>

                <th className="py-3 px-3 sm:px-4 font-semibold text-center">
                  <span>حالة التنبيه (Alert)</span>
                </th>

                <th className="py-3 px-3 sm:px-4 font-semibold text-center">
                  <span>حالة البيانات</span>
                </th>

                <th className="py-3 px-3 sm:px-4 font-semibold text-center">
                  <span>إجراء</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60">
              {state.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Radio className="w-6 h-6 text-slate-500 animate-pulse" />
                      <p>جاري استقبال بيانات السوق أو لا توجد نتائج مطابقة للبحث...</p>
                    </div>
                  </td>
                </tr>
              ) : (
                state.rows.map((row) => {
                  const isPositive = row.changePercent !== null && row.changePercent > 0;
                  const isNegative = row.changePercent !== null && row.changePercent < 0;
                  const isAlerted = row.alertState === 'ALERTED';

                  return (
                    <tr 
                      key={row.symbol} 
                      className={`transition-colors hover:bg-slate-800/40 ${
                        row.hasRecentAlert 
                          ? 'bg-emerald-500/10 animate-pulse' 
                          : isAlerted 
                          ? 'bg-emerald-950/20' 
                          : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-3 px-3 sm:px-4 text-center font-mono font-medium text-slate-400">
                        {row.rank}
                      </td>

                      {/* Asset */}
                      <td className="py-3 px-3 sm:px-4 font-semibold text-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100">{row.asset}</span>
                          <span className="text-[10px] text-slate-500 font-mono">/USDT</span>
                        </div>
                      </td>

                      {/* Current Price */}
                      <td className="py-3 px-3 sm:px-4 text-left font-mono font-medium text-slate-200">
                        {formatPrice(row.currentPrice)}
                      </td>

                      {/* Reference Price */}
                      <td className="py-3 px-3 sm:px-4 text-left font-mono text-slate-400">
                        {row.referencePrice !== null ? (
                          formatPrice(row.referencePrice)
                        ) : (
                          <span className="text-slate-500 text-[11px]" title="لا يوجد تاريخ كافٍ لحساب المرجع بدقة">
                            — (قيد البناء)
                          </span>
                        )}
                      </td>

                      {/* Change % */}
                      <td className="py-3 px-3 sm:px-4 text-left font-mono font-bold">
                        {row.changePercent !== null ? (
                          <span className={`px-2 py-0.5 rounded ${
                            isPositive 
                              ? 'text-emerald-400 bg-emerald-500/10' 
                              : isNegative 
                              ? 'text-rose-400 bg-rose-500/10' 
                              : 'text-slate-300'
                          }`}>
                            {formatChange(row.changePercent)}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Alert State */}
                      <td className="py-3 px-3 sm:px-4 text-center">
                        {isAlerted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <BellRing className="w-3 h-3 text-emerald-400" />
                            تنبيه نشط ({formatChange(row.changePercent)})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-slate-500 bg-slate-800/40">
                            عادي
                          </span>
                        )}
                      </td>

                      {/* Data Freshness */}
                      <td className="py-3 px-3 sm:px-4 text-center">
                        {row.dataStatus === 'FRESH' && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            حي (FRESH)
                          </span>
                        )}
                        {row.dataStatus === 'STALE' && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400" title="تجاوز 30 ثانية دون تحديث">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            متأخر (STALE)
                          </span>
                        )}
                        {row.dataStatus === 'NO_DATA' && (
                          <span className="inline-flex items-center text-[10px] text-slate-500">
                            لا بيانات
                          </span>
                        )}
                      </td>

                      {/* Integration Action */}
                      <td className="py-3 px-3 sm:px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedAssetModal(row.symbol)}
                          className="px-2 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 inline-flex items-center gap-1"
                          title="عرض تفاصيل الأصل وسياق الربط"
                        >
                          <span>تفاصيل</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Integration Context Modal (Spec Sections 36, 37: Preserving Future integration contracts) */}
      {selectedAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-base">
                سياق الأصل: {selectedAssetModal}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedAssetModal(null)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 bg-slate-800 rounded"
              >
                إغلاق
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">الفترة الحالية:</span>
                  <span className="font-mono text-emerald-400">{state.selectedPeriod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">حد التنبيه (Threshold):</span>
                  <span className="font-mono text-slate-200">+{state.alertThreshold}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">حالة الربط المعماري:</span>
                  <span className="text-emerald-400">Scanner Ready (Phase 1)</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 space-y-2">
                <span className="font-semibold text-slate-200 block">نقاط التكامل المستقبلية (قواعد Q المغلقة):</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  • <strong>Charts:</strong> تمرير سياق الرمز إلى الشارت عند بدء مرحلة Charts دون تكرار الاتصال.
                  <br />
                  • <strong>Execution (Spot/Convert):</strong> التنبيه هو إشارة فقط، والقرار النهائي بيد المستخدم دون شراء تلقائي.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  if (onSelectAssetForTrade && selectedAssetModal) {
                    const row = state.rows.find((r) => r.symbol === selectedAssetModal);
                    onSelectAssetForTrade(selectedAssetModal, row?.currentPrice || undefined);
                  }
                  setSelectedAssetModal(null);
                }}
                className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span>إنشاء صفقة في Trade Manager</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onSelectAssetForChart && selectedAssetModal) {
                    onSelectAssetForChart(selectedAssetModal);
                  }
                  setSelectedAssetModal(null);
                }}
                className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold rounded-lg"
              >
                عرض الشارت
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
