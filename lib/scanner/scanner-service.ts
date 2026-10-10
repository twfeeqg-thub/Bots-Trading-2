// Central Scanner Service Orchestrator for Project Q
// Coordinates Universe, Market Data, Price Store, Sampler, History, Calculator, and Alert Manager.

import { 
  ScannerTableRow, 
  TimePeriod, 
  SortDirection, 
  AlertEvent, 
  DataFreshness 
} from './types';
import { AssetUniverseManager } from './universe';
import { CurrentPriceStore } from './current-price-store';
import { PriceHistoryStore } from './history-store';
import { CentralSnapshotSampler } from './snapshot-sampler';
import { CentralMarketDataService, ConnectionStatus } from './market-data';
import { PeriodCalculator } from './period-calculator';
import { AlertStateManager, AlertEventPayload } from './alert-manager';

export interface ScannerTableState {
  rows: ScannerTableRow[];
  connectionStatus: ConnectionStatus;
  selectedPeriod: TimePeriod;
  alertThreshold: number;
  sortDirection: SortDirection;
  sortField: 'changePercent' | 'currentPrice' | 'asset';
  filterQuery: string;
  lastUpdated: number;
  activeAlertCount: number;
}

export type ScannerTableListener = (state: ScannerTableState) => void;

export class ScannerService {
  private static instance: ScannerService | null = null;

  public universeManager: AssetUniverseManager;
  public priceStore: CurrentPriceStore;
  public historyStore: PriceHistoryStore;
  public sampler: CentralSnapshotSampler;
  public marketData: CentralMarketDataService;
  public calculator: PeriodCalculator;
  public alertManager: AlertStateManager;

  private selectedPeriod: TimePeriod = '5m';
  private sortDirection: SortDirection = 'DESC';
  private sortField: 'changePercent' | 'currentPrice' | 'asset' = 'changePercent';
  private filterQuery: string = '';

  private listeners: Set<ScannerTableListener> = new Set();
  private updateTimer: NodeJS.Timeout | null = null;
  private recentAlerts: Map<string, number> = new Map(); // symbol -> timestamp of NEW_ALERT event
  private currentState: ScannerTableState | null = null;

  private constructor() {
    this.universeManager = new AssetUniverseManager();
    this.priceStore = new CurrentPriceStore();
    this.historyStore = new PriceHistoryStore();
    this.calculator = new PeriodCalculator(this.historyStore);
    this.alertManager = new AlertStateManager();
    this.sampler = new CentralSnapshotSampler(this.priceStore, this.historyStore, this.universeManager);
    this.marketData = new CentralMarketDataService(this.priceStore, this.universeManager);

    // Listen for NEW_ALERT events to flag in the UI
    this.alertManager.subscribe((event: AlertEvent, payload: AlertEventPayload) => {
      if (event === 'NEW_ALERT') {
        this.recentAlerts.set(payload.symbol, payload.timestamp);
        // Clean up visual highlight after 10 seconds
        setTimeout(() => {
          this.recentAlerts.delete(payload.symbol);
          this.emitState();
        }, 10000);
      }
    });

    // Start services
    this.marketData.start();
    this.sampler.start();

    // Kick off automatic initial real backfill for universe assets
    this.initInitialBackfill();

    // Periodic table computation loop (throttled to 1s for optimal UI performance)
    this.startTableComputationLoop();
  }

  public static getInstance(): ScannerService {
    if (!ScannerService.instance) {
      ScannerService.instance = new ScannerService();
    }
    return ScannerService.instance;
  }

  public setPeriod(period: TimePeriod): void {
    this.selectedPeriod = period;
    this.emitState();
  }

  public getPeriod(): TimePeriod {
    return this.selectedPeriod;
  }

  public setAlertThreshold(threshold: number): void {
    this.alertManager.setThreshold(threshold);
    this.emitState();
  }

  public getAlertThreshold(): number {
    return this.alertManager.getThreshold();
  }

