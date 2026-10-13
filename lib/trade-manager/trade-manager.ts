// Project Q — Trade Manager: Central Orchestrator
// Coordinates the trade lifecycle:
// Two creation paths (Manual & Scanner) -> Entry Execution (SEND/VERIFY) ->
// Open Trade Monitoring (T0, T1-50%, T1, T2, T3 trailing protection) ->
// X/Recovery Engine for RANGE_BOT ->
// Sell Execution (SEND/VERIFY) -> Net PnL Calculation & Audit Log.
// Accepts ANY positive amount or step %, accepts negative or positive stop-loss.
// Operates with Binance Trading Layer Mock (Zero real Binance keys).

import {
  ConfirmedSymbolCost,
  CostDataSource,
  CreateTradeManualParams,
  CreateTradeScannerParams,
  ManagedTrade,
  TradeCostConfig,
  TradeCreationSource,
  ManualApprovedTradeValues,
  BinanceConfirmedTradeValues,
} from './types';
import { LevelCalculator } from './level-calculator';
import { sharedSymbolCostStore } from './symbol-cost-store';
import { XRecoveryManager } from './x-recovery-manager';
import { getSharedBotEngine } from '@/lib/engine';
import { sharedMarketDataStore } from '@/lib/market-data';

export type TradeChangeListener = (trades: ManagedTrade[]) => void;

export class TradeManager {
  private static instance: TradeManager | null = null;
  private trades: Map<string, ManagedTrade> = new Map();
  private listeners: Set<TradeChangeListener> = new Set();
  private isMonitoringStarted: boolean = false;
  private unsubscribeMarketData: (() => void) | null = null;
  private isProcessingTick: boolean = false;

  constructor() {
    this.startMarketDataMonitoring();
  }

  public static getInstance(): TradeManager {
    if (!TradeManager.instance) {
      TradeManager.instance = new TradeManager();
    }
    return TradeManager.instance;
  }

