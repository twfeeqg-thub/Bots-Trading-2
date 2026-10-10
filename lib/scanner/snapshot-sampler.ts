// Central Snapshot Sampler for Project Q
// Takes periodic samples (≈ 10 seconds) centrally across all assets with FRESH status only.

import { CurrentPriceStore } from './current-price-store';
import { PriceHistoryStore } from './history-store';
import { AssetUniverseManager } from './universe';

export const SAMPLING_INTERVAL_MS = 10 * 1000; // ≈ 10 seconds sampling density

export class CentralSnapshotSampler {
  private samplerTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(
    private priceStore: CurrentPriceStore,
    private historyStore: PriceHistoryStore,
    private universeManager: AssetUniverseManager
  ) {}

  public start(): void {
    if (this.isRunning || typeof window === 'undefined') return;
    this.isRunning = true;

    // Run initial sample immediately if fresh data is present
    this.takeSnapshot();

    // Central recurring timer (single timer for all assets)
    this.samplerTimer = setInterval(() => {
      this.takeSnapshot();
    }, SAMPLING_INTERVAL_MS);
  }

  public stop(): void {
    if (this.samplerTimer) {
      clearInterval(this.samplerTimer);
      this.samplerTimer = null;
    }
    this.isRunning = false;
  }

  // Central snapshot rule:
  // - Use central current price
  // - Use millisecond timestamp
  // - Do NOT create sample if status is NO_DATA or STALE
  private takeSnapshot(): void {
    const assets = this.universeManager.getAssets();
    const now = Date.now();

    for (let i = 0; i < assets.length; i++) {
      const symbol = assets[i].symbol;
      const record = this.priceStore.getRecord(symbol);

      // Only FRESH data can enter history as real sample
      if (record && record.freshness === 'FRESH' && record.currentPrice > 0) {
        // Sample timestamp from the real price record
        const sampleTimestamp = record.timestamp || now;

        this.historyStore.appendSample(symbol, {
          timestamp: sampleTimestamp,
          price: record.currentPrice,
        });
      }
    }
  }
}
