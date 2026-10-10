// Project Q — Standalone Bot Engine (V1)
// Orchestrates bot lifecycles using Bot Core, persists all state changes via Persistence Layer,
// supports full state recovery upon restart, and exposes an API surface for UI and services.
// Strictly NO real trading, NO Buy/Sell execution, NO Binance private keys.

import {
  BotConfig,
  BotState,
  BotCycle,
  BotTrade,
  CreateBotParams,
  TransitionResult,
  ErrorRecoveryResult,
  TradeEntryExecution,
  TradeExitExecution,
} from '@/lib/bots/types';
import { BotInstance } from '@/lib/bots/bot-instance';
import { BotStateMachine } from '@/lib/bots/bot-state-machine';
import { BotRepository, BotStateEvent } from '@/lib/persistence/types';
import { getSharedBotRepository } from '@/lib/persistence';
import {
  sharedMarketDataStore,
  CentralMarketDataStore,
  MarketDataStatus,
  MarketPriceRecord,
} from '@/lib/market-data';
import {
  BinanceTradingService,
  sharedBinanceTradingService,
  BuyExecutionResult,
  SellExecutionResult,
  OrderVerificationResult,
  BinanceOrderType,
} from '@/lib/trading';
import { BotEngineConfig, BotEngineStatus, BotSummaryDTO } from './types';

export class BotEngine {
  private repository: BotRepository;
  private marketData: CentralMarketDataStore;
  private tradingService: BinanceTradingService;
  private bots: Map<string, BotInstance> = new Map();
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private startTime: number = 0;

  constructor(config?: BotEngineConfig) {
    this.repository = config?.repository || getSharedBotRepository();
    this.marketData = config?.marketDataStore || sharedMarketDataStore;
    this.tradingService = config?.tradingService || sharedBinanceTradingService;
  }