  /**
   * Subscribes to store changes for UI updates.
   */
  public subscribe(listener: TradeChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.listTrades());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const list = this.listTrades();
    this.listeners.forEach((l) => l(list));
  }

  /**
   * Path 1: Create Trade from Manual Entry.
   * Accepts ANY positive amount (including 0.01 USDT or less).
   */
  public async createTradeFromManual(params: CreateTradeManualParams): Promise<ManagedTrade> {
    return this.createManagedTrade({
      symbol: params.symbol.toUpperCase().trim(),
      entryAmount: params.entryAmount,
      entryPrice: params.entryPrice,
      source: 'MANUAL',
      stepPercent: params.stepPercent,
      manualEntryCost: params.manualEntryCost,
      manualExitCostRate: params.manualExitCostRate,
      manualEntryFeePercent: params.manualEntryFeePercent,
      manualEntryFeeAmount: params.manualEntryFeeAmount,
      manualExitFeePercent: params.manualExitFeePercent,
      manualExitFeeAmount: params.manualExitFeeAmount,
      botType: params.botType,
      xSettings: params.xSettings,
      initialStopLossPercent: params.initialStopLossPercent,
      immediateEntry: params.immediateEntry,
      isPreEntryRecovery: params.isPreEntryRecovery,
    });
  }

  /**
   * Path 2: Create Trade from Scanner Result.
   */
  public async createTradeFromScanner(params: CreateTradeScannerParams): Promise<ManagedTrade> {
    return this.createManagedTrade({
      symbol: params.symbol.toUpperCase().trim(),
      entryAmount: params.entryAmount,
      entryPrice: params.scannerPrice,
      source: 'SCANNER',
      stepPercent: params.stepPercent,
      manualEntryCost: params.manualEntryCost,
      manualExitCostRate: params.manualExitCostRate,
      manualEntryFeePercent: params.manualEntryFeePercent,
      manualEntryFeeAmount: params.manualEntryFeeAmount,
      manualExitFeePercent: params.manualExitFeePercent,
      manualExitFeeAmount: params.manualExitFeeAmount,
      botType: params.botType,
      xSettings: params.xSettings,
      initialStopLossPercent: params.initialStopLossPercent,
      immediateEntry: params.immediateEntry,
      isPreEntryRecovery: params.isPreEntryRecovery,
    });
  }

  /**
   * Unified creation path: creates or retrieves bot in BotEngine,
   * resolves initial cost config via priority (Saved Real -> Manual User Input -> Fallback Manual),
   * registers the managed trade in PENDING_ENTRY, and initiates entry.
   * NEVER blocks trade creation if real data is not yet available or if amounts are small.
   */
  private async createManagedTrade(params: {
    symbol: string;
    entryAmount: number;
    entryPrice?: number;
    source: TradeCreationSource;
    stepPercent?: number;
    manualEntryCost?: number;
    manualExitCostRate?: number;
    manualEntryFeePercent?: number;
    manualEntryFeeAmount?: number;
    manualExitFeePercent?: number;
    manualExitFeeAmount?: number;
    botType?: 'DEAL_BOT' | 'RANGE_BOT';
    xSettings?: import('@/lib/bots/types').XRangeSettings;
    initialStopLossPercent?: number;
    immediateEntry?: boolean;
    isPreEntryRecovery?: boolean;
  }): Promise<ManagedTrade> {
    const tradeId = `trd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const botId = `bot_trade_${params.symbol.toLowerCase()}_${Date.now().toString(36)}`;
    const now = Date.now();

    const botType = params.botType || (params.xSettings?.enabled ? 'RANGE_BOT' : 'DEAL_BOT');
    const xSettings =
      botType === 'RANGE_BOT'
        ? params.xSettings || {
            enabled: true,
          }
        : undefined;

    // Resolve initial cost configuration according to 3-tier priority
    const initialCostConfig = sharedSymbolCostStore.resolveInitialCostConfig({
      symbol: params.symbol,
      entryAmount: params.entryAmount,
      manualEntryCost: params.manualEntryCost,
      manualExitCostRate: params.manualExitCostRate,
      manualEntryFeePercent: params.manualEntryFeePercent,
      manualEntryFeeAmount: params.manualEntryFeeAmount,
      manualExitFeePercent: params.manualExitFeePercent,
      manualExitFeeAmount: params.manualExitFeeAmount,
    });

    // Create underlying bot in BotEngine to anchor state machine and cycle
    const engine = await getSharedBotEngine();
    await engine.createBot({
      id: botId,
      type: botType,
      name: `صفقة ${params.symbol} (${botType === 'RANGE_BOT' ? 'المسار العرضي' : params.source === 'SCANNER' ? 'الموجّه' : 'يدوي'})`,
      symbol: params.symbol,
      entryAmount: params.entryAmount,
      entryMethod: 'MARKET',
      initialStopLoss: {
        type: 'PERCENT',
        value: params.initialStopLossPercent !== undefined ? params.initialStopLossPercent : 2.0,
      },
      tRuleConfig: {
        targetType: 'FIXED_PERCENT',
        targetValue: params.stepPercent !== undefined && params.stepPercent > 0 ? params.stepPercent : 2.0,
        description: `قواعد T بمقدار ${params.stepPercent !== undefined && params.stepPercent > 0 ? params.stepPercent : 2.0}%`,
      },
      xSettings,
    });

    const manualStep = params.stepPercent !== undefined && params.stepPercent > 0 ? params.stepPercent : 2.0;
    const manualPrice = params.entryPrice || null;
    const manualEstimatedQty =
      manualPrice && manualPrice > 0 && params.entryAmount > 0
        ? Number((params.entryAmount / manualPrice).toFixed(8))
        : null;

    const manualApprovedValues: ManualApprovedTradeValues = {
      manualAmount: params.entryAmount !== undefined && params.entryAmount > 0 ? params.entryAmount : 100,
      manualPlannedPrice: manualPrice,
      manualEstimatedQuantity: manualEstimatedQty,
      manualEntryFeePercent: params.manualEntryFeePercent ?? initialCostConfig.entryFeePercent,
      manualEntryFeeAmount: params.manualEntryFeeAmount ?? initialCostConfig.entryFeeAmount,
      manualExitFeePercent: params.manualExitFeePercent ?? initialCostConfig.exitFeePercent,
      manualExitFeeAmount: params.manualExitFeeAmount ?? initialCostConfig.exitFeeAmount,
      manualEntryFee: initialCostConfig.entryCostAmount,
      manualExitFeeRate: initialCostConfig.exitCostRate,
      manualStepPercent: manualStep,
      manualStopLossPercent: params.initialStopLossPercent ?? 0,
      approvedAt: now,
    };

    const trade: ManagedTrade = {
      tradeId,
      botId,
      symbol: params.symbol,
      source: params.source,
      botType,
      status: 'PENDING_ENTRY',
      requestedAmount: params.entryAmount !== undefined && params.entryAmount > 0 ? params.entryAmount : 100,
      plannedPrice: params.entryPrice || null,
      entry: {
        requestedAmount: params.entryAmount,
        plannedPrice: params.entryPrice || null,
      },
      costConfig: initialCostConfig,
      manualValues: manualApprovedValues,
      confirmedValues: null,
      createdAt: now,
      notes: `تم إنشاء الصفقة (${initialCostConfig.description}). النوع: ${botType}. المصدر الأولي للتكلفة: ${initialCostConfig.source}`,
    };

    this.trades.set(tradeId, trade);
    this.notifyListeners();

    // Check if Pre-Entry Recovery monitoring is requested
    const shouldMonitorRecovery =
      params.isPreEntryRecovery ||
      (params.immediateEntry === false && (botType === 'RANGE_BOT' || xSettings?.enabled));

    if (shouldMonitorRecovery) {
      // Start bot to WAITING_FOR_ENTRY so it's ready for monitoring ticks
      try {
        await engine.startBot(botId);
      } catch {}

      const watchPrice =
        params.entryPrice && params.entryPrice > 0 ? params.entryPrice : 100;
      const stepPercent = xSettings?.stepPercent || params.stepPercent || 2.0;

      trade.preEntryXMonitor = XRecoveryManager.buildPreEntryMonitor({
        watchPrice,
        stepPercent,
        requiredRecoveries: 3,
        enabled: true,
      });

      trade.notes = `مراقبة الدخول بالتعافي (X) نشطة: سعر بدء المراقبة ${watchPrice} USDT. يُمنع الشراء أثناء الهبوط، والشرط استعادة 3 مستويات X متتالية صاعدة.`;
      this.notifyListeners();
    } else if (params.immediateEntry !== false) {
      // If immediateEntry is not explicitly false, execute entry immediately
      await this.executeTradeEntry(tradeId, xSettings, params.initialStopLossPercent);
    } else {
      // Start bot to WAITING_FOR_ENTRY so it's ready for manual trigger
      try {
        await engine.startBot(botId);
      } catch {}
    }

    return trade;
  }

  /**
   * Executes the Buy order on Binance Trading Layer (Mock) via BotEngine.
   * When fill response arrives:
   * 1. Replaces manual data with REAL_CONFIRMED_RECENT data automatically.
   * 2. Recalculates T0 and levels plan.
   * 3. If botType is RANGE_BOT, builds the X/Recovery plan.
   * 4. Saves confirmed cost data to SymbolCostStore for future trades of this symbol.
   */
  public async executeTradeEntry(
    tradeId: string,
    xSettings?: import('@/lib/bots/types').XRangeSettings,
    initialStopLossPercent?: number
  ): Promise<ManagedTrade> {
    const trade = this.trades.get(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found.`);

    const engine = await getSharedBotEngine();

    // Start cycle if stopped
    const bot = engine.getBot(trade.botId);
    if (bot && bot.getState() === 'STOPPED') {
      await engine.startBot(trade.botId);
    }

    // Execute buy
    const buyResult = await engine.executeBotBuy(trade.botId, {
      quoteOrderQty: trade.requestedAmount,
      orderType: 'MARKET',
      price: trade.plannedPrice || undefined,
    });

    if (buyResult.outcome === 'SUCCESS') {
      // Confirmed filled on Binance!
      const filledPrice = buyResult.avgPrice || trade.plannedPrice || 50000;
      const filledQty = buyResult.executedQty || trade.requestedAmount / filledPrice;

      // Extract real confirmed entry fee and rate from Binance fill
      const realFeeAmount = buyResult.commission ? buyResult.commission.amount : trade.costConfig.entryCostAmount;
      const realQuoteSpent = buyResult.cummulativeQuoteQty || trade.requestedAmount;
      const effectiveEntryRate = realQuoteSpent > 0 ? realFeeAmount / realQuoteSpent : trade.costConfig.entryCostRate;

      // Rule: Replace manual data automatically with confirmed real data
      const updatedCostConfig: TradeCostConfig = {
        entryCostAmount: Number(realFeeAmount.toFixed(8)),
        entryCostRate: Number(effectiveEntryRate.toFixed(8)),
        exitCostRate: trade.costConfig.exitCostRate || effectiveEntryRate,
        source: 'REAL_CONFIRMED_RECENT',
        updatedAt: Date.now(),
        description: 'بيانات حقيقية مؤكدة حديثًا من تنفيذ أمر الشراء على Binance',
        isRealConfirmed: true,
      };

      trade.costConfig = updatedCostConfig;

      // Rule: Save real confirmed data for this symbol for future trades
      sharedSymbolCostStore.saveConfirmedCost({
        symbol: trade.symbol,
        effectiveEntryRate: updatedCostConfig.entryCostRate,
        effectiveExitRate: updatedCostConfig.exitCostRate,
        lastConfirmedEntryFee: realFeeAmount,
        confirmedAt: Date.now(),
        sourceTradeId: trade.tradeId,
      });

      trade.status = 'OPEN';
      trade.openedAt = Date.now();
      trade.positionManager = 'UNIFIED_T_LADDER';
      trade.isExiting = false;
      trade.entry = {
        requestedAmount: trade.requestedAmount,
        plannedPrice: trade.plannedPrice,
        executionPrice: filledPrice,
        filledQuantity: filledQty,
        executedAt: buyResult.timestamp,
        orderId: buyResult.orderId,
      };
      trade.initialQuantity = filledQty;
      trade.remainingQuantity = filledQty;
      trade.soldQuantity = 0;
      trade.partialExits = [];

      // Phase 4: Explicit separation: Record Binance Confirmed Actual Values
      // Manual values (trade.manualValues) are preserved and NEVER replaced or overwritten
      trade.confirmedValues = {
        confirmedPrice: filledPrice,
        confirmedQuantity: filledQty,
        confirmedQuoteAmount: realQuoteSpent,
        confirmedEntryFee: realFeeAmount,
        orderId: buyResult.orderId,
        confirmedAt: buyResult.timestamp || Date.now(),
        exchangeSource: 'BINANCE_ACTUAL',
        isFeeDeduplicated: true,
      };

      // Construct mathematical T-levels plan with the confirmed real costs
      const botTargetValue = bot?.getConfig().tRuleConfig.targetValue;
      const stepPercent = botTargetValue !== undefined && botTargetValue > 0 ? botTargetValue : 2.0;
      trade.levelsPlan = LevelCalculator.buildTradeLevelsPlan({
        entryPrice: filledPrice,
        filledQuantity: filledQty,
        costConfig: updatedCostConfig,
        stepPercent,
        initialStopPercent: initialStopLossPercent,
      });

      // Construct X/Recovery plan if bot is a RANGE_BOT
      const effectiveXSettings = xSettings || bot?.getConfig().xSettings;
      if (trade.botType === 'RANGE_BOT' || effectiveXSettings?.enabled) {
        trade.xRecoveryPlan = XRecoveryManager.buildPlan({
          entryPrice: filledPrice,
          entryAmount: trade.requestedAmount,
          xSettings: effectiveXSettings,
        });
      }

      trade.notes = `الصفقة مفتوحة بنجاح. ${trade.xRecoveryPlan ? `(خطة تعافي X مفعّلة ${trade.xRecoveryPlan.maxLevels ? `بـ ${trade.xRecoveryPlan.maxLevels} مستويات` : 'ديناميكياً بلا حد ثابت'})` : ''} تم تأكيد التكلفة الحقيقية (عمولة: ${realFeeAmount} USDT).`;
      this.notifyListeners();
    } else if (buyResult.outcome === 'AMBIGUOUS' || buyResult.needsVerification) {
      trade.status = 'PENDING_ENTRY';
      trade.notes = 'أمر الشراء قيد التحقق (AMBIGUOUS). يمنع تكرار الإرسال.';
      this.notifyListeners();
    }

    return trade;
  }

  /**
   * Directly updates an active trade with confirmed real costs.
   * Recalculates T0 and active protection price without user intervention.
   */
  public applyRealConfirmedCost(
    tradeId: string,
    realCost: {
      entryCostAmount?: number;
      entryCostRate?: number;
      exitCostRate?: number;
    }
  ): ManagedTrade {
    const trade = this.trades.get(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found.`);

    const newEntryAmount =
      realCost.entryCostAmount !== undefined
        ? realCost.entryCostAmount
        : trade.costConfig.entryCostAmount;

    const newEntryRate =
      realCost.entryCostRate !== undefined
        ? realCost.entryCostRate
        : trade.costConfig.entryCostRate;

    const newExitRate =
      realCost.exitCostRate !== undefined
        ? realCost.exitCostRate
        : trade.costConfig.exitCostRate;

    const updatedCostConfig: TradeCostConfig = {
      entryCostAmount: Number(newEntryAmount.toFixed(8)),
      entryCostRate: Number(newEntryRate.toFixed(8)),
      exitCostRate: Number(newExitRate.toFixed(8)),
      source: 'REAL_CONFIRMED_RECENT',
      updatedAt: Date.now(),
      description: 'تم تحديث التكاليف ببيانات حقيقية مؤكدة أثناء تشغيل الصفقة',
      isRealConfirmed: true,
    };

    trade.costConfig = updatedCostConfig;

    // If trade is currently OPEN, immediately recalculate levels and T0
    if (trade.status === 'OPEN' && trade.levelsPlan) {
      LevelCalculator.recalculateWithUpdatedCosts(trade.levelsPlan, updatedCostConfig);
    }

    // Save as default for symbol
    sharedSymbolCostStore.saveConfirmedCost({
      symbol: trade.symbol,
      effectiveEntryRate: updatedCostConfig.entryCostRate,
      effectiveExitRate: updatedCostConfig.exitCostRate,
      lastConfirmedEntryFee: updatedCostConfig.entryCostAmount,
      confirmedAt: Date.now(),
      sourceTradeId: trade.tradeId,
    });

    trade.notes = `تم استبدال البيانات بتكاليف حقيقية مؤكدة حديثًا وتحديث T0 إلى ${trade.levelsPlan?.t0BreakEvenPrice} USDT.`;
    this.notifyListeners();

    return trade;
  }

  /**
   * Updates X/Recovery settings for an active RANGE_BOT trade on the fly.
   * Modifies stepPercent, recoveryRatio, and maxLevels according to user inputs.
   * Recalculates all pending levels dynamically.
   */
  public updateTradeXSettings(
    tradeId: string,
    settings: {
      stepPercent?: number;
      recoveryRatio?: number;
      customAllocationQuote?: number;
      maxLevels?: number | null;
    }
  ): ManagedTrade {
    const trade = this.trades.get(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found.`);
    if (!trade.xRecoveryPlan) throw new Error(`Trade ${tradeId} does not have an active X/Recovery plan.`);

    if (settings.stepPercent !== undefined && settings.stepPercent > 0) {
      trade.xRecoveryPlan.stepPercent = settings.stepPercent;
    }
    if (settings.recoveryRatio !== undefined && settings.recoveryRatio > 0) {
      trade.xRecoveryPlan.recoveryRatio = settings.recoveryRatio;
    }
    if (settings.customAllocationQuote !== undefined) {
      trade.xRecoveryPlan.customAllocationQuote =
        settings.customAllocationQuote > 0 ? settings.customAllocationQuote : undefined;
    }
    if (settings.maxLevels !== undefined) {
      trade.xRecoveryPlan.maxLevels =
        settings.maxLevels === null || isNaN(settings.maxLevels) || settings.maxLevels <= 0
          ? undefined
          : settings.maxLevels;
    }

    // Recompute trigger prices and quote allocations for all PENDING levels
    for (const lvl of trade.xRecoveryPlan.levels) {
      if (lvl.status === 'PENDING') {
        const dropMultiplier = 1 - (lvl.levelIndex * trade.xRecoveryPlan.stepPercent) / 100;
        lvl.triggerPrice = Number((trade.xRecoveryPlan.baseEntryPrice * dropMultiplier).toFixed(8));
        lvl.allocationQuote =
          trade.xRecoveryPlan.customAllocationQuote !== undefined && trade.xRecoveryPlan.customAllocationQuote > 0
            ? Number(trade.xRecoveryPlan.customAllocationQuote.toFixed(8))
            : Number(
                (
                  trade.xRecoveryPlan.baseEntryAmount *
                  Math.pow(trade.xRecoveryPlan.recoveryRatio, lvl.levelIndex)
                ).toFixed(8)
              );
      }
    }

    // If maxLevels is set, remove any pending levels that exceed the new ceiling
    if (trade.xRecoveryPlan.maxLevels !== undefined) {
      trade.xRecoveryPlan.levels = trade.xRecoveryPlan.levels.filter(
        (l) => l.status === 'EXECUTED' || l.levelIndex <= trade.xRecoveryPlan!.maxLevels!
      );
    }

    trade.notes = `تم تحديث إعدادات X بنجاح: نسبة الهبوط ${trade.xRecoveryPlan.stepPercent}%، مضاعف الحجم ${trade.xRecoveryPlan.recoveryRatio}${trade.xRecoveryPlan.customAllocationQuote ? `، حجم التعزيز: ${trade.xRecoveryPlan.customAllocationQuote} USDT` : ''}، السقف: ${trade.xRecoveryPlan.maxLevels ?? 'غير محدود'}.`;
    this.notifyListeners();
    return trade;
  }

  /**
   * Generates the next recovery level for an active trade on demand.
   */
  public generateNextRecoveryLevel(tradeId: string): import('./types').XRecoveryLevel | null {
    const trade = this.trades.get(tradeId);
    if (!trade || !trade.xRecoveryPlan) return null;
    const next = XRecoveryManager.generateNextLevel(trade.xRecoveryPlan);
    if (next) {
      this.notifyListeners();
    }
    return next;
  }

  /**
   * Executes a recovery level buy for a RANGE_BOT.
   * Recalculates aggregated weighted average entry price, updates T0 and T-levels ladder.
   */
  public async executeRecoveryBuy(tradeId: string, levelIndex: number): Promise<ManagedTrade> {
    const trade = this.trades.get(tradeId);
    if (!trade || !trade.xRecoveryPlan || trade.status !== 'OPEN' || trade.isExiting) return trade!;

    let level = trade.xRecoveryPlan.levels.find((l) => l.levelIndex === levelIndex);
    if (!level) {
      // Dynamically generate levels up to levelIndex if allowed
      while (trade.xRecoveryPlan.levels.length < levelIndex) {
        const next = XRecoveryManager.generateNextLevel(trade.xRecoveryPlan);
        if (!next) break;
      }
      level = trade.xRecoveryPlan.levels.find((l) => l.levelIndex === levelIndex);
    }
    if (!level || level.status !== 'PENDING') return trade;

    const engine = await getSharedBotEngine();
    const buyResult = await engine.executeBotRecoveryBuy(trade.botId, {
      quoteOrderQty: level.allocationQuote,
      orderType: 'MARKET',
      price: level.triggerPrice,
      levelIndex: level.levelIndex,
    });

    if (buyResult.outcome === 'SUCCESS') {
      const fillPrice = buyResult.avgPrice || level.triggerPrice;
      const filledQty = buyResult.executedQty || level.allocationQuote / fillPrice;
      const feePaid = buyResult.commission ? buyResult.commission.amount : level.allocationQuote * trade.costConfig.entryCostRate;

      // Record recovery execution
      XRecoveryManager.recordExecution(trade.xRecoveryPlan, levelIndex, {
        fillPrice,
        filledQty,
        feePaid,
        orderId: buyResult.orderId || `ord_rec_${levelIndex}_${Date.now()}`,
        timestamp: buyResult.timestamp || Date.now(),
      });

      // Calculate aggregated position cleanly anchored to base initial entry without double counting
      const initialQty: number =
        trade.xRecoveryPlan.baseEntryPrice > 0
          ? trade.xRecoveryPlan.baseEntryAmount / trade.xRecoveryPlan.baseEntryPrice
          : (trade.entry.filledQuantity || 0);
      const initialEntry = {
        price: trade.xRecoveryPlan.baseEntryPrice,
        qty: initialQty,
        fee: trade.costConfig.entryCostAmount,
      };

      const aggregated = XRecoveryManager.calculateAggregatedPosition(initialEntry, trade.xRecoveryPlan);

      // Update trade entry execution price and quantity with aggregated values
      trade.entry.executionPrice = aggregated.averageEntryPrice;
      trade.entry.filledQuantity = aggregated.totalQuantity;
      trade.initialQuantity = aggregated.totalQuantity;
      trade.remainingQuantity = Number(((trade.remainingQuantity || 0) + filledQty).toFixed(8));

      // Recalculate T0 and T-levels anchored to new aggregated average entry price
      if (trade.levelsPlan) {
        LevelCalculator.recalculateWithAggregatedEntry(
          trade.levelsPlan,
          aggregated.averageEntryPrice,
          aggregated.totalQuantity,
          aggregated.totalEntryFees
        );
      }

      trade.notes = `تم تنفيذ تعزيز المسار العرضي (مستوى X رقم ${levelIndex}) بنجاح. متوسط السعر الجديد: ${aggregated.averageEntryPrice} USDT، الكمية الإجمالية: ${aggregated.totalQuantity}، T0 الجديد: ${trade.levelsPlan?.t0BreakEvenPrice} USDT.`;
      this.notifyListeners();
    }

    return trade;
  }

  /**
   * Evaluates price ticks against open trades:
   * 1. Checks X/Recovery triggers for RANGE_BOT.
   * 2. Evaluates trailing T-levels and protection triggers.
   */
  public async onMarketPriceTick(symbol: string, currentPrice: number): Promise<void> {
    if (!currentPrice || currentPrice <= 0 || this.isProcessingTick) return;
    this.isProcessingTick = true;

    try {
      // Update the central market store with the currentPrice tick to ensure fresh market data for order execution
      const now = Date.now();
      sharedMarketDataStore.updatePrice(symbol, currentPrice, now, now);

      for (const trade of this.trades.values()) {
        if (trade.symbol === symbol) {
          // Check Pre-Entry Recovery for trades waiting for entry
          if (
            trade.status === 'PENDING_ENTRY' &&
            trade.preEntryXMonitor &&
            trade.preEntryXMonitor.enabled
          ) {
            const preResult = XRecoveryManager.evaluatePreEntryTick(
              trade.preEntryXMonitor,
              currentPrice
            );

            if (preResult.shouldBuy) {
              // Rule: 3 consecutive recoveries achieved during ascent -> execute buy entry!
              await this.executeTradeEntry(
                trade.tradeId,
                trade.xRecoveryPlan?.enabled ? { enabled: true, stepPercent: trade.preEntryXMonitor.stepPercent } : undefined
              );
              continue;
            } else if (preResult.stateChanged) {
              this.notifyListeners();
            }
          }

          // Check Open Trades: ALL OPEN trades governed exclusively by unified T-levels ladder
          if (trade.status === 'OPEN' && trade.levelsPlan) {
            trade.positionManager = 'UNIFIED_T_LADDER';

            // Step 1: Check dynamic recovery if enabled and position is not exiting
            if (trade.xRecoveryPlan && trade.xRecoveryPlan.enabled && !trade.isExiting) {
              const recoveryTrigger = XRecoveryManager.checkTrigger(trade.xRecoveryPlan, currentPrice);
              if (recoveryTrigger) {
                await this.executeRecoveryBuy(trade.tradeId, recoveryTrigger.levelIndex);
                continue; // Re-evaluate on next tick with new average price
              }
            }

            // Step 2: Unified T-levels ladder and trailing protection (sole authority for exit)
            if (!trade.isExiting) {
              const evalResult = LevelCalculator.evaluatePriceTick(trade.levelsPlan, currentPrice);

              if (evalResult.levelAdvanced) {
                trade.notes = `تقدم المستوى إلى ${evalResult.newAchievedLevel}، مستوى الحماية الحالي: ${evalResult.newProtectionPrice} USDT`;
                this.notifyListeners();
              }

              if (evalResult.shouldSell) {
                // Trigger Sell via Trading Layer for full quantity
                await this.executeTradeExit(trade.tradeId, evalResult.triggerReason || 'تحقق شرط الحماية');
              }
            }
          }
        }
      }
    } finally {
      this.isProcessingTick = false;
    }
  }

  /**
  /**
   * Executes Sell order via Binance Trading Layer (Mock) and calculates Net PnL.
   * Stage 3: Requests selling the entire remaining quantity in one order.
   * If Binance executes partially:
   * - Records executed portion as an independent slice with its own profit & fees.
   * - Unsold quantity remains OPEN and governed by T-levels ladder until fully sold.
   * - Trade is not marked CLOSED until total quantity is confirmed sold.
   * - Prevents duplicate orders and locks during AMBIGUOUS state.
   */
  public async executeTradeExit(tradeId: string, reason: string): Promise<ManagedTrade> {
    const trade = this.trades.get(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found.`);
    // Anti-conflict position lock: prevent dual or concurrent managers from issuing conflicting exits
    if (trade.status !== 'OPEN' || trade.isExiting) return trade;

    const qtyToSell = trade.remainingQuantity !== undefined ? trade.remainingQuantity : (trade.entry.filledQuantity || 1);
    if (qtyToSell <= 0) {
      return trade;
    }

    trade.isExiting = true;
    trade.status = 'PENDING_EXIT';
    this.notifyListeners();

    try {
      const engine = await getSharedBotEngine();

      const sellResult = await engine.executeBotSell(trade.botId, {
        isPartial: false, // Rule: System always requests selling the full remaining quantity in one order
        quantity: qtyToSell,
        orderType: 'MARKET',
        reason,
      });

      const entryPrice = trade.entry.executionPrice || 1;
      const initialTotalQty = trade.initialQuantity || trade.entry.filledQuantity || qtyToSell;

      if (sellResult.outcome === 'SUCCESS' || sellResult.outcome === 'PARTIAL') {
        const exitPrice = sellResult.avgPrice || trade.levelsPlan?.activeProtectionPrice || entryPrice;
        const exitQty = Number((sellResult.executedQty || 0).toFixed(8));

        // Did Binance execute the full requested quantity or a partial portion?
        const isFullFill = sellResult.outcome === 'SUCCESS' && exitQty >= (qtyToSell - 1e-7);
        const actualSoldSlice = isFullFill ? qtyToSell : Math.min(exitQty, qtyToSell);

        if (actualSoldSlice > 0) {
          // 1. Calculate proportional entry fee share for this executed slice
          const entryFeeShare = initialTotalQty > 0
            ? (trade.costConfig.entryCostAmount * (actualSoldSlice / initialTotalQty))
            : 0;

          // 2. Real confirmed exit commission for this execution
          const realExitFee = sellResult.commission
            ? sellResult.commission.amount
            : exitPrice * actualSoldSlice * trade.costConfig.exitCostRate;

          const grossReturn = (exitPrice - entryPrice) * actualSoldSlice;
          const netReturnQuote = grossReturn - (entryFeeShare + realExitFee);
          const investedSlice = entryPrice * actualSoldSlice;
          const netReturnPercent = investedSlice > 0 ? (netReturnQuote / investedSlice) * 100 : 0;

          const newRemaining = Number(Math.max(0, qtyToSell - actualSoldSlice).toFixed(8));

          // 3. Independent ledger record for this execution
          const record: import('./types').PartialExitRecord = {
            recordId: `exit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            orderId: sellResult.orderId,
            executionPrice: exitPrice,
            soldQuantity: actualSoldSlice,
            remainingQuantityAfter: newRemaining,
            entryCostQuotePortion: Number(entryFeeShare.toFixed(6)),
            exitCostQuote: Number(realExitFee.toFixed(6)),
            grossReturnQuote: Number(grossReturn.toFixed(4)),
            netReturnQuote: Number(netReturnQuote.toFixed(4)),
            netReturnPercent: Number(netReturnPercent.toFixed(2)),
            isProfitable: netReturnQuote > 0,
            executedAt: sellResult.timestamp || Date.now(),
            reason,
          };

          if (!trade.partialExits) {
            trade.partialExits = [];
          }
          trade.partialExits.push(record);

          // Update quantities
          trade.soldQuantity = Number(((trade.soldQuantity || 0) + actualSoldSlice).toFixed(8));
          trade.remainingQuantity = newRemaining;

          // Update symbol store costs
          const realQuoteReceived = exitPrice * actualSoldSlice;
          const effectiveExitRate = realQuoteReceived > 0 ? realExitFee / realQuoteReceived : trade.costConfig.exitCostRate;
          trade.costConfig.exitCostRate = Number(effectiveExitRate.toFixed(8));
          trade.costConfig.updatedAt = Date.now();

          sharedSymbolCostStore.saveConfirmedCost({
            symbol: trade.symbol,
            effectiveEntryRate: trade.costConfig.entryCostRate,
            effectiveExitRate,
            lastConfirmedEntryFee: trade.costConfig.entryCostAmount,
            lastConfirmedExitFee: realExitFee,
            confirmedAt: Date.now(),
            sourceTradeId: trade.tradeId,
          });

          if (isFullFill || newRemaining <= 0) {
            // === FULL EXECUTION: TRADE IS COMPLETELY CLOSED ===
            trade.status = 'CLOSED';
            trade.closedAt = Date.now();
            trade.closeReason = reason;
            trade.isExiting = false;
            trade.exit = {
              executionPrice: exitPrice,
              filledQuantity: actualSoldSlice,
              executedAt: sellResult.timestamp,
              orderId: sellResult.orderId,
              reason,
            };

            if (trade.confirmedValues) {
              trade.confirmedValues.confirmedExitFee = realExitFee;
              trade.confirmedValues.isFeeDeduplicated = true;
            }

            // Aggregate overall net PnL across all partial exits
            const totalGross = trade.partialExits.reduce((acc, r) => acc + r.grossReturnQuote, 0);
            const totalFees = trade.partialExits.reduce((acc, r) => acc + (r.entryCostQuotePortion + r.exitCostQuote), 0);
            const totalNet = trade.partialExits.reduce((acc, r) => acc + r.netReturnQuote, 0);
            const totalInvested = entryPrice * initialTotalQty;
            const totalNetPercent = totalInvested > 0 ? (totalNet / totalInvested) * 100 : 0;

            trade.pnl = {
              grossReturnQuote: Number(totalGross.toFixed(8)),
              totalFeesQuote: Number(totalFees.toFixed(8)),
              netReturnQuote: Number(totalNet.toFixed(8)),
              netReturnPercent: Number(totalNetPercent.toFixed(6)),
              isProfitable: totalNet > 0,
            };

            trade.notes = `تم إغلاق الصفقة بالكامل بعد بيع كامل الكمية (${trade.soldQuantity}). صافي الربح الإجمالي: ${trade.pnl.netReturnQuote} USDT (${trade.pnl.netReturnPercent}%). إجمالي العمولات: ${trade.pnl.totalFeesQuote} USDT.`;
          } else {
            // === PARTIAL EXECUTION: REMAINING QUANTITY STAYS OPEN UNDER T-LEVELS ===
            trade.status = 'OPEN';
            trade.isExiting = false;

            // Recalculate remaining levelsPlan entry commission & T0 for the remaining quantity
            if (trade.levelsPlan) {
              const remainingEntryComm = initialTotalQty > 0
                ? trade.costConfig.entryCostAmount * (newRemaining / initialTotalQty)
                : 0;
              trade.levelsPlan.filledQuantity = newRemaining;
              trade.levelsPlan.entryCommissionQuote = Number(remainingEntryComm.toFixed(8));
              trade.levelsPlan.t0BreakEvenPrice = LevelCalculator.calculateT0BreakEven(
                trade.levelsPlan.entryPrice,
                newRemaining,
                trade.levelsPlan.entryCommissionQuote,
                trade.levelsPlan.exitCommissionRate
              );
            }

            trade.notes = `تنفيذ بيع جزئي: تم بيع ${actualSoldSlice} بسعر ${exitPrice} USDT، المتبقي ${newRemaining} مفتوح ويخضع لمستويات T. ربح الجزء المباع: ${record.netReturnQuote} USDT.`;
          }
          this.notifyListeners();
        } else {
          // Zero quantity executed
          trade.status = 'OPEN';
          trade.isExiting = false;
          this.notifyListeners();
        }
      } else if (sellResult.outcome === 'AMBIGUOUS' || sellResult.needsVerification) {
        trade.status = 'PENDING_EXIT';
        trade.isExiting = true; // Retain lock to prevent duplicate order dispatch
        trade.notes = `أمر البيع (${reason}) قيد التحقق (AMBIGUOUS). يمنع تكرار الإرسال حتى التحقق من Binance.`;
        this.notifyListeners();
      } else if (sellResult.outcome === 'FAILED') {
        trade.status = 'OPEN';
        trade.isExiting = false;
        trade.notes = `فشل إرسال أمر البيع: ${sellResult.error || 'خطأ غير محدد'}. عادت الصفقة لحالة المراقبة بمستويات T.`;
        this.notifyListeners();
      }
    } finally {
      if (trade.status === 'CLOSED') {
        trade.isExiting = false;
      }
    }

    return trade;
  }

  /**
   * Verifies an ambiguous order with Binance Mock.
   * Stage 3: Resolves both full and partial fills with ledger records and T-level continuity.
   */
  public async verifyTrade(tradeId: string): Promise<ManagedTrade> {
    const trade = this.trades.get(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found.`);

    const engine = await getSharedBotEngine();
    const orderId = trade.entry.orderId || trade.exit?.orderId || undefined;
    const verifyRes = await engine.verifyBotOrder(trade.botId, orderId);

    if (verifyRes.found) {
      if (trade.status === 'PENDING_ENTRY' && verifyRes.status === 'FILLED') {
        const filledPrice = verifyRes.avgPrice || 50000;
        const filledQty = verifyRes.executedQty || trade.requestedAmount / filledPrice;
        const realFee = trade.costConfig.entryCostAmount;

        trade.costConfig = {
          entryCostAmount: realFee,
          entryCostRate: trade.requestedAmount > 0 ? realFee / trade.requestedAmount : trade.costConfig.entryCostRate,
          exitCostRate: trade.costConfig.exitCostRate,
          source: 'REAL_CONFIRMED_RECENT',
          updatedAt: Date.now(),
          description: 'تم تأكيد التكلفة الحقيقية عبر استعلام التحقق (Verify) مع Binance',
          isRealConfirmed: true,
        };

        sharedSymbolCostStore.saveConfirmedCost({
          symbol: trade.symbol,
          effectiveEntryRate: trade.costConfig.entryCostRate,
          effectiveExitRate: trade.costConfig.exitCostRate,
          lastConfirmedEntryFee: realFee,
          confirmedAt: Date.now(),
        });

        trade.status = 'OPEN';
        trade.openedAt = Date.now();
        trade.isExiting = false;
        trade.positionManager = 'UNIFIED_T_LADDER';
        trade.entry = {
          requestedAmount: trade.requestedAmount,
          executionPrice: filledPrice,
          filledQuantity: filledQty,
          orderId: verifyRes.orderId,
          executedAt: verifyRes.timestamp,
        };
        trade.initialQuantity = filledQty;
        trade.remainingQuantity = filledQty;
        trade.soldQuantity = 0;
        trade.partialExits = [];

        trade.levelsPlan = LevelCalculator.buildTradeLevelsPlan({
          entryPrice: filledPrice,
          filledQuantity: filledQty,
          costConfig: trade.costConfig,
          stepPercent: 2.0,
        });
        trade.notes = 'تم تأكيد أمر الدخول بنجاح عبر استعلام التحقق (Verify).';
      } else if (trade.status === 'PENDING_EXIT') {
        const prevRemaining = trade.remainingQuantity !== undefined ? trade.remainingQuantity : (trade.entry.filledQuantity || 1);
        const exitPrice = verifyRes.avgPrice || trade.entry.executionPrice || 1;
        const initialTotalQty = trade.initialQuantity || trade.entry.filledQuantity || prevRemaining;
        const entryPrice = trade.entry.executionPrice || exitPrice;

        if (verifyRes.status === 'FILLED' || verifyRes.status === 'PARTIALLY_FILLED') {
          const executedQty = Number((verifyRes.executedQty || prevRemaining).toFixed(8));
          const isFull = verifyRes.status === 'FILLED' && executedQty >= (prevRemaining - 1e-7);
          const actualSoldSlice = isFull ? prevRemaining : Math.min(executedQty, prevRemaining);

          if (actualSoldSlice > 0) {
            const entryFeeShare = initialTotalQty > 0
              ? (trade.costConfig.entryCostAmount * (actualSoldSlice / initialTotalQty))
              : 0;
            const realExitFee = exitPrice * actualSoldSlice * trade.costConfig.exitCostRate;
            const grossReturn = (exitPrice - entryPrice) * actualSoldSlice;
            const netReturnQuote = grossReturn - (entryFeeShare + realExitFee);
            const investedSlice = entryPrice * actualSoldSlice;
            const netReturnPercent = investedSlice > 0 ? (netReturnQuote / investedSlice) * 100 : 0;
            const newRemaining = Number(Math.max(0, prevRemaining - actualSoldSlice).toFixed(8));

            const record: import('./types').PartialExitRecord = {
              recordId: `exit_vfy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              orderId: verifyRes.orderId,
              executionPrice: exitPrice,
              soldQuantity: actualSoldSlice,
              remainingQuantityAfter: newRemaining,
              entryCostQuotePortion: Number(entryFeeShare.toFixed(6)),
              exitCostQuote: Number(realExitFee.toFixed(6)),
              grossReturnQuote: Number(grossReturn.toFixed(4)),
              netReturnQuote: Number(netReturnQuote.toFixed(4)),
              netReturnPercent: Number(netReturnPercent.toFixed(2)),
              isProfitable: netReturnQuote > 0,
              executedAt: verifyRes.timestamp || Date.now(),
              reason: 'تأكيد عبر التحقق (Verify)',
            };

            if (!trade.partialExits) trade.partialExits = [];
            trade.partialExits.push(record);

            trade.soldQuantity = Number(((trade.soldQuantity || 0) + actualSoldSlice).toFixed(8));
            trade.remainingQuantity = newRemaining;

            if (isFull || newRemaining <= 0) {
              trade.status = 'CLOSED';
              trade.closedAt = Date.now();
              trade.closeReason = 'تأكيد إغلاق بالكامل عبر استعلام التحقق (Verify)';
              trade.isExiting = false;
              trade.exit = {
                executionPrice: exitPrice,
                filledQuantity: actualSoldSlice,
                executedAt: verifyRes.timestamp || Date.now(),
                orderId: verifyRes.orderId,
                reason: 'تأكيد تنفيذ البيع عبر استعلام التحقق (Verify)',
              };

              const totalGross = trade.partialExits.reduce((acc, r) => acc + r.grossReturnQuote, 0);
              const totalFees = trade.partialExits.reduce((acc, r) => acc + (r.entryCostQuotePortion + r.exitCostQuote), 0);
              const totalNet = trade.partialExits.reduce((acc, r) => acc + r.netReturnQuote, 0);
              const totalInvested = entryPrice * initialTotalQty;
              const totalNetPercent = totalInvested > 0 ? (totalNet / totalInvested) * 100 : 0;

              trade.pnl = {
                grossReturnQuote: Number(totalGross.toFixed(8)),
                totalFeesQuote: Number(totalFees.toFixed(8)),
                netReturnQuote: Number(totalNet.toFixed(8)),
                netReturnPercent: Number(totalNetPercent.toFixed(6)),
                isProfitable: totalNet > 0,
              };
              trade.notes = `تم تأكيد إغلاق الصفقة بالكامل بالتحقق. صافي الربح: ${trade.pnl.netReturnQuote} USDT (${trade.pnl.netReturnPercent}%).`;
            } else {
              trade.status = 'OPEN';
              trade.isExiting = false;
              if (trade.levelsPlan) {
                const remainingEntryComm = initialTotalQty > 0
                  ? trade.costConfig.entryCostAmount * (newRemaining / initialTotalQty)
                  : 0;
                trade.levelsPlan.filledQuantity = newRemaining;
                trade.levelsPlan.entryCommissionQuote = Number(remainingEntryComm.toFixed(8));
                trade.levelsPlan.t0BreakEvenPrice = LevelCalculator.calculateT0BreakEven(
                  trade.levelsPlan.entryPrice,
                  newRemaining,
                  trade.levelsPlan.entryCommissionQuote,
                  trade.levelsPlan.exitCommissionRate
                );
              }
              trade.notes = `تم تأكيد بيع جزئي بالتحقق: بيع ${actualSoldSlice}، المتبقي ${newRemaining} مستمر تحت مستويات T.`;
            }
          }
        } else if (verifyRes.status === 'CANCELED' || verifyRes.status === 'REJECTED' || verifyRes.status === 'EXPIRED') {
          trade.status = 'OPEN';
          trade.isExiting = false;
          trade.notes = `أمر البيع ملغى على Binance (${verifyRes.status}). عادت الصفقة لحالة المراقبة بمستويات T.`;
        }
      }
      this.notifyListeners();
    }

    return trade;
  }

  public getTrade(tradeId: string): ManagedTrade | undefined {
    return this.trades.get(tradeId);
  }

  public getTradeByBotId(botId: string): ManagedTrade | undefined {
    return Array.from(this.trades.values()).find((t) => t.botId === botId);
  }

  /**
   * Adopts an existing BotInstance from BotEngine into TradeManager if not already managed.
   * This bridges any bot created via BotEngine or previous sessions so that it participates
   * in the unified trade lifecycle (T0, T-levels ladder, trailing protection, Net PnL).
   */
  public async adoptBotAsManagedTrade(botId: string): Promise<ManagedTrade | undefined> {
    const existing = this.getTradeByBotId(botId);

    const engine = await getSharedBotEngine();
    const bot = engine.getBot(botId);
    if (!bot) return existing;

    const cfg = bot.getConfig();
    const trade = bot.getCurrentTrade();
    const cycle = bot.getCurrentCycle();
    const state = bot.getState();

    const isClosed = state === 'POSITION_CLOSED';
    const isOpen = state === 'POSITION_OPEN';
    const isPendingEntry = state === 'EXECUTING_BUY' || state === 'VERIFYING_BUY' || state === 'ENTRY_TRIGGERED';
    const isPendingExit = state === 'EXECUTING_SELL' || state === 'VERIFYING_SELL';

    const execPrice = trade?.entry.executionPrice || cfg.entryAmount;
    const filledQty = trade?.entry.filledQuantity || (execPrice > 0 ? cfg.entryAmount / execPrice : 1);

    if (existing) {
      let changed = false;
      if (isClosed && existing.status !== 'CLOSED') {
        existing.status = 'CLOSED';
        existing.closedAt = trade?.exit.executedAt || Date.now();
        existing.closeReason = trade?.exit.reason || 'إغلاق من البوت';
        if (trade?.exit.executedAt) {
          existing.exit = {
            executionPrice: trade.exit.executionPrice || undefined,
            filledQuantity: trade.exit.filledQuantity || undefined,
            executedAt: trade.exit.executedAt,
            orderId: trade.exit.orderId,
            reason: trade.exit.reason || 'إغلاق من البوت',
          };
        }
        if (!existing.pnl && existing.entry.executionPrice && existing.exit?.executionPrice) {
          existing.pnl = LevelCalculator.calculateNetPnL({
            entryPrice: existing.entry.executionPrice,
            exitPrice: existing.exit.executionPrice,
            filledQuantity: existing.exit.filledQuantity || existing.entry.filledQuantity || 1,
            entryCommissionQuote: existing.levelsPlan?.entryCommissionQuote || existing.costConfig.entryCostAmount,
            exitCommissionQuote: existing.exit.executionPrice * (existing.exit.filledQuantity || 1) * existing.costConfig.exitCostRate,
          });
        }
        changed = true;
      } else if (isOpen && existing.status !== 'OPEN') {
        existing.status = 'OPEN';
        existing.openedAt = trade?.entry.executedAt || Date.now();
        existing.positionManager = 'UNIFIED_T_LADDER';
        existing.isExiting = false;
        if (trade?.entry.executionPrice) {
          existing.entry.executionPrice = trade.entry.executionPrice;
          existing.entry.filledQuantity = trade.entry.filledQuantity;
          existing.entry.executedAt = trade.entry.executedAt;
          existing.entry.orderId = trade.entry.orderId;
        }
        if (!existing.levelsPlan && existing.entry.executionPrice && existing.entry.filledQuantity) {
          existing.levelsPlan = LevelCalculator.buildTradeLevelsPlan({
            entryPrice: existing.entry.executionPrice,
            filledQuantity: existing.entry.filledQuantity,
            costConfig: existing.costConfig,
            stepPercent: cfg.tRuleConfig.targetValue || 2.0,
          });
          if (cfg.type === 'RANGE_BOT' || cfg.xSettings?.enabled) {
            existing.xRecoveryPlan = XRecoveryManager.buildPlan({
              entryPrice: existing.entry.executionPrice,
              entryAmount: existing.requestedAmount,
              xSettings: cfg.xSettings,
            });
          }
        }
        changed = true;
      } else if (isPendingExit && existing.status !== 'PENDING_EXIT') {
        existing.status = 'PENDING_EXIT';
        changed = true;
      } else if (isPendingEntry && existing.status !== 'PENDING_ENTRY' && existing.status !== 'OPEN' && existing.status !== 'CLOSED') {
        existing.status = 'PENDING_ENTRY';
        changed = true;
      }

      if (changed) {
        this.notifyListeners();
      }
      return existing;
    }

    const tradeId = trade?.tradeId || `trd_adopt_${botId}_${Date.now()}`;
    const initialCostConfig = sharedSymbolCostStore.resolveInitialCostConfig({
      symbol: cfg.symbol,
      entryAmount: cfg.entryAmount,
    });

    const managedTrade: ManagedTrade = {
      tradeId,
      botId: cfg.id,
      symbol: cfg.symbol,
      source: 'MANUAL',
      botType: cfg.type === 'RANGE_BOT' ? 'RANGE_BOT' : 'DEAL_BOT',
      status: isClosed ? 'CLOSED' : isPendingExit ? 'PENDING_EXIT' : isOpen ? 'OPEN' : isPendingEntry ? 'PENDING_ENTRY' : 'PENDING_ENTRY',
      requestedAmount: cfg.entryAmount,
      plannedPrice: trade?.entry.plannedPrice || null,
      entry: {
        requestedAmount: cfg.entryAmount,
        plannedPrice: trade?.entry.plannedPrice || null,
        executionPrice: trade?.entry.executionPrice,
        filledQuantity: trade?.entry.filledQuantity,
        executedAt: trade?.entry.executedAt,
        orderId: trade?.entry.orderId,
      },
      exit: trade?.exit.executedAt ? {
        executionPrice: trade.exit.executionPrice || undefined,
        filledQuantity: trade.exit.filledQuantity || undefined,
        executedAt: trade.exit.executedAt,
        orderId: trade.exit.orderId,
        reason: trade.exit.reason || 'إغلاق من البوت',
      } : undefined,
      costConfig: initialCostConfig,
      initialQuantity: trade?.entry.filledQuantity || filledQty,
      remainingQuantity: isOpen ? (trade?.entry.filledQuantity || filledQty) : 0,
      soldQuantity: isClosed ? (trade?.exit?.filledQuantity || filledQty) : 0,
      partialExits: [],
      manualValues: {
        manualAmount: cfg.entryAmount,
        manualPlannedPrice: trade?.entry.plannedPrice || null,
        manualEstimatedQuantity: trade?.entry.plannedPrice ? Number((cfg.entryAmount / trade.entry.plannedPrice).toFixed(8)) : null,
        manualEntryFeePercent: initialCostConfig.entryFeePercent,
        manualEntryFeeAmount: initialCostConfig.entryFeeAmount,
        manualExitFeePercent: initialCostConfig.exitFeePercent,
        manualExitFeeAmount: initialCostConfig.exitFeeAmount,
        manualEntryFee: initialCostConfig.entryCostAmount,
        manualExitFeeRate: initialCostConfig.exitCostRate,
        manualStepPercent: cfg.tRuleConfig.targetValue || 2.0,
        manualStopLossPercent: 0,
        approvedAt: cycle?.startedAt || Date.now(),
      },
      confirmedValues: execPrice && filledQty ? {
        confirmedPrice: execPrice,
        confirmedQuantity: filledQty,
        confirmedQuoteAmount: execPrice * filledQty,
        confirmedEntryFee: initialCostConfig.entryCostAmount,
        orderId: trade?.entry.orderId,
        confirmedAt: trade?.entry.executedAt || Date.now(),
        exchangeSource: 'BINANCE_ACTUAL',
        isFeeDeduplicated: true,
      } : null,
      createdAt: cycle?.startedAt || Date.now(),
      openedAt: trade?.entry.executedAt,
      closedAt: trade?.exit.executedAt,
      closeReason: trade?.exit.reason,
      notes: `تم ربط البوت «${cfg.name}» في دورة التداول الموحدة (الحالة: ${state}).`,
    };

    if (isOpen && execPrice && filledQty) {
      managedTrade.positionManager = 'UNIFIED_T_LADDER';
      managedTrade.isExiting = false;
      managedTrade.levelsPlan = LevelCalculator.buildTradeLevelsPlan({
        entryPrice: execPrice,
        filledQuantity: filledQty,
        costConfig: initialCostConfig,
        stepPercent: cfg.tRuleConfig.targetValue || 2.0,
      });

      if (cfg.type === 'RANGE_BOT' || cfg.xSettings?.enabled) {
        managedTrade.xRecoveryPlan = XRecoveryManager.buildPlan({
          entryPrice: execPrice,
          entryAmount: cfg.entryAmount,
          xSettings: cfg.xSettings,
        });
      }
    } else if (isClosed && trade?.exit.executionPrice) {
      managedTrade.pnl = LevelCalculator.calculateNetPnL({
        entryPrice: execPrice || trade.exit.executionPrice,
        exitPrice: trade.exit.executionPrice,
        filledQuantity: filledQty,
        entryCommissionQuote: initialCostConfig.entryCostAmount,
        exitCommissionQuote: trade.exit.executionPrice * filledQty * initialCostConfig.exitCostRate,
      });
    }

    this.trades.set(tradeId, managedTrade);
    this.notifyListeners();
    return managedTrade;
  }

  public listTrades(): ManagedTrade[] {
    return Array.from(this.trades.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getActiveTrades(): ManagedTrade[] {
    return this.listTrades().filter((t) => t.status === 'OPEN' || t.status === 'PENDING_ENTRY');
  }

  public getClosedTrades(): ManagedTrade[] {
    return this.listTrades().filter((t) => t.status === 'CLOSED');
  }

  public getConfirmedSymbolCost(symbol: string): ConfirmedSymbolCost | undefined {
    return sharedSymbolCostStore.getConfirmedCost(symbol);
  }

  private startMarketDataMonitoring(): void {
    if (this.isMonitoringStarted) return;
    this.isMonitoringStarted = true;

    // Listen to market data store updates
    this.unsubscribeMarketData = sharedMarketDataStore.subscribeToChanges(() => {
      // Evaluate all open symbols
      const openSymbols = new Set(
        Array.from(this.trades.values())
          .filter((t) => t.status === 'OPEN')
          .map((t) => t.symbol)
      );

      for (const symbol of openSymbols) {
        const freshPrice = sharedMarketDataStore.getFreshPrice(symbol);
        if (freshPrice !== null) {
          void this.onMarketPriceTick(symbol, freshPrice);
        }
      }
    });
  }

  public destroy(): void {
    if (this.unsubscribeMarketData) {
      this.unsubscribeMarketData();
      this.unsubscribeMarketData = null;
    }
    this.isMonitoringStarted = false;
    this.trades.clear();
    this.listeners.clear();
  }
}

export const sharedTradeManager = TradeManager.getInstance();
