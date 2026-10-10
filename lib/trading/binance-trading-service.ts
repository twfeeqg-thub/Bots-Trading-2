// Project Q — Binance Trading Layer (V1): Primary Trading Service
// Orchestrates Buy, Sell (full & partial), and Verify with Binance.
// Strictly enforces:
// 1. Separation of SEND and VERIFY.
// 2. Explicit AMBIGUOUS result handling without blind retries.
// 3. Strict duplicate prevention via OrderLockManager.
// 4. Binance as the definitive source of truth.
// 5. Server-side only execution.

import {
  BinanceOrderSide,
  BinanceRawFill,
  BinanceRawOrderResponse,
  BinanceRawQueryOrderResponse,
  BuyExecutionResult,
  BuyOrderParams,
  IBinanceTransport,
  OrderVerificationResult,
  SellExecutionResult,
  SellOrderParams,
  VerifyOrderParams,
} from './types';
import { BinanceSigner } from './binance-signer';
import { BinanceTradingClient, BinanceApiError, NetworkAmbiguousError } from './binance-trading-client';
import { MockBinanceTransport } from './mock-binance-transport';
import { OrderLockManager, sharedOrderLockManager } from './order-lock-manager';

export interface BinanceTradingServiceConfig {
  transport?: IBinanceTransport;
  lockManager?: OrderLockManager;
}

export class BinanceTradingService {
  private static instance: BinanceTradingService | null = null;
  private transport: IBinanceTransport;
  private lockManager: OrderLockManager;

  constructor(config?: BinanceTradingServiceConfig) {
    if (config?.transport) {
      this.transport = config.transport;
    } else {
      const signer = new BinanceSigner();
      if (signer.hasCredentials()) {
        this.transport = new BinanceTradingClient(signer);
      } else {
        // Safe default: When no real Binance keys are provided in environment,
        // use MockBinanceTransport so NO network requests or real trades ever touch Binance.
        this.transport = new MockBinanceTransport();
      }
    }
    this.lockManager = config?.lockManager || sharedOrderLockManager;
  }

  public static getInstance(): BinanceTradingService {
    if (!BinanceTradingService.instance) {
      BinanceTradingService.instance = new BinanceTradingService();
    }
    return BinanceTradingService.instance;
  }

  /**
   * Indicates whether the service is currently using a mock/test double transport.
   */
  public isUsingMock(): boolean {
    return this.transport instanceof MockBinanceTransport;
  }

  /**
   * Allows injecting custom transport (e.g. mock transport during tests)
   */
  public setTransport(transport: IBinanceTransport): void {
    this.transport = transport;
  }

  public getLockManager(): OrderLockManager {
    return this.lockManager;
  }

  /**
   * Explicitly clears a lock for a bot and side (used after verified manual resolution).
   */
  public clearLock(botId: string, side: BinanceOrderSide, clientOrderId?: string): void {
    this.lockManager.releaseLock(botId, side, clientOrderId);
  }

  // ============================================================================
  // BUY OPERATION (SEND & EVALUATE)
  // ============================================================================

  /**
   * Dispatches a Buy order to Binance.
   * Does NOT assume position is open on mere send.
   * Returns explicit outcome (SUCCESS, PARTIAL, FAILED, AMBIGUOUS).
   */
  public async executeBuy(params: BuyOrderParams): Promise<BuyExecutionResult> {
    const symbol = params.symbol.toUpperCase().trim();
    const orderType = params.orderType || 'MARKET';
    const now = Date.now();

    // 1. Check duplicate prevention lock
    const canSendCheck = this.lockManager.canSend(params.botId, 'BUY');
    if (!canSendCheck.allowed) {
      return {
        sent: false,
        orderId: canSendCheck.lock?.orderId || null,
        clientOrderId: canSendCheck.lock?.clientOrderId || '',
        status: 'UNKNOWN',
        outcome: 'AMBIGUOUS',
        isFinal: false,
        needsVerification: true,
        requestedAmount: params.quoteOrderQty || params.quantity || 0,
        executedQty: 0,
        cummulativeQuoteQty: 0,
        avgPrice: null,
        commission: null,
        error: canSendCheck.reason,
        raw: null,
        timestamp: now,
      };
    }

    // 2. Generate clientOrderId and acquire lock
    const clientOrderId = params.clientOrderId || BinanceSigner.generateClientOrderId('BUY', params.botId, params.cycleId);
    this.lockManager.acquireLock(params.botId, 'BUY', symbol, clientOrderId, params.cycleId);

    try {
      // 3. Dispatch to Binance transport
      const res = await this.transport.sendOrder({
        symbol,
        side: 'BUY',
        type: orderType,
        quoteOrderQty: params.quoteOrderQty,
        quantity: params.quantity,
        price: params.price,
        newClientOrderId: clientOrderId,
      });

      // 4. Evaluate Binance response
      return this.evaluateBuyResponse(params, clientOrderId, res);
    } catch (err: unknown) {
      return this.handleBuyError(params, clientOrderId, err);
    }
  }

