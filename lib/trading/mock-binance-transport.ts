// Project Q — Binance Trading Layer: Mock / Test Double Transport
// Server-side test double: Fully simulates Binance Spot API behavior without real keys or real trades.
// Enables running all tests, bots, and engine workflows safely in sandbox/mock mode.

import {
  BinanceApiError,
  NetworkAmbiguousError,
} from './binance-trading-client';
import {
  BinanceAccountInformation,
  BinanceOrderSide,
  BinanceOrderType,
  BinanceRawOrderResponse,
  BinanceRawQueryOrderResponse,
  BinanceServerTimeResponse,
  BinanceSymbolFilters,
  BinanceTimeInForce,
  IBinanceTransport,
} from './types';
import { CentralMarketDataStore, sharedMarketDataStore } from '../market-data/market-data-store';

export type MockExecutionMode =
  | 'FILLED'
  | 'PARTIALLY_FILLED'
  | 'NEW'
  | 'REJECTED_BALANCE'
  | 'REJECTED_SYMBOL'
  | 'NETWORK_TIMEOUT'
  | 'SERVER_5XX';

export class MockBinanceTransport implements IBinanceTransport {
  private mode: MockExecutionMode = 'FILLED';
  private ordersByClientId: Map<string, BinanceRawOrderResponse> = new Map();
  private ordersById: Map<number, BinanceRawOrderResponse> = new Map();
  private nextOrderId: number = 880001;
  private marketDataStore: CentralMarketDataStore;
  private simulatedBalances: Map<string, { free: number; locked: number }> = new Map();

  constructor(
    defaultMode: MockExecutionMode = 'FILLED',
    marketDataStore?: CentralMarketDataStore
  ) {
    this.mode = defaultMode;
    this.marketDataStore = marketDataStore || sharedMarketDataStore;
    this.initializeDefaultBalances();
  }

  private initializeDefaultBalances(): void {
    this.simulatedBalances.set('USDT', { free: 10000.0, locked: 0.0 });
    this.simulatedBalances.set('BTC', { free: 0.5, locked: 0.0 });
    this.simulatedBalances.set('ETH', { free: 5.0, locked: 0.0 });
  }

  public setMarketDataStore(store: CentralMarketDataStore): void {
    this.marketDataStore = store;
  }

  public getMarketDataStore(): CentralMarketDataStore {
    return this.marketDataStore;
  }

  public getSimulatedBalance(asset: string): { free: number; locked: number } {
    const upper = asset.toUpperCase().trim();
    return this.simulatedBalances.get(upper) || { free: 0, locked: 0 };
  }

  public setSimulatedBalance(asset: string, free: number, locked: number = 0): void {
    const upper = asset.toUpperCase().trim();
    this.simulatedBalances.set(upper, { free, locked });
  }

  /**
   * Sets the simulation mode for subsequent orders.
   */
  public setMode(mode: MockExecutionMode): void {
    this.mode = mode;
  }

  public getMode(): MockExecutionMode {
    return this.mode;
  }

  /**
   * Clears internal state and resets order history.
   */
  public reset(): void {
    this.ordersByClientId.clear();
    this.ordersById.clear();
    this.mode = 'FILLED';
    this.initializeDefaultBalances();
  }

