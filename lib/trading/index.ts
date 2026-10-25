// Project Q — Binance Trading Service
// Coordinates Mock Transport and Live/Testnet Trading Client

import { BinanceSigner } from './binance-signer';
import { BinanceTradingClient, BinanceAccountInfo } from './binance-trading-client';

export class BinanceTradingService {
  private signer: BinanceSigner;
  private client: BinanceTradingClient;

  constructor() {
    this.signer = new BinanceSigner();
    this.client = new BinanceTradingClient(this.signer);
  }

  public isUsingMock(): boolean {
    return this.signer.getConfigurationStatus().mode !== 'testnet';
  }

  public getTransport() {
    return {
      getAccountInformation: () => this.client.getAccountInformation(),
      getServerTime: () => this.client.getServerTime(),
    };
  }

  public getClient(): BinanceTradingClient {
    return this.client;
  }
}

export const sharedBinanceTradingService = new BinanceTradingService();
