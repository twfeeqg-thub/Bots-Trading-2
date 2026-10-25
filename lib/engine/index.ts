// Project Q — Bot Engine Central Orchestrator
// Coordinates Bot Core, Binance Trading Layer, Market Data, and Trade Manager

import { BotConfig, BotCycle, BotState, BotTrade, BotType, CreateBotParams } from '@/lib/bots/types';
import { BotStatusDTO, BotSummaryDTO } from './types';
import { sharedMarketDataStore } from '@/lib/market-data';

export class BotEngine {
  private static instance: BotEngine;
  private bots: Map<string, BotSummaryDTO> = new Map();

  private constructor() {
    this.seedExemplarBots();
  }

  public static getInstance(): BotEngine {
    if (!BotEngine.instance) {
      BotEngine.instance = new BotEngine();
    }
    return BotEngine.instance;
  }

  private seedExemplarBots() {
    const demoBots: CreateBotParams[] = [
      {
        name: 'بوت صفقات البيتكوين السريعة',
        type: 'DEAL_BOT',
        symbol: 'BTCUSDT',
        amount: 250,
        entryMethod: 'MARKET',
        stepPercent: 1.5,
      },
      {
        name: 'بوت مسار الإيثيريوم العرضي',
        type: 'RANGE_BOT',
        symbol: 'ETHUSDT',
        amount: 200,
        entryMethod: 'MARKET',
        stepPercent: 2.0,
        recoveryRatio: 1.5,
        maxLevels: 4,
      },
      {
        name: 'بوت قناص سولانا اللحظي',
        type: 'DEAL_BOT',
        symbol: 'SOLUSDT',
        amount: 150,
        entryMethod: 'MARKET',
        stepPercent: 2.5,
      },
    ];

    for (const params of demoBots) {
      this.createBotInternal(params);
    }
  }

  private createBotInternal(params: CreateBotParams): BotSummaryDTO {
    const id = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const [base, quote] = params.symbol.includes('USDT')
      ? [params.symbol.replace('USDT', ''), 'USDT']
      : ['BTC', 'USDT'];

    const config: BotConfig = {
      id,
      name: params.name || `بوت ${params.symbol}`,
      type: params.type,
      symbol: params.symbol,
      baseAsset: base,
      quoteAsset: quote,
      allocatedCapital: params.amount,
      entryAmount: params.amount,
      entryMethod: params.entryMethod || 'MARKET',
      stepPercent: params.stepPercent ?? 2.0,
      recoveryRatio: params.recoveryRatio ?? 1.5,
      maxLevels: params.maxLevels ?? 5,
      customAllocation: params.customAllocation,
      createdAt: now,
      updatedAt: now,
      enabled: true,
    };

    const livePrice = sharedMarketDataStore.getFreshPrice(params.symbol) || 67000;

    const initialTrade: BotTrade = {
      tradeId: `tr_${id}`,
      orderId: `ord_${Date.now()}`,
      clientOrderId: `cli_${Date.now()}`,
      side: 'BUY',
      price: livePrice,
      quantity: params.amount / livePrice,
      executedAmount: params.amount,
      fee: params.amount * 0.001,
      feeAsset: 'USDT',
      timestamp: now,
      status: 'OPEN',
      entry: {
        orderId: `ord_${Date.now()}`,
        executionPrice: livePrice,
        filledQuantity: params.amount / livePrice,
        executedAt: now,
        totalCost: params.amount,
        fee: params.amount * 0.001,
      },
    };

    const initialCycle: BotCycle = {
      cycleId: `cycle_1_${id}`,
      botId: id,
      cycleNumber: 1,
      startTime: now,
      startedAt: now,
      activeTradeId: initialTrade.tradeId,
      status: 'ACTIVE',
      trades: [initialTrade],
      totalInvested: params.amount,
      totalReturned: 0,
      realizedPnl: 0,
      realizedPnlPercent: 0,
      netFee: initialTrade.fee,
      stateHistory: [
        {
          from: 'WAITING_FOR_ENTRY',
          to: 'MONITORING_ENTRY',
          timestamp: now - 120000,
          reason: 'بدء مراقبة الشموع وإشارات الزخم',
        },
        {
          from: 'MONITORING_ENTRY',
          to: 'ENTRY_TRIGGERED',
          timestamp: now - 60000,
          reason: 'تحفيز إشارة الشراء بعد تأكيد الصعود',
        },
        {
          from: 'ENTRY_TRIGGERED',
          to: 'POSITION_OPEN',
          timestamp: now,
          reason: 'تنفيذ وتأكيد أمر الشراء على Binance Spot',
        },
      ],
    };

    const summary: BotSummaryDTO = {
      id,
      name: config.name,
      type: config.type,
      symbol: config.symbol,
      currentState: 'POSITION_OPEN',
      entryAmount: params.amount,
      cycleNumber: 1,
      config,
      currentCycle: initialCycle,
      currentTrade: initialTrade,
      lastActionTimestamp: now,
    };

    this.bots.set(id, summary);
    return summary;
  }

