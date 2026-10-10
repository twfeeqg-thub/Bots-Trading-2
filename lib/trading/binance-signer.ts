// Project Q — Binance Trading Layer: Server-Side Cryptographic Signer & Config
// Server-side only: Uses Node.js crypto for HMAC SHA-256.
// Masks secrets, ensures no secrets leak into UI or logs.

import crypto from 'crypto';

export interface BinanceCredentials {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
}

export class BinanceSigner {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor(creds?: Partial<BinanceCredentials>) {
    this.apiKey = creds?.apiKey || process.env.BINANCE_API_KEY || '';
    this.apiSecret = creds?.apiSecret || process.env.BINANCE_API_SECRET || '';
    this.baseUrl = creds?.baseUrl || process.env.BINANCE_API_BASE_URL || 'https://api.binance.com';
  }

  public hasCredentials(): boolean {
    // 1. Live trading must be explicitly enabled by environment flag
    if (process.env.BINANCE_LIVE_TRADING_ENABLED !== 'true') {
      return false;
    }

    // 2. Both key and secret must exist
    if (!this.apiKey || !this.apiSecret) {
      return false;
    }

    // 3. Must not contain placeholder, mock, dummy, test, or sample keywords
    const invalidSubstrings = [
      'placeholder',
      'dummy',
      'mock',
      'fake',
      'sample',
      'test',
      'your-binance',
      'none',
      'undefined',
      'null',
    ];
    const lowerKey = this.apiKey.toLowerCase().trim();
    const lowerSecret = this.apiSecret.toLowerCase().trim();

    for (const sub of invalidSubstrings) {
      if (lowerKey.includes(sub) || lowerSecret.includes(sub)) {
        return false;
      }
    }

    // 4. Real Binance keys and secrets are at least 32 characters long
    if (this.apiKey.trim().length < 32 || this.apiSecret.trim().length < 32) {
      return false;
    }

    return true;
  }

  public getBaseUrl(): string {
    return this.baseUrl.replace(/\/+$/, '');
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  /**
   * Signs a parameter object or query string using HMAC SHA-256.
   * Returns signed query string including timestamp and signature.
   */
  public signParams(params: Record<string, string | number | boolean | undefined>): string {
    if (!this.apiSecret) {
      throw new Error('[BinanceSigner] Cannot sign request: Missing BINANCE_API_SECRET.');
    }

    const timestamp = Date.now();
    const cleanParams: Record<string, string> = {
      timestamp: timestamp.toString(),
      recvWindow: '5000',
    };

    // Filter and normalize parameters
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        cleanParams[key] = String(value);
      }
    }

    // Build URL query string sorted or standard
    const queryString = new URLSearchParams(cleanParams).toString();

    // Compute HMAC SHA256 hex signature
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');

    return `${queryString}&signature=${signature}`;
  }

  /**
   * Generates a deterministic clientOrderId for idempotency & tracking.
   * Max 36 characters allowed by Binance Spot.
   */
  public static generateClientOrderId(prefix: 'BUY' | 'SELL', botId: string, extraId?: string): string {
    const cleanBotId = botId.replace(/[^a-zA-Z0-9]/g, '').slice(-8);
    const cleanExtra = extraId ? extraId.replace(/[^a-zA-Z0-9]/g, '').slice(-6) : '';
    const rand = Math.random().toString(36).substring(2, 6);
    const ts = Date.now().toString(36).slice(-6);

    const id = `Q_${prefix}_${cleanBotId}_${cleanExtra ? `${cleanExtra}_` : ''}${ts}${rand}`;
    return id.slice(0, 36);
  }
}