  private evaluateBuyResponse(
    params: BuyOrderParams,
    clientOrderId: string,
    res: BinanceRawOrderResponse
  ): BuyExecutionResult {
    const now = Date.now();
    const orderIdStr = res.orderId ? String(res.orderId) : null;
    const executedQty = parseFloat(res.executedQty || '0');
    const cummulativeQuoteQty = parseFloat(res.cummulativeQuoteQty || '0');
    const avgPrice = this.calculateAveragePrice(executedQty, cummulativeQuoteQty, res.fills);
    const commission = this.extractCommission(res.fills);

    // Save orderId into lock record for verification reference
    const lock = this.lockManager.getLock(params.botId, 'BUY');
    if (lock) lock.orderId = orderIdStr;

    switch (res.status) {
      case 'FILLED': {
        // Complete execution confirmed
        this.lockManager.releaseLock(params.botId, 'BUY', clientOrderId);
        return {
          sent: true,
          orderId: orderIdStr,
          clientOrderId,
          status: 'FILLED',
          outcome: 'SUCCESS',
          isFinal: true,
          needsVerification: false,
          requestedAmount: params.quoteOrderQty || params.quantity || 0,
          executedQty,
          cummulativeQuoteQty,
          avgPrice,
          commission,
          raw: res,
          timestamp: now,
        };
      }

      case 'PARTIALLY_FILLED': {
        // Partial execution
        this.lockManager.markAmbiguous(params.botId, 'BUY', clientOrderId, 'Order partially filled on Binance');
        return {
          sent: true,
          orderId: orderIdStr,
          clientOrderId,
          status: 'PARTIALLY_FILLED',
          outcome: 'PARTIAL',
          isFinal: false,
          needsVerification: true,
          requestedAmount: params.quoteOrderQty || params.quantity || 0,
          executedQty,
          cummulativeQuoteQty,
          avgPrice,
          commission,
          raw: res,
          timestamp: now,
        };
      }

      case 'NEW': {
        // Accepted by matching engine, awaiting fill (e.g. LIMIT order)
        this.lockManager.markAmbiguous(params.botId, 'BUY', clientOrderId, 'Order is NEW on Binance order book');
        return {
          sent: true,
          orderId: orderIdStr,
          clientOrderId,
          status: 'NEW',
          outcome: 'AMBIGUOUS',
          isFinal: false,
          needsVerification: true,
          requestedAmount: params.quoteOrderQty || params.quantity || 0,
          executedQty: 0,
          cummulativeQuoteQty: 0,
          avgPrice: null,
          commission: null,
          raw: res,
          timestamp: now,
        };
      }

      case 'CANCELED':
      case 'REJECTED':
      case 'EXPIRED':
      case 'EXPIRED_IN_MATCH': {
        this.lockManager.releaseLock(params.botId, 'BUY', clientOrderId);
        return {
          sent: true,
          orderId: orderIdStr,
          clientOrderId,
          status: res.status,
          outcome: 'FAILED',
          isFinal: true,
          needsVerification: false,
          requestedAmount: params.quoteOrderQty || params.quantity || 0,
          executedQty,
          cummulativeQuoteQty,
          avgPrice,
          commission,
          error: `Order ended with status ${res.status}`,
          raw: res,
          timestamp: now,
        };
      }

      default: {
        this.lockManager.markAmbiguous(params.botId, 'BUY', clientOrderId, `Unknown status ${res.status}`);
        return {
          sent: true,
          orderId: orderIdStr,
          clientOrderId,
          status: res.status || 'UNKNOWN',
          outcome: 'AMBIGUOUS',
          isFinal: false,
          needsVerification: true,
          requestedAmount: params.quoteOrderQty || params.quantity || 0,
          executedQty,
          cummulativeQuoteQty,
          avgPrice,
          commission,
          raw: res,
          timestamp: now,
        };
      }
    }
  }

