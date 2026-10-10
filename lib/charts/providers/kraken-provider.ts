// Kraken Data Provider for Project Q (Primary Chart Source)
// Implements Kraken WebSocket v2 with REST OHLC for initial history and gap repair.

import { Candle, ChartConnectionStatus, NativeTimeframe, TIMEFRAME_SECONDS } from '../types';

const KRAKEN_WS_URL = 'wss://ws.kraken.com/v2';
const KRAKEN_REST_BASE = 'https://api.kraken.com/0/public/OHLC';
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];

// Kraken native intervals in minutes. Note: 3m is NOT natively supported on Kraken.
const KRAKEN_INTERVALS: Partial<Record<NativeTimeframe, number>> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
};

export class KrakenProvider {
  private ws: WebSocket | null = null;
  private status: ChartConnectionStatus = 'DISCONNECTED';
  private reconnectAttempt: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private intentionallyClosed: boolean = false;

  // Active subscriptions: key is `${symbol}_${timeframe}`
  private activeSubscriptions: Map<
    string,
    {
      symbol: string;
      krakenPair: string;
      timeframe: NativeTimeframe;
      intervalMinutes: number;
      onCandle: (candle: Candle) => void;
      onStatus: (status: ChartConnectionStatus) => void;
      onFallbackNeeded: () => void;
    }
  > = new Map();

  constructor() {}

  public isTimeframeSupported(timeframe: NativeTimeframe): boolean {
    return KRAKEN_INTERVALS[timeframe] !== undefined;
  }

