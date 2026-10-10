// Alert State Manager for Project Q
// Implements strict Alert Crossing Semantics (Crossing -> NEW_ALERT, No repeated alerts while staying above).

import { AlertState, AlertEvent } from './types';

export interface AlertEventPayload {
  symbol: string;
  changePercent: number;
  threshold: number;
  timestamp: number;
  currentPrice: number;
  referencePrice: number;
}

export type AlertEventListener = (event: AlertEvent, payload: AlertEventPayload) => void;

interface AssetStateInfo {
  state: AlertState;
  lastEvaluatedChange: number | null;
  lastAlertTimestamp: number | null;
}

export class AlertStateManager {
  private assetStates: Map<string, AssetStateInfo> = new Map();
  private listeners: Set<AlertEventListener> = new Set();
  private userThreshold: number = 1.0; // Default user-selected threshold, customizable in UI

  public setThreshold(threshold: number): void {
    if (isNaN(threshold)) return;
    this.userThreshold = threshold;
  }

  public getThreshold(): number {
    return this.userThreshold;
  }

  public getAlertState(symbol: string): AlertState {
    const info = this.assetStates.get(symbol);
    return info ? info.state : 'NOT_ALERTED';
  }

  public getLastAlertTimestamp(symbol: string): number | null {
    const info = this.assetStates.get(symbol);
    return info ? info.lastAlertTimestamp : null;
  }

  public subscribe(listener: AlertEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Evaluates alert condition on valid change calculation.
   * Closed Rule:
   * - Data Loss (null, STALE, NO_DATA) MUST NOT trigger an alert.
   * - If change < threshold -> NOT_ALERTED
   * - If was < threshold (or NOT_ALERTED) and now >= threshold -> NEW_ALERT event, state becomes ALERTED
   * - If stays >= threshold -> remain ALERTED, do NOT re-trigger event
   * - If drops below threshold -> reset to NOT_ALERTED
   */
  public evaluate(
    symbol: string,
    changePercent: number | null,
    currentPrice: number | null,
    referencePrice: number | null
  ): AlertState {
    // If no valid change calculation exists (e.g. STALE or NO_DATA), do not alter alert crossing logic
    if (changePercent === null || isNaN(changePercent) || currentPrice === null || referencePrice === null) {
      return this.getAlertState(symbol);
    }

    let info = this.assetStates.get(symbol);
    if (!info) {
      info = {
        state: 'NOT_ALERTED',
        lastEvaluatedChange: null,
        lastAlertTimestamp: null,
      };
      this.assetStates.set(symbol, info);
    }

    const threshold = this.userThreshold;
    const isAboveOrEqual = changePercent >= threshold;

    if (info.state === 'NOT_ALERTED') {
      if (isAboveOrEqual) {
        // Crossing event occurred!
        info.state = 'ALERTED';
        info.lastAlertTimestamp = Date.now();

        const payload: AlertEventPayload = {
          symbol,
          changePercent,
          threshold,
          timestamp: info.lastAlertTimestamp,
          currentPrice,
          referencePrice,
        };

        this.notifyListeners('NEW_ALERT', payload);
      }
    } else if (info.state === 'ALERTED') {
      if (!isAboveOrEqual) {
        // Reset when it drops back below threshold
        info.state = 'NOT_ALERTED';
      }
      // If still above threshold, do nothing (no repeated alert)
    }

    info.lastEvaluatedChange = changePercent;
    return info.state;
  }

  private notifyListeners(event: AlertEvent, payload: AlertEventPayload): void {
    this.listeners.forEach((fn) => {
      try {
        fn(event, payload);
      } catch {
        // ignore listener errors
      }
    });
  }
}
