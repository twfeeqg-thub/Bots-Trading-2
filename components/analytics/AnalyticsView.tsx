'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Award,
  ShieldCheck,
  ShieldAlert,
  Layers,
  RefreshCw,
  Download,
  Filter,
  BarChart3,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileJson,
} from 'lucide-react';
import {
  GlobalAnalyticsSummary,
  BotPerformanceMetrics,
  TradeAnalyticsRecord,
  RawAnalyticsEvent,
} from '@/lib/analytics/types';

export function AnalyticsView() {
  const [summary, setSummary] = useState<GlobalAnalyticsSummary | null>(null);
  const [bots, setBots] = useState<BotPerformanceMetrics[]>([]);
  const [trades, setTrades] = useState<TradeAnalyticsRecord[]>([]);
  const [events, setEvents] = useState<RawAnalyticsEvent[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<TradeAnalyticsRecord | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'trades' | 'bots' | 'events'>('trades');

  // Filters
  const [filterSymbol, setFilterSymbol] = useState<string>('ALL');
  const [filterBotType, setFilterBotType] = useState<string>('ALL');
  const [filterOutcome, setFilterOutcome] = useState<string>('ALL');

  const fetchAnalytics = useCallback(async () => {
    try {
      const [analyticsRes, tradesRes, eventsRes] = await Promise.all([
        fetch('/api/analytics'),
        fetch('/api/analytics/trades'),
        fetch('/api/analytics/events?limit=100'),
      ]);

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setSummary(data.summary || null);
        setBots(data.bots || []);
      }

      if (tradesRes.ok) {
        const data = await tradesRes.json();
        const tradeList: TradeAnalyticsRecord[] = data.trades || [];
        setTrades(tradeList);

        if (tradeList.length > 0) {
          setSelectedTrade((prev) => {
            if (!prev) return tradeList[0];
            const updated = tradeList.find((t) => t.tradeId === prev.tradeId);
            return updated || tradeList[0];
          });
        }
      }

      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchAnalytics();
    setIsRefreshing(false);
  };

  useEffect(() => {
    let ignore = false;
    const runAsync = async () => {
      await fetchAnalytics();
      if (!ignore) {
        setIsLoading(false);
      }
    };
    runAsync();

    const interval = setInterval(() => {
      fetchAnalytics();
    }, 4000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [fetchAnalytics]);

  // Filtered trades list
  const filteredTrades = trades.filter((t) => {
    if (filterSymbol !== 'ALL' && t.symbol !== filterSymbol) return false;
    if (filterBotType !== 'ALL' && t.botType !== filterBotType) return false;
    if (filterOutcome !== 'ALL') {
      if (filterOutcome === 'OPEN' && t.status !== 'OPEN') return false;
      if (filterOutcome !== 'OPEN' && t.outcome !== filterOutcome) return false;
    }
    return true;
  });

  const uniqueSymbols = Array.from(new Set(trades.map((t) => t.symbol)));

  const handleExportJSON = () => {
    window.open('/api/analytics/events?export=true', '_blank');
  };

  if (isLoading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-slate-400 gap-3">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">جاري معالجة بيانات الأداء وتحليل الصفقات الحية...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Top Banner & Header Controls */}
      <div className="theme-section flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="theme-heading text-base sm:text-lg font-bold">
                مكوّن PnL &amp; Analytics المتقدم
              </h2>
              <p className="text-xs text-slate-400">
                تحليل رياضي فوري للصفقات، تقييم أداء البوتات، وتوثيق سجل الوقائع الخام بدقة 8 خانات عشرية.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>تحديث البيانات</span>
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير السجل الخام (JSON)</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Total Net PnL */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block flex items-center justify-between">
              <span>صافي PnL الكلي</span>
              {summary.totalNetPnLQuote >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              )}
            </span>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-lg font-bold font-mono ${
                  summary.totalNetPnLQuote >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {summary.totalNetPnLQuote >= 0 ? '+' : ''}
                {summary.totalNetPnLQuote.toFixed(4)}
              </span>
              <span className="text-[10px] text-slate-400">USDT</span>
            </div>
            <span
              className={`text-[10px] block font-mono ${
                summary.totalNetPnLPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {summary.totalNetPnLPercent >= 0 ? '+' : ''}
              {summary.totalNetPnLPercent.toFixed(2)}% صافي
            </span>
          </div>

          {/* Card 2: Win Rate */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block flex items-center justify-between">
              <span>نسبة الصفقات الرابحة</span>
              <Award className="w-3.5 h-3.5 text-amber-400" />
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-slate-100">
                {summary.globalWinRate.toFixed(1)}%
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              {summary.winningTrades} رابحة / {summary.losingTrades} خاسرة / {summary.breakevenTrades} تعادل
            </span>
          </div>

          {/* Card 3: Capital Invested */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block flex items-center justify-between">
              <span>إجمالي رأس المال المنفذ</span>
              <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-slate-100">
                {summary.totalInvestedVolume.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400">USDT</span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              عبر {summary.totalTrades} صفقة ({summary.openTrades} جارية)
            </span>
          </div>

          {/* Card 4: Total Fees Paid */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block flex items-center justify-between">
              <span>إجمالي العمولات والرسوم</span>
              <Activity className="w-3.5 h-3.5 text-orange-400" />
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-amber-300">
                {summary.totalFeesPaid.toFixed(4)}
              </span>
              <span className="text-[10px] text-slate-400">USDT</span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              عمولات دخول وخروج حقيقية
            </span>
          </div>

          {/* Card 5: Profit Factor */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block flex items-center justify-between">
              <span>معامل الربح (Profit Factor)</span>
              <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-cyan-300">
                {summary.profitFactor !== null && isFinite(summary.profitFactor)
                  ? summary.profitFactor.toFixed(2)
                  : '∞'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              نسبة إجمالي الأرباح إلى الخسائر
            </span>
          </div>

          {/* Card 6: Recovery Reliance */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block flex items-center justify-between">
              <span>فاعلية التعزيز (X-Recovery)</span>
              <Layers className="w-3.5 h-3.5 text-purple-400" />
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-purple-300">
                {summary.recoverySuccessRate.toFixed(1)}%
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              {summary.totalRecoveryTrades} صفقة استعانت بالتعزيز
            </span>
          </div>
        </div>
      )}

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('trades')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            activeSubTab === 'trades'
              ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900/40'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>تحليل الصفقات الحية والمغلقة ({trades.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('bots')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            activeSubTab === 'bots'
              ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900/40'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>مصفوفة تقييم ومقارنة أداء البوتات ({bots.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('events')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            activeSubTab === 'events'
              ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900/40'
          }`}
        >
          <FileJson className="w-4 h-4" />
          <span>سجل الوقائع والأحداث الخام ({events.length})</span>
        </button>
      </div>

      {/* SUB-TAB 1: TRADES ANALYSIS */}
      {activeSubTab === 'trades' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Trades List with Filters */}
          <div className="lg:col-span-4 space-y-3">
            {/* Filter Bar */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  <span>تصفية الصفقات</span>
                </span>
                <span>{filteredTrades.length} صفقة</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <select
                  value={filterSymbol}
                  onChange={(e) => setFilterSymbol(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded p-1.5 text-[11px] text-slate-200"
                >
                  <option value="ALL">كل العملات</option>
                  {uniqueSymbols.map((sym) => (
                    <option key={sym} value={sym}>
                      {sym}
                    </option>
                  ))}
                </select>

                <select
                  value={filterBotType}
                  onChange={(e) => setFilterBotType(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded p-1.5 text-[11px] text-slate-200"
                >
                  <option value="ALL">كل الأنواع</option>
                  <option value="RANGE_BOT">RANGE_BOT</option>
                  <option value="DEAL_BOT">DEAL_BOT</option>
                </select>

                <select
                  value={filterOutcome}
                  onChange={(e) => setFilterOutcome(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded p-1.5 text-[11px] text-slate-200"
                >
                  <option value="ALL">كل الحالات</option>
                  <option value="OPEN">جارية</option>
                  <option value="WIN">رابحة</option>
                  <option value="LOSS">خاسرة</option>
                  <option value="BREAKEVEN">تعادل</option>
                </select>
              </div>
            </div>

            {/* Trades List Scroll */}
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {filteredTrades.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800 text-xs">
                  لا توجد صفقات تطابق معايير التصفية الحالية.
                </div>
              ) : (
                filteredTrades.map((t) => {
                  const isSelected = selectedTrade?.tradeId === t.tradeId;
                  const isProfit = t.netPnLQuote >= 0;

                  return (
                    <div
                      key={t.tradeId}
                      onClick={() => setSelectedTrade(t)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all text-xs space-y-2 ${
                        isSelected
                          ? 'bg-slate-800/90 border-emerald-500/80 shadow-md'
                          : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200 text-sm">{t.symbol}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              t.botType === 'RANGE_BOT'
                                ? 'bg-purple-950/60 text-purple-300 border border-purple-800/50'
                                : 'bg-blue-950/60 text-blue-300 border border-blue-800/50'
                            }`}
                          >
                            {t.botType}
                          </span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            t.status === 'OPEN'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : t.outcome === 'WIN'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : t.outcome === 'LOSS'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {t.status === 'OPEN'
                            ? 'جارية'
                            : t.outcome === 'WIN'
                            ? 'رابحة'
                            : t.outcome === 'LOSS'
                            ? 'خاسرة'
                            : 'تعادل'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400 font-mono">
                        <div>
                          <span>رأس المال: </span>
                          <span className="text-slate-300">{t.totalInvested.toFixed(2)} USDT</span>
                        </div>
                        <div className="text-left">
                          <span>WAP: </span>
                          <span className="text-slate-300">{t.weightedAverageEntryPrice.toFixed(4)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                        <span className="text-slate-400 font-mono">{t.durationFormatted}</span>
                        <div className="flex items-center gap-1 font-mono font-bold">
                          <span className={isProfit ? 'text-emerald-400' : 'text-rose-400'}>
                            {isProfit ? '+' : ''}
                            {t.netPnLQuote.toFixed(4)} USDT
                          </span>
                          <span className={`text-[10px] ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                            ({isProfit ? '+' : ''}
                            {t.netPnLPercent.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed Trade Inspector */}
          <div className="lg:col-span-8 space-y-4">
            {selectedTrade ? (
              <div className="space-y-4">
                {/* 1. Trade Summary Card */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-100 font-mono">
                          {selectedTrade.symbol} — تفاصيل الصفقة
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {selectedTrade.tradeId}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {selectedTrade.botName} | المصدر: {selectedTrade.source} | الحالة: {selectedTrade.status}
                      </span>
                    </div>

                    <div className="text-left font-mono">
                      <span className="text-[10px] text-slate-400 block">صافي PnL المحقق / الحالي</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-lg font-bold ${
                            selectedTrade.netPnLQuote >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {selectedTrade.netPnLQuote >= 0 ? '+' : ''}
                          {selectedTrade.netPnLQuote.toFixed(4)} USDT
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                            selectedTrade.netPnLQuote >= 0
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {selectedTrade.netPnLQuote >= 0 ? '+' : ''}
                          {selectedTrade.netPnLPercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-slate-300">
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">إجمالي رأس المال المنفذ</span>
                      <span className="font-bold text-slate-100 text-sm">
                        {selectedTrade.totalInvested.toFixed(4)} USDT
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        الأساسي: {selectedTrade.initialAmount.toFixed(2)} USDT
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">الكمية الإجمالية المجمعة</span>
                      <span className="font-bold text-slate-100 text-sm">
                        {selectedTrade.totalQuantity.toFixed(6)}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        الأساسية: {selectedTrade.initialQuantity.toFixed(6)}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">متوسط سعر الدخول (WAP)</span>
                      <span className="font-bold text-cyan-400 text-sm">
                        {selectedTrade.weightedAverageEntryPrice.toFixed(4)}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        الدخول الأولي: {selectedTrade.initialEntryPrice.toFixed(4)}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">إجمالي الرسوم المدفوعة</span>
                      <span className="font-bold text-amber-300 text-sm">
                        {selectedTrade.totalFeesPaid.toFixed(4)} USDT
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        دخول: {selectedTrade.entryCommissionPaid.toFixed(4)} | خروج: {selectedTrade.exitCommissionPaid.toFixed(4)}
                      </span>
                    </div>
                  </div>

                  {/* T0 Break-Even and Protection Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">سعر التعادل الصافي T0:</span>
                      <span className="font-bold text-emerald-400">
                        {selectedTrade.targetAnalytics.t0BreakEvenPrice.toFixed(4)} USDT
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        شامل كافة العمولات الحقيقية
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">سعر الحماية الفعّال:</span>
                      <span className="font-bold text-indigo-300">
                        {selectedTrade.targetAnalytics.activeProtectionPrice.toFixed(4)} USDT
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        الأولي: {selectedTrade.targetAnalytics.initialProtectionPrice.toFixed(4)} USDT
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">أعلى هدف T تم الوصول إليه:</span>
                      <span className="font-bold text-amber-300">
                        {selectedTrade.targetAnalytics.maxTLevelReached}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {selectedTrade.targetAnalytics.isClosedByProtection
                          ? 'أغلقت بواسطة الحماية المتحركة'
                          : selectedTrade.status === 'CLOSED'
                          ? `أغلقت: ${selectedTrade.closeReason || 'حسب الخطة'}`
                          : 'المراقبة مستمرة ديناميكيًا'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Levels Breakdown Table */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-100 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <span>تحليل المستويات المنفذة (Levels PnL Breakdown)</span>
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {selectedTrade.recoveryAnalytics.levels.length} مستوى منفذ
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                        <tr>
                          <th className="p-2">المستوى</th>
                          <th className="p-2">سعر التنفيذ</th>
                          <th className="p-2">الكمية</th>
                          <th className="p-2">المبلغ (USDT)</th>
                          <th className="p-2">الرسوم (دخول+خروج)</th>
                          <th className="p-2">السعر الحالي/الخروج</th>
                          <th className="p-2 text-left">صافي PnL المستوى</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {selectedTrade.recoveryAnalytics.levels.map((lvl) => {
                          const isLvlProfit = lvl.netPnLQuote >= 0;
                          return (
                            <tr key={`${lvl.levelType}_${lvl.levelIndex}`} className="hover:bg-slate-800/40">
                              <td className="p-2 font-sans font-semibold text-slate-200">
                                {lvl.label}
                              </td>
                              <td className="p-2 text-slate-300">{lvl.executionPrice.toFixed(4)}</td>
                              <td className="p-2 text-slate-300">{lvl.quantity.toFixed(6)}</td>
                              <td className="p-2 text-slate-200 font-bold">{lvl.quoteAmount.toFixed(2)}</td>
                              <td className="p-2 text-amber-300/90">
                                {(lvl.feePaid + lvl.exitFeeAllocated).toFixed(4)}
                              </td>
                              <td className="p-2 text-slate-300">{lvl.currentOrExitPrice.toFixed(4)}</td>
                              <td className="p-2 text-left font-bold">
                                <span className={isLvlProfit ? 'text-emerald-400' : 'text-rose-400'}>
                                  {isLvlProfit ? '+' : ''}
                                  {lvl.netPnLQuote.toFixed(4)} USDT
                                </span>
                                <span
                                  className={`text-[10px] block ${
                                    isLvlProfit ? 'text-emerald-500' : 'text-rose-500'
                                  }`}
                                >
                                  ({isLvlProfit ? '+' : ''}
                                  {lvl.netPnLPercent.toFixed(2)}%)
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Recovery Impact & Analytics Evaluation */}
                {selectedTrade.recoveryAnalytics.hasRecoveries && (
                  <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-purple-200 flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-purple-400" />
                        <span>تحليل أثر التعزيز (Recovery Impact Evaluation)</span>
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          selectedTrade.recoveryAnalytics.recoveryResult === 'POSITIVE_IMPACT'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : selectedTrade.recoveryAnalytics.recoveryResult === 'NEGATIVE_IMPACT'
                            ? 'bg-rose-950 text-rose-300 border border-rose-700'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {selectedTrade.recoveryAnalytics.recoveryResult === 'POSITIVE_IMPACT'
                          ? 'التعزيز حسّن النتيجة النهائية'
                          : selectedTrade.recoveryAnalytics.recoveryResult === 'NEGATIVE_IMPACT'
                          ? 'التعزيز زاد الخسارة مقارنة بالخروج الأولي'
                          : 'أثر التعزيز متعادل'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                      <div className="p-2.5 rounded-lg bg-slate-950/70 border border-purple-900/40">
                        <span className="text-slate-400 block text-[10px]">مبالغ التعزيزات المنفذة</span>
                        <span className="font-bold text-purple-300 text-sm">
                          {selectedTrade.recoveryAnalytics.totalRecoverySpent.toFixed(2)} USDT
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {selectedTrade.recoveryAnalytics.recoveryCapitalRatio}% من إجمالي رأس مال الصفقة
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-950/70 border border-purple-900/40">
                        <span className="text-slate-400 block text-[10px]">الخسارة الافتراضية لو تم الخروج بوقف أولي</span>
                        <span className="font-bold text-rose-400 text-sm">
                          {selectedTrade.recoveryAnalytics.baseNetPnLQuoteAtInitialStop.toFixed(4)} USDT
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          دون اللجوء لمسار التعزيز
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-950/70 border border-purple-900/40">
                        <span className="text-slate-400 block text-[10px]">فارق التحسن بفضل التعزيز (Delta)</span>
                        <span
                          className={`font-bold text-sm ${
                            selectedTrade.recoveryAnalytics.recoveryImprovementDelta >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {selectedTrade.recoveryAnalytics.recoveryImprovementDelta >= 0 ? '+' : ''}
                          {selectedTrade.recoveryAnalytics.recoveryImprovementDelta.toFixed(4)} USDT
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          النتيجة الحالية مقارنة بالوقف الأولي
                        </span>
                      </div>
                    </div>

                    {/* WAP Progression Progression */}
                    {selectedTrade.recoveryAnalytics.wapHistory.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-purple-900/40">
                        <span className="text-[11px] text-slate-300 font-semibold block">
                          تدرج متوسط السعر المرجح (WAP Progression):
                        </span>
                        <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                          <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400">
                            الدخول الأولي: {selectedTrade.initialEntryPrice.toFixed(4)}
                          </span>
                          {selectedTrade.recoveryAnalytics.wapHistory.map((w) => (
                            <span
                              key={w.levelIndex}
                              className="px-2 py-1 rounded bg-purple-950/40 border border-purple-700/50 text-purple-200"
                            >
                              بعد X{w.levelIndex}: {w.wapAfter.toFixed(4)} USDT (هبوط WAP من {w.wapBefore.toFixed(4)})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800 text-xs">
                اختر صفقة من القائمة الجانبية لعرض تحليلها التفصيلي.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BOT PERFORMANCE & COMPARISON MATRIX */}
      {activeSubTab === 'bots' && (
        <div className="space-y-6">
          {/* Analytical Insights Synthesis Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Question 1: Best Performing Bot */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  <span>أي بوت أداؤه هو الأفضل؟</span>
                </span>
                {summary.bestPerformingBot ? (
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-slate-100 block">
                      {summary.bestPerformingBot.botName}
                    </span>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className="text-emerald-400 font-semibold">
                        +{summary.bestPerformingBot.netPnLQuote.toFixed(4)} USDT
                      </span>
                      <span className="text-slate-400">
                        نسبة فوز: {summary.bestPerformingBot.winRate}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500">لا توجد بيانات صفقات مكتملة كافية للمقارنة بعد.</span>
                )}
              </div>

              {/* Question 2: Bot Type Profitability */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                <span className="text-[11px] font-semibold text-cyan-400 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4" />
                  <span>مقارنة أداء RANGE_BOT مقابل DEAL_BOT</span>
                </span>
                <div className="space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between items-center text-purple-300">
                    <span>RANGE_BOT (المسار العرضي):</span>
                    <span>
                      {summary.botTypeComparison.RANGE_BOT.totalPnLQuote.toFixed(2)} USDT (
                      {summary.botTypeComparison.RANGE_BOT.winRate}%)
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-blue-300">
                    <span>DEAL_BOT (الصفقة الواحدة):</span>
                    <span>
                      {summary.botTypeComparison.DEAL_BOT.totalPnLQuote.toFixed(2)} USDT (
                      {summary.botTypeComparison.DEAL_BOT.winRate}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Question 3: Recovery Impact Verdict */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                <span className="text-[11px] font-semibold text-purple-400 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  <span>هل كثرة التعزيزات تحسن النتيجة أم تضعفها؟</span>
                </span>
                <div className="space-y-1 text-slate-300">
                  <p className="text-[11px] leading-relaxed">
                    نسبة نجاح الصفقات التي استعانت بالتعزيز:{' '}
                    <span className="font-bold text-purple-300 font-mono">
                      {summary.recoverySuccessRate}%
                    </span>
                    . تم توظيف{' '}
                    <span className="font-mono text-slate-100">
                      {summary.totalRecoveryCapitalDeployed.toFixed(2)} USDT
                    </span>{' '}
                    في التعزيزات، ومتوسط التعزيزات هو{' '}
                    <span className="font-mono text-slate-100">{summary.averageRecoveryLevels}</span> مستوى لكل صفقة.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Bots Comparison Table */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>مصفوفة مقارنة أداء جميع البوتات</span>
              </h3>
              <span className="text-slate-400 text-[11px]">{bots.length} بوت نشط ومسجل</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">البوت والعملة</th>
                    <th className="p-2.5">النوع</th>
                    <th className="p-2.5">إجمالي الصفقات</th>
                    <th className="p-2.5">نسبة الفوز</th>
                    <th className="p-2.5">رأس المال المنفذ</th>
                    <th className="p-2.5">إجمالي الرسوم</th>
                    <th className="p-2.5">معامل الربح</th>
                    <th className="p-2.5">الاعتماد على التعزيز</th>
                    <th className="p-2.5 text-left">صافي PnL الكلي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {bots.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-500 font-sans">
                        لم يتم تسجيل صفقات مكتملة للبوتات حتى الآن.
                      </td>
                    </tr>
                  ) : (
                    bots.map((b) => {
                      const isProfit = b.overallNetPnLQuote >= 0;
                      return (
                        <tr key={b.botId} className="hover:bg-slate-800/40">
                          <td className="p-2.5 font-sans">
                            <span className="font-bold text-slate-200 block">{b.botName}</span>
                            <span className="text-[10px] text-slate-500">{b.symbol}</span>
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                b.botType === 'RANGE_BOT'
                                  ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                  : 'bg-blue-950 text-blue-300 border border-blue-800'
                              }`}
                            >
                              {b.botType}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-300">
                            {b.totalTrades} ({b.closedTradesCount} مغلقة / {b.openTradesCount} جارية)
                          </td>
                          <td className="p-2.5 text-slate-200 font-bold">{b.winRate}%</td>
                          <td className="p-2.5 text-slate-300">{b.totalInvestedVolume.toFixed(2)} USDT</td>
                          <td className="p-2.5 text-amber-300">{b.totalFeesPaid.toFixed(4)}</td>
                          <td className="p-2.5 text-cyan-300 font-mono">
                            {b.profitFactor !== null && isFinite(b.profitFactor)
                              ? b.profitFactor.toFixed(2)
                              : '∞'}
                          </td>
                          <td className="p-2.5 text-slate-300">
                            {b.recoveryUtilizationRate}% ({b.tradesWithRecoveryCount} صفقة)
                          </td>
                          <td className="p-2.5 text-left font-bold">
                            <span className={isProfit ? 'text-emerald-400' : 'text-rose-400'}>
                              {isProfit ? '+' : ''}
                              {b.overallNetPnLQuote.toFixed(4)} USDT
                            </span>
                            <span
                              className={`text-[10px] block ${
                                isProfit ? 'text-emerald-500' : 'text-rose-500'
                              }`}
                            >
                              ({isProfit ? '+' : ''}
                              {b.overallNetPnLPercent.toFixed(2)}%)
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: RAW EVENTS LOG & EXPORT */}
      {activeSubTab === 'events' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <div>
              <h3 className="font-bold text-slate-100 flex items-center gap-1.5 text-sm">
                <FileJson className="w-4 h-4 text-emerald-400" />
                <span>سجل الوقائع والأحداث الخام (Immutable Events Audit Stream)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                تخزين منظم للحقائق الخام للصفقات والدورات دون أي تغيير في مسار تنفيذ التداول.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportJSON}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold flex items-center gap-1.5 text-xs transition-colors shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>تنزيل السجل التاريخي الكامل (JSON)</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="p-2">الوقت</th>
                    <th className="p-2">نوع الحدث</th>
                    <th className="p-2">معرف الصفقة</th>
                    <th className="p-2">معرف البوت</th>
                    <th className="p-2">البيانات الخام (Payload)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500 font-sans">
                        لم يتم تسجيل أحداث حتى الآن.
                      </td>
                    </tr>
                  ) : (
                    events.map((evt) => (
                      <tr key={evt.eventId} className="hover:bg-slate-800/40">
                        <td suppressHydrationWarning className="p-2 text-slate-400 whitespace-nowrap">
                          {new Date(evt.timestamp).toLocaleTimeString('ar-EG')}
                        </td>
                        <td className="p-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              evt.type === 'TRADE_CLOSED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : evt.type === 'RECOVERY_EXECUTED'
                                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                : evt.type === 'LEVEL_ADVANCED'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {evt.type}
                          </span>
                        </td>
                        <td className="p-2 text-slate-300">{evt.tradeId}</td>
                        <td className="p-2 text-slate-400">{evt.botId}</td>
                        <td className="p-2 text-slate-400 truncate max-w-md">
                          {JSON.stringify(evt.payload)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
