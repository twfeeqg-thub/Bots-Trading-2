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
      botType: params.botType,
      xSettings: params.xSettings,
      initialStopLossPercent: params.initialStopLossPercent,
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
      botType: params.botType,
      xSettings: params.xSettings,
      initialStopLossPercent: params.initialStopLossPercent,
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
    botType?: 'DEAL_BOT' | 'RANGE_BOT';
    xSettings?: import('@/lib/bots/types').XRangeSettings;
    initialStopLossPercent?: number;
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
      createdAt: now,
      notes: `تم إنشاء الصفقة (${initialCostConfig.description}). النوع: ${botType}. المصدر الأولي للتكلفة: ${initialCostConfig.source}`,
    };

    this.trades.set(tradeId, trade);
    this.notifyListeners();

    // Automatically trigger entry execution
    await this.executeTradeEntry(tradeId, xSettings, params.initialStopLossPercent);

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
      trade.entry = {
        requestedAmount: trade.requestedAmount,
        plannedPrice: trade.plannedPrice,
        executionPrice: filledPrice,
        filledQuantity: filledQty,
        executedAt: buyResult.timestamp,
        orderId: buyResult.orderId,
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
    if (!trade || !trade.xRecoveryPlan || trade.status !== 'OPEN') return trade!;

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
    if (!currentPrice || currentPrice <= 0) return;

    for (const trade of this.trades.values()) {
      if (trade.symbol === symbol && trade.status === 'OPEN' && trade.levelsPlan) {
        // Step 1: Check X/Recovery triggers for RANGE_BOT
        if (trade.xRecoveryPlan && trade.xRecoveryPlan.enabled) {
          const recoveryTrigger = XRecoveryManager.checkTrigger(trade.xRecoveryPlan, currentPrice);
          if (recoveryTrigger) {
            await this.executeRecoveryBuy(trade.tradeId, recoveryTrigger.levelIndex);
            continue; // Re-evaluate on next tick with new average price
          }
        }

        // Step 2: Evaluate T-levels ladder and trailing protection
        const evalResult = LevelCalculator.evaluatePriceTick(trade.levelsPlan, currentPrice);

        if (evalResult.levelAdvanced) {
          trade.notes = `تقدم المستوى إلى ${evalResult.newAchievedLevel}، مستوى الحماية الحالي: ${evalResult.newProtectionPrice} USDT`;
          this.notifyListeners();
        }

        if (evalResult.shouldSell) {
          // Trigger Sell via Trading Layer
          await this.executeTradeExit(trade.tradeId, evalResult.triggerReason || 'تحقق شرط الحماية');
        }
      }
    }
  }

  /**
   * Executes Sell order via Binance Trading Layer (Mock) and calculates Net PnL.
   */
  public async executeTradeExit(tradeId: string, reason: string): Promise<ManagedTrade> {
    const trade = this.trades.get(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found.`);
    if (trade.status !== 'OPEN') return trade;

    trade.status = 'PENDING_EXIT';
    this.notifyListeners();

    const engine = await getSharedBotEngine();
    const qtyToSell = trade.entry.filledQuantity || 1;

    const sellResult = await engine.executeBotSell(trade.botId, {
      isPartial: false,
      quantity: qtyToSell,
      orderType: 'MARKET',
      reason,
    });

    if (sellResult.outcome === 'SUCCESS') {
      const exitPrice = sellResult.avgPrice || trade.levelsPlan?.activeProtectionPrice || trade.entry.executionPrice || 1;
      const exitQty = sellResult.executedQty || qtyToSell;

      // Extract real exit commission from fill
      const realExitFee = sellResult.commission ? sellResult.commission.amount : exitPrice * exitQty * trade.costConfig.exitCostRate;
      const realQuoteReceived = exitPrice * exitQty;
      const effectiveExitRate = realQuoteReceived > 0 ? realExitFee / realQuoteReceived : trade.costConfig.exitCostRate;

      // Update trade costs
      trade.costConfig.exitCostRate = Number(effectiveExitRate.toFixed(8));
      trade.costConfig.updatedAt = Date.now();

      // Update confirmed symbol store
      sharedSymbolCostStore.saveConfirmedCost({
        symbol: trade.symbol,
        effectiveEntryRate: trade.costConfig.entryCostRate,
        effectiveExitRate: effectiveExitRate,
        lastConfirmedEntryFee: trade.costConfig.entryCostAmount,
        lastConfirmedExitFee: realExitFee,
        confirmedAt: Date.now(),
        sourceTradeId: trade.tradeId,
      });

      trade.status = 'CLOSED';
      trade.closedAt = Date.now();
      trade.closeReason = reason;
      trade.exit = {
        executionPrice: exitPrice,
        filledQuantity: exitQty,
        executedAt: sellResult.timestamp,
        orderId: sellResult.orderId,
        reason,
      };

      // Calculate exact Net PnL using real confirmed entry and exit fees
      trade.pnl = LevelCalculator.calculateNetPnL({
        entryPrice: trade.entry.executionPrice || exitPrice,
        exitPrice,
        filledQuantity: exitQty,
        entryCommissionQuote: trade.levelsPlan?.entryCommissionQuote || trade.costConfig.entryCostAmount,
        exitCommissionQuote: realExitFee,
      });

      trade.notes = `تم إغلاق الصفقة بنجاح: ${reason}. صافي الربح: ${trade.pnl.netReturnQuote} USDT (${trade.pnl.netReturnPercent}%). العمولات الفعلية: ${trade.pnl.totalFeesQuote} USDT.`;
      this.notifyListeners();
    }

    return trade;
  }

  /**
   * Verifies an ambiguous order with Binance Mock.
   */
  public async verifyTrade(tradeId: string): Promise<ManagedTrade> {
    const trade = this.trades.get(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found.`);

    const engine = await getSharedBotEngine();
    const orderId = trade.entry.orderId || trade.exit?.orderId || undefined;
    const verifyRes = await engine.verifyBotOrder(trade.botId, orderId);

    if (verifyRes.found && verifyRes.status === 'FILLED') {
      if (trade.status === 'PENDING_ENTRY') {
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
        trade.entry = {
          requestedAmount: trade.requestedAmount,
          executionPrice: filledPrice,
          filledQuantity: filledQty,
          orderId: verifyRes.orderId,
          executedAt: verifyRes.timestamp,
        };
        trade.levelsPlan = LevelCalculator.buildTradeLevelsPlan({
          entryPrice: filledPrice,
          filledQuantity: filledQty,
          costConfig: trade.costConfig,
          stepPercent: 2.0,
        });
      } else if (trade.status === 'PENDING_EXIT') {
        trade.status = 'CLOSED';
        trade.closedAt = Date.now();
      }
      this.notifyListeners();
    }

    return trade;
  }

  public getTrade(tradeId: string): ManagedTrade | undefined {
    return this.trades.get(tradeId);
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