  public async sendOrder(params: {
    symbol: string;
    side: BinanceOrderSide;
    type: BinanceOrderType;
    quantity?: number;
    quoteOrderQty?: number;
    price?: number;
    timeInForce?: BinanceTimeInForce;
    newClientOrderId: string;
  }): Promise<BinanceRawOrderResponse> {
    const symbol = params.symbol.toUpperCase().trim();
    const isBuy = params.side === 'BUY';

    // 1. Simulate Network Failures
    if (this.mode === 'NETWORK_TIMEOUT') {
      throw new NetworkAmbiguousError(
        '[MockBinanceTransport] Simulated socket timeout after 8000ms. Outcome is ambiguous.',
        params.newClientOrderId
      );
    }

    if (this.mode === 'SERVER_5XX') {
      throw new NetworkAmbiguousError(
        '[MockBinanceTransport] Simulated Binance 502 Bad Gateway. Outcome is ambiguous.',
        params.newClientOrderId
      );
    }

    // 2. Simulate API Rejections (4xx)
    if (this.mode === 'REJECTED_BALANCE') {
      throw new BinanceApiError(
        'Binance API Error [-2010]: Account has insufficient balance for requested action.',
        -2010,
        400,
        params.newClientOrderId
      );
    }

    if (this.mode === 'REJECTED_SYMBOL') {
      throw new BinanceApiError(
        'Binance API Error [-1121]: Invalid symbol.',
        -1121,
        400,
        params.newClientOrderId
      );
    }

    // 3. Resolve execution price dynamically
    let mockRefPrice: number | null = null;

    if (params.type === 'MARKET') {
      // Rule: MARKET orders MUST execute ONLY at a valid, fresh real-time market price.
      // Rejects execution if fresh market price is absent or stale.
      const freshPrice = this.marketDataStore.getFreshPrice(symbol);
      if (!freshPrice || freshPrice <= 0) {
        throw new BinanceApiError(
          `Binance Simulation Error: Execution rejected for MARKET order on ${symbol}. No valid fresh market price available in CentralMarketDataStore.`,
          -2010,
          400,
          params.newClientOrderId
        );
      }
      mockRefPrice = freshPrice;
    } else {
      // LIMIT or other orders use specified order price or fresh market price
      if (params.price && params.price > 0) {
        mockRefPrice = params.price;
      } else {
        const freshPrice = this.marketDataStore.getFreshPrice(symbol);
        if (freshPrice && freshPrice > 0) {
          mockRefPrice = freshPrice;
        } else {
          throw new BinanceApiError(
            `Binance Simulation Error: Execution rejected for ${params.type} order on ${symbol}. Price must be specified or fresh market price available.`,
            -1102,
            400,
            params.newClientOrderId
          );
        }
      }
    }

    let requestedQty = 0;
    let quoteAmount = 0;

    if (params.quoteOrderQty) {
      quoteAmount = params.quoteOrderQty;
      requestedQty = quoteAmount / mockRefPrice;
    } else if (params.quantity) {
      requestedQty = params.quantity;
      quoteAmount = requestedQty * mockRefPrice;
    } else {
      requestedQty = 1;
      quoteAmount = mockRefPrice;
    }

    let status = this.mode as 'FILLED' | 'PARTIALLY_FILLED' | 'NEW';
    let executedQty = requestedQty;
    let cummulativeQuoteQty = quoteAmount;

    if (this.mode === 'PARTIALLY_FILLED') {
      status = 'PARTIALLY_FILLED';
      executedQty = requestedQty * 0.5; // 50% filled
      cummulativeQuoteQty = quoteAmount * 0.5;
    } else if (this.mode === 'NEW') {
      status = 'NEW';
      executedQty = 0;
      cummulativeQuoteQty = 0;
    }

    const baseAsset = symbol.replace(/USDT$|BUSD$|USDC$|FDUSD$/, '');
    const quoteAsset = symbol.endsWith('USDT') ? 'USDT' : 'USDT';

    // 4. Update simulated balances ledger upon execution
    if (executedQty > 0) {
      const quoteBalance = this.getSimulatedBalance(quoteAsset);
      const baseBalance = this.getSimulatedBalance(baseAsset);

      if (isBuy) {
        // Buyer spends quote asset, receives base asset (minus 0.1% commission)
        const quoteSpent = cummulativeQuoteQty;
        const baseReceived = executedQty * 0.999;
        this.setSimulatedBalance(quoteAsset, Math.max(0, quoteBalance.free - quoteSpent), quoteBalance.locked);
        this.setSimulatedBalance(baseAsset, baseBalance.free + baseReceived, baseBalance.locked);
      } else {
        // Seller spends base asset, receives quote asset (minus 0.1% commission)
        const baseSpent = executedQty;
        const quoteReceived = cummulativeQuoteQty * 0.999;
        this.setSimulatedBalance(baseAsset, Math.max(0, baseBalance.free - baseSpent), baseBalance.locked);
        this.setSimulatedBalance(quoteAsset, quoteBalance.free + quoteReceived, quoteBalance.locked);
      }
    }

    const orderId = this.nextOrderId++;
    const now = Date.now();

    const formatMockPrecision = (num: number, minDecimals: number = 2, maxDecimals: number = 8): string => {
      if (num === 0) return '0.00';
      const fixed = num.toFixed(maxDecimals);
      const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
      const decPart = trimmed.split('.')[1] || '';
      return num >= 1 && decPart.length <= minDecimals ? num.toFixed(minDecimals) : trimmed;
    };

    const response: BinanceRawOrderResponse = {
      symbol,
      orderId,
      orderListId: -1,
      clientOrderId: params.newClientOrderId,
      transactTime: now,
      price: mockRefPrice >= 1 ? mockRefPrice.toFixed(2) : mockRefPrice.toFixed(8),
      origQty: formatMockPrecision(requestedQty, 4, 8),
      executedQty: formatMockPrecision(executedQty, 4, 8),
      cummulativeQuoteQty: formatMockPrecision(cummulativeQuoteQty, 2, 8),
      status,
      timeInForce: params.timeInForce || 'GTC',
      type: params.type,
      side: params.side,
      fills:
        executedQty > 0
          ? [
              {
                price: mockRefPrice >= 1 ? mockRefPrice.toFixed(2) : mockRefPrice.toFixed(8),
                qty: formatMockPrecision(executedQty, 4, 8),
                commission: (executedQty * 0.001).toFixed(8),
                commissionAsset: isBuy ? symbol.replace('USDT', '') : 'USDT',
                tradeId: Math.floor(Math.random() * 100000) + 1,
              },
            ]
          : [],
    };

    // Store in memory for subsequent queryOrder / cancelOrder calls
    this.ordersByClientId.set(params.newClientOrderId, response);
    this.ordersById.set(orderId, response);

    return response;
  }

