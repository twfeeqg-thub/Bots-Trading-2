// Project Q — Central Market Data Layer
// Implements 30s freshness timeout & central snapshot per Section 2 & Pipeline specs

export interface MarketPriceRecord {
  symbol: string;
  price: number;
  lastUpdated: number;
  status: 'FRESH' | 'STALE' | 'DISCONNECTED';
  dataStatus: 'FRESH' | 'STALE' | 'DISCONNECTED';
  change24h?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
}

const FRESHNESS_TIMEOUT_MS = 30 * 1000; // 30s closed rule

export class MarketDataStore {
  private static instance: MarketDataStore;
  private prices: Map<string, MarketPriceRecord> = new Map();
  private subscribers: Map<string, Set<(record: MarketPriceRecord) => void>> = new Map();

  private constructor() {
    this.seedDefaultPrices();
  }

  public static getInstance(): MarketDataStore {
    if (!MarketDataStore.instance) {
      MarketDataStore.instance = new MarketDataStore();
    }
    return MarketDataStore.instance;
  }

  private seedDefaultPrices() {
    const defaults: Record<string, { price: number; change24h: number }> = {
      BTCUSDT: { price: 67850, change24h: 3.45 },
      ETHUSDT: { price: 2640, change24h: 2.18 },
      SOLUSDT: { price: 182.5, change24h: 6.82 },
      BNBUSDT: { price: 592.4, change24h: 1.15 },
      XRPUSDT: { price: 0.542, change24h: -0.84 },
      DOGEUSDT: { price: 0.142, change24h: 5.12 },
      ADAUSDT: { price: 0.354, change24h: 1.45 },
      AVAXUSDT: { price: 28.6, change24h: 4.22 },
      LINKUSDT: { price: 12.1, change24h: 3.05 },
      SUIUSDT: { price: 2.14, change24h: 8.94 },
      NEARUSDT: { price: 5.12, change24h: 4.50 },
      APTUSDT: { price: 10.25, change24h: 3.75 },
      PEPEUSDT: { price: 0.0000104, change24h: 11.2 },
      SHIBUSDT: { price: 0.0000187, change24h: 4.1 },
      ARBUSDT: { price: 0.58, change24h: 2.3 },
      OPUSDT: { price: 1.62, change24h: 3.1 },
      TAOUSDT: { price: 585.0, change24h: 7.4 },
      RENDERUSDT: { price: 5.85, change24h: 4.9 },
    };

    const now = Date.now();
    for (const [sym, data] of Object.entries(defaults)) {
      this.prices.set(sym, {
        symbol: sym,
        price: data.price,
        lastUpdated: now,
        status: 'FRESH',
        dataStatus: 'FRESH',
        change24h: data.change24h,
        high24h: data.price * 1.05,
        low24h: data.price * 0.95,
        volume24h: data.price * 1000000,
      });
    }
  }

  public updatePrice(symbol: string, price: number, change24h?: number): void {
    const sym = symbol.toUpperCase();
    const now = Date.now();
    const existing = this.prices.get(sym);

    const record: MarketPriceRecord = {
      symbol: sym,
      price,
      lastUpdated: now,
      status: 'FRESH',
      dataStatus: 'FRESH',
      change24h: change24h !== undefined ? change24h : existing?.change24h ?? 0,
      high24h: existing?.high24h ? Math.max(existing.high24h, price) : price,
      low24h: existing?.low24h ? Math.min(existing.low24h, price) : price,
      volume24h: existing?.volume24h ?? price * 500000,
    };

    this.prices.set(sym, record);

    const listeners = this.subscribers.get(sym);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(record);
        } catch {
          // Ignore listener failures
        }
      });
    }

    this.globalChangeSubscribers.forEach((cb) => {
      try {
        cb();
      } catch {
        // Ignore
      }
    });
  }

  public getFreshPrice(symbol: string): number | null {
    const sym = symbol.toUpperCase();
    const record = this.prices.get(sym);
    if (!record) return null;

    if (Date.now() - record.lastUpdated > FRESHNESS_TIMEOUT_MS) {
      record.status = 'STALE';
      record.dataStatus = 'STALE';
      return null;
    }

    return record.price;
  }

  public getLastKnownPrice(symbol: string): number | null {
    const sym = symbol.toUpperCase();
    const record = this.prices.get(sym);
    return record ? record.price : null;
  }

  public getStatus(symbol: string): 'FRESH' | 'STALE' | 'DISCONNECTED' {
    const sym = symbol.toUpperCase();
    const record = this.prices.get(sym);
    if (!record) return 'DISCONNECTED';

    if (Date.now() - record.lastUpdated > FRESHNESS_TIMEOUT_MS) {
      record.status = 'STALE';
      record.dataStatus = 'STALE';
      return 'STALE';
    }
    return record.status;
  }

  public getRecord(symbol: string): MarketPriceRecord | null {
    const sym = symbol.toUpperCase();
    const rec = this.prices.get(sym);
    if (rec && Date.now() - rec.lastUpdated > FRESHNESS_TIMEOUT_MS) {
      rec.status = 'STALE';
      rec.dataStatus = 'STALE';
    }
    return rec || null;
  }

  public getAll(): MarketPriceRecord[] {
    const now = Date.now();
    const all = Array.from(this.prices.values());
    for (const item of all) {
      if (now - item.lastUpdated > FRESHNESS_TIMEOUT_MS) {
        item.status = 'STALE';
        item.dataStatus = 'STALE';
      }
    }
    return all;
  }

  private globalChangeSubscribers: Set<() => void> = new Set();

  public subscribeToChanges(callback: () => void): () => void {
    this.globalChangeSubscribers.add(callback);
    return () => {
      this.globalChangeSubscribers.delete(callback);
    };
  }

  public subscribe(symbol: string, callback: (record: MarketPriceRecord) => void): () => void {
    const sym = symbol.toUpperCase();
    if (!this.subscribers.has(sym)) {
      this.subscribers.set(sym, new Set());
    }
    this.subscribers.get(sym)!.add(callback);

    const current = this.prices.get(sym);
    if (current) {
      callback(current);
    }

    return () => {
      const set = this.subscribers.get(sym);
      if (set) {
        set.delete(callback);
      }
    };
  }
}

export const sharedMarketDataStore = MarketDataStore.getInstance();
