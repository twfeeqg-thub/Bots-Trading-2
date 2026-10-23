// Rolling Price History & IndexedDB Persistence for Project Q
// Stores time-ordered real samples for each asset with >= 24h retention.
// Supports backfill using real Binance historical kline data.

import { PricePoint } from './types';

const DB_NAME = 'ProjectQ_Scanner_DB';
const DB_VERSION = 1;
const STORE_NAME = 'price_history';
const MAX_HISTORY_AGE_MS = 25 * 60 * 60 * 1000; // >= 24h retention (25 hours buffer)

export class PriceHistoryStore {
  private inMemoryHistory: Map<string, PricePoint[]> = new Map();
  private db: IDBDatabase | null = null;
  private isDbReady: boolean = false;
  private pendingSaves: Map<string, PricePoint[]> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.initDatabase();
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
            db.createObjectStore(STORE_NAME, { keyPath: 'symbol' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      this.isDbReady = true;
      await this.restoreAllFromDb();
    } catch {
      // In-memory fallback if IndexedDB is blocked
      this.isDbReady = false;
    }
  }

  private async restoreAllFromDb(): Promise<void> {
    if (!this.db || !this.isDbReady) return;

    try {
      const records = await new Promise<{ symbol: string; points: PricePoint[] }[]>((resolve, reject) => {
        const tx = this.db!.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      const cutoff = Date.now() - MAX_HISTORY_AGE_MS;

      for (const rec of records) {
        if (rec && rec.symbol && Array.isArray(rec.points)) {
          // Filter strictly real points within retention
          const valid = rec.points
            .filter((p) => p.timestamp >= cutoff && !isNaN(p.price) && p.price > 0)
            .sort((a, b) => a.timestamp - b.timestamp);

          this.inMemoryHistory.set(rec.symbol, valid);
        }
      }
    } catch {
      // Fallback
    }
  }

  public appendSample(symbol: string, point: PricePoint): void {
    if (isNaN(point.price) || point.price <= 0 || !point.timestamp) return;

    let points = this.inMemoryHistory.get(symbol);
    if (!points) {
      points = [];
      this.inMemoryHistory.set(symbol, points);
    }

    // Ensure strictly time-ordered and no duplicate timestamps
    const lastPoint = points.length > 0 ? points[points.length - 1] : null;
    if (lastPoint && point.timestamp <= lastPoint.timestamp) {
      // Ignore outdated or identical sample timestamp
      return;
    }

    points.push(point);

    // Prune points older than MAX_HISTORY_AGE_MS
    const cutoff = Date.now() - MAX_HISTORY_AGE_MS;
    if (points.length > 0 && points[0].timestamp < cutoff) {
      const firstValidIdx = points.findIndex((p) => p.timestamp >= cutoff);
      if (firstValidIdx > 0) {
        points.splice(0, firstValidIdx);
      }
    }

    // Stage for batched DB persistence
    this.stageSave(symbol, point);
  }

  public getHistory(symbol: string): readonly PricePoint[] {
    return this.inMemoryHistory.get(symbol) || [];
  }

  public getAllSymbolsWithHistory(): string[] {
    return Array.from(this.inMemoryHistory.keys());
  }

  // Finds nearest real sample to targetTimestamp (Now - Period)
  // Closed Spec: "Search the price history for the real sample closest to Now - Selected Period.
  // Do NOT create a synthetic reference."
  public findNearestSample(symbol: string, targetTimestamp: number, maxAllowedDeviationMs: number): PricePoint | null {
    const points = this.inMemoryHistory.get(symbol);
    if (!points || points.length === 0) return null;

    // Check if the history covers back far enough
    const earliestPoint = points[0];
    if (targetTimestamp < earliestPoint.timestamp - maxAllowedDeviationMs) {
      // Target time is older than earliest known history + allowance
      return null;
    }

    // Binary search for closest timestamp
    let low = 0;
    let high = points.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (points[mid].timestamp === targetTimestamp) {
        return points[mid];
      }
      if (points[mid].timestamp < targetTimestamp) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // Compare points at high and low to see which is closer
    let closest: PricePoint = points[0];
    let minDiff = Infinity;

    const candidates = [high, low].filter((idx) => idx >= 0 && idx < points.length);
    for (const idx of candidates) {
      const diff = Math.abs(points[idx].timestamp - targetTimestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = points[idx];
      }
    }

    // Enforce maxAllowedDeviation to guarantee accuracy (e.g. within ±40% of period duration or max 15m)
    if (minDiff > maxAllowedDeviationMs) {
      return null;
    }

    return closest;
  }

  // Real Backfill using Binance Klines REST (density ≈ 2 minutes)
  // Closed Spec: "Real historical data only. No synthetic samples, no interpolation."
  public async backfillHistory(symbol: string, startTimeMs: number, endTimeMs: number): Promise<void> {
    try {
      // Use 1m or 3m real klines from Binance public API
      const interval = '1m';
      const limit = Math.min(1000, Math.ceil((endTimeMs - startTimeMs) / (60 * 1000)));
      if (limit <= 0) return;

      let data: unknown[][] = [];
      const proxyUrl = `/api/binance/klines?symbol=${symbol}&interval=${interval}&startTime=${startTimeMs}&endTime=${endTimeMs}&limit=${limit}`;
      try {
        const pRes = await fetch(proxyUrl);
        if (pRes.ok) {
          const json = await pRes.json();
          if (Array.isArray(json) && json.length > 0) {
            data = json as unknown[][];
          }
        }
      } catch {
        // Fallback to direct fetch
      }

      if (data.length === 0) {
        try {
          const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTimeMs}&endTime=${endTimeMs}&limit=${limit}`;
          const res = await fetch(url);
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json)) {
              data = json as unknown[][];
            }
          }
        } catch {
          return;
        }
      }

      if (!Array.isArray(data) || data.length === 0) return;

      const sampledPoints: PricePoint[] = [];
      let lastSampledTime = 0;
      const sampleIntervalMs = 2 * 60 * 1000; // ≈ 2 minutes density as specified in Section 14

      for (const kline of data) {
        // kline format: [openTime, open, high, low, close, volume, closeTime, ...]
        const openTime = Number(kline[0]);
        const closePrice = Number(kline[4]);

        if (!isNaN(closePrice) && closePrice > 0) {
          if (openTime - lastSampledTime >= sampleIntervalMs) {
            sampledPoints.push({ timestamp: openTime, price: closePrice });
            lastSampledTime = openTime;
          }
        }
      }

      if (sampledPoints.length > 0) {
        // Merge with existing points and sort
        const currentPoints = this.inMemoryHistory.get(symbol) || [];
        const mergedMap = new Map<number, number>();

        for (const p of sampledPoints) {
          mergedMap.set(p.timestamp, p.price);
        }
        for (const p of currentPoints) {
          mergedMap.set(p.timestamp, p.price);
        }

        const sortedMerged = Array.from(mergedMap.entries())
          .map(([timestamp, price]) => ({ timestamp, price }))
          .sort((a, b) => a.timestamp - b.timestamp);

        this.inMemoryHistory.set(symbol, sortedMerged);
        this.saveSymbolToDb(symbol, sortedMerged);
      }
    } catch {
      // Network or API limitation fallback: keep existing real samples
    }
  }

  private stageSave(symbol: string, _point: PricePoint): void {
    if (!this.isDbReady || !this.db) return;

    if (!this.pendingSaves.has(symbol)) {
      this.pendingSaves.set(symbol, []);
    }

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushPendingSaves();
      }, 5000); // batch saves every 5 seconds to reduce IndexedDB write pressure
    }
  }

  private async flushPendingSaves(): Promise<void> {
    this.flushTimer = null;
    if (!this.isDbReady || !this.db || this.pendingSaves.size === 0) return;

    const toSave = Array.from(this.pendingSaves.keys());
    this.pendingSaves.clear();

    try {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const symbol of toSave) {
        const points = this.inMemoryHistory.get(symbol) || [];
        store.put({ symbol, points });
      }
    } catch {
      // ignore write error
    }
  }

  private async saveSymbolToDb(symbol: string, points: PricePoint[]): Promise<void> {
    if (!this.isDbReady || !this.db) return;
    try {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ symbol, points });
    } catch {
      // ignore
    }
  }
}