  public async queryOrder(params: {
    symbol: string;
    orderId?: number;
    origClientOrderId?: string;
  }): Promise<BinanceRawQueryOrderResponse> {
    let order: BinanceRawOrderResponse | undefined;

    if (params.origClientOrderId) {
      order = this.ordersByClientId.get(params.origClientOrderId);
    }
    if (!order && params.orderId) {
      order = this.ordersById.get(params.orderId);
    }

    if (!order) {
      throw new BinanceApiError(
        'Binance Query Error [-2011]: Unknown order sent. Order does not exist.',
        -2011,
        400,
        params.origClientOrderId
      );
    }

    return {
      symbol: order.symbol,
      orderId: order.orderId,
      orderListId: order.orderListId,
      clientOrderId: order.clientOrderId,
      price: order.price,
      origQty: order.origQty,
      executedQty: order.executedQty,
      cummulativeQuoteQty: order.cummulativeQuoteQty,
      status: order.status,
      timeInForce: order.timeInForce,
      type: order.type,
      side: order.side,
      time: order.transactTime,
      updateTime: order.transactTime,
      isWorking: order.status === 'NEW' || order.status === 'PARTIALLY_FILLED',
    };
  }

  public async cancelOrder(params: {
    symbol: string;
    orderId?: number;
    origClientOrderId?: string;
  }): Promise<BinanceRawOrderResponse> {
    let order: BinanceRawOrderResponse | undefined;

    if (params.origClientOrderId) {
      order = this.ordersByClientId.get(params.origClientOrderId);
    }
    if (!order && params.orderId) {
      order = this.ordersById.get(params.orderId);
    }

    if (!order) {
      throw new BinanceApiError('Order not found to cancel', -2011, 400, params.origClientOrderId);
    }

    order.status = 'CANCELED';
    return order;
  }

  public async getServerTime(): Promise<BinanceServerTimeResponse> {
    return {
      serverTime: Date.now(),
      offsetMs: 0,
    };
  }

  public async getAccountInformation(): Promise<BinanceAccountInformation> {
    const balances: Array<{ asset: string; free: string; locked: string }> = [];
    this.simulatedBalances.forEach((val, asset) => {
      balances.push({
        asset,
        free: val.free.toFixed(8),
        locked: val.locked.toFixed(8),
      });
    });

    return {
      makerCommission: 10,
      takerCommission: 10,
      buyerCommission: 0,
      sellerCommission: 0,
      canTrade: true,
      canWithdraw: false,
      canDeposit: true,
      updateTime: Date.now(),
      accountType: 'SPOT',
      balances,
    };
  }

  public async getSymbolFilters(symbol: string): Promise<BinanceSymbolFilters | null> {
    const upper = symbol.toUpperCase().trim();
    return {
      symbol: upper,
      minPrice: 0.01,
      maxPrice: 1000000,
      tickSize: 0.01,
      minQty: 0.00001,
      maxQty: 9000,
      stepSize: 0.00001,
      minNotional: 5,
    };
  }
}
