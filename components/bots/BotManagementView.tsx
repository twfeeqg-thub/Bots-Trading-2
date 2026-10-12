'use client';

// Project Q — Phase: Bot Management Screen (شاشة البوتات)
// Fully integrated with:
// 1. Bot Core (11 deterministic states & state machine)
// 2. Bot Engine (central orchestrator via /api/engine/bots and /api/engine/bots/[id]/actions)
// 3. Binance Trading Layer (Buy / Sell / Verify / OrderLockManager / Mock Transport)
// 4. Central Market Data (Fresh prices and event times)
// Server-Side Mock Mode: Zero real Binance keys, Zero external trading calls.
// Strict Scope: NO T/T0, NO X/Recovery, NO SL/Trailing, NO 24/7 background cron, NO auto-cycles.

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Plus,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Shield,
  Layers,
  Activity,
  Trash2,
  RotateCcw,
  Tag,
  Crosshair,
  Info,
  Lock,
  RefreshCw,
  Search,
  Check,
  AlertCircle,
  HelpCircle,
  Percent,
} from 'lucide-react';
import {
  BotType,
  BotState,
  BOT_TYPE_LABELS,
  BOT_STATE_METADATA,
  BotConfig,
  BotCycle,
  BotTrade,
  CreateBotParams,
  EntryMethod,
} from '@/lib/bots/types';
import { BotSummaryDTO } from '@/lib/engine/types';
import { sharedMarketDataStore, MarketPriceRecord } from '@/lib/market-data';

interface BotManagementViewProps {
  onNavigateToTradeManager?: (symbol?: string) => void;
}