  private handleBuyError(
    params: BuyOrderParams,
    clientOrderId: string,
    err: unknown
  ): BuyExecutionResult {
    const now = Date.now();

    // 4xx Rejected from Binance (e.g. insufficient funds, invalid symbol)
    if (err instanceof BinanceApiError) {
      this.lockManager.releaseLock(params.botId, 'BUY', clientOrderId);
      return {
        sent: false,
        orderId: null,
        clientOrderId,
        status: 'REJECTED',
        outcome: 'FAILED',
        isFinal: true,
        needsVerification: false,
        requestedAmount: params.quoteOrderQty || params.quantity || 0,
        executedQty: 0,
        cummulativeQuoteQty: 0,
        avgPrice: null,
        commission: null,
        error: err.message,
        raw: { code: err.code, status: err.status },
        timestamp: now,
      };
    }

    // Network timeout, connection drop, 5xx server error: AMBIGUOUS!
    const errorMsg = (err as Error)?.message || String(err);
    this.lockManager.markAmbiguous(
      params.botId,
      'BUY',
      clientOrderId,
      `Network/Ambiguous error: ${errorMsg}. DO NOT RESEND. VERIFY FIRST.`
    );

    return {
      sent: true, // Dispatched over network, unknown whether Binance matching engine received it
      orderId: null,
      clientOrderId,
      status: 'UNKNOWN',
      outcome: 'AMBIGUOUS',
      isFinal: false,
      needsVerification: true,
      requestedAmount: params.quoteOrderQty || params.quantity || 0,
      executedQty: 0,
      cummulativeQuoteQty: 0,
      avgPrice: null,
      commission: null,
      error: `نتيجة غامضة (Ambiguous): ${errorMsg}. يمنع إرسال أمر ثانٍ، يجب التحقق أولاً من Binance (VERIFY).`,
      raw: null,
      timestamp: now,
    };
  }

  // ============================================================================
  // SELL OPERATION (SEND & EVALUATE)
  // ============================================================================

  /**
   * Dispatches a Sell order to Binance.
   * Supports full sell and partial sell.
   * Does NOT assume trade is closed on mere send.
   */
  public async executeSell(params: SellOrderParams): Promise<SellExecutionResult> {
    const symbol = params.symbol.toUpperCase().trim();
    const orderType = params.orderType || 'MARKET';
    const now = Date.now();

    // 1. Check duplicate prevention lock
    const canSendCheck = this.lockManager.canSend(params.botId, 'SELL');
    if (!canSendCheck.allowed) {
      return {
        sent: false,
        orderId: canSendCheck.lock?.orderId || null,
        clientOrderId: canSendCheck.lock?.clientOrderId || '',
        status: 'UNKNOWN',
        outcome: 'AMBIGUOUS',
        isFinal: false,
        needsVerification: true,
        isPartial: Boolean(params.isPartial),
        requestedQty: params.quantity,
        executedQty: 0,
        cummulativeQuoteQty: 0,
        avgPrice: null,
        commission: null,
        error: canSendCheck.reason,
        raw: null,
        timestamp: now,
      };
    }

    // 2. Generate clientOrderId and acquire lock
    const clientOrderId = params.clientOrderId || BinanceSigner.generateClientOrderId('SELL', params.botId, params.tradeId);
    this.lockManager.acquireLock(params.botId, 'SELL', symbol, clientOrderId, params.cycleId);

    try {
      // 3. Dispatch to Binance transport
      const res = await this.transport.sendOrder({
        symbol,
        side: 'SELL',
        type: orderType,
        quantity: params.quantity,
        price: params.price,
        newClientOrderId: clientOrderId,
      });

      // 4. Evaluate Binance response
      return this.evaluateSellResponse(params, clientOrderId, res);
    } catch (err: unknown) {
      return this.handleSellError(params, clientOrderId, err);
    }
  }

