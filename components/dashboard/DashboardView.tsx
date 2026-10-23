'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Radar, 
  LineChart, 
  TrendingUp, 
  ShieldCheck, 
  Activity, 
  Bell, 
  BellRing, 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Clock, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Plus, 
  Trash2, 
  Check, 
  Bookmark, 
  BookmarkCheck,
  ChevronRight,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useScanner } from '@/hooks/use-scanner';
import { useTheme } from '@/components/theme/ThemeContext';
import { SessionTimelineCard } from '@/components/markets/SessionTimelineCard';
import { 
  SUPPORTED_PERIODS, 
  TimePeriod, 
  ScannerTableRow 
} from '@/lib/scanner/types';
import { 
  ChartItemConfig, 
  loadPersistedCharts, 
  savePersistedCharts, 
  MAX_ACTIVE_CHARTS 
} from '@/lib/charts/chart-persistence';

interface DashboardViewProps {
  onNavigateToScanner: () => void;
  onNavigateToCharts: (symbol?: string) => void;
  onNavigateToTrades: (symbol?: string, currentPrice?: number) => void;
}

export function DashboardView({
  onNavigateToScanner,
  onNavigateToCharts,
  onNavigateToTrades,
}: DashboardViewProps) {
  const { isLight } = useTheme();
  const { state, setPeriod, setSort, setFilter } = useScanner();

  // Mounted flag to avoid SSR hydration mismatches
  const [mounted, setMounted] = useState<boolean>(false);

  // Active tracked charts list from existing persistence
  const [persistedCharts, setPersistedCharts] = useState<ChartItemConfig[]>([]);

  // Local filter and tab state for currency lists
  const [activeListTab, setActiveListTab] = useState<'all' | 'watchlist' | 'gainers' | 'alerted'>('all');
  const [searchInput, setSearchInput] = useState<string>('');

  // Reload persisted charts on focus/mount
  const refreshPersistedCharts = useCallback(() => {
    if (typeof window !== 'undefined') {
      setPersistedCharts(loadPersistedCharts());
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    refreshPersistedCharts();
    window.addEventListener('storage', refreshPersistedCharts);
    return () => window.removeEventListener('storage', refreshPersistedCharts);
  }, [refreshPersistedCharts]);

  // Handle adding/removing symbol to existing persisted charts
  const handleToggleChartTrack = (symbol: string) => {
    const cleanSym = symbol.trim().toUpperCase();
    const current = loadPersistedCharts();
    const existingIndex = current.findIndex((c) => !c.isClosed && c.symbol === cleanSym);

    let updated: ChartItemConfig[];
    if (existingIndex >= 0) {
      // Mark as closed / remove from active charts
      updated = current.map((c, i) => i === existingIndex ? { ...c, isClosed: true } : c);
    } else {
      // Check active count
      const activeCount = current.filter((c) => !c.isClosed).length;
      if (activeCount >= MAX_ACTIVE_CHARTS) {
        alert(`الحد الأقصى للشارتات النشطة هو ${MAX_ACTIVE_CHARTS} شارتات.`);
        return;
      }
      const newChart: ChartItemConfig = {
        id: `chart_${Date.now()}_${cleanSym.toLowerCase()}`,
        symbol: cleanSym,
        timeframe: '5m',
        order: current.length,
        isMinimized: false,
        isClosed: false,
        horizontalLines: [],
        redrawRateMs: 0,
      };
      updated = [newChart, ...current];
    }

    savePersistedCharts(updated);
    setPersistedCharts(updated);
  };

  // Set of active chart symbols (guarded for SSR)
  const activeChartSymbols = useMemo(() => {
    if (!mounted) return new Set<string>();
    return new Set(persistedCharts.filter((c) => !c.isClosed).map((c) => c.symbol));
  }, [persistedCharts, mounted]);

  // Data Freshness counts
  const freshnessStats = useMemo(() => {
    let fresh = 0;
    let stale = 0;
    let noData = 0;
    for (const r of state.rows) {
      if (r.dataStatus === 'FRESH') fresh++;
      else if (r.dataStatus === 'STALE') stale++;
      else noData++;
    }
    return { fresh, stale, noData, total: state.rows.length };
  }, [state.rows]);

  // Highlighted coins worthy of attention (Alerted or top positive momentum)
  const attentionCoins = useMemo(() => {
    return state.rows
      .filter((r) => r.alertState === 'ALERTED' || r.hasRecentAlert || (r.changePercent !== null && r.changePercent > 0))
      .sort((a, b) => {
        // Prioritize ALERTED first, then highest change percent
        if (a.alertState === 'ALERTED' && b.alertState !== 'ALERTED') return -1;
        if (b.alertState === 'ALERTED' && a.alertState !== 'ALERTED') return 1;
        return (b.changePercent || 0) - (a.changePercent || 0);
      })
      .slice(0, 6);
  }, [state.rows]);

  // Filtered rows for the list
  const displayRows = useMemo(() => {
    let list = state.rows;

    if (activeListTab === 'watchlist') {
      list = list.filter((r) => activeChartSymbols.has(r.symbol));
    } else if (activeListTab === 'gainers') {
      list = list.filter((r) => (r.changePercent || 0) > 0);
    } else if (activeListTab === 'alerted') {
      list = list.filter((r) => r.alertState === 'ALERTED' || r.hasRecentAlert);
    }

    if (searchInput.trim()) {
      const q = searchInput.trim().toUpperCase();
      list = list.filter((r) => r.symbol.includes(q) || r.asset.includes(q));
    }

    return list;
  }, [state.rows, activeListTab, activeChartSymbols, searchInput]);

  // Price & change formatters
  const formatPrice = (price: number | null): string => {
    if (price === null || isNaN(price)) return '—';
    if (price >= 1000) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  const formatChange = (change: number | null): string => {
    if (change === null || isNaN(change)) return '—';
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  return (
    <div 
      id="dashboard-view-container" 
      suppressHydrationWarning
      className="space-y-4 sm:space-y-6 pb-16 animate-in fade-in duration-200 max-w-full overflow-hidden"
    >
      
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HERO: Connection, Freshness & System Summary */}
      {/* ------------------------------------------------------------- */}
      <section className={`theme-section rounded-2xl p-4 sm:p-5 border shadow-xs transition-colors ${
        isLight 
          ? 'bg-gradient-to-r from-slate-50 via-white to-amber-50/40 border-slate-200' 
          : 'bg-gradient-to-r from-slate-900/90 via-slate-900 to-amber-950/20 border-slate-800'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                state.connectionStatus === 'CONNECTED'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/30 animate-pulse'
              }`}>
                {state.connectionStatus === 'CONNECTED' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>بث السوق الحي متصل (WebSocket)</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>حالة الاتصال: {state.connectionStatus}</span>
                  </>
                )}
              </span>

              <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono ${
                isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
              }`}>
                !miniTicker@arr
              </span>
            </div>

            <h2 className="theme-heading text-lg sm:text-xl font-bold tracking-tight">
              لوحة التحكم الرئيسية (Dashboard)
            </h2>
            <p className={`text-xs sm:text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              نظرة عامة موحدة على حالة البث والعملات المتابعة وفترات السيولة واختصارات التداول السريعة.
            </p>
          </div>

          {/* Metrics summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full md:w-auto shrink-0 font-mono text-xs">
            {/* Tracked coins */}
            <div className={`p-2.5 rounded-xl border ${
              isLight ? 'bg-white border-slate-200' : 'bg-slate-950/80 border-slate-800'
            }`}>
              <div className="text-[10px] text-slate-400 font-sans">العملات المتابعة</div>
              <div className="text-base sm:text-lg font-bold text-amber-500">
                {freshnessStats.total} <span className="text-xs font-normal text-slate-500 font-sans">عملة</span>
              </div>
            </div>

            {/* Freshness */}
            <div className={`p-2.5 rounded-xl border ${
              isLight ? 'bg-white border-slate-200' : 'bg-slate-950/80 border-slate-800'
            }`}>
              <div className="text-[10px] text-slate-400 font-sans">حداثة البيانات</div>
              <div className="text-base sm:text-lg font-bold text-emerald-500">
                {freshnessStats.fresh} <span className="text-[10px] text-slate-500 font-sans">طازجة</span>
              </div>
              <div className="text-[9px] text-slate-500">
                {freshnessStats.stale > 0 ? `${freshnessStats.stale} متأخرة` : 'تحديث لحظي'}
              </div>
            </div>

            {/* Active Charts / Watchlist */}
            <div className={`col-span-2 sm:col-span-1 p-2.5 rounded-xl border ${
              isLight ? 'bg-white border-slate-200' : 'bg-slate-950/80 border-slate-800'
            }`}>
              <div className="text-[10px] text-slate-400 font-sans">الشارتات النشطة</div>
              <div suppressHydrationWarning className="text-base sm:text-lg font-bold text-sky-500">
                {mounted ? activeChartSymbols.size : 0} <span className="text-xs font-normal text-slate-500 font-sans">/ {MAX_ACTIVE_CHARTS}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Nav Shortcuts Row */}
        <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-slate-800/40">
          <button
            type="button"
            onClick={onNavigateToScanner}
            className="p-2 sm:p-2.5 rounded-xl border font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
          >
            <Radar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">رادار الصعود (Scanner)</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToCharts()}
            className={`p-2 sm:p-2.5 rounded-xl border font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isLight 
                ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
            }`}
          >
            <LineChart className="w-3.5 h-3.5 shrink-0 text-sky-400" />
            <span className="truncate">الشارتات التفاعلية (Charts)</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToTrades()}
            className={`p-2 sm:p-2.5 rounded-xl border font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isLight 
                ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span className="truncate">إدارة الصفقات والبوتات</span>
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 2. REUSED SESSION TIMELINE & GOLDEN OVERLAPS FROM MARKETS */}
      {/* ------------------------------------------------------------- */}
      <SessionTimelineCard />

      {/* ------------------------------------------------------------- */}
      {/* 3. ATTENTION HIGHLIGHT: Coins worthy of note (Alerts / Momentum) */}
      {/* ------------------------------------------------------------- */}
      <section className={`theme-section rounded-2xl p-4 sm:p-5 border shadow-xs space-y-3 transition-colors ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5 border-slate-800/40">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <h3 className="theme-heading text-sm sm:text-base font-bold flex items-center gap-2">
                <span>عملات جديرة بالانتباه (تنبيهات وزخم لحظي)</span>
                {attentionCoins.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    {attentionCoins.length} عملات
                  </span>
                )}
              </h3>
              <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                مبنية على تجاوز نسبة التنبيه المحددة ومؤشر التغير اللحظي فقط — ليست توصيات شراء أو دعوات استثمار.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs">
            <span className="text-[11px] text-slate-400">الفترة الحالية:</span>
            <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
              {state.selectedPeriod}
            </span>
          </div>
        </div>

        {attentionCoins.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            لا توجد عملات متجاوزة لنسبة التنبيه في الفترة الزمنية المحددة حالياً.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {attentionCoins.map((coin) => {
              const isChartActive = activeChartSymbols.has(coin.symbol);
              const isAlerted = coin.alertState === 'ALERTED' || coin.hasRecentAlert;

              return (
                <div
                  key={coin.symbol}
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 relative ${
                    isAlerted
                      ? isLight
                        ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/30'
                        : 'bg-amber-950/20 border-amber-500/40 ring-1 ring-amber-500/20'
                      : isLight
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {coin.asset}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        /USDT
                      </span>
                      {isAlerted && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-bold animate-pulse">
                          تنبيه صعود
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className={`text-xs font-bold font-mono ${
                        (coin.changePercent || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {formatChange(coin.changePercent)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[11px] text-slate-400 font-sans">السعر:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      ${formatPrice(coin.currentPrice)}
                    </span>
                  </div>

                  {/* Actions for this coin */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/30">
                    <button
                      type="button"
                      onClick={() => onNavigateToCharts(coin.symbol)}
                      className="flex-1 py-1 px-2 rounded-lg text-[11px] font-semibold bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <LineChart className="w-3 h-3" />
                      <span>شارت</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigateToTrades(coin.symbol, coin.currentPrice || undefined)}
                      className="flex-1 py-1 px-2 rounded-lg text-[11px] font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <TrendingUp className="w-3 h-3" />
                      <span>تداول</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleChartTrack(coin.symbol)}
                      title={isChartActive ? 'إزالة من قائمة الشارتات النشطة' : 'إضافة إلى الشارتات النشطة'}
                      className={`p-1 rounded-lg border transition-colors cursor-pointer ${
                        isChartActive
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          : 'bg-slate-800/40 text-slate-400 border-slate-700/60 hover:text-slate-200'
                      }`}
                    >
                      {isChartActive ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. CURRENCY LISTS & CONTROLS: Display, Sort, Filter & Watchlist */}
      {/* ------------------------------------------------------------- */}
      <section className={`theme-section rounded-2xl p-4 sm:p-5 border shadow-xs space-y-4 transition-colors ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
      }`}>
        {/* Header & Tabs */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b pb-3 border-slate-800/40">
          <div>
            <h3 className="theme-heading text-sm sm:text-base font-bold">
              قوائم العملات المتابعة وإدارتها
            </h3>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              فرز وتنظيم الأصول ومتابعة الأسعار اللحظية وإدارة الشارتات النشطة
            </p>
          </div>

          {/* List Tab Switcher */}
          <div className={`flex items-center p-1 rounded-xl border text-xs overflow-x-auto max-w-full ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}>
            <button
              type="button"
              onClick={() => setActiveListTab('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeListTab === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              الكل ({state.rows.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveListTab('watchlist')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                activeListTab === 'watchlist'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bookmark className="w-3 h-3" />
              <span suppressHydrationWarning>الشارتات النشطة ({mounted ? activeChartSymbols.size : 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveListTab('gainers')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeListTab === 'gainers'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              الأعلى صعوداً
            </button>

            <button
              type="button"
              onClick={() => setActiveListTab('alerted')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeListTab === 'alerted'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              المتجاوزة للتنبيه
            </button>
          </div>
        </div>

        {/* Toolbar: Timeframe Periods & Search Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="بحث عن رمز العملة (مثال: BTC, SOL, ETH)..."
              className={`w-full pr-9 pl-3 py-1.5 rounded-xl text-xs border transition-colors outline-hidden ${
                isLight 
                  ? 'bg-slate-50 border-slate-300 focus:border-amber-500 text-slate-900' 
                  : 'bg-slate-950 border-slate-800 focus:border-amber-500 text-slate-100'
              }`}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Timeframe selector (reusing existing periods) */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-slate-400 ml-1 shrink-0">الفترة:</span>
            {SUPPORTED_PERIODS.slice(0, 6).map((p) => {
              const isSelected = state.selectedPeriod === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sorting header buttons */}
        <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-slate-800/30 text-slate-400">
          <div className="flex items-center gap-2">
            <span>الترتيب حسب:</span>
            <button
              type="button"
              onClick={() => setSort('changePercent')}
              className={`px-2 py-0.5 rounded font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                state.sortField === 'changePercent' ? 'text-amber-400 bg-amber-500/10' : 'hover:text-slate-200'
              }`}
            >
              <span>نسبة التغير %</span>
              <ArrowUpDown className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setSort('currentPrice')}
              className={`px-2 py-0.5 rounded font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                state.sortField === 'currentPrice' ? 'text-amber-400 bg-amber-500/10' : 'hover:text-slate-200'
              }`}
            >
              <span>السعر</span>
              <ArrowUpDown className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setSort('asset')}
              className={`px-2 py-0.5 rounded font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                state.sortField === 'asset' ? 'text-amber-400 bg-amber-500/10' : 'hover:text-slate-200'
              }`}
            >
              <span>الرمز</span>
              <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>

          <div className="text-[11px] text-slate-500">
            عرض {displayRows.length} من {state.rows.length}
          </div>
        </div>

        {/* Coins List / Table Cards */}
        {displayRows.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-500">
            لا توجد عملات تطابق خيارات التصفية الحالية.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/40 border rounded-xl overflow-hidden">
            {displayRows.map((row) => {
              const isChartActive = activeChartSymbols.has(row.symbol);
              const isGain = (row.changePercent || 0) >= 0;

              return (
                <div
                  key={row.symbol}
                  className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
                    isLight 
                      ? 'hover:bg-slate-50 bg-white' 
                      : 'hover:bg-slate-800/40 bg-slate-950/60'
                  }`}
                >
                  {/* Left info: Rank, Asset, Symbol, Status */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500 w-5 text-center">
                      #{row.rank}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleToggleChartTrack(row.symbol)}
                      title={isChartActive ? 'إزالة من الشارتات النشطة' : 'إضافة للشارتات النشطة'}
                      className={`p-1 rounded-md transition-colors cursor-pointer ${
                        isChartActive 
                          ? 'text-amber-400 bg-amber-500/10' 
                          : 'text-slate-600 hover:text-slate-400'
                      }`}
                    >
                      {isChartActive ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                    </button>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {row.asset}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          /{row.symbol.replace(row.asset, '') || 'USDT'}
                        </span>
                        {row.alertState === 'ALERTED' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-bold">
                            تنبيه
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-500 flex items-center gap-2 font-mono">
                        <span>الأساس: ${formatPrice(row.referencePrice)}</span>
                        <span>•</span>
                        <span className={row.dataStatus === 'FRESH' ? 'text-emerald-500' : 'text-slate-400'}>
                          {row.dataStatus === 'FRESH' ? 'طازجة' : 'محدثة'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle / Right: Price & Change */}
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-left sm:text-right font-mono">
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        ${formatPrice(row.currentPrice)}
                      </div>
                      <div className={`text-xs font-semibold ${isGain ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {formatChange(row.changePercent)}
                      </div>
                    </div>

                    {/* Direct action shortcuts */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onNavigateToCharts(row.symbol)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                        title={`عرض شارت ${row.asset}`}
                      >
                        <LineChart className="w-3 h-3" />
                        <span className="hidden xs:inline">شارت</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onNavigateToTrades(row.symbol, row.currentPrice || undefined)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                        title={`تداول عملة ${row.asset}`}
                      >
                        <TrendingUp className="w-3 h-3" />
                        <span className="hidden xs:inline">تداول</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