export function BotManagementView({ onNavigateToTradeManager }: BotManagementViewProps = {}) {
  const [bots, setBots] = useState<BotSummaryDTO[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<'ALL' | BotType>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  // Market Data state for active symbol
  const [livePriceRecord, setLivePriceRecord] = useState<MarketPriceRecord | null>(null);

  // Create Bot Form State
  const [newBotType, setNewBotType] = useState<BotType>('DEAL_BOT');
  const [newBotName, setNewBotName] = useState<string>('');
  const [newBotSymbol, setNewBotSymbol] = useState<string>('BTCUSDT');
  const [newBotAmount, setNewBotAmount] = useState<number>(100);
  const [newBotEntryMethod, setNewBotEntryMethod] = useState<EntryMethod>('MARKET');
  const [newBotMaxLevels, setNewBotMaxLevels] = useState<string>('');
  const [newBotStepPercent, setNewBotStepPercent] = useState<string>('');
  const [newBotRecoveryRatio, setNewBotRecoveryRatio] = useState<string>('');
  const [newBotCustomAllocation, setNewBotCustomAllocation] = useState<string>('');

  // Status feedback
  const [actionFeedback, setActionFeedback] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const showFeedback = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info'
  ) => {
    setActionFeedback({ message, type });
    setTimeout(() => setActionFeedback(null), 6000);
  };

  // Fetch all bots from BotEngine via API
  const fetchBots = useCallback(async () => {
    try {
      const res = await fetch('/api/engine/bots');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.bots)) {
          setBots(data.bots);
          setSelectedBotId((prev) => (prev ? prev : data.bots.length > 0 ? data.bots[0].id : null));
        }
      }
    } catch {
      // Non-fatal on transient network error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load and periodic polling every 4 seconds
  useEffect(() => {
    let isMounted = true;

    const loadBots = async () => {
      try {
        const res = await fetch('/api/engine/bots');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && Array.isArray(data.bots)) {
            setBots(data.bots);
            setSelectedBotId((prev) => (prev ? prev : data.bots.length > 0 ? data.bots[0].id : null));
          }
        }
      } catch {
        // Non-fatal
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadBots();
    const interval = setInterval(loadBots, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Currently selected bot
  const selectedBot = bots.find((b) => b.id === selectedBotId);
  const selectedSymbol = selectedBot?.symbol || 'BTCUSDT';

  // Subscribe to Central Market Data store for live price of selected bot
  useEffect(() => {
    const updatePrice = () => {
      const rec = sharedMarketDataStore.getRecord(selectedSymbol);
      if (rec) setLivePriceRecord(rec);
    };

    const unsubscribe = sharedMarketDataStore.subscribeToChanges(updatePrice);
    const initialTimer = setTimeout(updatePrice, 0);

    return () => {
      clearTimeout(initialTimer);
      unsubscribe();
    };
  }, [selectedSymbol]);

  // Execute Bot Action via BotEngine API
  const executeEngineAction = async (action: string, payload?: Record<string, unknown>) => {
    if (!selectedBotId) return;
    setIsActionLoading(true);

    try {
      const res = await fetch(`/api/engine/bots/${selectedBotId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Handle specific action result types
        if (action === 'buy') {
          const outcome = data.result?.outcome;
          const avgPrice = data.result?.avgPrice;
          const qty = data.result?.executedQty;
          const orderId = data.result?.orderId;

          if (outcome === 'SUCCESS') {
            showFeedback(
              `✓ تم تنفيذ أمر الشراء على Binance (Mock) بنجاح: شراء ${qty} بسعر ${avgPrice} USDT (orderId: ${orderId})`,
              'success'
            );
          } else if (outcome === 'AMBIGUOUS') {
            showFeedback(
              `⚠️ نتيجة الشراء غامضة (AMBIGUOUS): تعذر حسم امتلاء الأمر. البوت الآن في حالة التحقق (VERIFYING_BUY). يمنع إرسال أمر ثانٍ قبل التحقق.`,
              'warning'
            );
          } else {
            showFeedback(`تم إرسال أمر الشراء: النتيجة ${outcome}`, 'info');
          }
        } else if (action === 'sell') {
          const outcome = data.result?.outcome;
          const isPartial = data.result?.isPartial;
          const avgPrice = data.result?.avgPrice;
          const qty = data.result?.executedQty;

          if (outcome === 'SUCCESS') {
            showFeedback(
              `✓ تم تنفيذ أمر البيع بالكامل على Binance (Mock): بيع ${qty} بسعر ${avgPrice} USDT وتم إغلاق الصفقة (POSITION_CLOSED)`,
              'success'
            );
          } else if (outcome === 'PARTIAL') {
            showFeedback(
              `✓ تم تنفيذ بيع جزئي على Binance (Mock): بيع ${qty} بسعر ${avgPrice} USDT وبقاء المتبقي تحت المراقبة (PARTIAL)`,
              'info'
            );
          } else if (outcome === 'AMBIGUOUS') {
            showFeedback(
              `⚠️ نتيجة البيع غامضة (AMBIGUOUS): البوت في حالة التحقق من البيع (VERIFYING_SELL). يمنع إرسال أمر ثانٍ.`,
              'warning'
            );
          }
        } else if (action === 'verify') {
          const status = data.result?.status;
          const outcome = data.result?.outcome;
          if (outcome === 'SUCCESS') {
            showFeedback(`✓ تم التحقق من Binance بنجاح: الأمر ممتلئ (FILLED) وحُسمت الصفقة نهائيًا.`, 'success');
          } else if (outcome === 'AMBIGUOUS') {
            showFeedback(`⚠️ التحقق من Binance: الأمر غير مؤكد بعد وما زال يحتاج متابعة.`, 'warning');
          } else {
            showFeedback(`نتيجة التحقق من Binance: الحالة ${status} (${data.result?.error || 'مكتمل'})`, 'info');
          }
        } else {
          showFeedback(`تم تنفيذ الإجراء «${action}» بنجاح`, 'success');
        }
      } else {
        showFeedback(data.error || `فشل تنفيذ الإجراء «${action}»`, 'error');
      }

      await fetchBots();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل الاتصال بمحرك البوتات';
      showFeedback(msg, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Create Bot
  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/engine/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newBotType,
          name:
            newBotName.trim() ||
            (newBotType === 'RANGE_BOT'
              ? `بوت مسار عرضي ${newBotSymbol}`
              : `بوت صفقة ${newBotSymbol}`),
          symbol: newBotSymbol.toUpperCase().trim(),
          entryAmount: Number(newBotAmount),
          entryMethod: newBotEntryMethod,
          xSettings:
            newBotType === 'RANGE_BOT'
              ? {
                  enabled: true,
                  maxLevels: newBotMaxLevels ? Number(newBotMaxLevels) : undefined,
                  stepPercent: newBotStepPercent ? Number(newBotStepPercent) : undefined,
                  recoveryRatio: newBotRecoveryRatio ? Number(newBotRecoveryRatio) : undefined,
                  customAllocationQuote: newBotCustomAllocation ? Number(newBotCustomAllocation) : undefined,
                }
              : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedBotId(data.bot.id);
        setShowCreateModal(false);
        setNewBotName('');
        showFeedback(`تم إنشاء البوت «${data.bot.name}» بنجاح`, 'success');
        await fetchBots();
      } else {
        showFeedback(data.error || 'فشل إنشاء البوت', 'error');
      }
    } catch {
      showFeedback('فشل الاتصال بالمحرك لإنشاء البوت', 'error');
    }
  };

  // Delete Bot
  const handleDeleteBot = async (botId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا البوت؟')) return;
    try {
      const res = await fetch(`/api/engine/bots/${botId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback('تم حذف البوت بنجاح', 'success');
        const remaining = bots.filter((b) => b.id !== botId);
        setSelectedBotId(remaining.length > 0 ? remaining[0].id : null);
        await fetchBots();
      } else {
        showFeedback(data.error || 'تعذر حذف البوت', 'error');
      }
    } catch {
      showFeedback('فشل حذف البوت', 'error');
    }
  };

  const filteredBots = bots.filter((b) => {
    if (filterType === 'ALL') return true;
    return b.type === filterType;
  });

  const botConfig = selectedBot?.config;
  const botCycle = selectedBot?.currentCycle;
  const botTrade = selectedBot?.currentTrade;
  const botState = selectedBot?.currentState || 'STOPPED';
  const stateMeta = BOT_STATE_METADATA[botState];

  // Determine lock state presentation
  const isAmbiguousState =
    botState === 'VERIFYING_BUY' || botState === 'VERIFYING_SELL';

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Global Architectural & Mock Security Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-100">
                شاشة إدارة البوتات — نظام التداول المعزول (V1)
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium">
                Mock Mode النشط (صفر مفاتيح حقيقية)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              المعمارية المعتمدة: <strong>Bot Core</strong> (الحالات الـ 11) ←{' '}
              <strong>Bot Engine</strong> (المنسق) ←{' '}
              <strong>Binance Trading Layer</strong> (الشراء والبيع والتحقق) ←{' '}
              <strong>Binance Mock Transport</strong> (مصدر الحقيقة).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchBots}
            disabled={isLoading || isActionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors border border-slate-700 disabled:opacity-50"
            title="تحديث قائمة البوتات من المحرك"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء بوت جديد</span>
          </button>
        </div>
      </div>

      {/* 2. Action Feedback Toast */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center gap-2.5 animate-in fade-in duration-200 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : actionFeedback.type === 'warning'
              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
              : actionFeedback.type === 'error'
              ? 'bg-red-950/60 border-red-500/40 text-red-300'
              : 'bg-blue-950/60 border-blue-500/40 text-blue-300'
          }`}
        >
          {actionFeedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {actionFeedback.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          {actionFeedback.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
          {actionFeedback.type === 'info' && <Info className="w-4 h-4 text-blue-400 shrink-0" />}
          <span className="font-medium leading-relaxed">{actionFeedback.message}</span>
        </div>
      )}

      {/* 3. Main Screen Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Bots List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="font-semibold text-slate-300">
              البوتات المسجلة ({filteredBots.length})
            </span>
            {/* Filter buttons */}
            <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  filterType === 'ALL'
                    ? 'bg-slate-800 text-slate-100 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setFilterType('RANGE_BOT')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  filterType === 'RANGE_BOT'
                    ? 'bg-purple-950/60 text-purple-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                المسار
              </button>
              <button
                type="button"
                onClick={() => setFilterType('DEAL_BOT')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  filterType === 'DEAL_BOT'
                    ? 'bg-cyan-950/60 text-cyan-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                الصفقة
              </button>
            </div>
          </div>

          {filteredBots.length === 0 ? (
            <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/40 text-center space-y-3">
              <Bot className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">لا توجد بوتات مسجلة حاليًا</p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/30"
              >
                إنشاء أول بوت
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBots.map((b) => {
                const isSelected = b.id === selectedBotId;
                const meta = BOT_STATE_METADATA[b.currentState];

                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBotId(b.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-900 border-emerald-500/60 shadow-lg ring-1 ring-emerald-500/30'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-slate-100 truncate">
                            {b.name}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                              b.type === 'RANGE_BOT'
                                ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                                : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {BOT_TYPE_LABELS[b.type].ar}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-1.5 flex items-center gap-2">
                          <span className="text-emerald-400 font-semibold">{b.symbol}</span>
                          <span>•</span>
                          <span>{b.entryAmount} USDT</span>
                          <span>•</span>
                          <span>دورة #{b.cycleNumber}</span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium border shrink-0 ${meta.badgeColor}`}
                      >
                        {meta.ar}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Selected Bot Details & Trading Layer Orchestration (8 cols) */}
        <div className="lg:col-span-8">
          {selectedBot && botConfig ? (
            <div className="space-y-6">
              {/* Card 1: Top Status & Live Market Price Header */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-100">{botConfig.name}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-mono ${
                          botConfig.type === 'RANGE_BOT'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        }`}
                      >
                        {BOT_TYPE_LABELS[botConfig.type].ar}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      معرّف البوت: {botConfig.id} • الزوج: {botConfig.symbol} • مبلغ الدخول:{' '}
                      {botConfig.entryAmount} USDT
                    </p>
                    {onNavigateToTradeManager && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onNavigateToTradeManager(botConfig.symbol)}
                          className="px-2 py-0.5 rounded bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-500/30 text-[10px] font-sans flex items-center gap-1 transition-colors"
                          title="عرض هذه الصفقة في دورة التداول الموحدة (مستويات T وX وصافي الربح)"
                        >
                          <TrendingUp className="w-3 h-3 text-indigo-400" />
                          <span>إدارة الصفقة في دورة التداول الموحدة (T0 &amp; T-Levels)</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Market Data Widget */}
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-right">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <Activity className="w-3 h-3 text-emerald-400" />
                        <span>سعر السوق (MiniTicker):</span>
                        {livePriceRecord && (
                          <span
                            className={`px-1 rounded text-[9px] font-mono font-bold ${
                              livePriceRecord.dataStatus === 'FRESH'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : livePriceRecord.dataStatus === 'STALE'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {livePriceRecord.dataStatus}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-base font-bold text-slate-100">
                        {livePriceRecord?.price !== undefined
                          ? `${livePriceRecord.price.toFixed(livePriceRecord.price > 100 ? 2 : 4)} USDT`
                          : 'جاري الاستقبال...'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteBot(selectedBot.id)}
                      disabled={isActionLoading || botState === 'POSITION_OPEN'}
                      className="p-2 rounded-lg bg-slate-950 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-500/40 transition-colors disabled:opacity-40"
                      title={
                        botState === 'POSITION_OPEN'
                          ? 'لا يمكن حذف بوت لديه صفقة مفتوحة'
                          : 'حذف البوت'
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* V1 Lifecycle Progress Stepper (11 States) */}
                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center justify-between">
                    <span>دورة حياة V1 المنضبطة (11 حالة حتمية):</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      الحالة الحالية: #{stateMeta.index} ({stateMeta.ar})
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-1.5 text-center">
                    {(
                      [
                        'WAITING_FOR_ENTRY',
                        'MONITORING_ENTRY',
                        'ENTRY_TRIGGERED',
                        'EXECUTING_BUY',
                        'VERIFYING_BUY',
                        'POSITION_OPEN',
                        'EXECUTING_SELL',
                        'VERIFYING_SELL',
                        'POSITION_CLOSED',
                        'STOPPED',
                        'ERROR',
                      ] as BotState[]
                    ).map((st) => {
                      const isCurrent = botState === st;
                      const meta = BOT_STATE_METADATA[st];

                      return (
                        <div
                          key={st}
                          className={`p-2 rounded-lg border text-center transition-all ${
                            isCurrent
                              ? 'bg-slate-950 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/40 shadow-sm'
                              : 'bg-slate-950/40 border-slate-800/80 text-slate-500'
                          }`}
                        >
                          <div className="text-[10px] font-mono font-bold">#{meta.index}</div>
                          <div className="text-xs font-semibold truncate mt-0.5">{meta.ar}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ambiguity Alert & Verify Call-to-Action */}
                {isAmbiguousState && (
                  <div className="p-3.5 rounded-lg border border-amber-500/40 bg-amber-950/30 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold">تنبيه: العملية في حالة تحقق (AMBIGUOUS / VERIFY):</span>
                        <p className="text-[11px] text-amber-300/80 mt-0.5">
                          تم إرسال الأمر عبر الشبكة ويُمنع إرسال أمر ثانٍ مكرر. يجب الاستعلام من Binance لتأكيد الامتلاء.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => executeEngineAction('verify')}
                      disabled={isActionLoading}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shrink-0 flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>التحقق من Binance الآن</span>
                    </button>
                  </div>
                )}

                {/* Card 2: Interactive Operational Actions Bar */}
                <div className="pt-2 border-t border-slate-800">
                  <div className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center justify-between">
                    <span>أوامر التحكم والمحاكاة المتاحة للحالة الحالية:</span>
                    <span className="text-[10px] text-slate-500">
                      تخضع لقواعد State Machine الصارمة
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* STOPPED State */}
                    {botState === 'STOPPED' && (
                      <button
                        type="button"
                        onClick={() => executeEngineAction('start')}
                        disabled={isActionLoading}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>بدء دورة تشغيل جديدة (Start)</span>
                      </button>
                    )}

                    {/* WAITING_FOR_ENTRY State */}
                    {botState === 'WAITING_FOR_ENTRY' && (
                      <>
                        <button
                          type="button"
                          onClick={() => executeEngineAction('advance', { targetState: 'MONITORING_ENTRY' })}
                          disabled={isActionLoading}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-slate-100 font-bold text-xs transition-colors disabled:opacity-50"
                        >
                          بدء مراقبة السوق (MONITORING_ENTRY)
                        </button>
                        <button
                          type="button"
                          onClick={() => executeEngineAction('stop', { reason: 'إيقاف يدوي من الشاشة' })}
                          disabled={isActionLoading}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors disabled:opacity-50"
                        >
                          إيقاف يدوي (STOPPED)
                        </button>
                      </>
                    )}

                    {/* MONITORING_ENTRY State */}
                    {botState === 'MONITORING_ENTRY' && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            executeEngineAction('advance', {
                              targetState: 'ENTRY_TRIGGERED',
                              details: { reason: 'تحقق إشارة الدخول يدويًا' },
                            })
                          }
                          disabled={isActionLoading}
                          className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50"
                        >
                          تحقق شرط الدخول (ENTRY_TRIGGERED)
                        </button>
                        <button
                          type="button"
                          onClick={() => executeEngineAction('stop', { reason: 'إيقاف يدوي من الشاشة' })}
                          disabled={isActionLoading}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors disabled:opacity-50"
                        >
                          إيقاف يدوي (STOPPED)
                        </button>
                      </>
                    )}

                    {/* ENTRY_TRIGGERED State: Dispatches BUY through Binance Trading Layer */}
                    {botState === 'ENTRY_TRIGGERED' && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            executeEngineAction('buy', {
                              options: {
                                quoteOrderQty: botConfig.entryAmount,
                                orderType: 'MARKET',
                              },
                            })
                          }
                          disabled={isActionLoading}
                          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold text-xs transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>إرسال أمر الشراء عبر Binance Trading Layer (BUY)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => executeEngineAction('stop', { reason: 'إلغاء أمر الدخول' })}
                          disabled={isActionLoading}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors disabled:opacity-50"
                        >
                          إلغاء وإيقاف (STOPPED)
                        </button>
                      </>
                    )}

                    {/* EXECUTING_BUY or VERIFYING_BUY */}
                    {(botState === 'EXECUTING_BUY' || botState === 'VERIFYING_BUY') && (
                      <button
                        type="button"
                        onClick={() => executeEngineAction('verify')}
                        disabled={isActionLoading}
                        className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-slate-100 font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>التحقق من امتلاء أمر الشراء من Binance (Verify Buy)</span>
                      </button>
                    )}

                    {/* POSITION_OPEN State: Full Sell or Partial Sell */}
                    {botState === 'POSITION_OPEN' && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            executeEngineAction('sell', {
                              options: {
                                isPartial: false,
                                orderType: 'MARKET',
                                reason: 'إغلاق بيع كامل يدوي',
                              },
                            })
                          }
                          disabled={isActionLoading}
                          className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-slate-100 font-bold text-xs transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <span>تنفيذ بيع كامل عبر Binance (Full Sell)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const totalQty = botTrade?.entry?.filledQuantity || 1;
                            const partialQty = Number((totalQty / 2).toFixed(6));
                            executeEngineAction('sell', {
                              options: {
                                isPartial: true,
                                quantity: partialQty,
                                orderType: 'MARKET',
                                reason: 'بيع جزئي 50% للتجربة',
                              },
                            });
                          }}
                          disabled={isActionLoading}
                          className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Percent className="w-3 h-3" />
                          <span>بيع جزئي 50% (Partial Sell)</span>
                        </button>
                      </>
                    )}

                    {/* EXECUTING_SELL or VERIFYING_SELL */}
                    {(botState === 'EXECUTING_SELL' || botState === 'VERIFYING_SELL') && (
                      <button
                        type="button"
                        onClick={() => executeEngineAction('verify')}
                        disabled={isActionLoading}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>التحقق من تنفيذ البيع من Binance (Verify Sell)</span>
                      </button>
                    )}

                    {/* POSITION_CLOSED State */}
                    {botState === 'POSITION_CLOSED' && (
                      <button
                        type="button"
                        onClick={() => executeEngineAction('advance', { targetState: 'STOPPED' })}
                        disabled={isActionLoading}
                        className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50"
                      >
                        نقل البوت إلى التوقف (STOPPED)
                      </button>
                    )}

                    {/* ERROR State: Recovery */}
                    {botState === 'ERROR' && (
                      <button
                        type="button"
                        onClick={() =>
                          executeEngineAction('recover', {
                            targetState: 'STOPPED',
                            reason: 'استرداد آمن يدوي من الشاشة',
                          })
                        }
                        disabled={isActionLoading}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50"
                      >
                        استرداد آمن إلى التوقف (Recover to STOPPED)
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 2: Decoupled Architecture Data (Cycle & Trade Details) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 2A: Cycle Info */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <span>بيانات دورة التشغيل (Current Cycle)</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      دورة #{selectedBot.cycleNumber}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">معرّف الدورة:</span>
                      <span className="text-slate-300 truncate max-w-[180px]">
                        {botCycle?.cycleId || 'لا توجد دورة نشطة'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">وقت البدء:</span>
                      <span>
                        {botCycle?.startedAt
                          ? new Date(botCycle.startedAt).toLocaleTimeString('ar-EG')
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">الحالة السابقة:</span>
                      <span className="text-slate-400">{botCycle?.previousState || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">الصفقة النشطة:</span>
                      <span className="text-cyan-400">
                        {botCycle?.activeTradeId || 'لا توجد صفقة مرتبطة'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2B: Trade Execution Details (from Binance Trading Layer) */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span>بيانات تنفيذ الصفقة (Trade Execution)</span>
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        botTrade?.status === 'OPEN'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : botTrade?.status === 'CLOSED'
                          ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {botTrade?.status || 'لا توجد صفقة'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">معرّف الصفقة:</span>
                      <span className="text-slate-300 truncate max-w-[180px]">
                        {botTrade?.tradeId || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">أمر بينانس (Order ID):</span>
                      <span className="text-emerald-400">
                        {botTrade?.entry?.orderId || botTrade?.exit?.orderId || 'لم يتم التسجيل بعد'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">سعر التنفيذ الفعلي:</span>
                      <span className="text-slate-200 font-bold">
                        {botTrade?.entry?.executionPrice
                          ? `${botTrade.entry.executionPrice} USDT`
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">الكمية المنفذة:</span>
                      <span className="text-slate-200">
                        {botTrade?.entry?.filledQuantity !== undefined && botTrade?.entry?.filledQuantity !== null
                          ? `${botTrade.entry.filledQuantity} ${selectedSymbol.replace('USDT', '')}`
                          : '—'}
                      </span>
                    </div>
                    {botTrade?.exit?.executionPrice && (
                      <div className="flex justify-between border-t border-slate-800 pt-1 text-rose-300">
                        <span>سعر الخروج الفعلي:</span>
                        <span>{botTrade.exit.executionPrice} USDT</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 3: Deterministic State History & Audit Log */}
              {botCycle?.stateHistory && botCycle.stateHistory.length > 0 && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>سجل الانتقالات الحتمية للدورة الحالية ({botCycle.stateHistory.length}):</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      توثيق كامل للقرارات والانتقالات
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1 text-xs">
                    {botCycle.stateHistory.map((h, i) => (
                      <div
                        key={i}
                        className="p-2 rounded bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-500">
                            #{i + 1}
                          </span>
                          <span className="text-slate-400 font-semibold">{h.from}</span>
                          <ArrowRight className="w-3 h-3 text-slate-600" />
                          <span className="text-emerald-400 font-semibold">{h.to}</span>
                          {h.reason && (
                            <span className="text-slate-500 text-[11px] truncate max-w-xs">
                              ({h.reason})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {new Date(h.timestamp).toLocaleTimeString('ar-EG')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center text-slate-400 space-y-2">
              <Bot className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">لم يتم اختيار أي بوت</p>
              <p className="text-xs text-slate-500">
                اختر بوتًا من القائمة الجانبية أو قم بإنشاء بوت جديد للبدء
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 4. Create Bot Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>إنشاء بوت جديد (V1)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBot} className="space-y-4 text-xs">
              {/* Type Selection */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">نوع البوت:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewBotType('DEAL_BOT')}
                    className={`p-2.5 rounded-lg border text-center font-bold transition-all ${
                      newBotType === 'DEAL_BOT'
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    بوت صفقة (Deal Bot)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewBotType('RANGE_BOT')}
                    className={`p-2.5 rounded-lg border text-center font-bold transition-all ${
                      newBotType === 'RANGE_BOT'
                        ? 'bg-purple-950/60 border-purple-500 text-purple-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    بوت مسار عرضي (Range)
                  </button>
                </div>
              </div>

              {/* Bot Name */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">اسم البوت (اختياري):</label>
                <input
                  type="text"
                  value={newBotName}
                  onChange={(e) => setNewBotName(e.target.value)}
                  placeholder="مثال: بوت اختراق البيتكوين"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Symbol & Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">زوج التداول:</label>
                  <input
                    type="text"
                    value={newBotSymbol}
                    onChange={(e) => setNewBotSymbol(e.target.value.toUpperCase())}
                    placeholder="BTCUSDT"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">المبلغ (USDT):</label>
                  <input
                    type="number"
                    value={newBotAmount}
                    onChange={(e) => setNewBotAmount(Number(e.target.value))}
                    step="any"
                    placeholder="مثال: 0.01 أو 100"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* X/Recovery Settings when RANGE_BOT */}
              {newBotType === 'RANGE_BOT' && (
                <div className="p-3 rounded-lg bg-purple-950/20 border border-purple-500/30 space-y-2 text-xs">
                  <div className="font-bold text-purple-300">إعدادات مسار التعافي X (Range Recovery):</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">نسبة الهبوط %:</label>
                      <input
                        type="number"
                        value={newBotStepPercent}
                        onChange={(e) => setNewBotStepPercent(e.target.value)}
                        placeholder="مثال: 1.5 أو 0.5"
                        step="any"
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">مضاعف الحجم:</label>
                      <input
                        type="number"
                        value={newBotRecoveryRatio}
                        onChange={(e) => setNewBotRecoveryRatio(e.target.value)}
                        placeholder="مثال: 1.0 أو 1.2"
                        step="any"
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">حجم تعزيز نقدي (USDT):</label>
                      <input
                        type="number"
                        value={newBotCustomAllocation}
                        onChange={(e) => setNewBotCustomAllocation(e.target.value)}
                        placeholder="اختياري (بديل المضاعف)"
                        step="any"
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">الحد الأقصى للمستويات:</label>
                      <input
                        type="number"
                        value={newBotMaxLevels}
                        onChange={(e) => setNewBotMaxLevels(e.target.value)}
                        placeholder="فارغ = غير محدود"
                        step="1"
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Entry Method */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">طريقة الدخول:</label>
                <select
                  value={newBotEntryMethod}
                  onChange={(e) => setNewBotEntryMethod(e.target.value as EntryMethod)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="MARKET">سعر السوق المباشر (MARKET)</option>
                  <option value="SIGNAL">عند تحقق الإشارة (SIGNAL)</option>
                  <option value="LIMIT">أمر حدي محدد (LIMIT)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  حفظ وإنشاء البوت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
