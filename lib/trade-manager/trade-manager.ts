// Project Q — Trade Manager Core Engine
// Implements unified trading cycle, real confirmed costs, and X-Recovery layer

export interface TradeEntry {
  executionPrice: number;
  filledQuantity: number;
  orderId: string;
  clientOrderId?: string;
  executedAt: number;
  totalCost: number;
  fee: number;
}

export interface TradeExit {
  executionPrice: number;
  filledQuantity: number;
  orderId: string;
  executedAt: number;
  totalCost: number;
  fee: number;
  pnlNet: number;
  pnlPercent: number;
  reason?: string;
}

export interface RecoveryLevel {
  levelIndex: number;
  targetPrice: number;
  allocationAmount: number;
  quantity: number;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED';
  executedAt?: number;
}

export interface TradeRecord {
  tradeId: string;
  botId?: string;
  botType?: string;
  symbol: string;
  status: 'OPEN' | 'CLOSED' | 'PENDING_ENTRY' | 'PENDING_EXIT';
  source: 'MANUAL' | 'SCANNER' | 'BOT';
  entry: TradeEntry;
  exit?: TradeExit;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  realizedPnl?: number;
  realizedPnlPercent?: number;
  feesPaid: number;
  stepPercent?: number;
  recoveryRatio?: number;
  maxLevels?: number | null;
  customAllocationQuote?: number;
  recoveryLevels: RecoveryLevel[];
  initialStopLossPercent?: number;
  stopLossPrice?: number;
  isPreEntryRecovery?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTradeParams {
  symbol: string;
  entryAmount: number;
  entryPrice?: number;
  scannerPrice?: number;
  stepPercent?: number;
  manualEntryCost?: number;
  manualExitCostRate?: number;
  manualEntryFeePercent?: number;
  manualEntryFeeAmount?: number;
  manualExitFeePercent?: number;
  manualExitFeeAmount?: number;
  botType?: string;
  xSettings?: {
    enabled?: boolean;
    stepPercent?: number;
    recoveryRatio?: number;
    customAllocationQuote?: number;
    maxLevels?: number;
  };
  initialStopLossPercent?: number;
  immediateEntry?: boolean;
  isPreEntryRecovery?: boolean;
}

export class SymbolCostStore {
  private costs: Map<string, { entryFeeRate: number; exitFeeRate: number }> = new Map();

  constructor() {
    this.costs.set('BTCUSDT', { entryFeeRate: 0.001, exitFeeRate: 0.001 });
    this.costs.set('ETHUSDT', { entryFeeRate: 0.001, exitFeeRate: 0.001 });
    this.costs.set('SOLUSDT', { entryFeeRate: 0.001, exitFeeRate: 0.001 });
  }

  public getAll(): Record<string, { entryFeeRate: number; exitFeeRate: number }> {
    const obj: Record<string, { entryFeeRate: number; exitFeeRate: number }> = {};
    this.costs.forEach((v, k) => {
      obj[k] = v;
    });
    return obj;
  }

  public setCost(symbol: string, entryFeeRate: number, exitFeeRate: number) {
    this.costs.set(symbol.toUpperCase(), { entryFeeRate, exitFeeRate });
  }
}

export const sharedSymbolCostStore = new SymbolCostStore();

export class TradeManager {
  private static instance: TradeManager;
  private trades: Map<string, TradeRecord> = new Map();

  private constructor() {
    this.seedDemoTrades();
  }

  public static getInstance(): TradeManager {
    if (!TradeManager.instance) {
      TradeManager.instance = new TradeManager();
    }
    return TradeManager.instance;
  }

  private seedDemoTrades() {
    const now = Date.now();
    const demo: TradeRecord = {
      tradeId: 'tr_demo_101',
      botId: 'bot_demo_btc',
      botType: 'DEAL_BOT',
      symbol: 'BTCUSDT',
      status: 'OPEN',
      source: 'MANUAL',
      entry: {
        executionPrice: 67200,
        filledQuantity: 200 / 67200,
        orderId: 'ord_demo_buy_1',
        clientOrderId: 'cli_demo_buy_1',
        executedAt: now - 3600000,
        totalCost: 200,
        fee: 0.2,
      },
      currentPrice: 67850,
      unrealizedPnl: (200 / 67200) * 67850 - 200 - 0.2,
      unrealizedPnlPercent: ((67850 - 67200) / 67200) * 100,
      feesPaid: 0.2,
      stepPercent: 2.0,
      recoveryRatio: 1.5,
      maxLevels: 4,
      recoveryLevels: [],
      createdAt: now - 3600000,
      updatedAt: now,
    };
    this.trades.set(demo.tradeId, demo);
  }

