'use client';

// Project Q — Trade Manager View (شاشة مدير الصفقة)
// Two Unified Entry Paths: Manual Entry or Scanner Selection.
// Trailing T-Levels: T0 (Net Break-Even), T1-50%, T1, T2, T3...
// RANGE_BOT & X/Recovery Engine support.
// Removes artificial limits: Accepts ANY positive amount (e.g. 0.01 USDT or less),
// accepts ANY positive step %, accepts negative or positive stop-loss %.
// Zero real keys, 100% Mock isolation.

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Shield,
  Layers,
  ArrowRight,
  RefreshCw,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  DollarSign,
  Percent,
  Check,
  Zap,
  Info,
  ExternalLink,
  Database,
  History,
  Tag,
  Repeat,
  Sliders,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import {
  ConfirmedSymbolCost,
  CostDataSource,
  ManagedTrade,
  TradeCostConfig,
  TradeLevelsPlan,
  XRecoveryPlan,
} from '@/lib/trade-manager/types';
import { LevelCalculator } from '@/lib/trade-manager/level-calculator';
import { sharedMarketDataStore, MarketPriceRecord } from '@/lib/market-data';

interface TradeManagementViewProps {
  initialSymbol?: string | null;
  initialPrice?: number | null;
}

export function TradeManagementView({
  initialSymbol,
  initialPrice,
}: TradeManagementViewProps) {
  const [trades, setTrades] = useState<ManagedTrade[]>([]);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [symbolCosts, setSymbolCosts] = useState<Record<string, ConfirmedSymbolCost>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  // Manual Entry Form State (No artificial minimums!)
  const [manualSymbol, setManualSymbol] = useState<string>(initialSymbol || 'BTCUSDT');
  const [manualAmount, setManualAmount] = useState<string>('100');
  const [manualPrice, setManualPrice] = useState<string>(initialPrice ? String(initialPrice) : '');
  const [manualStep, setManualStep] = useState<string>('2.0');
  const [manualStopLoss, setManualStopLoss] = useState<string>('-2.5');
  const [manualEntryFee, setManualEntryFee] = useState<string>('');
  const [manualExitFeeRate, setManualExitFeeRate] = useState<string>('');

  // Bot Type & X/Recovery Settings
  const [botType, setBotType] = useState<'DEAL_BOT' | 'RANGE_BOT'>('DEAL_BOT');
  const [xMaxLevels, setXMaxLevels] = useState<string>('');
  const [xStepPercent, setXStepPercent] = useState<string>('');
  const [xRecoveryRatio, setXRecoveryRatio] = useState<string>('');
  const [xCustomAllocation, setXCustomAllocation] = useState<string>('');

  // Selected trade live X settings editing
  const [isEditingXSettings, setIsEditingXSettings] = useState<boolean>(false);
  const [editStepPercent, setEditStepPercent] = useState<string>('');
  const [editRecoveryRatio, setEditRecoveryRatio] = useState<string>('');
  const [editCustomAllocation, setEditCustomAllocation] = useState<string>('');
  const [editMaxLevels, setEditMaxLevels] = useState<string>('');

  // Market Data state
  const [livePrices, setLivePrices] = useState<Record<string, MarketPriceRecord>>({});

  // Status feedback toast
  const [feedback, setFeedback] = useState<{
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
  } | null>(null);

  const showFeedback = (
    message: string,
    type: 'success' | 'warning' | 'error' | 'info' = 'info'
  ) => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 6000);
  };

  // Sync initial props if passed from Scanner
  useEffect(() => {
    if (initialSymbol) {
      const timer = setTimeout(() => {
        setManualSymbol(initialSymbol);
        if (initialPrice) setManualPrice(String(initialPrice));
        setFeedback({
          message: `تم تحميل سياق الأصل «${initialSymbol}» من الـ Scanner بنجاح`,
          type: 'info',
        });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialSymbol, initialPrice]);

  // Fetch trades and symbol costs from API
  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch('/api/trades');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.trades)) {
          setTrades(data.trades);
          if (data.symbolCosts) {
            setSymbolCosts(data.symbolCosts);
          }
          setSelectedTradeId((prev) =>
            prev ? prev : data.trades.length > 0 ? data.trades[0].tradeId : null
          );
        }
      }
    } catch {
      // Non-fatal
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll trades every 3 seconds
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/trades');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && Array.isArray(data.trades)) {
            setTrades(data.trades);
            if (data.symbolCosts) {
              setSymbolCosts(data.symbolCosts);
            }
            setSelectedTradeId((prev) =>
              prev ? prev : data.trades.length > 0 ? data.trades[0].tradeId : null
            );
          }
        }
      } catch {
        // Non-fatal
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void load();
    const interval = setInterval(load, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Listen to live prices from Central Market Data Store
  useEffect(() => {
    const handlePriceChange = () => {
      const updated: Record<string, MarketPriceRecord> = {};
      trades.forEach((t) => {
        const rec = sharedMarketDataStore.getRecord(t.symbol);
        if (rec) updated[t.symbol] = rec;
      });
      setLivePrices(updated);
    };

    const unsubscribe = sharedMarketDataStore.subscribeToChanges(handlePriceChange);
    const timer = setTimeout(handlePriceChange, 0);
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [trades]);

  // Handle Trade Creation (Accepts ANY positive amount and any step %)
  const handleCreateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(manualAmount);
    if (!manualSymbol.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      showFeedback('يرجى إدخال رمز العملة ومبلغ موجب صحيح (يقبل أي مبلغ موجب مثل 0.01 أو أقل)', 'error');
      return;
    }

    setIsActionLoading(true);
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: initialSymbol ? 'SCANNER' : 'MANUAL',
          symbol: manualSymbol.toUpperCase().trim(),
          entryAmount: parsedAmount,
          entryPrice: manualPrice ? parseFloat(manualPrice) : undefined,
          stepPercent: manualStep ? parseFloat(manualStep) : undefined,
          manualEntryCost: manualEntryFee ? parseFloat(manualEntryFee) : undefined,
          manualExitCostRate: manualExitFeeRate ? parseFloat(manualExitFeeRate) / 100 : undefined,
          botType,
          xSettings:
            botType === 'RANGE_BOT'
              ? {
                  enabled: true,
                  maxLevels: xMaxLevels ? parseInt(xMaxLevels, 10) : undefined,
                  stepPercent: xStepPercent ? parseFloat(xStepPercent) : undefined,
                  recoveryRatio: xRecoveryRatio ? parseFloat(xRecoveryRatio) : undefined,
                  customAllocationQuote: xCustomAllocation ? parseFloat(xCustomAllocation) : undefined,
                }
              : undefined,
          initialStopLossPercent: manualStopLoss ? parseFloat(manualStopLoss) : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback(
          `✓ تم فتح الصفقة بنجاح على ${data.trade.symbol}: بمبلغ ${data.trade.entry.requestedAmount} USDT وسعر ${data.trade.entry.executionPrice} USDT`,
          'success'
        );
        setSelectedTradeId(data.trade.tradeId);
        await fetchTrades();
      } else {
        showFeedback(data.error || 'فشل فتح الصفقة', 'error');
      }
    } catch {
      showFeedback('فشل الاتصال بمدير الصفقات', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Close trade manually
  const handleCloseTrade = async (tradeId: string) => {
    if (!confirm('هل تريد إغلاق هذه الصفقة يدويًا الآن؟')) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/trades/${tradeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', reason: 'إغلاق يدوي من الشاشة' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback(
          `✓ تم إغلاق الصفقة بنجاح عبر Binance (Mock). صافي الربح: ${data.trade.pnl?.netReturnQuote} USDT (${data.trade.pnl?.netReturnPercent}%)`,
          'success'
        );
        await fetchTrades();
      } else {
        showFeedback(data.error || 'فشل إغلاق الصفقة', 'error');
      }
    } catch {
      showFeedback('فشل إغلاق الصفقة', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Simulate price tick
  const handleSimulateTick = async (tradeId: string, price: number) => {
    try {
      const res = await fetch(`/api/trades/${tradeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tick', price }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.trade.status === 'CLOSED') {
          showFeedback(
            `⚠️ وصل السعر إلى مستوى الحماية وتم تنفيذ البيع آليًا وإغلاق الصفقة بنجاح!`,
            'warning'
          );
        } else {
          showFeedback(
            `تم تحديث السعر إلى ${price} USDT. المستوى المحقق: ${data.trade.levelsPlan?.currentAchievedLevel}، الحماية: ${data.trade.levelsPlan?.activeProtectionPrice} USDT`,
            'info'
          );
        }
        await fetchTrades();
      }
    } catch {
      // Non-fatal
    }
  };

  // Simulate real cost data arrival during open trade
  const handleSimulateRealCostArrival = async (tradeId: string) => {
    try {
      const res = await fetch(`/api/trades/${tradeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'applyRealCost',
          entryCostAmount: 0.35,
          entryCostRate: 0.0035,
          exitCostRate: 0.0015,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback(
          `✓ تم استبدال البيانات اليدوية بالبيانات الحقيقية المؤكدة حديثًا وتحديث سعر التعادل T0 فورًا إلى ${data.trade.levelsPlan?.t0BreakEvenPrice} USDT!`,
          'success'
        );
        await fetchTrades();
      }
    } catch {
      showFeedback('فشل محاكاة وصول التكاليف الحقيقية', 'error');
    }
  };

  // Simulate X/Recovery execution for RANGE_BOT
  const handleSimulateRecovery = async (tradeId: string, levelIndex: number = 1) => {
    try {
      const res = await fetch(`/api/trades/${tradeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recovery', levelIndex }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback(
          `✓ تم تفعيل مستوى تعزيز X رقم ${levelIndex} وتحديث متوسط السعر وسعر التعادل T0 بنجاح!`,
          'success'
        );
        await fetchTrades();
      }
    } catch {
      showFeedback('فشل محاكاة تعزيز X', 'error');
    }
  };

  // Save modified X/Recovery settings for active trade
  const handleSaveXSettings = async (tradeId: string) => {
    try {
      setIsActionLoading(true);
      const res = await fetch(`/api/trades/${tradeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateXSettings',
          stepPercent: editStepPercent ? parseFloat(editStepPercent) : undefined,
          recoveryRatio: editRecoveryRatio ? parseFloat(editRecoveryRatio) : undefined,
          customAllocationQuote: editCustomAllocation ? parseFloat(editCustomAllocation) : undefined,
          maxLevels: editMaxLevels ? parseInt(editMaxLevels, 10) : null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback(
          '✓ تم حفظ وتحديث إعدادات مسار التعافي X بنجاح وتحديث أسعار ومبالغ المستويات القادمة فوراً',
          'success'
        );
        setIsEditingXSettings(false);
        await fetchTrades();
      } else {
        showFeedback(data.error || 'فشل تحديث إعدادات X', 'error');
      }
    } catch {
      showFeedback('فشل الاتصال لتحديث إعدادات X', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Generate the next recovery level dynamically on demand
  const handleGenerateNextLevel = async (tradeId: string) => {
    try {
      setIsActionLoading(true);
      const res = await fetch(`/api/trades/${tradeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generateNextRecoveryLevel' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback(
          data.nextLevel
            ? `✓ تم توليد المستوى التالي X${data.nextLevel.levelIndex} بسعر تفعيل ${data.nextLevel.triggerPrice} USDT بنجاح`
            : 'لم يتم توليد مستوى جديد (قد يكون تم بلوغ السقف الاختياري)',
          data.nextLevel ? 'success' : 'info'
        );
        await fetchTrades();
      } else {
        showFeedback(data.error || 'تعذر توليد المستوى التالي', 'error');
      }
    } catch {
      showFeedback('فشل الاتصال لتوليد المستوى التالي', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const activeTrades = trades.filter((t) => t.status === 'OPEN' || t.status === 'PENDING_ENTRY');
  const closedTrades = trades.filter((t) => t.status === 'CLOSED');
  const selectedTrade = trades.find((t) => t.tradeId === selectedTradeId);
  const plan = selectedTrade?.levelsPlan;
  const costConfig = selectedTrade?.costConfig;
  const recoveryPlan = selectedTrade?.xRecoveryPlan;
  const savedCostForManual = symbolCosts[manualSymbol.toUpperCase().trim()];

  // Open / Toggle edit form pre-populated with selected trade's active recovery plan
  const handleToggleEditXSettings = () => {
    if (!isEditingXSettings && recoveryPlan) {
      setEditStepPercent(recoveryPlan.stepPercent !== undefined ? String(recoveryPlan.stepPercent) : '');
      setEditRecoveryRatio(recoveryPlan.recoveryRatio !== undefined ? String(recoveryPlan.recoveryRatio) : '');
      setEditCustomAllocation(
        recoveryPlan.customAllocationQuote !== undefined ? String(recoveryPlan.customAllocationQuote) : ''
      );
      setEditMaxLevels(recoveryPlan.maxLevels ? String(recoveryPlan.maxLevels) : '');
    }
    setIsEditingXSettings((prev) => !prev);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Global Header & Architecture Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-100">
                مدير الصفقة (Trade Manager) — صفقات T و T0 والمسار العرضي X/Recovery
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium">
                Mock Mode النشط (صفر مفاتيح حقيقية)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              يدعم <strong>أي مبلغ موجب دون حد مصطنع (0.01 USDT أو أقل)</strong>، وأي نسبة موجبة أو سالبة لوقف الخسارة.
              دعم متكامل لـ <strong>DEAL_BOT</strong> و <strong>RANGE_BOT (تعزيز X)</strong> مع استبدال التكاليف الحقيقية تلقائيًا.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchTrades}
          disabled={isLoading || isActionLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>تحديث الصفقات</span>
        </button>
      </div>

      {/* 2. Action Feedback Toast */}
      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center gap-2.5 animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : feedback.type === 'warning'
              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
              : feedback.type === 'error'
              ? 'bg-red-950/60 border-red-500/40 text-red-300'
              : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
          }`}
        >
          {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {feedback.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          {feedback.type === 'info' && <Info className="w-4 h-4 text-indigo-400 shrink-0" />}
          <span className="font-medium leading-relaxed">{feedback.message}</span>
        </div>
      )}

      {/* 3. Top Row: Trade Creation Panel with Bot Type Toggle & X/Recovery Settings */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Plus className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-sm text-slate-100">
              إنشاء صفقة جديدة (يقبل أي مبالغ أو نسب دون حد أدنى)
            </h3>
          </div>

          {/* Bot Type Selection */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setBotType('DEAL_BOT')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                botType === 'DEAL_BOT'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              صفقة عادية (DEAL_BOT)
            </button>
            <button
              type="button"
              onClick={() => setBotType('RANGE_BOT')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1 ${
                botType === 'RANGE_BOT'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Repeat className="w-3 h-3" />
              <span>مسار عرضي (RANGE_BOT + X)</span>
            </button>
          </div>
        </div>

        {/* Saved Symbol Cost Badge */}
        {savedCostForManual && (
          <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-cyan-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                توجد بيانات تكلفة حقيقية محفوظة لـ <strong>{manualSymbol}</strong>: عمولة الدخول السابقة{' '}
                <strong>{savedCostForManual.lastConfirmedEntryFee} USDT</strong> ومعدل الخروج{' '}
                <strong>{(savedCostForManual.effectiveExitRate * 100).toFixed(2)}%</strong>.
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">
              تُطبق كافتراضي تلقائي
            </span>
          </div>
        )}

        <form onSubmit={handleCreateTrade} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Pair */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1">العملة / الزوج:</label>
              <input
                type="text"
                value={manualSymbol}
                onChange={(e) => setManualSymbol(e.target.value.toUpperCase())}
                placeholder="BTCUSDT"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            {/* Amount (Accepts ANY positive amount without artificial minimum) */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1">مبلغ الدخول (USDT):</label>
              <input
                type="number"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="مثال: 0.01 أو 100"
                step="any"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            {/* Entry Price */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1">سعر الدخول (اختياري / Market):</label>
              <input
                type="number"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder="سعر السوق اللحظي"
                step="any"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Step % (Accepts ANY positive percentage) */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1">مسافة أهداف T (%):</label>
              <input
                type="number"
                value={manualStep}
                onChange={(e) => setManualStep(e.target.value)}
                placeholder="مثال: 0.1 أو 2.0"
                step="any"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            {/* Initial Stop Loss % (Accepts negative or positive) */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1">وقف الخسارة الأولي (%):</label>
              <input
                type="number"
                value={manualStopLoss}
                onChange={(e) => setManualStopLoss(e.target.value)}
                placeholder="مثال: -2.5% أو 2.5%"
                step="any"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* RANGE_BOT X/Recovery Settings Sub-Panel */}
          {botType === 'RANGE_BOT' && (
            <div className="p-3 rounded-lg bg-purple-950/20 border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-purple-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 text-purple-400" />
                  <span>إعدادات المسار العرضي ومستويات تعزيز X (Recovery Grid):</span>
                </span>
                <span className="text-[10px] text-purple-400 font-mono">X/Recovery Active</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">نسبة هبوط المستوى (% Step):</label>
                  <input
                    type="number"
                    value={xStepPercent}
                    onChange={(e) => setXStepPercent(e.target.value)}
                    placeholder="مثال: 1.5 أو 0.5"
                    step="any"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">مضاعف حجم التعافي (Ratio):</label>
                  <input
                    type="number"
                    value={xRecoveryRatio}
                    onChange={(e) => setXRecoveryRatio(e.target.value)}
                    placeholder="مثال: 1.0 أو 1.2"
                    step="any"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">حجم تعزيز نقدي (USDT اختياري):</label>
                  <input
                    type="number"
                    value={xCustomAllocation}
                    onChange={(e) => setXCustomAllocation(e.target.value)}
                    placeholder="بديل المضاعف (مثال: 50)"
                    step="any"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">الحد الأقصى للمستويات (اختياري):</label>
                  <input
                    type="number"
                    value={xMaxLevels}
                    onChange={(e) => setXMaxLevels(e.target.value)}
                    placeholder="فارغ = غير محدود (مستمر)"
                    step="1"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Optional Initial Manual Cost Inputs (Pre-Trade) */}
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                <span>بيانات تكلفة يدوية أولية (اختيارية — حتى لا تتعطل الصفقة لحين توفر البيانات الحقيقية):</span>
              </span>
              <span className="text-[10px] text-slate-500">تستبدل تلقائيًا عند وصول البيانات الحقيقية</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">عمولة الدخول الأولية (USDT):</label>
                <input
                  type="number"
                  value={manualEntryFee}
                  onChange={(e) => setManualEntryFee(e.target.value)}
                  placeholder="مثال: 0.10 USDT"
                  step="any"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">معدل عمولة الخروج الأولي (%):</label>
                <input
                  type="number"
                  value={manualExitFeeRate}
                  onChange={(e) => setManualExitFeeRate(e.target.value)}
                  placeholder="مثال: 0.1%"
                  step="any"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>فتح الصفقة وبدء المتابعة</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* 4. Active Trades & T-Levels Detailed Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Active Trades List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="font-semibold text-slate-300">
              الصفقات المفتوحة ({activeTrades.length})
            </span>
            <span className="text-[10px] text-slate-500">حماية متحركة مستمرة</span>
          </div>

          {activeTrades.length === 0 ? (
            <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/40 text-center space-y-2">
              <Activity className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">لا توجد صفقات مفتوحة حاليًا</p>
              <p className="text-[11px] text-slate-500">
                أنشئ صفقة من الأعلى أو اختر أصلاً من الـ Scanner
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeTrades.map((t) => {
                const isSelected = t.tradeId === selectedTradeId;
                const rec = livePrices[t.symbol];
                const curPrice = rec?.price || t.entry.executionPrice || 0;
                const cost = t.costConfig;

                return (
                  <div
                    key={t.tradeId}
                    onClick={() => setSelectedTradeId(t.tradeId)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-900 border-indigo-500/60 shadow-lg ring-1 ring-indigo-500/30'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-slate-100">{t.symbol}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              t.botType === 'RANGE_BOT'
                                ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                                : t.source === 'SCANNER'
                                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {t.botType === 'RANGE_BOT' ? 'RANGE + X' : t.source === 'SCANNER' ? 'Scanner' : 'يدوي'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-2">
                          <span>دخول: {t.entry.executionPrice} USDT</span>
                          <span>•</span>
                          <span className="text-slate-200">{t.entry.requestedAmount} USDT</span>
                        </div>
                        {/* Cost source mini indicator */}
                        <div className="mt-1 flex items-center gap-1">
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-medium ${
                              cost?.source === 'REAL_CONFIRMED_RECENT'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : cost?.source === 'REAL_CONFIRMED_SAVED'
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {cost?.source === 'REAL_CONFIRMED_RECENT'
                              ? 'حقيقي مؤكد حديثًا'
                              : cost?.source === 'REAL_CONFIRMED_SAVED'
                              ? 'حقيقي محفوظ للعملة'
                              : 'بيانات يدوية'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {t.levelsPlan?.currentAchievedLevel || 'OPEN'}
                        </span>
                        <div className="font-mono text-xs font-bold text-slate-200 mt-1">
                          {curPrice ? `${curPrice.toFixed(curPrice > 100 ? 2 : 4)}` : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Selected Trade Detailed Plan & Live Ladder (8 cols) */}
        <div className="lg:col-span-8">
          {selectedTrade && plan ? (
            <div className="space-y-4">
              {/* Card 1: Key Level Indicators Bar */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-100">
                        صفقة {selectedTrade.symbol} ({selectedTrade.tradeId})
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {selectedTrade.status}
                      </span>
                      {selectedTrade.botType === 'RANGE_BOT' && (
                        <span className="text-xs px-2 py-0.5 rounded font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          مسار عرضي (RANGE)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      متوسط سعر الدخول: {selectedTrade.entry.executionPrice} USDT • الكمية الإجمالية:{' '}
                      {selectedTrade.entry.filledQuantity} • أمر الدخول: {selectedTrade.entry.orderId}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCloseTrade(selectedTrade.tradeId)}
                      disabled={isActionLoading}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-slate-100 font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
                    >
                      إغلاق فوري للصفقة
                    </button>
                  </div>
                </div>

                {/* Summary Banner: Current Achieved Level & Net PnL */}
                {(() => {
                  const stepDelta = plan.entryPrice * (plan.stepPercent / 100);
                  const highestAchievedT =
                    plan.currentAchievedLevel.startsWith('T') && plan.currentAchievedLevel !== 'T1_MINUS_50'
                      ? parseInt(plan.currentAchievedLevel.replace('T', ''), 10)
                      : plan.currentAchievedLevel === 'T1_MINUS_50'
                      ? 0.5
                      : 0;

                  const currentExitFee = plan.activeProtectionPrice * plan.filledQuantity * plan.exitCommissionRate;
                  const currentGross = (plan.activeProtectionPrice - plan.entryPrice) * plan.filledQuantity;
                  const currentNetQuote = Number((currentGross - (plan.entryCommissionQuote + currentExitFee)).toFixed(4));
                  const currentInvested = plan.entryPrice * plan.filledQuantity;
                  const currentNetPercent = currentInvested > 0 ? Number(((currentNetQuote / currentInvested) * 100).toFixed(2)) : 0;

                  const nextTIndex = highestAchievedT === 0 ? 1 : Math.floor(highestAchievedT) + 1;
                  const nextTargetPrice = Number((plan.entryPrice + nextTIndex * stepDelta).toFixed(8));
                  const nextExitFee = nextTargetPrice * plan.filledQuantity * plan.exitCommissionRate;
                  const nextGross = (nextTargetPrice - plan.entryPrice) * plan.filledQuantity;
                  const nextNetQuote = Number((nextGross - (plan.entryCommissionQuote + nextExitFee)).toFixed(4));
                  const nextNetPercent = currentInvested > 0 ? Number(((nextNetQuote / currentInvested) * 100).toFixed(2)) : 0;

                  return (
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-slate-400">المستوى الحالي المحقق:</span>
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                          {plan.currentAchievedLevel}
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">الربح الصافي في المستوى الحالي (عند الحماية بعد خصم كافة العمولات):</span>
                        <span
                          className={`font-mono font-bold ${
                            currentNetQuote >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {currentNetQuote >= 0 ? `+${currentNetQuote}` : currentNetQuote} USDT ({currentNetPercent >= 0 ? `+${currentNetPercent}` : currentNetPercent}%)
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px] bg-slate-900 px-2.5 py-1 rounded border border-slate-800 shrink-0">
                        <span className="text-cyan-400 font-bold">الهدف التالي المنتظر: T{nextTIndex}</span>
                        <span>({nextTargetPrice} USDT)</span>
                        <span className="text-emerald-400 font-bold">
                          +{nextNetQuote} USDT (+{nextNetPercent}%)
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Mathematical Levels Grid: Dynamic T0, T1-50%, T1, T2, T3 ... Tn */}
                {(() => {
                  const stepDelta = plan.entryPrice * (plan.stepPercent / 100);
                  const highestAchievedT =
                    plan.currentAchievedLevel.startsWith('T') && plan.currentAchievedLevel !== 'T1_MINUS_50'
                      ? parseInt(plan.currentAchievedLevel.replace('T', ''), 10)
                      : plan.currentAchievedLevel === 'T1_MINUS_50'
                      ? 0.5
                      : 0;

                  // Dynamically display up to highest achieved + 2 levels (at least up to T4)
                  const maxTToDisplay = Math.max(4, Math.floor(highestAchievedT) + 2);
                  const currentInvested = plan.entryPrice * plan.filledQuantity;

                  const currentExitFee = plan.activeProtectionPrice * plan.filledQuantity * plan.exitCommissionRate;
                  const currentGross = (plan.activeProtectionPrice - plan.entryPrice) * plan.filledQuantity;
                  const currentNetQuote = Number((currentGross - (plan.entryCommissionQuote + currentExitFee)).toFixed(4));
                  const currentNetPercent = currentInvested > 0 ? Number(((currentNetQuote / currentInvested) * 100).toFixed(2)) : 0;

                  // T0 PnL
                  const t0ExitFee = plan.t0BreakEvenPrice * plan.filledQuantity * plan.exitCommissionRate;
                  const t0Gross = (plan.t0BreakEvenPrice - plan.entryPrice) * plan.filledQuantity;
                  const t0NetQuote = Number((t0Gross - (plan.entryCommissionQuote + t0ExitFee)).toFixed(4));

                  // T1-50% PnL
                  const t1Minus50ExitFee = plan.t1Minus50Price * plan.filledQuantity * plan.exitCommissionRate;
                  const t1Minus50Gross = (plan.t1Minus50Price - plan.entryPrice) * plan.filledQuantity;
                  const t1Minus50NetQuote = Number((t1Minus50Gross - (plan.entryCommissionQuote + t1Minus50ExitFee)).toFixed(4));
                  const t1Minus50NetPercent = currentInvested > 0 ? Number(((t1Minus50NetQuote / currentInvested) * 100).toFixed(2)) : 0;

                  const dynamicCards = [];

                  // 1. T0 Card
                  dynamicCards.push(
                    <div
                      key="T0"
                      className={`p-2.5 rounded-lg border ${
                        plan.currentAchievedLevel === 'T1_MINUS_50'
                          ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/30 text-amber-200'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 font-bold">
                        <span>T0 (التعادل)</span>
                        <span className="text-[9px] text-slate-500">Net ~0%</span>
                      </div>
                      <div className="font-mono font-bold text-xs mt-1 text-emerald-400">
                        {plan.t0BreakEvenPrice}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-1 font-mono">
                        صافي: {t0NetQuote >= 0 ? `+${t0NetQuote}` : t0NetQuote} USDT
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">شامل التكاليف</div>
                    </div>
                  );

                  // 2. T1 - 50% Card
                  dynamicCards.push(
                    <div
                      key="T1_MINUS_50"
                      className={`p-2.5 rounded-lg border ${
                        plan.currentAchievedLevel === 'T1_MINUS_50'
                          ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/30 text-indigo-200'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 font-bold">
                        <span>T1 − 50%</span>
                        {plan.currentAchievedLevel === 'T1_MINUS_50' && (
                          <span className="text-[9px] text-indigo-300 font-bold">الحالي ★</span>
                        )}
                      </div>
                      <div className="font-mono font-bold text-xs mt-1 text-cyan-300">
                        {plan.t1Minus50Price}
                      </div>
                      <div className="text-[9px] text-emerald-400 mt-1 font-mono font-bold">
                        صافي: +{t1Minus50NetQuote} USDT (+{t1Minus50NetPercent}%)
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">الحماية: T0</div>
                    </div>
                  );

                  // 3. Dynamic T1 ... Tk Cards
                  for (let k = 1; k <= maxTToDisplay; k++) {
                    const targetPrice = Number((plan.entryPrice + k * stepDelta).toFixed(8));
                    const protectionPrice = k === 1 ? plan.t1Minus50Price : Number((plan.entryPrice + (k - 1) * stepDelta).toFixed(8));
                    const levelExitFee = targetPrice * plan.filledQuantity * plan.exitCommissionRate;
                    const levelGross = (targetPrice - plan.entryPrice) * plan.filledQuantity;
                    const levelNetQuote = Number((levelGross - (plan.entryCommissionQuote + levelExitFee)).toFixed(4));
                    const levelNetPercent = currentInvested > 0 ? Number(((levelNetQuote / currentInvested) * 100).toFixed(2)) : 0;

                    const isCurrent = plan.currentAchievedLevel === `T${k}`;
                    const isAchieved = highestAchievedT >= k;
                    const isNext = (highestAchievedT === 0 && k === 1 && plan.currentAchievedLevel !== 'T1_MINUS_50') || (highestAchievedT === k - 1);

                    dynamicCards.push(
                      <div
                        key={`T${k}`}
                        className={`p-2.5 rounded-lg border ${
                          isCurrent
                            ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/30 text-indigo-200'
                            : isAchieved
                            ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                            : isNext
                            ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                          <span className="text-slate-300">T{k} (+{(plan.stepPercent * k).toFixed(1)}%)</span>
                          {isCurrent ? (
                            <span className="text-[9px] text-indigo-300 font-bold">النشط ★</span>
                          ) : isAchieved ? (
                            <span className="text-[9px] text-emerald-400 font-bold">محقق ✓</span>
                          ) : isNext ? (
                            <span className="text-[9px] text-cyan-400 font-bold">التالي ⏳</span>
                          ) : null}
                        </div>
                        <div className="font-mono font-bold text-xs mt-1 text-slate-100">
                          {targetPrice}
                        </div>
                        <div className="text-[9px] text-emerald-400 mt-1 font-mono font-bold">
                          صافي: +{levelNetQuote} USDT (+{levelNetPercent}%)
                        </div>
                        <div className="text-[9px] text-slate-500 mt-0.5">
                          الحماية: {k === 1 ? 'T1-50%' : `T${k - 1}`} ({protectionPrice})
                        </div>
                      </div>
                    );
                  }

                  // 4. Active Protection Card
                  dynamicCards.push(
                    <div key="activeProt" className="p-2.5 rounded-lg border bg-amber-950/30 border-amber-500/40 text-amber-300">
                      <div className="text-[10px] font-mono font-bold flex items-center justify-between">
                        <span>الحماية النشطة</span>
                        <Shield className="w-3 h-3 text-amber-400" />
                      </div>
                      <div className="font-mono font-bold text-xs mt-1">
                        {plan.activeProtectionPrice}
                      </div>
                      <div
                        className={`text-[9px] font-mono mt-1 font-bold ${
                          currentNetQuote >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        صافي الخروج: {currentNetQuote >= 0 ? `+${currentNetQuote}` : currentNetQuote} USDT ({currentNetPercent >= 0 ? `+${currentNetPercent}` : currentNetPercent}%)
                      </div>
                      <div className="text-[9px] text-amber-400/80 mt-0.5">مستوى البيع الحالي</div>
                    </div>
                  );

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-center text-xs">
                      {dynamicCards}
                    </div>
                  );
                })()}

                {/* Simulation Controls */}
                <div className="pt-3 border-t border-slate-800">
                  <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                    <span>محاكاة تحرك السعر وفحص سلوك الحماية (Sandbox Testing):</span>
                    <span className="text-[10px] text-slate-500">Zero Real Binance Calls</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleSimulateTick(selectedTrade.tradeId, plan.t1Minus50Price)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-mono"
                    >
                      بلوغ T1-50% ({plan.t1Minus50Price})
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSimulateTick(selectedTrade.tradeId, plan.t1Price)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs font-mono"
                    >
                      بلوغ T1 ({plan.t1Price})
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSimulateTick(selectedTrade.tradeId, plan.t2Price)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs font-mono"
                    >
                      بلوغ T2 ({plan.t2Price})
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const stepDelta = plan.entryPrice * (plan.stepPercent / 100);
                        const highestAchievedT =
                          plan.currentAchievedLevel.startsWith('T') && plan.currentAchievedLevel !== 'T1_MINUS_50'
                            ? parseInt(plan.currentAchievedLevel.replace('T', ''), 10)
                            : 0;
                        const nextTarget = Math.max(3, highestAchievedT + 1);
                        const nextPrice = Number((plan.entryPrice + nextTarget * stepDelta).toFixed(8));
                        handleSimulateTick(selectedTrade.tradeId, nextPrice);
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 text-xs font-mono"
                    >
                      بلوغ المستوى التالي (+)
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSimulateTick(selectedTrade.tradeId, plan.activeProtectionPrice)}
                      className="px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold"
                    >
                      كسر الحماية الحالية ({plan.activeProtectionPrice})
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Cost Data System & Real Confirmed Cost Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-slate-200">
                      نظام بيانات التكاليف ومصدرها الحقيقي (Cost Data System):
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded font-mono font-bold text-[10px] border ${
                      costConfig?.source === 'REAL_CONFIRMED_RECENT'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : costConfig?.source === 'REAL_CONFIRMED_SAVED'
                        ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    المصدر: {costConfig?.source}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-slate-300">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">عمولة الدخول المعتمدة:</span>
                    <span className="font-bold text-slate-200">{plan.entryCommissionQuote} USDT</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      معدل الدخول: {(costConfig?.entryCostRate ? costConfig.entryCostRate * 100 : 0.1).toFixed(4)}%
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">معدل عمولة الخروج:</span>
                    <span className="font-bold text-slate-200">
                      {(plan.exitCommissionRate * 100).toFixed(4)}%
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {costConfig?.isRealConfirmed ? 'معدل حقيقي مؤكد' : 'معدل يدوي أولي'}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">سعر التعادل الصافي T0:</span>
                    <span className="font-bold text-emerald-400">{plan.t0BreakEvenPrice} USDT</span>
                    <span className="text-[10px] text-emerald-500 block mt-0.5">
                      محسوب بالكامل بعد التكاليف
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-slate-300 font-semibold block">{costConfig?.description}</span>
                    <span className="text-[10px] text-slate-500">
                      القاعدة: إذا توفرت بيانات حقيقية جديدة، تستبدل اليدوية فورًا ويعاد حساب T0 للصفقة المفتوحة.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSimulateRealCostArrival(selectedTrade.tradeId)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-[10px] font-bold shrink-0 transition-colors"
                  >
                    محاكاة وصول بيانات حقيقية وتحديث T0
                  </button>
                </div>
              </div>

              {/* Card 3: X/Recovery Engine Card for RANGE_BOT */}
              {recoveryPlan && (
                <div className="bg-slate-900/80 border border-purple-500/40 rounded-xl p-4 space-y-4 text-xs">
                  {/* Calculations for Current Position & Executed Levels */}
                  {(() => {
                    const currentMarketPrice =
                      livePrices[selectedTrade.symbol]?.price ||
                      plan.lastEvaluatedPrice ||
                      selectedTrade.entry.executionPrice ||
                      1;
                    const exitRate = plan.exitCommissionRate;

                    // Base entry initial level
                    const baseEntryQty: number =
                      recoveryPlan.baseEntryPrice > 0
                        ? Number((recoveryPlan.baseEntryAmount / recoveryPlan.baseEntryPrice).toFixed(8))
                        : (selectedTrade.entry.filledQuantity || 0);
                    const baseEntryExitFee = Number((currentMarketPrice * baseEntryQty * exitRate).toFixed(4));
                    const baseGross = (currentMarketPrice - recoveryPlan.baseEntryPrice) * baseEntryQty;
                    const baseNetQuote = Number((baseGross - (plan.entryCommissionQuote + baseEntryExitFee)).toFixed(4));
                    const baseNetPct =
                      recoveryPlan.baseEntryAmount > 0
                        ? Number(((baseNetQuote / recoveryPlan.baseEntryAmount) * 100).toFixed(2))
                        : 0;

                    const executedXLevels = recoveryPlan.levels.filter((l) => l.status === 'EXECUTED');
                    const lastExecutedLvl = executedXLevels[executedXLevels.length - 1];

                    // Combined metrics (Base + all executed recoveries)
                    let totalInvestedAll = recoveryPlan.baseEntryAmount;
                    let totalQtyAll = baseEntryQty;
                    let totalBuyFeesAll = plan.entryCommissionQuote;
                    let totalExitFeesAll = baseEntryExitFee;
                    let totalNetQuoteAll = baseNetQuote;

                    // Only executed recovery levels metrics for the executed recovery summary
                    let totalRecoveryExecutedSpent = 0;
                    let totalRecoveryExecutedQty = 0;
                    let totalRecoveryExecutedBuyFees = 0;
                    let totalRecoveryExecutedExitFees = 0;
                    let totalRecoveryExecutedNetQuote = 0;

                    const executedRows = [
                      {
                        label: 'مستوى الدخول الأساسي (Base Entry)',
                        levelIndex: 0,
                        fillPrice: recoveryPlan.baseEntryPrice,
                        filledQty: baseEntryQty,
                        investedQuote: recoveryPlan.baseEntryAmount,
                        feePaid: plan.entryCommissionQuote,
                        exitFee: baseEntryExitFee,
                        netQuote: baseNetQuote,
                        netPercent: baseNetPct,
                        time: selectedTrade.openedAt || selectedTrade.createdAt,
                        orderId: selectedTrade.entry.orderId || '—',
                      },
                    ];

                    executedXLevels.forEach((lvl) => {
                      const fillPrice = lvl.fillPrice || lvl.triggerPrice;
                      const filledQty = lvl.filledQty || Number((lvl.allocationQuote / fillPrice).toFixed(8));
                      const invested = Number((fillPrice * filledQty).toFixed(4));
                      const buyFee = lvl.feePaid !== undefined ? lvl.feePaid : Number((invested * selectedTrade.costConfig.entryCostRate).toFixed(4));
                      const exitFee = Number((currentMarketPrice * filledQty * exitRate).toFixed(4));
                      const gross = (currentMarketPrice - fillPrice) * filledQty;
                      const netQuote = Number((gross - (buyFee + exitFee)).toFixed(4));
                      const netPercent = invested > 0 ? Number(((netQuote / invested) * 100).toFixed(2)) : 0;

                      totalInvestedAll += invested;
                      totalQtyAll += filledQty;
                      totalBuyFeesAll += buyFee;
                      totalExitFeesAll += exitFee;
                      totalNetQuoteAll += netQuote;

                      totalRecoveryExecutedSpent += invested;
                      totalRecoveryExecutedQty += filledQty;
                      totalRecoveryExecutedBuyFees += buyFee;
                      totalRecoveryExecutedExitFees += exitFee;
                      totalRecoveryExecutedNetQuote += netQuote;

                      executedRows.push({
                        label: `مستوى تعزيز X${lvl.levelIndex}`,
                        levelIndex: lvl.levelIndex,
                        fillPrice,
                        filledQty,
                        investedQuote: invested,
                        feePaid: buyFee,
                        exitFee,
                        netQuote,
                        netPercent,
                        time: lvl.executedAt || Date.now(),
                        orderId: lvl.orderId || '—',
                      });
                    });

                    totalNetQuoteAll = Number(totalNetQuoteAll.toFixed(4));
                    const totalNetPercentAll =
                      totalInvestedAll > 0 ? Number(((totalNetQuoteAll / totalInvestedAll) * 100).toFixed(2)) : 0;

                    totalRecoveryExecutedNetQuote = Number(totalRecoveryExecutedNetQuote.toFixed(4));
                    const totalRecoveryExecutedNetPercent =
                      totalRecoveryExecutedSpent > 0
                        ? Number(((totalRecoveryExecutedNetQuote / totalRecoveryExecutedSpent) * 100).toFixed(2))
                        : 0;

                    const nextPendingX = recoveryPlan.levels.find((l) => l.status === 'PENDING');

                    return (
                      <>
                        {/* Header & Level Counter (No fixed /3 ceiling!) */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-500/20 pb-3">
                          <div className="flex items-center gap-2">
                            <Repeat className="w-5 h-5 text-purple-400 shrink-0" />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-purple-200">
                                  مسار تعزيز X ومستويات التعافي (RANGE_BOT Recovery):
                                </span>
                                <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                                  عدد المستويات المنفذة: {recoveryPlan.executedLevelsCount}{' '}
                                  {recoveryPlan.maxLevels ? `(سقف اختياري: ${recoveryPlan.maxLevels})` : '(توليد مستمر بلا سقف)'}
                                </span>
                              </div>
                              <p className="text-[10px] text-purple-300/70 font-mono mt-0.5">
                                مجموع صافي أرباح/خسائر المستويات المنفذة بالكامل:{' '}
                                <span
                                  className={`font-bold ${
                                    totalNetQuoteAll >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {totalNetQuoteAll >= 0 ? `+${totalNetQuoteAll}` : totalNetQuoteAll} USDT (
                                  {totalNetPercentAll >= 0 ? `+${totalNetPercentAll}` : totalNetPercentAll}%)
                                </span>{' '}
                                بعد خصم جميع عمولات البيع والشراء
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleGenerateNextLevel(selectedTrade.tradeId)}
                              disabled={isActionLoading}
                              className="px-2.5 py-1 rounded bg-purple-950/70 hover:bg-purple-900 text-purple-300 border border-purple-500/40 text-[10px] font-bold flex items-center gap-1 transition-colors"
                              title="توليد المستوى التالي في المصفوفة ديناميكياً"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>توليد المستوى التالي</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleToggleEditXSettings}
                              className="px-2.5 py-1 rounded bg-purple-900/50 hover:bg-purple-800 text-purple-300 border border-purple-500/30 text-[10px] flex items-center gap-1 transition-colors font-bold"
                            >
                              <Sliders className="w-3 h-3 text-purple-400" />
                              <span>تعديل إعدادات X</span>
                            </button>
                          </div>
                        </div>

                        {/* In-line X Settings Editor Panel */}
                        {isEditingXSettings && (
                          <div className="p-3 bg-purple-950/40 border border-purple-500/50 rounded-lg space-y-2.5 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between text-purple-200 font-bold text-xs">
                              <span className="flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                                <span>تعديل إعدادات مسار التعافي X للصفقة المفتوحة:</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsEditingXSettings(false)}
                                className="text-slate-400 hover:text-slate-200"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-slate-400 text-[10px] mb-1">
                                  نسبة فرق الهبوط بين المستويات (% Step):
                                </label>
                                <input
                                  type="number"
                                  value={editStepPercent}
                                  onChange={(e) => setEditStepPercent(e.target.value)}
                                  placeholder="مثال: 1.5 أو 0.5"
                                  step="any"
                                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono text-xs focus:border-purple-500"
                                />
                              </div>

                              <div>
                                <label className="block text-slate-400 text-[10px] mb-1">
                                  مضاعف حجم التعافي (Ratio):
                                </label>
                                <input
                                  type="number"
                                  value={editRecoveryRatio}
                                  onChange={(e) => setEditRecoveryRatio(e.target.value)}
                                  placeholder="مثال: 1.0 أو 1.2"
                                  step="any"
                                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono text-xs focus:border-purple-500"
                                />
                              </div>

                              <div>
                                <label className="block text-slate-400 text-[10px] mb-1">
                                  حجم تعزيز نقدي مباشر (USDT اختياري):
                                </label>
                                <input
                                  type="number"
                                  value={editCustomAllocation}
                                  onChange={(e) => setEditCustomAllocation(e.target.value)}
                                  placeholder="بديل المضاعف (مثال: 50)"
                                  step="any"
                                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono text-xs focus:border-purple-500"
                                />
                              </div>

                              <div>
                                <label className="block text-slate-400 text-[10px] mb-1">
                                  الحد الأقصى للمستويات (اختياري):
                                </label>
                                <input
                                  type="number"
                                  value={editMaxLevels}
                                  onChange={(e) => setEditMaxLevels(e.target.value)}
                                  placeholder="فارغ = غير محدود"
                                  step="1"
                                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono text-xs focus:border-purple-500"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-purple-500/20">
                              <button
                                type="button"
                                onClick={() => setIsEditingXSettings(false)}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                              >
                                إلغاء
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveXSettings(selectedTrade.tradeId)}
                                disabled={isActionLoading}
                                className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-slate-100 font-bold text-xs flex items-center gap-1 transition-colors"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>حفظ وتحديث المستويات فوراً</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Current Position / Level Overview Card (صافي الربح بالضبط بعد خصم عمولات البيع والشراء) */}
                        <div className="p-3 rounded-lg bg-slate-950/90 border border-purple-500/30 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-purple-200 border-b border-slate-800 pb-1.5">
                            <span className="flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 text-purple-400" />
                              <span>المستوى الحالي للمركز / الصفقة (Current Position Level):</span>
                            </span>
                            <span className="font-mono text-[10px] text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                              المستوى النشط:{' '}
                              {lastExecutedLvl
                                ? `مستوى تعزيز X${lastExecutedLvl.levelIndex} (مكتمل)`
                                : 'مستوى الأساس الأولي (قبل التعزيز)'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 font-mono text-slate-300">
                            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                              <span className="text-slate-500 block text-[10px]">متوسط سعر الدخول المرجّح:</span>
                              <span className="font-bold text-purple-300 text-xs">
                                {recoveryPlan.averageEntryPrice} USDT
                              </span>
                              <span className="text-[9px] text-slate-500 block mt-0.5">
                                الأساس: {recoveryPlan.baseEntryPrice} USDT
                              </span>
                            </div>

                            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                              <span className="text-slate-500 block text-[10px]">إجمالي رأس المال المستثمر:</span>
                              <span className="font-bold text-slate-200 text-xs">
                                {totalInvestedAll.toFixed(4)} USDT
                              </span>
                              <span className="text-[9px] text-slate-500 block mt-0.5">
                                تعزيز: {recoveryPlan.totalRecoverySpent.toFixed(4)} USDT
                              </span>
                            </div>

                            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                              <span className="text-slate-500 block text-[10px]">الكمية الإجمالية المجمعة:</span>
                              <span className="font-bold text-slate-200 text-xs">
                                {totalQtyAll.toFixed(6)}
                              </span>
                              <span className="text-[9px] text-slate-500 block mt-0.5">
                                تعزيز: {recoveryPlan.totalRecoveryQty.toFixed(6)}
                              </span>
                            </div>

                            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-purple-500/40 ring-1 ring-purple-500/20">
                              <span className="text-slate-400 block text-[10px] font-bold">
                                الربح الصافي الحالي بالضبط (صافي بعد العمولات):
                              </span>
                              <span
                                className={`font-bold text-xs block mt-0.5 ${
                                  totalNetQuoteAll >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {totalNetQuoteAll >= 0 ? `+${totalNetQuoteAll}` : totalNetQuoteAll} USDT (
                                {totalNetPercentAll >= 0 ? `+${totalNetPercentAll}` : totalNetPercentAll}%)
                              </span>
                              <span className="text-[9px] text-slate-500 block mt-0.5">
                                خصم الشراء: -{totalBuyFeesAll.toFixed(4)} • خصم البيع: -{totalExitFeesAll.toFixed(4)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Next Upcoming Recovery Level Banner */}
                        {nextPendingX ? (
                          (() => {
                            const isReady = currentMarketPrice <= nextPendingX.triggerPrice;
                            const dropPct = (nextPendingX.levelIndex * recoveryPlan.stepPercent).toFixed(2);
                            const gapPct = (
                              ((currentMarketPrice - nextPendingX.triggerPrice) / currentMarketPrice) *
                              100
                            ).toFixed(2);

                            return (
                              <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                    المستوى التالي المنتظر: X{nextPendingX.levelIndex}
                                  </span>
                                  <span className="font-mono text-slate-300">
                                    سعر التفعيل:{' '}
                                    <span className="font-bold text-purple-200">
                                      {nextPendingX.triggerPrice} USDT
                                    </span>{' '}
                                    (-{dropPct}%)
                                  </span>
                                  <span className="text-slate-500">•</span>
                                  <span className="font-mono text-slate-300">
                                    حجم التعزيز المرتبط:{' '}
                                    <span className="font-bold text-slate-100">
                                      {nextPendingX.allocationQuote} USDT
                                    </span>
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {isReady ? (
                                    <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                                      جاهز للتنفيذ (READY)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono text-slate-400">
                                      فارق السعر: {gapPct}% للوصول
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSimulateRecovery(selectedTrade.tradeId, nextPendingX.levelIndex)
                                    }
                                    className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-slate-100 text-[10px] font-bold font-mono transition-colors shadow-sm"
                                  >
                                    تفعيل شراء X{nextPendingX.levelIndex}
                                  </button>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                            <span>لا توجد مستويات معلقة حالياً في قائمة الانتظار.</span>
                            <button
                              type="button"
                              onClick={() => handleGenerateNextLevel(selectedTrade.tradeId)}
                              className="text-purple-300 hover:text-purple-200 font-bold underline"
                            >
                              + توليد مستوى تعزيز جديد
                            </button>
                          </div>
                        )}

                        {/* Executed Levels Section with Exact Net Profit/Loss (cash & %) after buy & sell commissions */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-200 border-b border-slate-800 pb-1">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>
                                المستويات المنفذة وصافي الربح فيها بالضبط بعد خصم العمولات ({executedRows.length}):
                              </span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              مجموع صافي المنفذ:{' '}
                              <span
                                className={`font-bold ${
                                  totalNetQuoteAll >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {totalNetQuoteAll >= 0 ? `+${totalNetQuoteAll}` : totalNetQuoteAll} USDT (
                                {totalNetPercentAll >= 0 ? `+${totalNetPercentAll}` : totalNetPercentAll}%)
                              </span>
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-lg border border-slate-800">
                            <table className="w-full text-right text-xs">
                              <thead className="bg-slate-950 text-slate-400 font-semibold text-[11px] border-b border-slate-800">
                                <tr>
                                  <th className="py-2 px-2.5">المستوى المنفذ</th>
                                  <th className="py-2 px-2.5">سعر التنفيذ الفعلي</th>
                                  <th className="py-2 px-2.5">الكمية المنفذة</th>
                                  <th className="py-2 px-2.5">المبلغ المستثمر</th>
                                  <th className="py-2 px-2.5">خصم عمولة الشراء</th>
                                  <th className="py-2 px-2.5">خصم عمولة البيع (تقديري)</th>
                                  <th className="py-2 px-2.5">صافي الربح بالضبط (نقداً ونسبة)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60 font-mono">
                                {executedRows.map((row) => (
                                  <tr key={row.levelIndex} className="hover:bg-slate-800/30">
                                    <td className="py-2 px-2.5 font-bold text-slate-200">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                                        <span>{row.label}</span>
                                      </div>
                                    </td>
                                    <td className="py-2 px-2.5 text-slate-200 font-bold">{row.fillPrice} USDT</td>
                                    <td className="py-2 px-2.5 text-slate-300">{row.filledQty}</td>
                                    <td className="py-2 px-2.5 text-slate-300">{row.investedQuote.toFixed(4)} USDT</td>
                                    <td className="py-2 px-2.5 text-rose-300/80">-{row.feePaid.toFixed(4)} USDT</td>
                                    <td className="py-2 px-2.5 text-rose-300/80">-{row.exitFee.toFixed(4)} USDT</td>
                                    <td className="py-2 px-2.5 font-bold">
                                      <span
                                        className={row.netQuote >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                                      >
                                        {row.netQuote >= 0 ? `+${row.netQuote}` : row.netQuote} USDT (
                                        {row.netPercent >= 0 ? `+${row.netPercent}` : row.netPercent}%)
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                                {/* Total Row */}
                                <tr className="bg-slate-950 font-bold text-slate-100 border-t-2 border-slate-700">
                                  <td className="py-2 px-2.5 text-purple-300">
                                    مجموع المستويات المنفذة بالكامل ({executedRows.length})
                                  </td>
                                  <td className="py-2 px-2.5 text-purple-300">{recoveryPlan.averageEntryPrice} USDT (مرجّح)</td>
                                  <td className="py-2 px-2.5 text-slate-200">{totalQtyAll.toFixed(6)}</td>
                                  <td className="py-2 px-2.5 text-slate-200">{totalInvestedAll.toFixed(4)} USDT</td>
                                  <td className="py-2 px-2.5 text-rose-400">-{totalBuyFeesAll.toFixed(4)} USDT</td>
                                  <td className="py-2 px-2.5 text-rose-400">-{totalExitFeesAll.toFixed(4)} USDT</td>
                                  <td className="py-2 px-2.5">
                                    <span
                                      className={`text-xs ${
                                        totalNetQuoteAll >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                      }`}
                                    >
                                      {totalNetQuoteAll >= 0 ? `+${totalNetQuoteAll}` : totalNetQuoteAll} USDT (
                                      {totalNetPercentAll >= 0 ? `+${totalNetPercentAll}` : totalNetPercentAll}%)
                                    </span>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Dynamic Recovery Levels Table: All executed + pending generated levels without pre-allocated limit */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-200 border-b border-slate-800 pb-1">
                            <span className="flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-purple-400" />
                              <span>جدول مصفوفة مسار X بالكامل (توليد ديناميكي مستمر):</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              إجمالي المستويات في المصفوفة: {recoveryPlan.levels.length}
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-lg border border-slate-800">
                            <table className="w-full text-right text-xs">
                              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px]">
                                <tr>
                                  <th className="py-2 px-2.5">مستوى X</th>
                                  <th className="py-2 px-2.5">نسبة الهبوط للتفعيل</th>
                                  <th className="py-2 px-2.5">سعر التفعيل</th>
                                  <th className="py-2 px-2.5">حجم التعزيز</th>
                                  <th className="py-2 px-2.5">الحالة</th>
                                  <th className="py-2 px-2.5">صافي الربح / تفاصيل المستوى</th>
                                  <th className="py-2 px-2.5">إجراء</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60 font-mono">
                                {recoveryPlan.levels.map((lvl) => {
                                  const isReady =
                                    lvl.status === 'PENDING' && currentMarketPrice <= lvl.triggerPrice;
                                  const dropPct = (lvl.levelIndex * recoveryPlan.stepPercent).toFixed(2);

                                  // Calculate net profit for executed level at current market price after both commissions
                                  let executedNetText = '—';
                                  if (lvl.status === 'EXECUTED' && lvl.fillPrice && lvl.filledQty) {
                                    const exitFee = currentMarketPrice * lvl.filledQty * plan.exitCommissionRate;
                                    const gross = (currentMarketPrice - lvl.fillPrice) * lvl.filledQty;
                                    const netQuote = Number((gross - ((lvl.feePaid || 0) + exitFee)).toFixed(4));
                                    const cost = lvl.fillPrice * lvl.filledQty;
                                    const netPct = cost > 0 ? Number(((netQuote / cost) * 100).toFixed(2)) : 0;
                                    executedNetText = `${
                                      netQuote >= 0 ? `+${netQuote}` : netQuote
                                    } USDT (${netPct >= 0 ? `+${netPct}` : netPct}%)`;
                                  }

                                  return (
                                    <tr key={lvl.levelIndex} className="hover:bg-slate-800/30">
                                      <td className="py-2 px-2.5 font-bold text-purple-300">
                                        مستوى X{lvl.levelIndex}
                                      </td>
                                      <td className="py-2 px-2.5 text-slate-400">-{dropPct}%</td>
                                      <td className="py-2 px-2.5 text-slate-200 font-bold">
                                        {lvl.triggerPrice} USDT
                                      </td>
                                      <td className="py-2 px-2.5 text-slate-300">{lvl.allocationQuote} USDT</td>
                                      <td className="py-2 px-2.5">
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                            lvl.status === 'EXECUTED'
                                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                              : isReady
                                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                                          }`}
                                        >
                                          {lvl.status === 'EXECUTED'
                                            ? 'منفّذ (EXECUTED)'
                                            : isReady
                                            ? 'جاهز (READY)'
                                            : 'منتظر (PENDING)'}
                                        </span>
                                      </td>
                                      <td className="py-2 px-2.5">
                                        {lvl.status === 'EXECUTED' ? (
                                          <div className="space-y-0.5 text-[10px]">
                                            <div className="text-slate-300">
                                              سعر: {lvl.fillPrice} • كمية: {lvl.filledQty}
                                            </div>
                                            <div
                                              className={`font-bold ${
                                                executedNetText.startsWith('+')
                                                  ? 'text-emerald-400'
                                                  : 'text-slate-300'
                                              }`}
                                            >
                                              صافي المستوى: {executedNetText}
                                            </div>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] text-slate-500">
                                            {isReady
                                              ? 'وصل السعر إلى نطاق التفعيل'
                                              : `في انتظار هبوط السعر (${(((currentMarketPrice - lvl.triggerPrice) / currentMarketPrice) * 100).toFixed(2)}% للوصول)`}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2 px-2.5">
                                        {lvl.status === 'PENDING' ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleSimulateRecovery(selectedTrade.tradeId, lvl.levelIndex)
                                            }
                                            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                                              isReady
                                                ? 'bg-amber-600 hover:bg-amber-500 text-slate-900 border border-amber-400 font-bold'
                                                : 'bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/40'
                                            }`}
                                          >
                                            تفعيل الشراء
                                          </button>
                                        ) : (
                                          <span className="text-[10px] text-emerald-400 font-mono">
                                            ✓ مكتمل
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center text-slate-400 space-y-2">
              <TrendingUp className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">لم يتم اختيار أي صفقة</p>
              <p className="text-xs text-slate-500">
                اختر صفقة من القائمة الجانبية أو افتح صفقة جديدة للبدء
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 5. Closed Trades History & Net PnL Table */}
      {closedTrades.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>سجل الصفقات المغلقة وصافي الأرباح ({closedTrades.length}):</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">
              توثيق كامل للأسعار الفعلية والعمولات
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">الرمز</th>
                  <th className="py-2.5 px-3">المسار</th>
                  <th className="py-2.5 px-3">النوع</th>
                  <th className="py-2.5 px-3">سعر الدخول</th>
                  <th className="py-2.5 px-3">سعر الخروج</th>
                  <th className="py-2.5 px-3">مصدر التكلفة</th>
                  <th className="py-2.5 px-3">العمولات الفعلية</th>
                  <th className="py-2.5 px-3">صافي الربح/الخسارة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {closedTrades.map((t) => (
                  <tr key={t.tradeId} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-bold text-slate-200">{t.symbol}</td>
                    <td className="py-2.5 px-3 text-slate-400">{t.source === 'SCANNER' ? 'Scanner' : 'يدوي'}</td>
                    <td className="py-2.5 px-3 text-slate-300">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                        {t.botType || 'DEAL_BOT'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{t.entry.executionPrice}</td>
                    <td className="py-2.5 px-3 text-slate-300">{t.exit?.executionPrice || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-400">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                        {t.costConfig?.source}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{t.pnl?.totalFeesQuote} USDT</td>
                    <td className="py-2.5 px-3 font-bold">
                      {t.pnl ? (
                        <span
                          className={`px-2 py-0.5 rounded ${
                            t.pnl.isProfitable
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {t.pnl.netReturnQuote > 0 ? '+' : ''}
                          {t.pnl.netReturnQuote} USDT ({t.pnl.netReturnPercent}%)
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