  private evaluateSellResponse(
    params: SellOrderParams,
    clientOrderId: string,
    res: BinanceRawOrderResponse
  ): SellExecutionResult {
    const now = Date.now();
    const orderIdStr = res.orderId ? String(res.orderId) : null;
    const executedQty = parseFloat(res.executedQty || '0');
    const cummulativeQuoteQty = parseFloat(res.cummulativeQuoteQty || '0');
    const avgPrice = this.calculateAveragePrice(executedQty, cummulativeQuoteQty, res.fills);
    const commission = this.extractCommission(res.fills);

    const lock = this.lockManager.getLock(params.botId, 'SELL');
    if (lock) lock.orderId = orderIdStr;

    switch (res.status) {
      case 'FILLED': {
        this.lockManager.releaseLock(params.botId, 'SELL', clientOrderId);
        return {
          sent: true,
          orderId: orderIdStr,
          clientOrderId,
          status: 'FILLED',
          outcome: 'SUCCESS',
          isFinal: true,
          needsVerification: false,
          isPartial: Boolean(params.isPartial),
          requestedQty: params.quantity,
          executedQty,
          cummulativeQuoteQty,
          avgPrice,
          commission,
          raw: res,
          timestamp: now,
        };
      }

      case 'PARTIALLY_FILLED': {
        this.lockManager.markAmbiguous(params.botId, 'SELL', clientOrderId, 'Sell order partially filled on Binance');
        return {
          sent: true,
          orderId: orderIdStr,
          clientOrderId,
          status: 'PARTIALLY_FILLED',
          outcome: 'PARTIAL',
          isFinal: false,
          needsVerification: true,
          isPartial: true, // Confirmed partial execution
          requestedQty: params.quantity,
          executedQty,
          cummulativeQuoteQty,
          avgPrice,
          commission,
          raw: res,
          timestamp: now,
        };
      }

      case 'NEW': {
        this.lockManager.markAmbiguous(params.botId, 'SELL', clientOrderId, 'Sell order is NEW on Binance order book');
        return {
          sent: true,
          orderId: orderIdStr,
          clientOrderId,
          status: 'NEW',
          outcome: 'AMBIGUOUS',
          isFinal: false,
          needsVerification: true,
          isPartial: Boolean(params.isPartial),
          requestedQty: params.quantity,
          executedQty: 0,
          cummulativeQuoteQty: 0,
          avgPrice: null,
          commission: null,
          raw: res,
          timestamp: now,
        };
      }

      case 'CANCELED':
      case 'REJECTED':
      case 'EXPIRED':
      case 'EXPIRED_IN_MATCH': {
        this.lockManager.releaseLock(params.botId, 'SELL', clientOrderId);
        return {
          sent: true,
          orderId: orderIdStr,
          clientOrderId,
          status: res.status,
          outcome: 'FAILED',
          isFinal: true,
          needsVerification: false,
          isPartial: Boolean(params.isPartial),
          requestedQty: params.quantity,
          executedQty,
          cummulativeQuoteQty,
          avgPrice,
          commission,
          error: `Sell order ended with status ${res.status}`,
          raw: res,
          timestamp: now,
        };
      }

      default: {
        this.lockManager.markAmbiguous(params.botId, 'SELL', clientOrderId, `Unknown status ${res.status}`);
        return {
          sent: true,
          orderId: orderIdStr,
          clientOrderId,
          status: res.status || 'UNKNOWN',
          outcome: 'AMBIGUOUS',
          isFinal: false,
          needsVerification: true,
          isPartial: Boolean(params.isPartial),
          requestedQty: params.quantity,
          executedQty,
          cummulativeQuoteQty,
          avgPrice,
          commission,
          raw: res,
          timestamp: now,
        };
      }
    }
  }

  private handleSellError(
    params: SellOrderParams,
    clientOrderId: string,
    err: unknown
  ): SellExecutionResult {
    const now = Date.now();

    if (err instanceof BinanceApiError) {
      this.lockManager.releaseLock(params.botId, 'SELL', clientOrderId);
      return {
        sent: false,
        orderId: null,
        clientOrderId,
        status: 'REJECTED',
        outcome: 'FAILED',
        isFinal: true,
        needsVerification: false,
        isPartial: Boolean(params.isPartial),
        requestedQty: params.quantity,
        executedQty: 0,
        cummulativeQuoteQty: 0,
        avgPrice: null,
        commission: null,
        error: err.message,
        raw: { code: err.code, status: err.status },
        timestamp: now,
      };
    }

    const errorMsg = (err as Error)?.message || String(err);
    this.lockManager.markAmbiguous(
      params.botId,
      'SELL',
      clientOrderId,
      `Network/Ambiguous error: ${errorMsg}. DO NOT RESEND. VERIFY FIRST.`
    );

    return {
      sent: true,
      orderId: null,
      clientOrderId,
      status: 'UNKNOWN',
      outcome: 'AMBIGUOUS',
      isFinal: false,
      needsVerification: true,
      isPartial: Boolean(params.isPartial),
      requestedQty: params.quantity,
      executedQty: 0,
      cummulativeQuoteQty: 0,
      avgPrice: null,
      commission: null,
      error: `نتيجة غامضة في البيع (Ambiguous): ${errorMsg}. يمنع إرسال أمر ثانٍ، يجب التحقق أولاً من Binance (VERIFY).`,
      raw: null,
      timestamp: now,
    };
  }

