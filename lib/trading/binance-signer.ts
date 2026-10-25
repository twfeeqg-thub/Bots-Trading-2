// Project Q — Binance Safe Signer
// Strictly manages testnet/mock authentication without leaking secrets

export interface SignerConfigStatus {
  valid: boolean;
  mode: 'testnet' | 'mock' | 'none';
  environment?: string;
  error?: string;
}

export class BinanceSigner {
  private apiKey: string;
  private apiSecret: string;
  private environment: string;

  constructor() {
    this.apiKey = process.env.BINANCE_TESTNET_API_KEY || '';
    this.apiSecret = process.env.BINANCE_TESTNET_API_SECRET || '';
    this.environment = process.env.BINANCE_ENVIRONMENT || 'mock';
  }

  public getConfigurationStatus(): SignerConfigStatus {
    const isTestnetEnabled = process.env.BINANCE_TESTNET_TRADING_ENABLED === 'true';
    if (this.environment === 'testnet' && isTestnetEnabled && this.apiKey && this.apiSecret) {
      return {
        valid: true,
        mode: 'testnet',
        environment: 'testnet',
      };
    }

    return {
      valid: false,
      mode: 'mock',
      environment: this.environment,
      error: 'Testnet trading is not configured or disabled. Operating in safe mock simulation mode.',
    };
  }

  public getBaseUrl(): string {
    if (this.environment === 'testnet') {
      return 'https://testnet.binance.vision';
    }
    return 'https://api.binance.com';
  }

  public sign(queryString: string): string {
    if (!this.apiSecret) return '';
    try {
      const crypto = require('crypto');
      return crypto.createHmac('sha256', this.apiSecret).update(queryString).digest('hex');
    } catch {
      return '';
    }
  }

  public getApiKey(): string {
    return this.apiKey;
  }
}
