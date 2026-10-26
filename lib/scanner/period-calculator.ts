// Period Calculator for Project Q
// Calculates Reference Price and Change % based on real price history for the 9 closed periods.

import { 
  TimePeriod, 
  PERIOD_DURATIONS_MS, 
  CalculationResult, 
  CurrentPriceRecord 
} from './types';
import { PriceHistoryStore } from './history-store';

export class PeriodCalculator {
  constructor(private historyStore: PriceHistoryStore) {}

  /**
   * Calculates reference price and change percentage.
   * Closed rules:
   * 1. If NO_DATA or STALE -> status = NO_DATA / STALE, changePercent = null
   * 2. Find closest real sample to (Now - Period)
   * 3. If history is insufficient -> status = INSUFFICIENT_HISTORY, referencePrice = null, changePercent = null
   * 4. Change % = ((Current Price - Reference Price) / Reference Price) * 100
   */
  public calculate(
    record: CurrentPriceRecord | undefined,
    period: TimePeriod,
    now: number = Date.now()
  ): CalculationResult {
    if (!record || record.freshness === 'NO_DATA' || isNaN(record.currentPrice) || record.currentPrice <= 0) {
      return {
        referencePrice: null,
        referenceTimestamp: null,
        changePercent: null,
        status: 'NO_DATA',
      };
    }

    if (record.freshness === 'STALE') {
      return {
        referencePrice: null,
        referenceTimestamp: null,
        changePercent: null,
        status: 'STALE',
      };
    }

    const durationMs = PERIOD_DURATIONS_MS[period];
    const targetTimestamp = now - durationMs;

    // Allowed deviation window for matching real samples:
    // e.g. for 1m (60s), allow sample within ±25s. For 24h, allow within ±15m.
    const maxAllowedDeviationMs = Math.max(25 * 1000, Math.min(15 * 60 * 1000, durationMs * 0.35));

    const referenceSample = this.historyStore.findNearestSample(
      record.symbol,
      targetTimestamp,
      maxAllowedDeviationMs
    );

    if (!referenceSample || isNaN(referenceSample.price) || referenceSample.price <= 0) {
      // Closed Rule: Do NOT guess, do NOT use current price, do NOT use 24h change
      return {
        referencePrice: null,
        referenceTimestamp: null,
        changePercent: null,
        status: 'INSUFFICIENT_HISTORY',
      };
    }

    const currentPrice = record.currentPrice;
    const refPrice = referenceSample.price;

    // Formula: ((Current Price - Reference Price) / Reference Price) * 100
    const changePercent = ((currentPrice - refPrice) / refPrice) * 100;

    return {
      referencePrice: refPrice,
      referenceTimestamp: referenceSample.timestamp,
      changePercent: Number(changePercent.toFixed(2)),
      status: 'VALID',
    };
  }
}
