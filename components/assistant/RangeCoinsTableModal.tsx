'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Sparkles,
  ChevronDown,
  Loader2,
  ArrowRight,
  Maximize2,
  Minimize2,
  Minus
} from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeContext';
import { RangeCoinScanItem } from '@/app/api/assistant/range-analysis/route';
import { UNIFIED_ASSISTANT_TIMEFRAMES } from './AssistantTypes';

interface RangeCoinsTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCoinForChat?: (symbol: string, item: RangeCoinScanItem) => void;
}

export function RangeCoinsTableModal({
  isOpen,
  onClose,
  onSelectCoinForChat,
}: RangeCoinsTableModalProps) {
  const { isLight } = useTheme();

  const [interval, setInterval] = useState<string>('1h');
  const [items, setItems] = useState<RangeCoinScanItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'viable_only' | 'unviable'>('all');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isCached, setIsCached] = useState<boolean>(false);

  // Window Management States
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = React.useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });

  // Handle Dragging
  const handleStartDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a, textarea')) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - dragStartRef.current.startX;
      const deltaY = clientY - dragStartRef.current.startY;
      setPosition({
        x: dragStartRef.current.posX + deltaX,
        y: dragStartRef.current.posY + deltaY,
      });
    };
    const handleEnd = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  const fetchRangeData = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/assistant/range-analysis?interval=${interval}${forceRefresh ? '&refresh=true' : ''}`
      );
      if (!res.ok) {
        throw new Error('فشل جلب نتائج فحص العملات العرضية');
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'خطأ غير معروف في خادم التحليل');
      }
      setItems(data.results || []);
      setLastUpdated(Date.now());
      setIsCached(!!data.cached);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الاتصال بخدمة التحليل العرضي');
    } finally {
      setIsLoading(false);
    }
  }, [interval]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        void fetchRangeData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, fetchRangeData]);

  // Filtered & sorted items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      result = result.filter((i) => i.symbol.includes(q));
    }

    // Classification filter
    if (filterMode === 'viable_only') {
      result = result.filter(
        (i) => i.classification === 'VIABLE_HIGH' || i.classification === 'VIABLE_MODERATE'
      );
    } else if (filterMode === 'unviable') {
      result = result.filter(
        (i) => i.classification === 'UNVIABLE_LOW_MARGIN' || i.classification === 'NOT_IN_RANGE'
      );
    }

    // Primary sort is always by net realizable margin descending
    return result.sort((a, b) => b.netRealizableMarginPercent - a.netRealizableMarginPercent);
  }, [items, searchQuery, filterMode]);

  if (!isOpen) return null;

  // Minimized Floating Bar
  if (isMinimized) {
    return (
      <div
        className={`fixed bottom-4 left-4 z-60 p-2.5 rounded-xl border shadow-2xl flex items-center gap-3 transition-all ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsMinimized(false)}>
          <Layers className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold">مهارة العملات العرضية ({interval})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            title="استعادة النافذة"
            className="p-1 rounded-lg hover:bg-slate-700/30 text-emerald-400"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="إغلاق والعودة"
            className="p-1 rounded-lg hover:bg-slate-700/30 text-slate-400 hover:text-rose-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md overflow-hidden">
      <div
        style={{
          transform: isMaximized ? 'none' : `translate(${position.x}px, ${position.y}px)`,
        }}
        className={`theme-modal-dialog flex flex-col shadow-2xl border transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-slate-900 border-slate-800 text-slate-100'
        } ${
          isMaximized
            ? 'fixed inset-0 w-full h-full max-w-none max-h-none rounded-none'
            : 'w-full max-w-5xl max-h-[90dvh] rounded-2xl overflow-hidden'
        }`}
      >
        {/* Header Bar with Drag & Window Controls */}
        <div
          onMouseDown={handleStartDrag}
          onTouchStart={handleStartDrag}
          className={`theme-modal-header p-3 sm:p-4 border-b flex items-center justify-between shrink-0 select-none cursor-move ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {/* Back Button (العودة إلى المساعد) */}
            <button
              type="button"
              onClick={onClose}
              title="العودة إلى المساعد"
              className={`p-2 rounded-xl border transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer ${
                isLight
                  ? 'bg-white border-slate-300 hover:bg-slate-100 text-slate-700'
                  : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <ArrowRight className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">العودة للمساعد</span>
            </button>

            <div
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border ${
                isLight
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}
            >
              <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="theme-heading text-sm sm:text-base font-bold">مهارة العملات العرضية وتقييم الجدوى</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  فحص حي
                </span>
              </div>
              <p className={`text-[11px] hidden sm:block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                فرز ومقارنة العملات المتذبذبة في مسار أفقي مع خصم الرسوم والانزلاق السعري
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Refresh */}
            <button
              type="button"
              onClick={() => fetchRangeData(true)}
              disabled={isLoading}
              title="تحديث البيانات"
              className={`p-1.5 sm:p-2 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer ${
                isLight
                  ? 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                  : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
              } disabled:opacity-50`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">تحديث</span>
            </button>

            {/* Minimize */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              title="تصغير النافذة"
              className={`p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <Minus className="w-4 h-4" />
            </button>

            {/* Maximize / Restore */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'استعادة الحجم الأصلي' : 'تكبير النافذة'}
              className={`p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              title="إغلاق والعودة"
              className={`p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Filter and Control Bar */}
        <div
          className={`p-3 border-b flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0 ${
            isLight ? 'bg-slate-100/60 border-slate-200' : 'bg-slate-950/40 border-slate-800'
          }`}
        >
          {/* Timeframe selector (Unified List) */}
          <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl overflow-x-auto max-w-full">
            {UNIFIED_ASSISTANT_TIMEFRAMES.map((int) => (
              <button
                key={int.id}
                type="button"
                onClick={() => setInterval(int.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  interval === int.id
                    ? isLight
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-500 text-slate-950 shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {int.label}
              </button>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterMode === 'all'
                  ? isLight
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-slate-800 text-white shadow-xs'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              الكل ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('viable_only')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterMode === 'viable_only'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              المجدية فقط ⭐
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unviable')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterMode === 'unviable'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              الضيقة والمستبعدة
            </button>
          </div>

          {/* Search box */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالرمز (مثلا BTC)..."
              className={`w-full pr-8 pl-3 py-1.5 rounded-xl border text-xs focus:outline-hidden ${
                isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
              }`}
            />
          </div>
        </div>

        {/* Content Area: Table / Loading / Error */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-4">
          {isLoading && items.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-sm font-medium">جاري فحص الشموع واكتشاف العملات العرضية...</p>
              <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                يتم تطبيق خوارزمية التجمع السعري وحساب هوامش الأمان والتكاليف
              </p>
            </div>
          ) : error ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
              <AlertTriangle className="w-10 h-10 text-rose-500" />
              <p className="text-sm font-bold text-rose-400">{error}</p>
              <button
                type="button"
                onClick={() => fetchRangeData(true)}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-center">
              <Info className="w-8 h-8 text-slate-400" />
              <p className="text-sm font-semibold">لا توجد نتائج مطابقة لخيارات الفرز الحالية</p>
              <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                جرب تغيير إطار الوقت أو إلغاء فلتر البحث
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-inherit">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr
                    className={`border-b text-[11px] font-semibold select-none ${
                      isLight ? 'bg-slate-100/80 text-slate-600' : 'bg-slate-950/60 text-slate-400'
                    }`}
                  >
                    <th className="p-3">الرمز</th>
                    <th className="p-3">السعر الحالي</th>
                    <th className="p-3">الدعم / المقاومة</th>
                    <th className="p-3 text-center">النطاق القابل للتحقيق</th>
                    <th className="p-3 text-center">التكاليف المقدرة</th>
                    <th className="p-3 text-center font-bold">صافي الجدوى</th>
                    <th className="p-3 text-center">درجة الجودة</th>
                    <th className="p-3 text-center">التصنيف</th>
                    <th className="p-3 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-inherit">
                  {filteredItems.map((item) => {
                    const isViableHigh = item.classification === 'VIABLE_HIGH';
                    const isViableMod = item.classification === 'VIABLE_MODERATE';
                    const isLowMargin = item.classification === 'UNVIABLE_LOW_MARGIN';
                    const isNotRange = item.classification === 'NOT_IN_RANGE';

                    const netColor =
                      isViableHigh
                        ? 'text-emerald-400 font-bold'
                        : isViableMod
                        ? 'text-teal-400 font-semibold'
                        : isLowMargin
                        ? 'text-amber-400'
                        : 'text-slate-400';

                    return (
                      <tr
                        key={item.symbol}
                        className={`transition-colors ${
                          isLight
                            ? 'hover:bg-slate-50/80'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Symbol */}
                        <td className="p-3 font-mono font-bold">
                          <div className="flex items-center gap-1.5">
                            <span>{item.symbol}</span>
                            {item.hasClusteredBounds && (
                              <span
                                title="تم إثبات مستويات الدعم والمقاومة بتجمعات ارتداد متعددة"
                                className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"
                              />
                            )}
                          </div>
                        </td>

                        {/* Current Price */}
                        <td className="p-3 font-mono">
                          {item.currentPrice < 1
                            ? item.currentPrice.toFixed(4)
                            : item.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Support & Resistance */}
                        <td className="p-3 font-mono text-[11px]">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-emerald-400/90">
                              د: {item.supportPrice < 1 ? item.supportPrice.toFixed(4) : item.supportPrice.toFixed(2)}
                            </span>
                            <span className="text-rose-400/90">
                              م: {item.resistancePrice < 1 ? item.resistancePrice.toFixed(4) : item.resistancePrice.toFixed(2)}
                            </span>
                          </div>
                        </td>

                        {/* Realizable Range % */}
                        <td className="p-3 text-center font-mono font-medium">
                          +{item.realizableRangePercent.toFixed(2)}%
                          <div className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                            إجمالي: {item.grossRangePercent.toFixed(2)}%
                          </div>
                        </td>

                        {/* Estimated Costs */}
                        <td className="p-3 text-center font-mono text-[11px]">
                          <span title={`رسوم تداول: ${item.confirmedFeePercent}% + انزلاق: ${item.assumedSlippagePercent}%`}>
                            {item.totalFrictionPercent.toFixed(2)}%
                          </span>
                        </td>

                        {/* Net Margin % */}
                        <td className={`p-3 text-center font-mono text-sm ${netColor}`}>
                          {item.netRealizableMarginPercent > 0 ? '+' : ''}
                          {item.netRealizableMarginPercent.toFixed(2)}%
                        </td>

                        {/* Quality Score */}
                        <td className="p-3 text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="font-semibold text-[11px]">{item.qualityScore}/100</span>
                            <div className="w-12 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  item.qualityScore >= 60
                                    ? 'bg-emerald-400'
                                    : item.qualityScore >= 40
                                    ? 'bg-teal-400'
                                    : 'bg-amber-400'
                                }`}
                                style={{ width: `${item.qualityScore}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Classification */}
                        <td className="p-3 text-center">
                          {isViableHigh ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                              ⭐ مجدية جداً
                            </span>
                          ) : isViableMod ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 whitespace-nowrap">
                              ✓ مقبولة
                            </span>
                          ) : isLowMargin ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                              ⚠ هامش ضيق
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30 whitespace-nowrap">
                              ✖ خارج النطاق
                            </span>
                          )}
                        </td>

                        {/* Action: Send to chat */}
                        <td className="p-3 text-center">
                          {onSelectCoinForChat && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectCoinForChat(item.symbol, item);
                                onClose();
                              }}
                              title="مناقشة هذه العملة في المحادثة"
                              className={`p-1.5 rounded-lg border transition-colors inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer ${
                                isLight
                                  ? 'bg-white border-slate-300 hover:bg-slate-100 text-slate-700'
                                  : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                              }`}
                            >
                              <MessageSquare className="w-3 h-3 text-emerald-400" />
                              <span className="hidden sm:inline">تحليل</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Bar with Safety Disclaimer */}
        <div
          className={`p-3 border-t text-[11px] flex flex-wrap items-center justify-between gap-2 shrink-0 ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-950/80 border-slate-800 text-slate-400'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>تنبيه للأمان:</strong> هذا الجدول مخصص للعرض والتحليل الفني الاسترشادي فقط، ولا ينفذ أي صفقات آلية.
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10px]">
            {lastUpdated && (
              <span>آخر تحديث: {new Date(lastUpdated).toLocaleTimeString('ar-EG')}</span>
            )}
            {isCached && (
              <span className="px-1.5 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20">
                مخزن مؤقتاً
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
