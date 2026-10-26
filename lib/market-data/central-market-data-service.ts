// Project Q — Central Market Data Service
// Manages the SINGLE, centralized Binance Spot WebSocket connection (!miniTicker@arr).
// Strictly guarantees no duplicate connections, automated backoff reconnection,
// and zero continuous REST polling.

import {
  MarketConnectionStatus,
  MarketConnectionListener,
  RawBinanceMiniTicker,
} from './types';
import { CentralMarketDataStore, sharedMarketDataStore } from './market-data-store';

const WS_ENDPOINTS = [
  'wss://stream.binance.com:9443/ws/!miniTicker@arr',
  'wss://data-stream.binance.vision/ws/!miniTicker@arr',
];

// Closed specification reconnection delays: 1s -> 2s -> 4s -> 8s -> 15s (max 15s)
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];

function getWebSocketConstructor(): typeof WebSocket | null {
  if (typeof globalThis !== 'undefined' && typeof globalThis.WebSocket !== 'undefined') {
    return globalThis.WebSocket;
  }
  if (typeof window !== 'undefined' && typeof window.WebSocket !== 'undefined') {
    return window.WebSocket;
  }
  return null;
}

export type SymbolFilterFn = (symbol: string) => boolean;

export class CentralMarketDataService {
  private static instance: CentralMarketDataService | null = null;
  private ws: WebSocket | null = null;
  private endpointIndex: number = 0;
  private retryCount: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isIntentionallyClosed: boolean = false;
  private currentStatus: MarketConnectionStatus = 'DISCONNECTED';
  private statusListeners: Set<MarketConnectionListener> = new Set();
  private store: CentralMarketDataStore;
  private symbolFilter: SymbolFilterFn | null = null;
  private lastMessageTime: number = 0;

  constructor(
    store: CentralMarketDataStore = sharedMarketDataStore,
    symbolFilter?: SymbolFilterFn
  ) {
    this.store = store;
    if (symbolFilter) {
      this.symbolFilter = symbolFilter;
    }
  }

  public static getInstance(): CentralMarketDataService {
    if (!CentralMarketDataService.instance) {
      CentralMarketDataService.instance = new CentralMarketDataService();
    }
    return CentralMarketDataService.instance;
  }

  public setSymbolFilter(filter: SymbolFilterFn | null): void {
    this.symbolFilter = filter;
  }

  /**
   * Starts the central market data connection.
   * Strictly prevents duplicate connections if already connected or connecting.
   */
  public start(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      // Already running single central connection
      return;
    }

    this.isIntentionallyClosed = false;
    this.connect();
  }

  /**
   * Intentionally halts the connection.
   */
  public stop(): void {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.setStatus('DISCONNECTED');
  }

  public getStatus(): MarketConnectionStatus {
    return this.currentStatus;
  }

  public getLastMessageTime(): number {
    return this.lastMessageTime;
  }

  public getStore(): CentralMarketDataStore {
    return this.store;
  }

  public subscribeStatus(listener: MarketConnectionListener): () => void {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private setStatus(status: MarketConnectionStatus): void {
    if (this.currentStatus === status) return;
    this.currentStatus = status;
    this.statusListeners.forEach((fn) => {
      try {
        fn(status);
      } catch {
        // ignore subscriber errors
      }
    });
  }

  private connect(): void {
    if (this.isIntentionallyClosed) return;

    const WS = getWebSocketConstructor();
    if (!WS) {
      console.warn('[MarketData] WebSocket API not available in current environment.');
      this.setStatus('DISCONNECTED');
      return;
    }

    // Clean up any stale ws reference
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    const endpoint = WS_ENDPOINTS[this.endpointIndex % WS_ENDPOINTS.length];
    this.setStatus(this.retryCount === 0 ? 'CONNECTING' : 'RECONNECTING');

    try {
      this.ws = new WS(endpoint);

      this.ws.onopen = () => {
        this.setStatus('CONNECTED');
        this.retryCount = 0; // Reset retry counter on successful connection
        this.lastMessageTime = Date.now();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.lastMessageTime = Date.now();
        this.handleMessage(event.data);
      };

      this.ws.onerror = () => {
        // ws.onclose will trigger reconnection logic
      };

      this.ws.onclose = () => {
        this.ws = null;
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        } else {
          this.setStatus('DISCONNECTED');
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private handleMessage(data: string | ArrayBuffer | Buffer): void {
    try {
      const text = typeof data === 'string' ? data : data.toString();

      // Respond to any text ping from Binance
      if (text === 'ping') {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send('pong');
        }
        return;
      }

      const tickers: RawBinanceMiniTicker[] = JSON.parse(text);
      if (!Array.isArray(tickers)) return;

      const receivedAt = Date.now();

      for (let i = 0; i < tickers.length; i++) {
        const item = tickers[i];
        const symbol = item.s;

        // Apply symbol filter if defined (e.g. executable universe assets)
        if (this.symbolFilter && !this.symbolFilter(symbol)) {
          continue;
        }

        const price = parseFloat(item.c);
        const eventTime = item.E || receivedAt;

        if (!isNaN(price) && price > 0) {
          this.store.updatePrice(symbol, price, eventTime, receivedAt);
        }
      }
    } catch {
      // Ignore malformed frames or JSON parse errors
    }
  }

  private scheduleReconnect(): void {
    if (this.isIntentionallyClosed) return;

    this.setStatus('RECONNECTING');

    const delayIndex = Math.min(this.retryCount, RECONNECT_DELAYS_MS.length - 1);
    const delay = RECONNECT_DELAYS_MS[delayIndex];
    this.retryCount++;

    // Alternate endpoints on successive retries for maximum resilience
    this.endpointIndex++;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);

    // Unref timer in Node environment so it doesn't block shutdown
    if (typeof this.reconnectTimer === 'object' && 'unref' in this.reconnectTimer) {
      this.reconnectTimer.unref();
    }
  }
}

export const sharedMarketDataService = CentralMarketDataService.getInstance();
