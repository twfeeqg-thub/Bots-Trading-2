// In-memory & IndexedDB Candle Storage for Project Q
// Stores native candles partitioned by Market + Native Timeframe.

import { Candle, NativeTimeframe } from './types';

const DB_NAME = 'ProjectQ_Charts_DB';
const DB_VERSION = 1;
const STORE_NAME = 'native_candles';

interface CandleRecord {
  id: string; // symbol_timeframe
  symbol: string;
  timeframe: string;
  candles: Candle[];
  lastUpdated: number;
}

export class CandleStore {
  private memoryCache: Map<string, Candle[]> = new Map();
  private db: IDBDatabase | null = null;
  private isDbReady: boolean = false;
  private dbInitPromise: Promise<void> | null = null;
  private pendingSaves: Set<string> = new Set();
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.dbInitPromise = this.initDatabase();
  }

  private getKey(symbol: string, timeframe: NativeTimeframe): string {
    return `${symbol.toUpperCase()}_${timeframe}`;
  }

  private async initDatabase(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return;
    }

    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      this.isDbReady = true;
    } catch {
      this.isDbReady = false;
    }
  }

  public getCandles(symbol: string, timeframe: NativeTimeframe): Candle[] {
    const key = this.getKey(symbol, timeframe);
    return this.memoryCache.get(key) || [];
  }

  public setCandles(symbol: string, timeframe: NativeTimeframe, candles: Candle[]): void {
    const key = this.getKey(symbol, timeframe);
    const sorted = this.deduplicateAndSort(candles);
    this.memoryCache.set(key, sorted);
    this.scheduleSave(key);
  }

  public updateLiveCandle(symbol: string, timeframe: NativeTimeframe, liveCandle: Candle): { isNew: boolean } {
    const key = this.getKey(symbol, timeframe);
    let list = this.memoryCache.get(key) || [];
    let isNew = false;

    if (list.length === 0) {
      list = [liveCandle];
      isNew = true;
    } else {
      const lastIndex = list.length - 1;
      const last = list[lastIndex];

      if (liveCandle.time === last.time) {
        // Update existing live candle
        list[lastIndex] = liveCandle;
      } else if (liveCandle.time > last.time) {
        // Ensure previous candle is marked closed
        if (!last.closed) {
          list[lastIndex] = { ...last, closed: true };
        }
        list.push(liveCandle);
        isNew = true;
      } else {
        // Insert in chronological order if received late
        list = this.deduplicateAndSort([...list, liveCandle]);
      }
    }

    this.memoryCache.set(key, list);
    // If candle is closed, schedule persistent save
    if (liveCandle.closed) {
      this.scheduleSave(key);
    }

    return { isNew };
  }

  public prependOlderCandles(symbol: string, timeframe: NativeTimeframe, olderCandles: Candle[]): void {
    const key = this.getKey(symbol, timeframe);
    const existing = this.memoryCache.get(key) || [];
    const merged = this.deduplicateAndSort([...olderCandles, ...existing]);
    this.memoryCache.set(key, merged);
    this.scheduleSave(key);
  }

  public repairGapCandles(symbol: string, timeframe: NativeTimeframe, gapCandles: Candle[]): void {
    const key = this.getKey(symbol, timeframe);
    const existing = this.memoryCache.get(key) || [];
    const merged = this.deduplicateAndSort([...existing, ...gapCandles]);
    this.memoryCache.set(key, merged);
    this.scheduleSave(key);
  }

  public getOldestTime(symbol: string, timeframe: NativeTimeframe): number | null {
    const candles = this.getCandles(symbol, timeframe);
    return candles.length > 0 ? candles[0].time : null;
  }

  public getLatestTime(symbol: string, timeframe: NativeTimeframe): number | null {
    const candles = this.getCandles(symbol, timeframe);
    return candles.length > 0 ? candles[candles.length - 1].time : null;
  }

  public async restoreFromStorage(symbol: string, timeframe: NativeTimeframe): Promise<Candle[]> {
    const key = this.getKey(symbol, timeframe);
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key)!;
    }

    if (!this.db && this.dbInitPromise) {
      await this.dbInitPromise;
    }

    if (!this.db || !this.isDbReady) {
      return [];
    }

    try {
      const record = await new Promise<CandleRecord | undefined>((resolve, reject) => {
        const tx = this.db!.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (record && record.candles && record.candles.length > 0) {
        this.memoryCache.set(key, record.candles);
        return record.candles;
      }
    } catch {
      // Fallback
    }

    return [];
  }

  private scheduleSave(key: string): void {
    this.pendingSaves.add(key);
    if (!this.saveDebounceTimer) {
      this.saveDebounceTimer = setTimeout(() => {
        this.flushPendingSaves();
      }, 1000); // 1-second debounce to batch rapid writes
    }
  }

  public async flushPendingSaves(): Promise<void> {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }

    if (!this.db && this.dbInitPromise) {
      await this.dbInitPromise;
    }

    if (!this.db || !this.isDbReady || this.pendingSaves.size === 0) {
      return;
    }

    const keysToSave = Array.from(this.pendingSaves);
    this.pendingSaves.clear();

    try {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const key of keysToSave) {
        const candles = this.memoryCache.get(key);
        if (candles && candles.length > 0) {
          const [symbol, timeframe] = key.split('_');
          const record: CandleRecord = {
            id: key,
            symbol,
            timeframe,
            candles,
            lastUpdated: Date.now(),
          };
          store.put(record);
        }
      }
    } catch {
      // Silent error handling for storage fallback
    }
  }

  private deduplicateAndSort(candles: Candle[]): Candle[] {
    const map = new Map<number, Candle>();
    for (const c of candles) {
      // Keep later / closed version if duplicate timestamp
      const existing = map.get(c.time);
      if (!existing || (!existing.closed && c.closed) || c.volume > existing.volume) {
        map.set(c.time, c);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.time - b.time);
  }
}

export const sharedCandleStore = new CandleStore();
