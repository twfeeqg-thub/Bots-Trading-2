// Project Q — Binance Trading Layer: Real Server-Side Binance Spot REST Client
// Interacts with Binance Spot REST API (/api/v3/order) with HMAC SHA-256 authentication.
// Strictly server-side only.

import {
  BinanceOrderSide,
  BinanceOrderType,
  BinanceRawOrderResponse,
  BinanceRawQueryOrderResponse,
  BinanceTimeInForce,
  IBinanceTransport,
} from './types';
import { BinanceSigner } from './binance-signer';

export class NetworkAmbiguousError extends Error {
  public isAmbiguous: boolean = true;
  public clientOrderId?: string;

  constructor(message: string, clientOrderId?: string) {
    super(message);
    this.name = 'NetworkAmbiguousError';
    this.clientOrderId = clientOrderId;
  }
}

export class BinanceApiError extends Error {
  public code: number;
  public status: number;
  public clientOrderId?: string;

  constructor(message: string, code: number, status: number, clientOrderId?: string) {
    super(message);
    this.name = 'BinanceApiError';
    this.code = code;
    this.status = status;
    this.clientOrderId = clientOrderId;
  }
}

export class BinanceTradingClient implements IBinanceTransport {
  private signer: BinanceSigner;
  private requestTimeoutMs: number;

  constructor(signer?: BinanceSigner, requestTimeoutMs: number = 8000) {
    this.signer = signer || new BinanceSigner();
    this.requestTimeoutMs = requestTimeoutMs;
  }

  /**
   * Dispatches a new order to Binance (POST /api/v3/order).
   */
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
    if (!this.signer.hasCredentials()) {
      throw new Error(
        '[BinanceTradingClient] Outbound call blocked: Real Binance live trading is strictly disabled in this phase. Use MockBinanceTransport.'
      );
    }

    const rawParams: Record<string, string | number | undefined> = {
      symbol: params.symbol.toUpperCase().trim(),
      side: params.side,
      type: params.type,
      newClientOrderId: params.newClientOrderId,
      newOrderRespType: 'FULL', // Receive fills, executedQty, cummulativeQuoteQty
    };

    if (params.type === 'MARKET') {
      if (params.quoteOrderQty !== undefined && params.quoteOrderQty > 0) {
        rawParams.quoteOrderQty = params.quoteOrderQty;
      } else if (params.quantity !== undefined && params.quantity > 0) {
        rawParams.quantity = params.quantity;
      }
    } else if (params.type === 'LIMIT') {
      rawParams.quantity = params.quantity;
      rawParams.price = params.price;
      rawParams.timeInForce = params.timeInForce || 'GTC';
    }

    const signedQuery = this.signer.signParams(rawParams);
    const url = `${this.signer.getBaseUrl()}/api/v3/order`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-MBX-APIKEY': this.signer.getApiKey(),
          'User-Agent': 'Mozilla/5.0 (compatible; ProjectQTrading/1.0)',
        },
        body: signedQuery,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const code = data?.code || res.status;
        const msg = data?.msg || res.statusText || 'Binance HTTP error';

        // 5xx Server Error: Ambiguous! The order may have reached the matching engine.
        if (res.status >= 500) {
          throw new NetworkAmbiguousError(
            `Binance 5xx Server Error (${res.status}): ${msg}. Outcome is ambiguous, VERIFY required.`,
            params.newClientOrderId
          );
        }

        // 4xx Client Error: Rejected (e.g. insufficient funds, invalid symbol)
        throw new BinanceApiError(`Binance API Error [${code}]: ${msg}`, code, res.status, params.newClientOrderId);
      }

      return data as BinanceRawOrderResponse;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      // Already handled BinanceApiError
      if (err instanceof BinanceApiError) {
        throw err;
      }

      // If aborted or network dropped, it's AMBIGUOUS!
      if (err instanceof NetworkAmbiguousError) {
        throw err;
      }

      const isAbort = (err as Error)?.name === 'AbortError';
      const msg = isAbort
        ? `Request timed out after ${this.requestTimeoutMs}ms. Order dispatch is ambiguous, VERIFY required.`
        : `Network connection error: ${(err as Error)?.message || String(err)}. Order dispatch is ambiguous, VERIFY required.`;

      throw new NetworkAmbiguousError(msg, params.newClientOrderId);
    }
  }

  /**
   * Queries status of an existing order on Binance (GET /api/v3/order).
   */
  public async queryOrder(params: {
    symbol: string;
    orderId?: number;
    origClientOrderId?: string;
  }): Promise<BinanceRawQueryOrderResponse> {
    if (!this.signer.hasCredentials()) {
      throw new Error(
        '[BinanceTradingClient] Outbound call blocked: Real Binance live trading is strictly disabled in this phase. Use MockBinanceTransport.'
      );
    }

    const rawParams: Record<string, string | number | undefined> = {
      symbol: params.symbol.toUpperCase().trim(),
    };

    if (params.orderId) {
      rawParams.orderId = params.orderId;
    }
    if (params.origClientOrderId) {
      rawParams.origClientOrderId = params.origClientOrderId;
    }

    const signedQuery = this.signer.signParams(rawParams);
    const url = `${this.signer.getBaseUrl()}/api/v3/order?${signedQuery}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': this.signer.getApiKey(),
          'User-Agent': 'Mozilla/5.0 (compatible; ProjectQTrading/1.0)',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const code = data?.code || res.status;
        const msg = data?.msg || res.statusText || 'Binance query error';
        throw new BinanceApiError(`Binance Query Error [${code}]: ${msg}`, code, res.status, params.origClientOrderId);
      }

      return data as BinanceRawQueryOrderResponse;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof BinanceApiError) {
        throw err;
      }
      throw new NetworkAmbiguousError(
        `Failed to query order from Binance: ${(err as Error)?.message || String(err)}`,
        params.origClientOrderId
      );
    }
  }

  /**
   * Cancels an order on Binance (DELETE /api/v3/order).
   */
  public async cancelOrder(params: {
    symbol: string;
    orderId?: number;
    origClientOrderId?: string;
  }): Promise<BinanceRawOrderResponse> {
    if (!this.signer.hasCredentials()) {
      throw new Error(
        '[BinanceTradingClient] Outbound call blocked: Real Binance live trading is strictly disabled in this phase. Use MockBinanceTransport.'
      );
    }

    const rawParams: Record<string, string | number | undefined> = {
      symbol: params.symbol.toUpperCase().trim(),
    };

    if (params.orderId) rawParams.orderId = params.orderId;
    if (params.origClientOrderId) rawParams.origClientOrderId = params.origClientOrderId;

    const signedQuery = this.signer.signParams(rawParams);
    const url = `${this.signer.getBaseUrl()}/api/v3/order?${signedQuery}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'X-MBX-APIKEY': this.signer.getApiKey(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await res.json();
      return data as BinanceRawOrderResponse;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}
