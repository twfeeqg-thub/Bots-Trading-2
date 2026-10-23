// Binance Spot Data Provider for Project Q (Fallback Chart Source)
// Uses Binance Spot WebSocket with multiplexed SUBSCRIBE / UNSUBSCRIBE, plus REST klines.

import { Candle, ChartConnectionStatus, NativeTimeframe } from '../types';

const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws';
const BINANCE_REST_BASE = 'https://api.binance.com/api/v3/klines';
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];

export class BinanceProvider {
  private ws: WebSocket | null = null;
  private status: ChartConnectionStatus = 'DISCONNECTED';
  private reconnectAttempt: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private intentionallyClosed: boolean = false;
  private nextRequestId: number = 1;

  // Active subscriptions: key is `${symbol}_${timeframe}`
  private activeSubscriptions: Map<
    string,
    {
      symbol: string;
      timeframe: NativeTimeframe;
      streamName: string;
      onCandle: (candle: Candle) => void;
      onStatus: (status: ChartConnectionStatus) => void;
    }
  > = new Map();

  constructor() {}

  public getStatus(): ChartConnectionStatus {
    return this.status;
  }

  private setStatus(newStatus: ChartConnectionStatus): void {
    this.status = newStatus;
    this.activeSubscriptions.forEach((sub) => {
      sub.onStatus(newStatus);
    });
  }

  public async fetchHistoricalCandles(
    symbol: string,
    timeframe: NativeTimeframe,
    limit: number = 200,
    endTimeMs?: number,
    startTimeMs?: number
  ): Promise<Candle[]> {
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      interval: timeframe,
      limit: Math.min(limit, 1000).toString(),
    });

    if (endTimeMs) {
      params.append('endTime', endTimeMs.toString());
    }
    if (startTimeMs) {
      params.append('startTime', startTimeMs.toString());
    }

    let rawData: unknown[][] = [];
    try {
      // First try same-origin server proxy to avoid CORS/adblocker/Failed-to-fetch issues
      const proxyUrl = `/api/binance/klines?${params.toString()}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          rawData = json as unknown[][];
        }
      }
    } catch {
      // Proxy fetch failed, attempt direct fetch as fallback
    }

    if (rawData.length === 0) {
      try {
        const response = await fetch(`${BINANCE_REST_BASE}?${params.toString()}`);
        if (response.ok) {
          const json = await response.json();
          if (Array.isArray(json)) {
            rawData = json as unknown[][];
          }
        }
      } catch {
        // Direct fetch failed
        return [];
      }
    }

    if (!Array.isArray(rawData) || rawData.length === 0) {
      return [];
    }

    const nowMs = Date.now();

    const parsed: Candle[] = rawData.map((row: unknown[]) => {
      const openTimeMs = Number(row[0]);
      const open = Number(row[1]);
      const high = Number(row[2]);
      const low = Number(row[3]);
      const close = Number(row[4]);
      const volume = Number(row[5]);
      const closeTimeMs = Number(row[6]);
      const isClosed = closeTimeMs <= nowMs;

      return {
        time: Math.floor(openTimeMs / 1000),
        open,
        high,
        low,
        close,
        volume,
        closed: isClosed,
      };
    });

    const map = new Map<number, Candle>();
    for (const c of parsed) {
      if (typeof c.time === 'number' && !isNaN(c.time) && !isNaN(c.close)) {
        map.set(c.time, c);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.time - b.time);
  }

  public subscribe(
    symbol: string,
    timeframe: NativeTimeframe,
    callbacks: {
      onCandle: (candle: Candle) => void;
      onStatus: (status: ChartConnectionStatus) => void;
    }
  ): () => void {
    const upperSymbol = symbol.toUpperCase();
    const key = `${upperSymbol}_${timeframe}`;
    const streamName = `${upperSymbol.toLowerCase()}@kline_${timeframe}`;

    this.activeSubscriptions.set(key, {
      symbol: upperSymbol,
      timeframe,
      streamName,
      ...callbacks,
    });

    callbacks.onStatus(this.status);
    this.ensureConnection();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscription([streamName], 'SUBSCRIBE');
    }

    return () => {
      this.unsubscribe(symbol, timeframe);
    };
  }

  public unsubscribe(symbol: string, timeframe: NativeTimeframe): void {
    const key = `${symbol.toUpperCase()}_${timeframe}`;
    const sub = this.activeSubscriptions.get(key);
    if (!sub) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscription([sub.streamName], 'UNSUBSCRIBE');
    }

    this.activeSubscriptions.delete(key);

    if (this.activeSubscriptions.size === 0) {
      this.disconnect();
    }
  }

  private ensureConnection(): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.intentionallyClosed = false;
    this.setStatus(this.reconnectAttempt === 0 ? 'CONNECTING' : 'RECONNECTING');

    try {
      this.ws = new WebSocket(BINANCE_WS_URL);

      this.ws.onopen = () => {
        this.setStatus('CONNECTED');
        this.reconnectAttempt = 0;

        // Resubscribe to all active streams
        const streams = Array.from(this.activeSubscriptions.values()).map((s) => s.streamName);
        if (streams.length > 0) {
          this.sendSubscription(streams, 'SUBSCRIBE');
        }
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = () => {
        // Will reconnect via onclose
      };

      this.ws.onclose = () => {
        this.ws = null;
        if (!this.intentionallyClosed && this.activeSubscriptions.size > 0) {
          this.scheduleReconnect();
        } else {
          this.setStatus('DISCONNECTED');
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionallyClosed) return;

    this.setStatus('RECONNECTING');
    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt++;

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.ensureConnection();
    }, delay);
  }

  private disconnect(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('DISCONNECTED');
  }

  private sendSubscription(streams: string[], method: 'SUBSCRIBE' | 'UNSUBSCRIBE'): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || streams.length === 0) return;
    const payload = {
      method,
      params: streams,
      id: this.nextRequestId++,
    };
    this.ws.send(JSON.stringify(payload));
  }

  private handleMessage(dataStr: string): void {
    try {
      const data = JSON.parse(dataStr);

      if (data.e === 'kline' && data.k) {
        const k = data.k;
        const key = `${data.s.toUpperCase()}_${k.i}`;
        const sub = this.activeSubscriptions.get(key);

        if (sub) {
          const candle: Candle = {
            time: Math.floor(k.t / 1000),
            open: Number(k.o),
            high: Number(k.h),
            low: Number(k.l),
            close: Number(k.c),
            volume: Number(k.v),
            closed: Boolean(k.x), // Source-confirmed closed flag
          };

          sub.onCandle(candle);
        }
      }
    } catch {
      // Ignore non-json or ping frames
    }
  }
}