  public listTrades(): TradeRecord[] {
    return Array.from(this.trades.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getActiveTrades(): TradeRecord[] {
    return this.listTrades().filter((t) => t.status === 'OPEN' || t.status === 'PENDING_ENTRY');
  }

  public getClosedTrades(): TradeRecord[] {
    return this.listTrades().filter((t) => t.status === 'CLOSED');
  }

  public getTrade(tradeId: string): TradeRecord | undefined {
    return this.trades.get(tradeId);
  }

  public getTradeByBotId(botId: string): TradeRecord | undefined {
    return Array.from(this.trades.values()).find((t) => t.botId === botId);
  }

  public async adoptBotAsManagedTrade(botId: string): Promise<TradeRecord> {
    const existing = this.getTradeByBotId(botId);
    if (existing) return existing;

    const now = Date.now();
    const tradeId = `tr_${botId}`;
    const newTrade: TradeRecord = {
      tradeId,
      botId,
      botType: 'DEAL_BOT',
      symbol: 'BTCUSDT',
      status: 'OPEN',
      source: 'BOT',
      entry: {
        executionPrice: 67500,
        filledQuantity: 100 / 67500,
        orderId: `ord_${now}`,
        clientOrderId: `cli_${now}`,
        executedAt: now,
        totalCost: 100,
        fee: 0.1,
      },
      currentPrice: 67500,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      feesPaid: 0.1,
      stepPercent: 2.0,
      recoveryRatio: 1.5,
      maxLevels: 4,
      recoveryLevels: [],
      createdAt: now,
      updatedAt: now,
    };

    this.trades.set(tradeId, newTrade);
    return newTrade;
  }

  public async createTradeFromManual(params: CreateTradeParams): Promise<TradeRecord> {
    return this.createInternal(params, 'MANUAL');
  }

  public async createTradeFromScanner(params: CreateTradeParams): Promise<TradeRecord> {
    return this.createInternal(params, 'SCANNER');
  }

  private createInternal(params: CreateTradeParams, source: 'MANUAL' | 'SCANNER'): TradeRecord {
    const now = Date.now();
    const tradeId = `tr_${now}_${Math.random().toString(36).substring(2, 6)}`;
    const price = params.entryPrice || params.scannerPrice || 67000;
    const amount = params.entryAmount || 100;
    const qty = amount / price;
    const fee = params.manualEntryFeeAmount ?? (params.manualEntryCost ?? amount * (params.manualEntryFeePercent ?? 0.001));

    const record: TradeRecord = {
      tradeId,
      botType: params.botType || 'DEAL_BOT',
      symbol: params.symbol.toUpperCase(),
      status: 'OPEN',
      source,
      entry: {
        executionPrice: price,
        filledQuantity: qty,
        orderId: `ord_${now}`,
        clientOrderId: `cli_${now}`,
        executedAt: now,
        totalCost: amount,
        fee,
      },
      currentPrice: price,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      feesPaid: fee,
      stepPercent: params.stepPercent || params.xSettings?.stepPercent || 2.0,
      recoveryRatio: params.xSettings?.recoveryRatio || 1.5,
      maxLevels: params.xSettings?.maxLevels ?? 4,
      customAllocationQuote: params.xSettings?.customAllocationQuote,
      recoveryLevels: [],
      initialStopLossPercent: params.initialStopLossPercent,
      stopLossPrice: params.initialStopLossPercent ? price * (1 - params.initialStopLossPercent / 100) : undefined,
      isPreEntryRecovery: params.isPreEntryRecovery,
      createdAt: now,
      updatedAt: now,
    };

    this.trades.set(tradeId, record);
    return record;
  }

  public async executeTradeExit(tradeId: string, reason = 'إغلاق يدوي'): Promise<TradeRecord> {
    const trade = this.trades.get(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found`);

    const now = Date.now();
    const exitPrice = trade.currentPrice || trade.entry.executionPrice;
    const qty = trade.entry.filledQuantity;
    const totalReturned = qty * exitPrice;
    const fee = totalReturned * 0.001;
    const netPnl = totalReturned - trade.entry.totalCost - trade.feesPaid - fee;
    const netPnlPercent = (netPnl / trade.entry.totalCost) * 100;

    trade.status = 'CLOSED';
    trade.exit = {
      executionPrice: exitPrice,
      filledQuantity: qty,
      orderId: `exit_${now}`,
      executedAt: now,
      totalCost: totalReturned,
      fee,
      pnlNet: netPnl,
      pnlPercent: netPnlPercent,
      reason,
    };
    trade.realizedPnl = netPnl;
    trade.realizedPnlPercent = netPnlPercent;
    trade.feesPaid += fee;
    trade.updatedAt = now;

    return trade;
  }

  public async onMarketPriceTick(symbol: string, currentPrice: number): Promise<void> {
    for (const trade of this.trades.values()) {
      if (trade.symbol === symbol.toUpperCase() && trade.status === 'OPEN') {
        trade.currentPrice = currentPrice;
        const totalValue = trade.entry.filledQuantity * currentPrice;
        trade.unrealizedPnl = totalValue - trade.entry.totalCost - trade.feesPaid;
        trade.unrealizedPnlPercent = ((currentPrice - trade.entry.executionPrice) / trade.entry.executionPrice) * 100;
        trade.updatedAt = Date.now();
      }
    }
  }

  public applyRealConfirmedCost(
    tradeId: string,
    costs: { entryCostAmount?: number; entryCostRate?: number; exitCostRate?: number }
  ): TradeRecord {
    const trade = this.trades.get(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found`);

    if (costs.entryCostAmount !== undefined) {
      trade.entry.fee = costs.entryCostAmount;
      trade.feesPaid = costs.entryCostAmount;
    }
    trade.updatedAt = Date.now();
    return trade;
  }

  public async executeRecoveryBuy(tradeId: string, levelIndex: number): Promise<TradeRecord> {
    const trade = this.trades.get(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found`);

    const currentPrice = trade.currentPrice || trade.entry.executionPrice * 0.98;
    const recoveryAmount = trade.entry.totalCost * (trade.recoveryRatio || 1.5);
    const addedQty = recoveryAmount / currentPrice;

    // Recalculate average price
    const totalCost = trade.entry.totalCost + recoveryAmount;
    const totalQty = trade.entry.filledQuantity + addedQty;
    const newAvgPrice = totalCost / totalQty;

    trade.entry.executionPrice = newAvgPrice;
    trade.entry.filledQuantity = totalQty;
    trade.entry.totalCost = totalCost;

    const level: RecoveryLevel = {
      levelIndex,
      targetPrice: currentPrice,
      allocationAmount: recoveryAmount,
      quantity: addedQty,
      status: 'EXECUTED',
      executedAt: Date.now(),
    };
    trade.recoveryLevels.push(level);
    trade.updatedAt = Date.now();

    return trade;
  }

  public updateTradeXSettings(
    tradeId: string,
    updates: {
      stepPercent?: number;
      recoveryRatio?: number;
      customAllocationQuote?: number;
      maxLevels?: number | null;
    }
  ): TradeRecord {
    const trade = this.trades.get(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found`);

    if (updates.stepPercent !== undefined) trade.stepPercent = updates.stepPercent;
    if (updates.recoveryRatio !== undefined) trade.recoveryRatio = updates.recoveryRatio;
    if (updates.customAllocationQuote !== undefined) trade.customAllocationQuote = updates.customAllocationQuote;
    if (updates.maxLevels !== undefined) trade.maxLevels = updates.maxLevels;

    trade.updatedAt = Date.now();
    return trade;
  }

  public generateNextRecoveryLevel(tradeId: string): RecoveryLevel {
    const trade = this.trades.get(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found`);

    const nextIndex = trade.recoveryLevels.length + 1;
    const step = trade.stepPercent || 2.0;
    const lastPrice = trade.entry.executionPrice;
    const targetPrice = lastPrice * Math.pow(1 - step / 100, nextIndex);
    const alloc = (trade.customAllocationQuote || trade.entry.totalCost) * Math.pow(trade.recoveryRatio || 1.5, nextIndex);

    return {
      levelIndex: nextIndex,
      targetPrice,
      allocationAmount: alloc,
      quantity: alloc / targetPrice,
      status: 'PENDING',
    };
  }

  public async verifyTrade(tradeId: string): Promise<TradeRecord> {
    const trade = this.trades.get(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found`);

    if (trade.status === 'PENDING_ENTRY') trade.status = 'OPEN';
    if (trade.status === 'PENDING_EXIT') trade.status = 'CLOSED';
    trade.updatedAt = Date.now();
    return trade;
  }
}

export const sharedTradeManager = TradeManager.getInstance();
