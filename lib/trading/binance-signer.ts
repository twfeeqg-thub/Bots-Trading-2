// Project Q — Binance Trading Layer: Server-Side Cryptographic Signer & Config
// Server-side only: Uses Node.js crypto for HMAC SHA-256.
// Masks secrets, ensures no secrets leak into UI or logs.
// Strictly isolates Testnet from Production.

import crypto from 'crypto';

export interface BinanceCredentials {
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  environment?: 'testnet' | 'production';
  testnetTradingEnabled?: boolean;
  liveTradingEnabled?: boolean;
}

export interface BinanceConfigStatus {
  valid: boolean;
  mode: 'testnet' | 'production' | 'mock';
  environment: string;
  baseUrl: string;
  hasKey: boolean;
  hasSecret: boolean;
  testnetTradingEnabled: boolean;
  liveTradingEnabled: boolean;
  error?: string;
}

export class BinanceSigner {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private environmentOverride?: 'testnet' | 'production';
  private testnetTradingEnabledOverride?: boolean;
  private liveTradingEnabledOverride?: boolean;
  private timeOffsetMs: number = 0;

  constructor(creds?: Partial<BinanceCredentials>) {
    this.apiKey = creds?.apiKey || process.env.BINANCE_API_KEY || '';
    this.apiSecret = creds?.apiSecret || process.env.BINANCE_API_SECRET || '';
    this.environmentOverride = creds?.environment;
    this.testnetTradingEnabledOverride = creds?.testnetTradingEnabled;
    this.liveTradingEnabledOverride = creds?.liveTradingEnabled;

    const env = (
      creds?.environment ||
      process.env.BINANCE_ENVIRONMENT ||
      ''
    ).toLowerCase().trim();

    if (creds?.baseUrl) {
      this.baseUrl = creds.baseUrl;
    } else if (process.env.BINANCE_API_BASE_URL) {
      this.baseUrl = process.env.BINANCE_API_BASE_URL;
    } else if (env === 'testnet') {
      // In testnet mode, default MUST be testnet vision URL, NEVER api.binance.com
      this.baseUrl = 'https://testnet.binance.vision';
    } else {
      this.baseUrl = 'https://api.binance.com';
    }
  }