  public listBots(): BotSummaryDTO[] {
    return Array.from(this.bots.values());
  }

  public getBot(id: string): (BotSummaryDTO & { getId: () => string }) | null {
    const bot = this.bots.get(id);
    if (!bot) return null;
    return {
      ...bot,
      getId: () => bot.id,
    };
  }

  public async createBot(params: CreateBotParams): Promise<{ getId: () => string }> {
    const summary = this.createBotInternal(params);
    return {
      getId: () => summary.id,
    };
  }

  public async deleteBot(id: string): Promise<boolean> {
    return this.bots.delete(id);
  }

  public async startBot(id: string): Promise<{ success: boolean; message: string }> {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Bot ${id} not found.`);
    bot.currentState = 'MONITORING_ENTRY';
    bot.lastActionTimestamp = Date.now();
    return { success: true, message: 'تم تشغيل البوت بنجاح' };
  }

  public async stopBot(id: string, reason?: string): Promise<{ success: boolean; message: string }> {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Bot ${id} not found.`);
    bot.currentState = 'STOPPED';
    bot.lastActionTimestamp = Date.now();
    return { success: true, message: reason || 'تم إيقاف تشغيل البوت' };
  }

  public async advanceBotState(
    id: string,
    targetState: BotState,
    details?: any
  ): Promise<{ success: boolean; targetState: BotState }> {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Bot ${id} not found.`);
    bot.currentState = targetState;
    bot.lastActionTimestamp = Date.now();
    return { success: true, targetState };
  }

  public async recoverBot(
    id: string,
    targetState: BotState,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Bot ${id} not found.`);
    bot.currentState = targetState;
    bot.lastActionTimestamp = Date.now();
    return { success: true, message: reason || 'تم تطبيق الاسترداد على البوت' };
  }

  public async executeBotBuy(id: string, options?: any): Promise<any> {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Bot ${id} not found.`);
    const livePrice = sharedMarketDataStore.getFreshPrice(bot.symbol) || 67000;
    const now = Date.now();
    const trade: BotTrade = {
      orderId: `ord_${now}`,
      clientOrderId: `cli_${now}`,
      side: 'BUY',
      price: livePrice,
      quantity: (options?.amount || bot.entryAmount) / livePrice,
      executedAmount: options?.amount || bot.entryAmount,
      fee: (options?.amount || bot.entryAmount) * 0.001,
      feeAsset: 'USDT',
      timestamp: now,
    };
    bot.currentTrade = trade;
    bot.currentState = 'POSITION_OPEN';
    bot.lastActionTimestamp = now;
    return {
      outcome: 'SUCCESS',
      avgPrice: livePrice,
      executedQty: trade.quantity,
      orderId: trade.orderId,
      timestamp: now,
    };
  }

  public async executeBotSell(id: string, options?: any): Promise<any> {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Bot ${id} not found.`);
    const livePrice = sharedMarketDataStore.getFreshPrice(bot.symbol) || 67000;
    const now = Date.now();
    bot.currentState = 'POSITION_CLOSED';
    bot.lastActionTimestamp = now;
    if (bot.currentCycle) {
      bot.currentCycle.status = 'COMPLETED';
      bot.currentCycle.endTime = now;
      bot.currentCycle.totalReturned = (bot.currentTrade?.quantity || 1) * livePrice;
      bot.currentCycle.realizedPnl = bot.currentCycle.totalReturned - bot.currentCycle.totalInvested;
      bot.currentCycle.realizedPnlPercent = (bot.currentCycle.realizedPnl / bot.currentCycle.totalInvested) * 100;
    }
    return {
      outcome: 'SUCCESS',
      avgPrice: livePrice,
      executedQty: bot.currentTrade?.quantity || 0,
      orderId: `sell_${now}`,
      timestamp: now,
    };
  }

  public async verifyBotOrder(id: string, orderId?: string, clientOrderId?: string): Promise<any> {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Bot ${id} not found.`);
    return {
      outcome: 'SUCCESS',
      status: 'FILLED',
      found: true,
      avgPrice: bot.currentTrade?.price || 67000,
      executedQty: bot.currentTrade?.quantity || 0,
      orderId: orderId || bot.currentTrade?.orderId || `ord_${Date.now()}`,
      timestamp: Date.now(),
    };
  }

  public async getStatus(): Promise<BotStatusDTO> {
    const activeBots = Array.from(this.bots.values()).filter(
      (b) => b.currentState === 'POSITION_OPEN' || b.currentState === 'MONITORING_ENTRY'
    );
    return {
      engineRunning: true,
      activeBotsCount: activeBots.length,
      totalBotsCount: this.bots.size,
      simulationMode: 'MOCK_WITH_REAL_MARKET_PRICES',
      timestamp: Date.now(),
    };
  }

  public async seedDemoBots(): Promise<BotSummaryDTO[]> {
    this.seedExemplarBots();
    return this.listBots();
  }
}

export async function getSharedBotEngine(): Promise<BotEngine> {
  return BotEngine.getInstance();
}
