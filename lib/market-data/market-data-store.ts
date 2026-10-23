// Project Q — Central Market Data Store
// Maintains the latest market price records, enforces the 30-second FRESH/STALE evaluation,
// and provides reactive event subscriptions to consumers (Scanner, Bot Engine, etc.).

import {
  MarketDataStatus,
  MarketPriceRecord,
  MarketPriceListener,
  MarketStoreChangeListener,
  FRESHNESS_THRESHOLD_MS,
} from './types';

export class CentralMarketDataStore {
  private static instance: CentralMarketDataStore | null = null;
  private store: Map<string, MarketPriceRecord> = new Map();
  private globalListeners: Set<MarketPriceListener> = new Set();
  private symbolListeners: Map<string, Set<MarketPriceListener>> = new Map();
  private changeListeners: Set<MarketStoreChangeListener> = new Set();
  private freshnessCheckTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startFreshnessChecker();
  }

  public static getInstance(): CentralMarketDataStore {
    if (!CentralMarketDataStore.instance) {
      CentralMarketDataStore.instance = new CentralMarketDataStore();
    }
    return CentralMarketDataStore.instance;
  }

  /**
   * Updates or inserts a price record.
   * Enforces that valid incoming updates transition status to FRESH.
   */
  public updatePrice(
    symbol: string,
    price: number,
    eventTime: number = Date.now(),
    receivedAt: number = Date.now()
  ): void {
    if (isNaN(price) || price <= 0 || !symbol) return;

    const normalizedSymbol = symbol.toUpperCase().trim();
    const record: MarketPriceRecord = {
      symbol: normalizedSymbol,
      price,
      eventTime,
      receivedAt,
      dataStatus: 'FRESH',
      // Compatibility aliases
      currentPrice: price,
      timestamp: eventTime || receivedAt,
      freshness: 'FRESH',
    };

    this.store.set(normalizedSymbol, record);

    // Notify global subscribers
    this.globalListeners.forEach((fn) => {
      try {
        fn(record);
      } catch {
        // ignore subscriber errors
      }
    });

    // Notify symbol-specific subscribers
    const symSet = this.symbolListeners.get(normalizedSymbol);
    if (symSet) {
      symSet.forEach((fn) => {
        try {
          fn(record);
        } catch {
          // ignore
        }
      });
    }

    this.notifyChange();
  }

  /**
   * Retrieves a price record for a symbol, re-evaluating the 30-second freshness rule.
   */
  public getRecord(symbol: string): MarketPriceRecord | undefined {
    const normalizedSymbol = symbol.toUpperCase().trim();
    const record = this.store.get(normalizedSymbol);
    if (!record) return undefined;

    // Check if it has become stale
    const now = Date.now();
    const age = now - record.receivedAt;
    if (age > FRESHNESS_THRESHOLD_MS && record.dataStatus === 'FRESH') {
      record.dataStatus = 'STALE';
      record.freshness = 'STALE';
    }

    return record;
  }

  /**
   * Returns the current price if data is FRESH.
   * If STALE or NO_DATA, returns null to prevent trading on stale or non-existent prices.
   */
  public getFreshPrice(symbol: string): number | null {
    const record = this.getRecord(symbol);
    if (!record || record.dataStatus !== 'FRESH') {
      return null;
    }
    return record.price;
  }

  /**
   * Returns the last known price regardless of freshness, or null if no data exists.
   */
  public getLastKnownPrice(symbol: string): number | null {
    const record = this.getRecord(symbol);
    if (!record) return null;
    return record.price;
  }

  /**
   * Returns the current status of data for the symbol.
   */
  public getStatus(symbol: string): MarketDataStatus {
    const record = this.getRecord(symbol);
    if (!record) return 'NO_DATA';
    return record.dataStatus;
  }

  /**
   * Checks if data for the symbol is currently FRESH (<= 30 seconds).
   */
  public isFresh(symbol: string): boolean {
    return this.getStatus(symbol) === 'FRESH';
  }

  /**
   * Returns all price records with freshness states re-evaluated.
   */
  public getAllRecords(): Map<string, MarketPriceRecord> {
    const now = Date.now();
    this.store.forEach((record) => {
      const age = now - record.receivedAt;
      if (record.dataStatus === 'FRESH' && age > FRESHNESS_THRESHOLD_MS) {
        record.dataStatus = 'STALE';
        record.freshness = 'STALE';
      }
    });
    return this.store;
  }

  /**
   * Subscribes to all incoming price updates.
   */
  public subscribe(listener: MarketPriceListener): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  /**
   * Subscribes to price updates for a specific symbol.
   */
  public subscribeSymbol(symbol: string, listener: MarketPriceListener): () => void {
    const normalized = symbol.toUpperCase().trim();
    let set = this.symbolListeners.get(normalized);
    if (!set) {
      set = new Set();
      this.symbolListeners.set(normalized, set);
    }
    set.add(listener);

    // If record exists, immediately invoke with current record
    const existing = this.getRecord(normalized);
    if (existing) {
      try {
        listener(existing);
      } catch {
        // ignore
      }
    }

    return () => {
      const targetSet = this.symbolListeners.get(normalized);
      if (targetSet) {
        targetSet.delete(listener);
        if (targetSet.size === 0) {
          this.symbolListeners.delete(normalized);
        }
      }
    };
  }

  /**
   * Subscribes to general store changes (e.g. batch updates or transitions to STALE).
   */
  public subscribeToChanges(listener: MarketStoreChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private notifyChange(): void {
    this.changeListeners.forEach((fn) => {
      try {
        fn();
      } catch {
        // ignore
      }
    });
  }

  /**
   * Periodic freshness checker (runs every 1 second).
   * Transitions any records aged > 30s from FRESH to STALE.
   */
  private startFreshnessChecker(): void {
    if (this.freshnessCheckTimer) return;

    this.freshnessCheckTimer = setInterval(() => {
      const now = Date.now();
      let hasStateChange = false;

      this.store.forEach((record) => {
        if (record.dataStatus === 'FRESH' && now - record.receivedAt > FRESHNESS_THRESHOLD_MS) {
          record.dataStatus = 'STALE';
          record.freshness = 'STALE';
          hasStateChange = true;
        }
      });

      if (hasStateChange) {
        this.notifyChange();
      }
    }, 1000);

    // Ensure timer doesn't keep Node.js process alive if it's the only remaining event
    if (typeof this.freshnessCheckTimer === 'object' && 'unref' in this.freshnessCheckTimer) {
      this.freshnessCheckTimer.unref();
    }
  }

  /**
   * Cleans up all resources and timers.
   */
  public destroy(): void {
    if (this.freshnessCheckTimer) {
      clearInterval(this.freshnessCheckTimer);
      this.freshnessCheckTimer = null;
    }
    this.globalListeners.clear();
    this.symbolListeners.clear();
    this.changeListeners.clear();
    this.store.clear();
  }
}

export const sharedMarketDataStore = CentralMarketDataStore.getInstance();