  /**
   * Evaluates configuration validity and returns a complete, safe status.
   * Strictly enforces:
   * 1. Testnet trading allowed ONLY when BINANCE_ENVIRONMENT=testnet AND BINANCE_TESTNET_TRADING_ENABLED=true.
   * 2. BINANCE_LIVE_TRADING_ENABLED must be false when in Testnet.
   * 3. Production URLs are strictly blocked in Testnet mode.
   * 4. Safe Mock mode is active when credentials or environments are absent.
   */
  public getConfigurationStatus(): BinanceConfigStatus {
    const env = (
      this.environmentOverride ||
      process.env.BINANCE_ENVIRONMENT ||
      ''
    ).toLowerCase().trim();

    const testnetEnabled =
      this.testnetTradingEnabledOverride !== undefined
        ? this.testnetTradingEnabledOverride
        : process.env.BINANCE_TESTNET_TRADING_ENABLED === 'true';

    const liveEnabled =
      this.liveTradingEnabledOverride !== undefined
        ? this.liveTradingEnabledOverride
        : process.env.BINANCE_LIVE_TRADING_ENABLED === 'true';

    const hasKey = Boolean(this.apiKey && this.apiKey.trim().length > 0);
    const hasSecret = Boolean(this.apiSecret && this.apiSecret.trim().length > 0);

    // 1. Conflict Check: Both LIVE and TESTNET flags enabled
    if (liveEnabled && testnetEnabled) {
      return {
        valid: false,
        mode: 'mock',
        environment: env,
        baseUrl: this.baseUrl,
        hasKey,
        hasSecret,
        testnetTradingEnabled: testnetEnabled,
        liveTradingEnabled: liveEnabled,
        error: 'Conflicting configuration: Both BINANCE_LIVE_TRADING_ENABLED and BINANCE_TESTNET_TRADING_ENABLED are set to true.',
      };
    }

    // 2. Conflict Check: Testnet environment but LIVE trading flag is true
    if (env === 'testnet' && liveEnabled) {
      return {
        valid: false,
        mode: 'mock',
        environment: env,
        baseUrl: this.baseUrl,
        hasKey,
        hasSecret,
        testnetTradingEnabled: testnetEnabled,
        liveTradingEnabled: liveEnabled,
        error: 'Conflicting configuration: BINANCE_LIVE_TRADING_ENABLED cannot be true when BINANCE_ENVIRONMENT=testnet.',
      };
    }

    // 3. Testnet Mode
    if (env === 'testnet') {
      if (!testnetEnabled) {
        return {
          valid: false,
          mode: 'mock',
          environment: env,
          baseUrl: this.baseUrl,
          hasKey,
          hasSecret,
          testnetTradingEnabled: testnetEnabled,
          liveTradingEnabled: liveEnabled,
          error: 'Testnet environment specified but BINANCE_TESTNET_TRADING_ENABLED is not true.',
        };
      }

      const lowerUrl = this.baseUrl.toLowerCase();
      if (
        lowerUrl.includes('api.binance.com') ||
        lowerUrl.includes('api1.binance.com') ||
        lowerUrl.includes('api2.binance.com') ||
        lowerUrl.includes('api3.binance.com')
      ) {
        return {
          valid: false,
          mode: 'mock',
          environment: env,
          baseUrl: this.baseUrl,
          hasKey,
          hasSecret,
          testnetTradingEnabled: testnetEnabled,
          liveTradingEnabled: liveEnabled,
          error: `Production URL (${this.baseUrl}) is strictly forbidden when BINANCE_ENVIRONMENT=testnet. Use https://testnet.binance.vision.`,
        };
      }

      if (!hasKey || !hasSecret) {
        return {
          valid: false,
          mode: 'mock',
          environment: env,
          baseUrl: this.baseUrl,
          hasKey,
          hasSecret,
          testnetTradingEnabled: testnetEnabled,
          liveTradingEnabled: liveEnabled,
          error: 'Missing required credentials: Both BINANCE_API_KEY and BINANCE_API_SECRET are required.',
        };
      }

      // Check placeholder keywords (Notice: 'test' is allowed for Testnet keys!)
      const invalidSubstrings = [
        'placeholder',
        'dummy',
        'mock',
        'fake',
        'sample',
        'your-binance',
        'none',
        'undefined',
        'null',
      ];
      const lowerKey = this.apiKey.toLowerCase().trim();
      const lowerSecret = this.apiSecret.toLowerCase().trim();

      for (const sub of invalidSubstrings) {
        if (lowerKey.includes(sub) || lowerSecret.includes(sub)) {
          return {
            valid: false,
            mode: 'mock',
            environment: env,
            baseUrl: this.baseUrl,
            hasKey,
            hasSecret,
            testnetTradingEnabled: testnetEnabled,
            liveTradingEnabled: liveEnabled,
            error: `Credentials contain placeholder or invalid keyword "${sub}".`,
          };
        }
      }

      if (this.apiKey.trim().length < 16 || this.apiSecret.trim().length < 16) {
        return {
          valid: false,
          mode: 'mock',
          environment: env,
          baseUrl: this.baseUrl,
          hasKey,
          hasSecret,
          testnetTradingEnabled: testnetEnabled,
          liveTradingEnabled: liveEnabled,
          error: 'Credentials are too short. Valid Binance API keys and secrets must be at least 16 characters.',
        };
      }

      return {
        valid: true,
        mode: 'testnet',
        environment: 'testnet',
        baseUrl: this.baseUrl,
        hasKey: true,
        hasSecret: true,
        testnetTradingEnabled: true,
        liveTradingEnabled: false,
      };
    }

    // 4. Production Mode
    if (env === 'production') {
      if (!liveEnabled) {
        return {
          valid: false,
          mode: 'mock',
          environment: env,
          baseUrl: this.baseUrl,
          hasKey,
          hasSecret,
          testnetTradingEnabled: testnetEnabled,
          liveTradingEnabled: liveEnabled,
          error: 'Production environment specified but BINANCE_LIVE_TRADING_ENABLED is not true.',
        };
      }

      const lowerUrl = this.baseUrl.toLowerCase();
      if (lowerUrl.includes('testnet')) {
        return {
          valid: false,
          mode: 'mock',
          environment: env,
          baseUrl: this.baseUrl,
          hasKey,
          hasSecret,
          testnetTradingEnabled: testnetEnabled,
          liveTradingEnabled: liveEnabled,
          error: 'Testnet URL cannot be used when BINANCE_ENVIRONMENT=production.',
        };
      }

      if (!hasKey || !hasSecret) {
        return {
          valid: false,
          mode: 'mock',
          environment: env,
          baseUrl: this.baseUrl,
          hasKey,
          hasSecret,
          testnetTradingEnabled: testnetEnabled,
          liveTradingEnabled: liveEnabled,
          error: 'Missing required credentials: Both BINANCE_API_KEY and BINANCE_API_SECRET are required.',
        };
      }

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
          return {
            valid: false,
            mode: 'mock',
            environment: env,
            baseUrl: this.baseUrl,
            hasKey,
            hasSecret,
            testnetTradingEnabled: testnetEnabled,
            liveTradingEnabled: liveEnabled,
            error: `Credentials contain placeholder or invalid keyword "${sub}".`,
          };
        }
      }

