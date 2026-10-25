'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  XCircle,
  RefreshCw,
  Plus,
  Layers,
  ArrowRight,
  Sliders,
  DollarSign,
  Activity,
  Bot
} from 'lucide-react';
import { useTheme, ACCENT_PALETTES } from '@/components/theme/ThemeContext';
import { BotManagementView } from '@/components/bots/BotManagementView';

interface TradeManagementViewProps {
  initialSymbol?: string;
  initialPrice?: number;
}

export function TradeManagementView({
  initialSymbol = 'BTCUSDT',
  initialPrice,
}: TradeManagementViewProps) {
  const { isLight, accent } = useTheme();
  const palette = ACCENT_PALETTES[accent] || ACCENT_PALETTES.gold;

  const [activeSubView, setActiveSubView] = useState<'trades' | 'bots'>('trades');
  const [trades, setTrades] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // New trade form state
  const [symbol, setSymbol] = useState<string>(initialSymbol);
  const [entryAmount, setEntryAmount] = useState<number>(100);
  const [entryPrice, setEntryPrice] = useState<number>(initialPrice || 67500);
  const [stepPercent, setStepPercent] = useState<number>(2.0);
  const [recoveryRatio, setRecoveryRatio] = useState<number>(1.5);
  const [maxLevels, setMaxLevels] = useState<number>(4);
  const [botType, setBotType] = useState<string>('DEAL_BOT');

  const showFeedback = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 5000);
  };

  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch('/api/trades');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.trades)) {
          setTrades(data.trades);
        }
      }
    } catch {
      // Non-fatal
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, 5000);
    return () => clearInterval(interval);
  }, [fetchTrades]);

  // Update initial inputs when changed from outside
  useEffect(() => {
    if (initialSymbol) setSymbol(initialSymbol);
    if (initialPrice) setEntryPrice(initialPrice);
  }, [initialSymbol, initialPrice]);

  // Create new trade
  const handleCreateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          entryAmount,
          entryPrice,
          stepPercent,
          botType,
          xSettings: {
            enabled: true,
            stepPercent,
            recoveryRatio,
            maxLevels,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback(`تم فتح صفقة ${symbol} بنجاح بمبلغ ${entryAmount} USDT`, 'success');
        await fetchTrades();
      } else {
        showFeedback(data.error || 'تعذر فتح الصفقة', 'error');
      }
    } catch {
      showFeedback('فشل الاتصال بطبقة إدارة الصفقات', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Close trade
  const handleCloseTrade = async (tradeId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في إغلاق هذه الصفقة وجني الأرباح/وقف الخسارة؟')) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/trades/${tradeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', reason: 'إغلاق يدوي من المستخدم' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback('تم إغلاق الصفقة واحتساب صافي الأرباح بعد الرسوم', 'success');
        await fetchTrades();
      } else {
        showFeedback(data.error || 'فشل إغلاق الصفقة', 'error');
      }
    } catch {
      showFeedback('تعذر تنفيذ أمر الإغلاق', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Trigger Recovery Buy
  const handleTriggerRecovery = async (tradeId: string, levelIndex: number) => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/trades/${tradeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recovery', levelIndex }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback(`تم تنفيذ تعزيز X${levelIndex} وتعديل متوسط السعر بنجاح`, 'success');
        await fetchTrades();
      } else {
        showFeedback(data.error || 'فشل تنفيذ التعزيز', 'error');
      }
    } catch {
      showFeedback('تعذر الاتصال لتنفيذ التعزيز', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const activeTrades = trades.filter((t) => t.status === 'OPEN' || t.status === 'PENDING_ENTRY');
  const closedTrades = trades.filter((t) => t.status === 'CLOSED');

  return (
    <div className="space-y-6">
      {/* Sub-view switcher */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubView('trades')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubView === 'trades'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>مدير الصفقات الحية الموحد ({activeTrades.length} نشطة)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('bots')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubView === 'bots'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>شاشة إدارة البوتات المستقلة (Bot Engine)</span>
          </button>
        </div>

        <button
          type="button"
          onClick={fetchTrades}
          disabled={isLoading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>تحديث</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium border flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : feedback.type === 'error'
              ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              : 'bg-blue-950/60 border-blue-500/40 text-blue-300'
          }`}
        >
          {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {feedback.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {activeSubView === 'bots' ? (
        <BotManagementView />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: New Trade Form (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <form
              onSubmit={handleCreateTrade}
              className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-md space-y-4 text-xs"
            >
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Plus className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  فتح صفقة جديدة / تفعيل استراتيجية
                </h3>
              </div>

              {/* Symbol */}
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">
                  زوج التداول (Binance Spot)
                </label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-slate-100 uppercase"
                />
              </div>

              {/* Amount & Entry Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 dark:text-slate-400 block mb-1">
                    المبلغ (USDT)
                  </label>
                  <input
                    type="number"
                    min={10}
                    step={10}
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-slate-600 dark:text-slate-400 block mb-1">
                    سعر الدخول التقديري
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Bot Type */}
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">
                  نوع الاستراتيجية المدارة
                </label>
                <select
                  value={botType}
                  onChange={(e) => setBotType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer"
                >
                  <option value="DEAL_BOT">بوت الصفقات الفورية (Deal Bot)</option>
                  <option value="RANGE_BOT">بوت النطاق العرضي (Range Bot + X Recovery)</option>
                </select>
              </div>

              {/* X Recovery Parameters */}
              <div className="p-3 rounded-xl bg-slate-100/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-2.5">
                <span className="text-[11px] font-bold text-amber-500 block flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  <span>طبقة التعزيز المحسوبة (X Recovery Settings)</span>
                </span>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">خطوة الهبوط</span>
                    <input
                      type="number"
                      step={0.5}
                      value={stepPercent}
                      onChange={(e) => setStepPercent(Number(e.target.value))}
                      className="w-full px-2 py-1 mt-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-slate-400 block">مضاعف الحجم</span>
                    <input
                      type="number"
                      step={0.1}
                      value={recoveryRatio}
                      onChange={(e) => setRecoveryRatio(Number(e.target.value))}
                      className="w-full px-2 py-1 mt-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-slate-400 block">أقصى تعزيزات</span>
                    <input
                      type="number"
                      value={maxLevels}
                      onChange={(e) => setMaxLevels(Number(e.target.value))}
                      className="w-full px-2 py-1 mt-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isActionLoading}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>تنفيذ الصفقة الآن</span>
              </button>
            </form>
          </div>

          {/* Right Column: Active & Closed Trades List (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                    الصفقات المفتوحة والنشطة ({activeTrades.length})
                  </h3>
                </div>
                <span className="text-xs text-slate-400">
                  الحقيقة التنفيذية: حساب PnL الصافي بعد خصم الرسوم
                </span>
              </div>

              {activeTrades.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs">
                  لا توجد صفقات مفتوحة حالياً. يمكنك فتح صفقة جديدة من النموذج الجانبي أو عبر الماسح.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeTrades.map((t) => {
                    const isProfit = (t.unrealizedPnl || 0) >= 0;
                    return (
                      <div
                        key={t.tradeId}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 space-y-3 text-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                              {t.symbol}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">
                              نشطة (OPEN)
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {t.botType || 'DEAL_BOT'}
                            </span>
                          </div>

                          {/* PnL Display */}
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-slate-400 text-[10px]">صافي PnL اللحظي:</span>
                            <span
                              className={`text-sm font-bold ${
                                isProfit ? 'text-emerald-500' : 'text-rose-500'
                              }`}
                            >
                              {isProfit ? '+' : ''}{(t.unrealizedPnl || 0).toFixed(4)} USDT ({isProfit ? '+' : ''}{(t.unrealizedPnlPercent || 0).toFixed(2)}%)
                            </span>
                          </div>
                        </div>

                        {/* Trade metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                          <div>
                            <span>متوسط الدخول: </span>
                            <strong className="text-slate-900 dark:text-slate-200">
                              {t.entry?.executionPrice?.toFixed(4)}
                            </strong>
                          </div>
                          <div>
                            <span>السعر الحالي: </span>
                            <strong className="text-slate-900 dark:text-slate-200">
                              {t.currentPrice?.toFixed(4) || t.entry?.executionPrice?.toFixed(4)}
                            </strong>
                          </div>
                          <div>
                            <span>رأس المال: </span>
                            <strong className="text-slate-900 dark:text-slate-200">
                              {t.entry?.totalCost?.toFixed(2)} USDT
                            </strong>
                          </div>
                          <div>
                            <span>الرسوم المدفوعة: </span>
                            <strong className="text-amber-500">
                              {(t.feesPaid || 0).toFixed(4)} USDT
                            </strong>
                          </div>
                        </div>

                        {/* Recovery levels if triggered */}
                        {t.recoveryLevels && t.recoveryLevels.length > 0 && (
                          <div className="p-2 rounded-lg bg-purple-950/30 border border-purple-800/40 text-[11px] text-purple-300 space-y-1">
                            <span className="font-semibold block">المستويات المعززة (X Recovery):</span>
                            <div className="flex flex-wrap gap-2 font-mono">
                              {t.recoveryLevels.map((lvl: any, idx: number) => (
                                <span key={idx} className="px-1.5 py-0.5 rounded bg-purple-900/50">
                                  X{lvl.levelIndex}: {lvl.allocationAmount} USDT @ {lvl.targetPrice.toFixed(4)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/80 gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleTriggerRecovery(t.tradeId, (t.recoveryLevels?.length || 0) + 1)}
                            disabled={isActionLoading}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-semibold cursor-pointer"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>تنفيذ تعزيز فوري (X{(t.recoveryLevels?.length || 0) + 1})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCloseTrade(t.tradeId)}
                            disabled={isActionLoading}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>إغلاق الصفقة وجني الأرباح</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