  // ============================================================================
  // VERIFY OPERATION (ORDER STATUS QUERY)
  // ============================================================================

  /**
   * Queries Binance for an order's definitive status.
   * Resolves ambiguous states and unlocks operations when finalized.
   */
  public async verifyOrder(params: VerifyOrderParams): Promise<OrderVerificationResult> {
    const symbol = params.symbol.toUpperCase().trim();
    const now = Date.now();

    const orderIdNum = params.orderId ? Number(params.orderId) : undefined;
    const clientOrderId = params.clientOrderId || '';

    try {
      const res = await this.transport.queryOrder({
        symbol,
        orderId: orderIdNum,
        origClientOrderId: clientOrderId || undefined,
      });

      const orderIdStr = res.orderId ? String(res.orderId) : null;
      const resClientOrderId = res.clientOrderId || clientOrderId;
      const origQty = parseFloat(res.origQty || '0');
      const executedQty = parseFloat(res.executedQty || '0');
      const cummulativeQuoteQty = parseFloat(res.cummulativeQuoteQty || '0');
      const avgPrice = executedQty > 0 ? cummulativeQuoteQty / executedQty : null;
      const side = res.side || 'UNKNOWN';

      switch (res.status) {
        case 'FILLED': {
          // Finalized on Binance! Release any active lock.
          if (side === 'BUY' || side === 'SELL') {
            this.lockManager.releaseLock(params.botId, side, resClientOrderId);
          }
          return {
            found: true,
            orderId: orderIdStr,
            clientOrderId: resClientOrderId,
            status: 'FILLED',
            outcome: 'SUCCESS',
            isFinal: true,
            needsVerification: false,
            origQty,
            executedQty,
            cummulativeQuoteQty,
            avgPrice,
            side,
            raw: res,
            timestamp: now,
          };
        }

        case 'PARTIALLY_FILLED': {
          return {
            found: true,
            orderId: orderIdStr,
            clientOrderId: resClientOrderId,
            status: 'PARTIALLY_FILLED',
            outcome: 'PARTIAL',
            isFinal: false,
            needsVerification: true,
            origQty,
            executedQty,
            cummulativeQuoteQty,
            avgPrice,
            side,
            raw: res,
            timestamp: now,
          };
        }

        case 'NEW': {
          return {
            found: true,
            orderId: orderIdStr,
            clientOrderId: resClientOrderId,
            status: 'NEW',
            outcome: 'AMBIGUOUS',
            isFinal: false,
            needsVerification: true,
            origQty,
            executedQty,
            cummulativeQuoteQty,
            avgPrice,
            side,
            raw: res,
            timestamp: now,
          };
        }

        case 'CANCELED':
        case 'REJECTED':
        case 'EXPIRED':
        case 'EXPIRED_IN_MATCH': {
          if (side === 'BUY' || side === 'SELL') {
            this.lockManager.releaseLock(params.botId, side, resClientOrderId);
          }
          return {
            found: true,
            orderId: orderIdStr,
            clientOrderId: resClientOrderId,
            status: res.status,
            outcome: 'FAILED',
            isFinal: true,
            needsVerification: false,
            origQty,
            executedQty,
            cummulativeQuoteQty,
            avgPrice,
            side,
            raw: res,
            timestamp: now,
          };
        }

        default: {
          return {
            found: true,
            orderId: orderIdStr,
            clientOrderId: resClientOrderId,
            status: res.status,
            outcome: 'AMBIGUOUS',
            isFinal: false,
            needsVerification: true,
            origQty,
            executedQty,
            cummulativeQuoteQty,
            avgPrice,
            side,
            raw: res,
            timestamp: now,
          };
        }
      }
    } catch (err: unknown) {
      // Check if Binance reported -2011 "Unknown order sent / Order does not exist"
      if (err instanceof BinanceApiError && err.code === -2011) {
        // IMPORTANT: -2011 strictly means the order was not found with the specific queried identifier at this time.
        // It is NOT absolute proof that no order was executed (e.g. latency, clientOrderId mismatch, or replication delay).
        const activeBuyLock = this.lockManager.getLock(params.botId, 'BUY');
        const activeSellLock = this.lockManager.getLock(params.botId, 'SELL');
        const isAmbiguousOperation =
          (activeBuyLock && activeBuyLock.state === 'AMBIGUOUS_NEEDS_VERIFY') ||
          (activeSellLock && activeSellLock.state === 'AMBIGUOUS_NEEDS_VERIFY');

        if (isAmbiguousOperation) {
          // If the previous operation was AMBIGUOUS, a single -2011 query MUST NOT release the lock
          // or allow a blind resend! Keep the lock active and require explicit determination.
          return {
            found: false,
            orderId: params.orderId ? String(params.orderId) : null,
            clientOrderId,
            status: 'NOT_FOUND',
            outcome: 'AMBIGUOUS',
            isFinal: false,
            needsVerification: true,
            origQty: 0,
            executedQty: 0,
            cummulativeQuoteQty: 0,
            avgPrice: null,
            side: 'UNKNOWN',
            error: 'الأمر غير موجود عند الاستعلام باستخدام المعرّف المتاح (-2011). بما أن العملية السابقة في حالة غامضة، يمنع فك القفل أو إعادة الإرسال الأعمى.',
            raw: { code: err.code, status: err.status },
            timestamp: now,
          };
        }

        // Only release the lock if the operation was not ambiguous
        this.lockManager.releaseLock(params.botId, 'BUY', clientOrderId);
        this.lockManager.releaseLock(params.botId, 'SELL', clientOrderId);

        return {
          found: false,
          orderId: params.orderId ? String(params.orderId) : null,
          clientOrderId,
          status: 'NOT_FOUND',
          outcome: 'FAILED',
          isFinal: true,
          needsVerification: false,
          origQty: 0,
          executedQty: 0,
          cummulativeQuoteQty: 0,
          avgPrice: null,
          side: 'UNKNOWN',
          error: 'الأمر غير موجود عند الاستعلام باستخدام المعرّف المتاح (-2011).',
          raw: { code: err.code, status: err.status },
          timestamp: now,
        };
      }

      // Network error during verification query
      const errorMsg = (err as Error)?.message || String(err);
      return {
        found: false,
        orderId: params.orderId ? String(params.orderId) : null,
        clientOrderId,
        status: 'UNKNOWN',
        outcome: 'AMBIGUOUS',
        isFinal: false,
        needsVerification: true,
        origQty: 0,
        executedQty: 0,
        cummulativeQuoteQty: 0,
        avgPrice: null,
        side: 'UNKNOWN',
        error: `فشل الاستعلام عن الأمر من Binance: ${errorMsg}. ما زال التحقق مطلوباً.`,
        raw: null,
        timestamp: now,
      };
    }
  }

