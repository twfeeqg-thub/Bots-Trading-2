// Project Q — Binance Trading Layer: Real Server-Side Binance Spot REST Client
// Interacts with Binance Spot REST API (/api/v3/order) with HMAC SHA-256 authentication.
// Strictly server-side only.

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
  private lastUsedWeight1m: number = 0;

  constructor(signer?: BinanceSigner, requestTimeoutMs: number = 8000) {
    this.signer = signer || new BinanceSigner();
    this.requestTimeoutMs = requestTimeoutMs;
  }

  public getSigner(): BinanceSigner {
    return this.signer;
  }

  public getLastUsedWeight1m(): number {
    return this.lastUsedWeight1m;
  }

  private recordHeaders(res: Response): void {
    const weightHeader = res.headers.get('x-mbx-used-weight-1m');
    if (weightHeader) {
      const parsed = parseInt(weightHeader, 10);
      if (!isNaN(parsed)) {
        this.lastUsedWeight1m = parsed;
      }
    }
  }

  /**
   * Strictly validates that the environment and URL are permitted for outbound calls.
   * Prevents sending Testnet credentials to Production or vice-versa.
   */
  private validateOutboundCall(): void {
    const status = this.signer.getConfigurationStatus();
    if (!status.valid) {
      throw new Error(
        `[BinanceTradingClient] Outbound call blocked: ${status.error || 'Real Binance live trading is strictly disabled in this phase. Use MockBinanceTransport.'}`
      );
    }

    if (status.mode === 'testnet') {
      const lowerUrl = this.signer.getBaseUrl().toLowerCase();
      if (
        lowerUrl.includes('api.binance.com') ||
        lowerUrl.includes('api1.binance.com') ||
        lowerUrl.includes('api2.binance.com') ||
        lowerUrl.includes('api3.binance.com')
      ) {
        throw new Error(
          `[BinanceTradingClient] Outbound call blocked: Production URL (${this.signer.getBaseUrl()}) is strictly forbidden in Testnet mode.`
        );
      }
    }
  }

  /**
   * Synchronizes server time with Binance (GET /api/v3/time) and updates time offset.
   */
  public async getServerTime(): Promise<BinanceServerTimeResponse> {
    const url = `${this.signer.getBaseUrl()}/api/v3/time`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; ProjectQTrading/1.0)',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      this.recordHeaders(res);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new BinanceApiError(`Failed to fetch Binance server time: ${errorText || res.statusText}`, res.status, res.status);
      }

      const data = await res.json();
      const serverTime = Number(data.serverTime);
      const localTime = Date.now();
      const offsetMs = serverTime - localTime;

      this.signer.setTimeOffset(offsetMs);

      return { serverTime, offsetMs };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof BinanceApiError) throw err;
      throw new Error(`Failed to query Binance server time: ${(err as Error)?.message || String(err)}`);
    }
  }

  /**
   * Reads Binance Spot account information and balances (GET /api/v3/account).
   */
  public async getAccountInformation(): Promise<BinanceAccountInformation> {
    this.validateOutboundCall();

    const signedQuery = this.signer.signParams({});
    const url = `${this.signer.getBaseUrl()}/api/v3/account?${signedQuery}`;

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
      this.recordHeaders(res);

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const code = data?.code || res.status;
        const msg = data?.msg || res.statusText || 'Binance account fetch error';
        throw new BinanceApiError(`Binance Account Error [${code}]: ${msg}`, code, res.status);
      }

      return data as BinanceAccountInformation;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof BinanceApiError) throw err;
      throw new Error(`Failed to query Binance account: ${(err as Error)?.message || String(err)}`);
    }
  }

  /**
   * Queries exchange info for a specific symbol to retrieve LOT_SIZE and PRICE_FILTER.
   */
  public async getSymbolFilters(symbol: string): Promise<BinanceSymbolFilters | null> {
    const cleanSymbol = symbol.toUpperCase().trim();
    const url = `${this.signer.getBaseUrl()}/api/v3/exchangeInfo?symbol=${encodeURIComponent(cleanSymbol)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; ProjectQTrading/1.0)',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      this.recordHeaders(res);

      if (!res.ok) return null;

      const data = await res.json().catch(() => null);
      const symbolInfo = data?.symbols?.[0];
      if (!symbolInfo || !Array.isArray(symbolInfo.filters)) return null;

      let minPrice = 0;
      let maxPrice = 0;
      let tickSize = 0.01;
      let minQty = 0;
      let maxQty = 0;
      let stepSize = 0.00001;
      let minNotional = 5;

      for (const f of symbolInfo.filters) {
        if (f.filterType === 'PRICE_FILTER') {
          minPrice = parseFloat(f.minPrice) || 0;
          maxPrice = parseFloat(f.maxPrice) || 0;
          tickSize = parseFloat(f.tickSize) || 0.01;
        } else if (f.filterType === 'LOT_SIZE') {
          minQty = parseFloat(f.minQty) || 0;
          maxQty = parseFloat(f.maxQty) || 0;
          stepSize = parseFloat(f.stepSize) || 0.00001;
        } else if (f.filterType === 'NOTIONAL' || f.filterType === 'MIN_NOTIONAL') {
          minNotional = parseFloat(f.minNotional) || 5;
        }
      }

      return {
        symbol: cleanSymbol,
        minPrice,
        maxPrice,
        tickSize,
        minQty,
        maxQty,
        stepSize,
        minNotional,
      };
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }

  /**
   * Quantizes quantity to match symbol stepSize.
   */
  public static roundStepSize(quantity: number, stepSize: number | string): number {
    const step = typeof stepSize === 'string' ? parseFloat(stepSize) : stepSize;
    if (!step || isNaN(step) || step <= 0) return quantity;

    const precision = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    const rounded = Math.floor((quantity + 1e-12) / step) * step;
    return parseFloat(rounded.toFixed(precision));
  }

  /**
   * Quantizes price to match symbol tickSize.
   */
  public static roundTickSize(price: number, tickSize: number | string): number {
    const tick = typeof tickSize === 'string' ? parseFloat(tickSize) : tickSize;
    if (!tick || isNaN(tick) || tick <= 0) return price;

    const precision = Math.max(0, -Math.floor(Math.log10(tick) + 1e-9));
    const rounded = Math.floor((price + 1e-12) / tick) * tick;
    return parseFloat(rounded.toFixed(precision));
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
    this.validateOutboundCall();

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
      this.recordHeaders(res);

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
    this.validateOutboundCall();

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
      this.recordHeaders(res);

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
    this.validateOutboundCall();

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
      this.recordHeaders(res);

      const data = await res.json();
      return data as BinanceRawOrderResponse;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}
