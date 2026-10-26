// Central Current Price Store for Project Q (Scanner Adapter)
// Delegates directly to the shared central Market Data store (lib/market-data),
// ensuring Scanner and Bot Engine share a single source of truth and single WebSocket.

import {
  sharedMarketDataStore,
  CentralMarketDataStore,
  MarketPriceRecord,
  FRESHNESS_THRESHOLD_MS,
} from '@/lib/market-data';
import { CurrentPriceRecord, DataFreshness } from './types';

export const FRESHNESS_TIMEOUT_MS = FRESHNESS_THRESHOLD_MS; // 30 seconds
export type PriceUpdateListener = (record: CurrentPriceRecord) => void;
export type StoreChangedListener = () => void;

export class CurrentPriceStore {
  private centralStore: CentralMarketDataStore;

  constructor(centralStore: CentralMarketDataStore = sharedMarketDataStore) {
    this.centralStore = centralStore;
  }

  public updatePrice(symbol: string, price: number, timestamp: number): void {
    this.centralStore.updatePrice(symbol, price, timestamp, Date.now());
  }

  public getRecord(symbol: string): CurrentPriceRecord | undefined {
    return this.centralStore.getRecord(symbol);
  }

  public getAllRecords(): Map<string, CurrentPriceRecord> {
    return this.centralStore.getAllRecords();
  }

  public getFreshness(symbol: string): DataFreshness {
    return this.centralStore.getStatus(symbol);
  }

  public subscribe(listener: PriceUpdateListener): () => void {
    return this.centralStore.subscribe(listener);
  }

  public subscribeToChanges(listener: StoreChangedListener): () => void {
    return this.centralStore.subscribeToChanges(listener);
  }

  public destroy(): void {
    // Retain centralStore for shared consumers
  }
}