  // ============================================================================
  // INTERNAL HELPERS
  // ============================================================================

  private calculateAveragePrice(
    executedQty: number,
    cummulativeQuoteQty: number,
    fills?: BinanceRawFill[]
  ): number | null {
    if (fills && fills.length > 0) {
      let totalCost = 0;
      let totalQty = 0;
      for (const fill of fills) {
        const p = parseFloat(fill.price);
        const q = parseFloat(fill.qty);
        if (!isNaN(p) && !isNaN(q)) {
          totalCost += p * q;
          totalQty += q;
        }
      }
      if (totalQty > 0) return totalCost / totalQty;
    }

    if (executedQty > 0 && cummulativeQuoteQty > 0) {
      return cummulativeQuoteQty / executedQty;
    }

    return null;
  }

  private extractCommission(fills?: BinanceRawFill[]): { asset: string; amount: number } | null {
    if (!fills || fills.length === 0) return null;
    let totalComm = 0;
    let asset = '';
    for (const f of fills) {
      const c = parseFloat(f.commission);
      if (!isNaN(c)) {
        totalComm += c;
        asset = f.commissionAsset;
      }
    }
    return totalComm > 0 ? { asset, amount: totalComm } : null;
  }
}

export const sharedBinanceTradingService = BinanceTradingService.getInstance();