  public setSort(field: 'changePercent' | 'currentPrice' | 'asset', direction?: SortDirection): void {
    if (direction) {
      this.sortDirection = direction;
    } else if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'DESC' ? 'ASC' : 'DESC';
    } else {
      this.sortDirection = 'DESC';
    }
    this.sortField = field;
    this.emitState();
  }

  public setFilter(query: string): void {
    this.filterQuery = query.trim().toUpperCase();
    this.emitState();
  }

  public subscribe(listener: ScannerTableListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getCurrentState(): ScannerTableState {
    if (!this.currentState) {
      this.currentState = this.computeTableState();
    }
    return this.currentState;
  }

  public computeTableState(): ScannerTableState {
    const assets = this.universeManager.getAssets();
    const now = Date.now();
    const rows: ScannerTableRow[] = [];
    let activeAlerts = 0;

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const symbol = asset.symbol;
      const baseAsset = asset.baseAsset;

      // Filter query matching (by base asset or full symbol)
      if (this.filterQuery && !baseAsset.includes(this.filterQuery) && !symbol.includes(this.filterQuery)) {
        continue;
      }

      const priceRecord = this.priceStore.getRecord(symbol);
      const currentPrice = priceRecord && priceRecord.freshness !== 'NO_DATA' ? priceRecord.currentPrice : null;
      const dataStatus: DataFreshness = priceRecord ? priceRecord.freshness : 'NO_DATA';

      // Calculate reference and change %
      const calcResult = this.calculator.calculate(priceRecord, this.selectedPeriod, now);

      // Evaluate alert state machine
      const alertState = this.alertManager.evaluate(
        symbol,
        calcResult.changePercent,
        currentPrice,
        calcResult.referencePrice
      );

      if (alertState === 'ALERTED') {
        activeAlerts++;
      }

      const recentAlertTs = this.recentAlerts.get(symbol);
      const hasRecentAlert = Boolean(recentAlertTs && now - recentAlertTs < 10000);

      rows.push({
        rank: 0, // Assigned after sorting
        asset: baseAsset,
        symbol,
        currentPrice,
        referencePrice: calcResult.referencePrice,
        changePercent: calcResult.changePercent,
        dataStatus,
        alertState,
        hasRecentAlert,
        lastAlertTimestamp: this.alertManager.getLastAlertTimestamp(symbol),
        lastUpdated: priceRecord ? priceRecord.timestamp : null,
      });
    }

    // Apply Sorting
    rows.sort((a, b) => {
      let valA: number | string | null = null;
      let valB: number | string | null = null;

      if (this.sortField === 'changePercent') {
        valA = a.changePercent;
        valB = b.changePercent;
      } else if (this.sortField === 'currentPrice') {
        valA = a.currentPrice;
        valB = b.currentPrice;
      } else if (this.sortField === 'asset') {
        valA = a.asset;
        valB = b.asset;
      }

      // Null handling: rows without valid calculation or price go to bottom
      if (valA === null && valB === null) return 0;
      if (valA === null) return 1;
      if (valB === null) return -1;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return this.sortDirection === 'ASC' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }

      const numA = Number(valA);
      const numB = Number(valB);

      return this.sortDirection === 'ASC' ? numA - numB : numB - numA;
    });

    // Re-assign Rank (1..N) based on sorted order
    for (let r = 0; r < rows.length; r++) {
      rows[r].rank = r + 1;
    }

    return {
      rows,
      connectionStatus: this.marketData.getStatus(),
      selectedPeriod: this.selectedPeriod,
      alertThreshold: this.alertManager.getThreshold(),
      sortDirection: this.sortDirection,
      sortField: this.sortField,
      filterQuery: this.filterQuery,
      lastUpdated: now,
      activeAlertCount: activeAlerts,
    };
  }

  private emitState(): void {
    this.currentState = this.computeTableState();
    this.listeners.forEach((fn) => {
      try {
        fn(this.currentState!);
      } catch {
        // ignore
      }
    });
  }

  private startTableComputationLoop(): void {
    if (typeof window === 'undefined') return;
    this.updateTimer = setInterval(() => {
      this.emitState();
    }, 1000);
  }

  private async initInitialBackfill(): Promise<void> {
    if (typeof window === 'undefined') return;

    // Small delay to let WebSocket connection establish first
    setTimeout(async () => {
      const assets = this.universeManager.getAssets();
      const now = Date.now();
      const startTime = now - 24 * 60 * 60 * 1000; // backfill up to 24h of real kline points

      // Limit concurrent backfill to top 15 pairs to avoid rate-limiting
      const priorityAssets = assets.slice(0, 15);
      for (const asset of priorityAssets) {
        try {
          await this.historyStore.backfillHistory(asset.symbol, startTime, now);
        } catch {
          // ignore
        }
      }
      this.emitState();
    }, 2000);
  }

  public destroy(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    this.sampler.stop();
    this.marketData.stop();
    this.priceStore.destroy();
    this.listeners.clear();
  }
}