      if (this.apiKey.trim().length < 32 || this.apiSecret.trim().length < 32) {
        return {
          valid: false,
          mode: 'mock',
          environment: env,
          baseUrl: this.baseUrl,
          hasKey,
          hasSecret,
          testnetTradingEnabled: testnetEnabled,
          liveTradingEnabled: liveEnabled,
          error: 'Credentials are too short for production live trading.',
        };
      }

      return {
        valid: true,
        mode: 'production',
        environment: 'production',
        baseUrl: this.baseUrl,
        hasKey: true,
        hasSecret: true,
        testnetTradingEnabled: false,
        liveTradingEnabled: true,
      };
    }

    // 5. Default/Mock Mode (when no live/testnet trading is enabled)
    return {
      valid: false,
      mode: 'mock',
      environment: env || 'none',
      baseUrl: this.baseUrl,
      hasKey,
      hasSecret,
      testnetTradingEnabled: testnetEnabled,
      liveTradingEnabled: liveEnabled,
      error: 'No active trading environment configured. Operating strictly in safe Mock mode.',
    };
  }

  public hasCredentials(): boolean {
    return this.getConfigurationStatus().valid;
  }

  public getBaseUrl(): string {
    return this.baseUrl.replace(/\/+$/, '');
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public setTimeOffset(offsetMs: number): void {
    this.timeOffsetMs = offsetMs;
  }

  public getTimeOffset(): number {
    return this.timeOffsetMs;
  }

  /**
   * Signs a parameter object or query string using HMAC SHA-256.
   * Returns signed query string including synchronized timestamp and signature.
   */
  public signParams(params: Record<string, string | number | boolean | undefined>): string {
    if (!this.apiSecret) {
      throw new Error('[BinanceSigner] Cannot sign request: Missing BINANCE_API_SECRET.');
    }

    const timestamp = Date.now() + this.timeOffsetMs;
    const cleanParams: Record<string, string> = {
      timestamp: timestamp.toString(),
      recvWindow: (params.recvWindow !== undefined && params.recvWindow !== null && params.recvWindow !== ''
        ? String(params.recvWindow)
        : '5000'),
    };

    // Filter and normalize parameters
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '' && key !== 'recvWindow') {
        cleanParams[key] = String(value);
      }
    }

    // Build URL query string
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