  public toKrakenPair(symbol: string): string {
    // Normalizes 'BTCUSDT' -> 'BTC/USDT'
    const s = symbol.toUpperCase();
    if (s.endsWith('USDT')) {
      const base = s.slice(0, -4);
      return `${base}/USDT`;
    }
    return s;
  }

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
    sinceTimestampSeconds?: number
  ): Promise<Candle[]> {
    const intervalMinutes = KRAKEN_INTERVALS[timeframe];
    if (!intervalMinutes) {
      throw new Error(`Timeframe ${timeframe} is not natively supported by Kraken`);
    }

    const pair = this.toKrakenPair(symbol);
    const params = new URLSearchParams({
      pair: pair.replace('/', ''),
      interval: intervalMinutes.toString(),
    });
    if (sinceTimestampSeconds) {
      params.append('since', sinceTimestampSeconds.toString());
    }

    let json: { error?: string[]; result?: Record<string, unknown> } | null = null;

    try {
      // First try same-origin server proxy
      const proxyUrl = `/api/kraken/ohlc?${params.toString()}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        json = await res.json();
      }
    } catch {
      // Proxy failed, try direct
    }

    if (!json || (json.error && json.error.length > 0)) {
      try {
        const response = await fetch(`${KRAKEN_REST_BASE}?${params.toString()}`);
        if (response.ok) {
          json = await response.json();
        }
      } catch {
        return [];
      }
    }

    if (!json || (json.error && json.error.length > 0)) {
      return [];
    }

    // Kraken returns result with dynamic pair key, e.g. json.result['XXBTZUSD'] or json.result['XETHZUSD']
    const result = json.result;
    if (!result) return [];

    let rawCandles: unknown[][] = [];
    for (const key of Object.keys(result)) {
      if (key !== 'last' && Array.isArray(result[key])) {
        rawCandles = result[key];
        break;
      }
    }

    const intervalSec = TIMEFRAME_SECONDS[timeframe];
    const nowSec = Math.floor(Date.now() / 1000);

    const parsed: Candle[] = rawCandles.map((row: unknown[]) => {
      const time = typeof row[0] === 'number' ? row[0] : Number(row[0]);
      const open = Number(row[1]);
      const high = Number(row[2]);
      const low = Number(row[3]);
      const close = Number(row[4]);
      const volume = Number(row[6]);
      // If candle interval has fully elapsed, it is closed
      const isClosed = time + intervalSec <= nowSec;

      return {
        time,
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
      onFallbackNeeded: () => void;
    }
  ): () => void {
    const key = `${symbol.toUpperCase()}_${timeframe}`;
    const intervalMinutes = KRAKEN_INTERVALS[timeframe];

    if (!intervalMinutes) {
      // 3m not on Kraken, trigger immediate fallback to Binance Spot
      callbacks.onFallbackNeeded();
      return () => {};
    }

    const krakenPair = this.toKrakenPair(symbol);
    this.activeSubscriptions.set(key, {
      symbol: symbol.toUpperCase(),
      krakenPair,
      timeframe,
      intervalMinutes,
      ...callbacks,
    });

    callbacks.onStatus(this.status);
    this.ensureConnection();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscribe(krakenPair, intervalMinutes);
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
      this.sendUnsubscribe(sub.krakenPair, sub.intervalMinutes);
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
      this.ws = new WebSocket(KRAKEN_WS_URL);

      this.ws.onopen = () => {
        this.setStatus('CONNECTED');
        this.reconnectAttempt = 0;
        // Resubscribe to all active pairs
        this.activeSubscriptions.forEach((sub) => {
          this.sendSubscribe(sub.krakenPair, sub.intervalMinutes);
        });
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

  private sendSubscribe(pair: string, intervalMinutes: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg = {
      method: 'subscribe',
      params: {
        channel: 'ohlc',
        symbol: [pair],
        interval: intervalMinutes,
      },
    };
    this.ws.send(JSON.stringify(msg));
  }

  private sendUnsubscribe(pair: string, intervalMinutes: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg = {
      method: 'unsubscribe',
      params: {
        channel: 'ohlc',
        symbol: [pair],
        interval: intervalMinutes,
      },
    };
    this.ws.send(JSON.stringify(msg));
  }

  private handleMessage(dataStr: string): void {
    try {
      const data = JSON.parse(dataStr);

      // Handle subscription error or pair not supported on Kraken
      if (data.error || (data.method === 'subscribe' && data.success === false)) {
        // Trigger fallback for affected subscription
        const symbolStr = data.symbol || (data.params && data.params.symbol && data.params.symbol[0]);
        if (symbolStr) {
          const normalized = symbolStr.replace('/', '').toUpperCase();
          this.activeSubscriptions.forEach((sub, key) => {
            if (key.startsWith(normalized)) {
              sub.onFallbackNeeded();
            }
          });
        }
        return;
      }

      // Kraken v2 OHLC data: { channel: "ohlc", data: [...] }
      if (data.channel === 'ohlc' && Array.isArray(data.data)) {
        for (const item of data.data) {
          const itemSymbol = (item.symbol || '').replace('/', '').toUpperCase();
          const intervalMin = item.interval;

          const rawTime = item.interval_begin || item.timestamp || item.time;
          let candleTime = 0;
          if (typeof rawTime === 'number') {
            candleTime = rawTime > 1e11 ? Math.floor(rawTime / 1000) : rawTime;
          } else if (typeof rawTime === 'string') {
            const parsed = Date.parse(rawTime);
            candleTime = !isNaN(parsed) ? Math.floor(parsed / 1000) : 0;
          }
          if (!candleTime) {
            const intervalSec = (intervalMin || 1) * 60;
            candleTime = Math.floor(Date.now() / 1000 / intervalSec) * intervalSec;
          }

          this.activeSubscriptions.forEach((sub) => {
            if (sub.symbol === itemSymbol && sub.intervalMinutes === intervalMin) {
              // In live streaming, open candle stays closed=false until next interval candle arrives from source
              const candle: Candle = {
                time: candleTime,
                open: Number(item.open),
                high: Number(item.high),
                low: Number(item.low),
                close: Number(item.close),
                volume: Number(item.volume || 0),
                closed: false,
              };

              sub.onCandle(candle);
            }
          });
        }
      }
    } catch {
      // Ignore unparseable frames (like heartbeats)
    }
  }
}