  /**
   * Initializes the engine and executes recovery:
   * 1. Connects to persistence repository.
   * 2. Loads all saved bots.
   * 3. For each bot, checks for open/active cycles and associated trades.
   * 4. Reconstructs BotInstance and restores previous state without creating a new cycle.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.startTime = Date.now();
    console.log('[BotEngine] Initializing standalone Bot Engine...');

    try {
      const savedBots = await this.repository.loadAllBots();
      console.log(`[BotEngine] Loaded ${savedBots.length} bot records from persistence.`);

      for (const record of savedBots) {
        const botConfig = record.bot;
        const bot = new BotInstance(botConfig);

        // Attempt recovery of open cycle and trade
        const openCycle = await this.repository.loadOpenCycle(botConfig.id);
        let openTrade: BotTrade | null = null;

        if (openCycle) {
          openTrade = await this.repository.loadOpenTrade(openCycle.cycleId);
          bot.restoreState(openCycle, openTrade);
          console.log(
            `[BotEngine] Restored active cycle #${openCycle.cycleNumber} for bot "${botConfig.name}" in state "${openCycle.currentState}".`
          );
        } else {
          // If no open cycle, check if there was a closed/latest cycle to preserve state history
          const latestCycle = await this.repository.loadLatestCycle(botConfig.id);
          if (latestCycle) {
            bot.restoreState(latestCycle, null);
          }
        }

        this.attachPersistenceListeners(bot);
        this.bots.set(bot.getId(), bot);
      }

      this.isInitialized = true;
      this.isRunning = true;
      console.log('[BotEngine] Initialization and state recovery complete.');
    } catch (err) {
      console.error('[BotEngine] Fatal error during engine initialization:', err);
      throw err;
    }
  }

  /**
   * Creates and registers a new bot, persisting it immediately.
   */
  public async createBot(params: CreateBotParams): Promise<BotInstance> {
    this.ensureInitialized();

    // Validate type strictly
    if (params.type !== 'RANGE_BOT' && params.type !== 'DEAL_BOT') {
      throw new Error(`Invalid bot type "${params.type}". Only RANGE_BOT and DEAL_BOT are permitted.`);
    }

    const id = params.id || `bot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const config: BotConfig = {
      id,
      type: params.type,
      name: params.name.trim() || (params.type === 'RANGE_BOT' ? 'بوت المسار العرضي' : 'بوت الصفقة'),
      symbol: params.symbol.toUpperCase().trim(),
      entryAmount: params.entryAmount > 0 ? params.entryAmount : 100,
      entryMethod: params.entryMethod || 'SIGNAL',
      plannedEntryPrice: params.plannedEntryPrice ?? null,
      initialStopLoss: params.initialStopLoss || {
        type: 'PERCENT',
        value: 2.0,
      },
      tRuleConfig: params.tRuleConfig || {
        targetType: 'FIXED_PERCENT',
        targetValue: 3.0,
        description: 'هدف ربح V1',
      },
      xSettings:
        params.type === 'RANGE_BOT'
          ? params.xSettings || {
              enabled: true,
            }
          : undefined,
      alertSettings: {
        onEntry: params.alertSettings?.onEntry ?? true,
        onExit: params.alertSettings?.onExit ?? true,
        onError: params.alertSettings?.onError ?? true,
        onStateChange: params.alertSettings?.onStateChange ?? true,
      },
      extraConfig: params.extraConfig || {},
      createdAt: now,
      updatedAt: now,
    };

    // Save to persistence
    await this.repository.createBot(config, 'STOPPED');

    const bot = new BotInstance(config);
    this.attachPersistenceListeners(bot);
    this.bots.set(id, bot);

    await this.logStateEvent({
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      botId: id,
      previousState: null,
      newState: 'STOPPED',
      eventType: 'STATE_TRANSITION',
      reason: 'إنشاء بوت جديد (Bot created)',
      timestamp: now,
    });

    return bot;
  }

  /**
   * Retrieves a bot instance by ID.
   */
  public getBot(id: string): BotInstance | undefined {
    return this.bots.get(id);
  }

  /**
   * Returns a list of all bots with summary metadata for APIs and UI.
   */
  public listBots(): BotSummaryDTO[] {
    return Array.from(this.bots.values()).map((bot) => {
      const cfg = bot.getConfig();
      const cycle = bot.getCurrentCycle();
      const trade = bot.getCurrentTrade();

      return {
        id: cfg.id,
        name: cfg.name,
        type: cfg.type,
        symbol: cfg.symbol,
        entryAmount: cfg.entryAmount,
        currentState: bot.getState(),
        enabled: true,
        cycleNumber: cycle ? cycle.cycleNumber : 0,
        hasOpenCycle: Boolean(cycle && cycle.endedAt === null),
        cycleStartedAt: cycle ? cycle.startedAt : null,
        activeTradeId: trade ? trade.tradeId : null,
        tradeStatus: trade ? trade.status : null,
        lastError: cycle?.lastError ? cycle.lastError.message : null,
        config: cfg,
        currentCycle: cycle ? { ...cycle } : null,
        currentTrade: trade ? { ...trade } : null,
      };
    });
  }

  /**
   * Starts a new cycle for the specified bot.
   */
  public async startBot(id: string): Promise<TransitionResult> {
    const bot = this.getBotOrThrow(id);
    const result = bot.start();

    if (result.success) {
      await this.persistBotState(bot);
    }
    return result;
  }

  /**
   * Stops the specified bot safely.
   */
  public async stopBot(id: string, reason: string = 'إيقاف يدوي من المحرك'): Promise<TransitionResult> {
    const bot = this.getBotOrThrow(id);
    const result = bot.stop(reason);

    if (result.success) {
      await this.persistBotState(bot);
    }
    return result;
  }

  /**
   * Advances the bot through its deterministic 11 states.
   */
  public async advanceBotState(
    id: string,
    targetState: BotState,
    details?: {
      reason?: string;
      entryDetails?: Partial<TradeEntryExecution>;
      exitDetails?: Partial<TradeExitExecution>;
      executionPrice?: number;
      filledQuantity?: number;
      orderId?: string;
    }
  ): Promise<TransitionResult> {
    const bot = this.getBotOrThrow(id);
    const currentState = bot.getState();

    // Check transition validity
    const validation = BotStateMachine.validateTransition(currentState, targetState);
    if (!validation.success) {
      return validation;
    }

    let result: TransitionResult;

    switch (targetState) {
      case 'MONITORING_ENTRY':
        result = bot.startMonitoring();
        break;
      case 'ENTRY_TRIGGERED':
        result = bot.triggerEntry(details?.reason);
        break;
      case 'EXECUTING_BUY':
        result = bot.startBuyExecution(details?.entryDetails);
        break;
      case 'VERIFYING_BUY':
        result = bot.confirmBuyVerification(details?.entryDetails);
        break;
      case 'POSITION_OPEN':
        result = bot.openPosition({
          executionPrice: details?.executionPrice,
          filledQuantity: details?.filledQuantity,
          orderId: details?.orderId,
        });
        break;
      case 'EXECUTING_SELL':
        result = bot.startSellExecution({
          reason: details?.reason,
          plannedPrice: details?.executionPrice,
        });
        break;
      case 'VERIFYING_SELL':
        result = bot.confirmSellVerification(details?.exitDetails);
        break;
      case 'POSITION_CLOSED':
        result = bot.closePosition({
          executionPrice: details?.executionPrice,
          filledQuantity: details?.filledQuantity,
          orderId: details?.orderId,
        });
        break;
      case 'STOPPED':
        result = currentState === 'POSITION_CLOSED' ? bot.finishCycle() : bot.stop(details?.reason);
        break;
      default:
        return {
          success: false,
          from: currentState,
          to: targetState,
          error: `Unhandled direct advance to ${targetState}`,
          timestamp: Date.now(),
        };
    }

    if (result.success) {
      await this.persistBotState(bot);
    }
    return result;
  }

  /**
   * Recovers a bot from an ERROR state to a safe designated state.
   */
  public async recoverBot(
    id: string,
    targetState: BotState,
    reason: string = 'استرداد آمن بعد معالجة الخطأ'
  ): Promise<ErrorRecoveryResult> {
    const bot = this.getBotOrThrow(id);
    const result = bot.recover(targetState, reason);

    if (result.success) {
      await this.persistBotState(bot);
      await this.logStateEvent({
        eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        botId: id,
        cycleId: bot.getCurrentCycle()?.cycleId,
        previousState: 'ERROR',
        newState: targetState,
        eventType: 'RECOVERY',
        reason,
        timestamp: Date.now(),
      });
    }
    return result;
  }

  /**
   * Deletes a bot from memory and persistence.
   */
  public async deleteBot(id: string): Promise<boolean> {
    const bot = this.getBotOrThrow(id);
    if (bot.getState() === 'POSITION_OPEN') {
      throw new Error('لا يمكن حذف بوت لديه صفقة مفتوحة. يجب إغلاق الصفقة أولاً.');
    }

    await this.repository.deleteBot(id);
    this.bots.delete(id);
    return true;
  }

  /**
   * Returns current engine operational status.
   */
  public async getStatus(): Promise<BotEngineStatus> {
    const pingRes = await this.repository.ping();
    const activeCycles = Array.from(this.bots.values()).filter(
      (b) => b.getCurrentCycle() && b.getCurrentCycle()?.endedAt === null
    ).length;

    return {
      running: this.isRunning,
      storageType: pingRes.type,
      totalBots: this.bots.size,
      activeCyclesCount: activeCycles,
      uptimeSeconds: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      initializedAt: this.startTime,
      storageHealthy: pingRes.ok,
    };
  }

  /**
   * Access to the central shared Market Data Store.
   */
  public getMarketDataStore(): CentralMarketDataStore {
    return this.marketData;
  }

  /**
   * Retrieves current fresh price for a symbol (returns null if STALE or NO_DATA).
   */
  public getMarketPrice(symbol: string): number | null {
    return this.marketData.getFreshPrice(symbol);
  }

  /**
   * Retrieves last known price regardless of freshness (returns null if NO_DATA).
   */
  public getLastKnownPrice(symbol: string): number | null {
    return this.marketData.getLastKnownPrice(symbol);
  }

  /**
   * Retrieves current market data status ('FRESH' | 'STALE' | 'NO_DATA').
   */
  public getMarketStatus(symbol: string): MarketDataStatus {
    return this.marketData.getStatus(symbol);
  }

  /**
   * Retrieves the full market record including eventTime and receivedAt.
   */
  public getMarketRecord(symbol: string): MarketPriceRecord | undefined {
    return this.marketData.getRecord(symbol);
  }

  /**
   * Access to the central shared Binance Trading Service.
   */
  public getTradingService(): BinanceTradingService {
    return this.tradingService;
  }

  /**
   * Executes a Buy order with Binance via Binance Trading Layer.
   * Strictly enforces SEND -> VERIFY -> TRANSITION.
   * Does NOT assume position open on mere send.
   */
  public async executeBotBuy(
    id: string,
    options?: {
      quoteOrderQty?: number;
      quantity?: number;
      orderType?: BinanceOrderType;
      price?: number;
    }
  ): Promise<BuyExecutionResult> {
    const bot = this.getBotOrThrow(id);
    const state = bot.getState();

    // Prepare state for buy if needed
    if (state === 'WAITING_FOR_ENTRY') {
      bot.startMonitoring();
      bot.triggerEntry('تجهيز التنفيذ المباشر');
    } else if (state === 'MONITORING_ENTRY') {
      bot.triggerEntry('تحقق شرط الدخول للتنفيذ');
    }

    const readyState = bot.getState();
    if (readyState !== 'ENTRY_TRIGGERED') {
      throw new Error(`Cannot execute buy: Bot "${id}" is in state "${readyState}". Expected ENTRY_TRIGGERED.`);
    }

    // Step 1: Transition to EXECUTING_BUY (SEND)
    const execBuyRes = bot.startBuyExecution();
    if (!execBuyRes.success) {
      throw new Error(`Failed to advance bot to EXECUTING_BUY: ${execBuyRes.error}`);
    }
    await this.persistBotState(bot);

    // Step 2: Send order through Binance Trading Layer
    const cycle = bot.getCurrentCycle();
    const cycleId = cycle ? cycle.cycleId : '';
    const symbol = bot.getConfig().symbol;
    const quoteAmount = options?.quoteOrderQty || bot.getConfig().entryAmount;

    const result = await this.tradingService.executeBuy({
      botId: id,
      cycleId,
      symbol,
      quoteOrderQty: quoteAmount,
      quantity: options?.quantity,
      orderType: options?.orderType || 'MARKET',
      price: options?.price,
    });

    // Step 3: Handle outcome
    if (result.outcome === 'SUCCESS') {
      // Confirmed filled on Binance!
      bot.confirmBuyVerification({
        executionPrice: result.avgPrice ?? undefined,
        filledQuantity: result.executedQty,
        orderId: result.orderId ?? undefined,
        executedAt: result.timestamp,
      });
      bot.openPosition({
        executionPrice: result.avgPrice ?? undefined,
        filledQuantity: result.executedQty,
        orderId: result.orderId ?? undefined,
      });
      await this.persistBotState(bot);
    } else if (result.outcome === 'AMBIGUOUS' || result.needsVerification) {
      // Ambiguous / Needs verification: Move to VERIFYING_BUY. DO NOT open position!
      bot.confirmBuyVerification({
        orderId: result.orderId ?? undefined,
      });
      await this.persistBotState(bot);
    } else if (result.outcome === 'FAILED') {
      // Definitively rejected or failed. Persist state.
      await this.persistBotState(bot);
    }

    return result;
  }

  /**
   * Executes a recovery Buy order for a RANGE_BOT in POSITION_OPEN.
   * Sends the buy order through Binance Trading Layer (Mock) while strictly respecting
   * that the bot remains in POSITION_OPEN state (no illegal transition to ENTRY_TRIGGERED).
   * Updates bot trade position metrics.
   */
  public async executeBotRecoveryBuy(
    id: string,
    options: {
      quoteOrderQty: number;
      orderType?: BinanceOrderType;
      price?: number;
      levelIndex: number;
    }
  ): Promise<BuyExecutionResult> {
    const bot = this.getBotOrThrow(id);
    const state = bot.getState();

    if (state !== 'POSITION_OPEN') {
      throw new Error(`Cannot execute recovery buy: Bot "${id}" must be in POSITION_OPEN (current: ${state}).`);
    }

    if (bot.getConfig().type !== 'RANGE_BOT') {
      throw new Error(`Cannot execute recovery buy: Bot "${id}" is of type "${bot.getConfig().type}". Only RANGE_BOT supports recovery levels.`);
    }

    const cycle = bot.getCurrentCycle();
    const cycleId = cycle ? cycle.cycleId : '';
    const symbol = bot.getConfig().symbol;

    // Send order through Binance Trading Layer
    const result = await this.tradingService.executeBuy({
      botId: id,
      cycleId,
      symbol,
      quoteOrderQty: options.quoteOrderQty,
      orderType: options.orderType || 'MARKET',
      price: options.price,
    });

    if (result.outcome === 'SUCCESS') {
      // Record fill in the bot instance position (without changing state from POSITION_OPEN)
      const currentTrade = bot.getCurrentTrade();
      if (currentTrade) {
        const prevPrice = currentTrade.entry.executionPrice || options.price || 0;
        const prevQty = currentTrade.entry.filledQuantity || 0;
        const addQty = result.executedQty || (options.quoteOrderQty / (result.avgPrice || prevPrice));
        const addPrice = result.avgPrice || options.price || prevPrice;

        const totalInvested = prevPrice * prevQty + addPrice * addQty;
        const totalQty = prevQty + addQty;
        const avgPrice = totalQty > 0 ? Number((totalInvested / totalQty).toFixed(8)) : prevPrice;

        bot.recordRecoveryEntry({
          executionPrice: avgPrice,
          filledQuantity: Number(totalQty.toFixed(8)),
          notes: `تم تنفيذ تعزيز X مستوى ${options.levelIndex}. متوسط السعر: ${avgPrice}`,
        });
      }
      await this.persistBotState(bot);
      await this.logStateEvent({
        eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        botId: id,
        cycleId,
        previousState: 'POSITION_OPEN',
        newState: 'POSITION_OPEN',
        eventType: 'STATE_TRANSITION',
        reason: `تنفيذ تعزيز مسار X مستوى ${options.levelIndex}`,
        timestamp: Date.now(),
      });
    }

    return result;
  }

  /**
   * Executes a Sell order with Binance via Binance Trading Layer.
   * Supports full sell and partial sell.
   * Does NOT assume position closed on mere send.
   */
  public async executeBotSell(
    id: string,
    options?: {
      quantity?: number;
      orderType?: BinanceOrderType;
      price?: number;
      isPartial?: boolean;
      reason?: string;
    }
  ): Promise<SellExecutionResult> {
    const bot = this.getBotOrThrow(id);
    const state = bot.getState();

    if (state !== 'POSITION_OPEN' && state !== 'VERIFYING_SELL') {
      throw new Error(`Cannot execute sell: Bot "${id}" is in state "${state}". Expected POSITION_OPEN or VERIFYING_SELL.`);
    }

    // Step 1: Transition to EXECUTING_SELL (SEND)
    const execSellRes = bot.startSellExecution({
      reason: options?.reason || 'طلب بيع يدوي/آلي من المحرك',
      plannedPrice: options?.price,
    });
    if (!execSellRes.success) {
      throw new Error(`Failed to advance bot to EXECUTING_SELL: ${execSellRes.error}`);
    }
    await this.persistBotState(bot);

    // Step 2: Send order through Binance Trading Layer
    const trade = bot.getCurrentTrade();
    const cycle = bot.getCurrentCycle();
    const qty = options?.quantity || trade?.entry.filledQuantity || 1;

    const result = await this.tradingService.executeSell({
      botId: id,
      cycleId: cycle?.cycleId || '',
      tradeId: trade?.tradeId || '',
      symbol: bot.getConfig().symbol,
      quantity: qty,
      orderType: options?.orderType || 'MARKET',
      price: options?.price,
      isPartial: options?.isPartial,
    });

    // Step 3: Handle outcome
    if (result.outcome === 'SUCCESS') {
      bot.confirmSellVerification({
        executionPrice: result.avgPrice ?? undefined,
        filledQuantity: result.executedQty,
        orderId: result.orderId ?? undefined,
        executedAt: result.timestamp,
      });

      if (!options?.isPartial) {
        // Full sell: close position
        bot.closePosition({
          executionPrice: result.avgPrice ?? undefined,
          filledQuantity: result.executedQty,
          orderId: result.orderId ?? undefined,
        });
      }
      await this.persistBotState(bot);
    } else if (result.outcome === 'PARTIAL') {
      bot.confirmSellVerification({
        executionPrice: result.avgPrice ?? undefined,
        filledQuantity: result.executedQty,
        orderId: result.orderId ?? undefined,
        executedAt: result.timestamp,
      });
      await this.persistBotState(bot);
    } else if (result.outcome === 'AMBIGUOUS' || result.needsVerification) {
      bot.confirmSellVerification({
        orderId: result.orderId ?? undefined,
      });
      await this.persistBotState(bot);
    } else if (result.outcome === 'FAILED') {
      await this.persistBotState(bot);
    }

    return result;
  }

  /**
   * Queries Binance to verify the actual state of an ambiguous or pending order.
   * Resolves the bot's state according to the definitive Binance result.
   */
  public async verifyBotOrder(
    id: string,
    orderId?: string | number | null,
    clientOrderId?: string | null
  ): Promise<OrderVerificationResult> {
    const bot = this.getBotOrThrow(id);
    const trade = bot.getCurrentTrade();
    const state = bot.getState();

    const targetOrderId = orderId || (state.includes('SELL') ? trade?.exit.orderId : trade?.entry.orderId);

    const result = await this.tradingService.verifyOrder({
      botId: id,
      symbol: bot.getConfig().symbol,
      orderId: targetOrderId ?? undefined,
      clientOrderId: clientOrderId ?? undefined,
    });

    if (result.outcome === 'SUCCESS' && result.status === 'FILLED') {
      if (state === 'VERIFYING_BUY') {
        bot.openPosition({
          executionPrice: result.avgPrice ?? undefined,
          filledQuantity: result.executedQty,
          orderId: result.orderId ?? undefined,
        });
        await this.persistBotState(bot);
      } else if (state === 'VERIFYING_SELL') {
        bot.closePosition({
          executionPrice: result.avgPrice ?? undefined,
          filledQuantity: result.executedQty,
          orderId: result.orderId ?? undefined,
        });
        await this.persistBotState(bot);
      }
    }

    return result;
  }

  /**
   * Graceful shutdown of the engine.
   */
  public async shutdown(): Promise<void> {
    console.log('[BotEngine] Shutting down Bot Engine...');
    this.isRunning = false;
    // Persist final states of all bots
    for (const bot of this.bots.values()) {
      await this.persistBotState(bot);
    }
    console.log('[BotEngine] Engine stopped cleanly.');
  }

  // --- Internal Persistence Wiring ---

  private attachPersistenceListeners(bot: BotInstance): void {
    bot.onStateChange(async (botId, from, to, cycle) => {
      try {
        await this.repository.saveCycle(cycle);
        await this.repository.saveBot(bot.getConfig(), to, true);

        await this.logStateEvent({
          eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          botId,
          cycleId: cycle.cycleId,
          previousState: from,
          newState: to,
          eventType: to === 'STOPPED' ? 'CYCLE_END' : 'STATE_TRANSITION',
          reason: cycle.stateHistory[cycle.stateHistory.length - 1]?.reason,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error(`[BotEngine] Error persisting state change for bot ${botId}:`, err);
      }
    });

    bot.onTradeUpdate(async (botId, trade) => {
      try {
        await this.repository.saveTrade(trade);
      } catch (err) {
        console.error(`[BotEngine] Error persisting trade update for bot ${botId}:`, err);
      }
    });

    bot.onError(async (botId, error) => {
      try {
        await this.logStateEvent({
          eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          botId,
          cycleId: bot.getCurrentCycle()?.cycleId,
          previousState: error.stateAtError,
          newState: 'ERROR',
          eventType: 'ERROR',
          reason: `[${error.code}] ${error.message}`,
          metadata: { errorCode: error.code, recoverable: error.recoverable },
          timestamp: error.timestamp,
        });
      } catch (err) {
        console.error(`[BotEngine] Error persisting error event for bot ${botId}:`, err);
      }
    });
  }

  private async persistBotState(bot: BotInstance): Promise<void> {
    const cycle = bot.getCurrentCycle();
    const trade = bot.getCurrentTrade();

    await this.repository.saveBot(bot.getConfig(), bot.getState(), true);
    if (cycle) {
      await this.repository.saveCycle(cycle);
    }
    if (trade) {
      await this.repository.saveTrade(trade);
    }
  }

  private async logStateEvent(event: BotStateEvent): Promise<void> {
    try {
      await this.repository.saveStateEvent(event);
    } catch {
      // Non-fatal
    }
  }

  private getBotOrThrow(id: string): BotInstance {
    const bot = this.bots.get(id);
    if (!bot) {
      throw new Error(`Bot with ID "${id}" was not found.`);
    }
    return bot;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('BotEngine has not been initialized. Call initialize() first.');
    }
  }
}
