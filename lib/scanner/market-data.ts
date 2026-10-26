// Central Market Data Connection Adapter for Project Q (Scanner)
// Delegates directly to the shared central Market Data service (lib/market-data),
// guaranteeing that Scanner and Bot Engine share a single Binance Spot WebSocket (!miniTicker@arr).

import {
  sharedMarketDataService,
  CentralMarketDataService as SharedCentralMarketDataService,
  MarketConnectionStatus,
} from '@/lib/market-data';
import { CurrentPriceStore } from './current-price-store';
import { AssetUniverseManager } from './universe';

export type ConnectionStatus = MarketConnectionStatus;

export class CentralMarketDataService {
  private sharedService: SharedCentralMarketDataService;

  constructor(
    private priceStore: CurrentPriceStore,
    private universeManager: AssetUniverseManager
  ) {
    this.sharedService = sharedMarketDataService;
  }

  public start(): void {
    this.sharedService.start();
  }

  public stop(): void {
    this.sharedService.stop();
  }

  public getStatus(): ConnectionStatus {
    return this.sharedService.getStatus();
  }

  public subscribeStatus(listener: (status: ConnectionStatus) => void): () => void {
    return this.sharedService.subscribeStatus(listener);
  }
}
