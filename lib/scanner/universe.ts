// Asset Universe Manager for Project Q
// Refreshes every 24 hours, filters executable Spot/Convert assets against USDT.

import { UniverseAsset } from './types';

const UNIVERSE_CACHE_KEY = 'project_q_scanner_universe_v1';
const UNIVERSE_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Curated top executable spot/convert assets on Binance against USDT
export const DEFAULT_EXECUTABLE_UNIVERSE: UniverseAsset[] = [
  { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'BNBUSDT', baseAsset: 'BNB', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'XRPUSDT', baseAsset: 'XRP', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'ADAUSDT', baseAsset: 'ADA', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'AVAXUSDT', baseAsset: 'AVAX', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'DOGEUSDT', baseAsset: 'DOGE', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'LINKUSDT', baseAsset: 'LINK', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'SUIUSDT', baseAsset: 'SUI', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'NEARUSDT', baseAsset: 'NEAR', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'APTUSDT', baseAsset: 'APT', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'DOTUSDT', baseAsset: 'DOT', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'LTCUSDT', baseAsset: 'LTC', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'PEPEUSDT', baseAsset: 'PEPE', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'SHIBUSDT', baseAsset: 'SHIB', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'INJUSDT', baseAsset: 'INJ', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'TIAUSDT', baseAsset: 'TIA', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'RENDERUSDT', baseAsset: 'RENDER', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'ARBUSDT', baseAsset: 'ARB', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'OPUSDT', baseAsset: 'OP', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'FETUSDT', baseAsset: 'FET', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'FILUSDT', baseAsset: 'FIL', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'ICPUSDT', baseAsset: 'ICP', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'XLMUSDT', baseAsset: 'XLM', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'UNIUSDT', baseAsset: 'UNI', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'AAVEUSDT', baseAsset: 'AAVE', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'TAOUSDT', baseAsset: 'TAO', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'SEIUSDT', baseAsset: 'SEI', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'PENDLEUSDT', baseAsset: 'PENDLE', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'WIFUSDT', baseAsset: 'WIF', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'FLOKIUSDT', baseAsset: 'FLOKI', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'BONKUSDT', baseAsset: 'BONK', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'JUPUSDT', baseAsset: 'JUP', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'WLDUSDT', baseAsset: 'WLD', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'FTMUSDT', baseAsset: 'FTM', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'ATOMUSDT', baseAsset: 'ATOM', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'POLUSDT', baseAsset: 'POL', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'GALAUSDT', baseAsset: 'GALA', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
  { symbol: 'SANDUSDT', baseAsset: 'SAND', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
];

interface UniverseStorageData {
  lastUpdated: number;
  assets: UniverseAsset[];
}

export class AssetUniverseManager {
  private assets: UniverseAsset[] = DEFAULT_EXECUTABLE_UNIVERSE;
  private symbolSet: Set<string> = new Set(DEFAULT_EXECUTABLE_UNIVERSE.map(a => a.symbol));
  private lastUpdated: number = 0;
  private isRefreshing: boolean = false;

  constructor() {
    this.loadCachedUniverse();
  }

  private loadCachedUniverse(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(UNIVERSE_CACHE_KEY);
      if (raw) {
        const parsed: UniverseStorageData = JSON.parse(raw);
        if (parsed.assets && Array.isArray(parsed.assets) && parsed.assets.length > 0) {
          this.assets = parsed.assets;
          this.symbolSet = new Set(parsed.assets.map(a => a.symbol));
          this.lastUpdated = parsed.lastUpdated || 0;
        }
      }
    } catch {
      // Fallback to default universe
      this.assets = DEFAULT_EXECUTABLE_UNIVERSE;
      this.symbolSet = new Set(DEFAULT_EXECUTABLE_UNIVERSE.map(a => a.symbol));
    }
  }

  private saveUniverse(assets: UniverseAsset[]): void {
    if (typeof window === 'undefined') return;
    try {
      const payload: UniverseStorageData = {
        lastUpdated: Date.now(),
        assets,
      };
      localStorage.setItem(UNIVERSE_CACHE_KEY, JSON.stringify(payload));
      this.lastUpdated = payload.lastUpdated;
      this.assets = assets;
      this.symbolSet = new Set(assets.map(a => a.symbol));
    } catch {
      // ignore quota or storage errors
    }
  }

  public getAssets(): UniverseAsset[] {
    return this.assets;
  }

  public isSymbolInUniverse(symbol: string): boolean {
    return this.symbolSet.has(symbol);
  }

  public shouldRefresh(): boolean {
    return Date.now() - this.lastUpdated > UNIVERSE_REFRESH_INTERVAL_MS;
  }

  public async refreshUniverse(): Promise<void> {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    try {
      // First try same-origin server proxy to prevent CORS/Failed to fetch errors
      let data: { symbols?: Array<{ quoteAsset: string; status: string; isSpotTradingAllowed: boolean; baseAsset: string; symbol: string }> } | null = null;

      try {
        const proxyRes = await fetch('/api/binance/exchangeInfo');
        if (proxyRes.ok) {
          data = await proxyRes.json();
        }
      } catch {
        // Fallback to direct fetch
      }

      if (!data || !Array.isArray(data.symbols) || data.symbols.length === 0) {
        try {
          const res = await fetch('https://api.binance.com/api/v3/exchangeInfo?permissions=SPOT');
          if (res.ok) {
            data = await res.json();
          }
        } catch {
          // Direct fetch failed
        }
      }

      if (data && Array.isArray(data.symbols) && data.symbols.length > 0) {
        const executable: UniverseAsset[] = [];

        for (const item of data.symbols) {
          // Rule: Quote asset must be USDT, status must be TRADING, spot allowed
          // Exclude leveraged tokens (UP, DOWN, BEAR, BULL)
          if (
            item.quoteAsset === 'USDT' &&
            item.status === 'TRADING' &&
            item.isSpotTradingAllowed &&
            !item.baseAsset.endsWith('UP') &&
            !item.baseAsset.endsWith('DOWN') &&
            !item.baseAsset.endsWith('BEAR') &&
            !item.baseAsset.endsWith('BULL')
          ) {
            executable.push({
              symbol: item.symbol,
              baseAsset: item.baseAsset,
              quoteAsset: item.quoteAsset,
              status: item.status,
              isSpotTradingAllowed: item.isSpotTradingAllowed,
            });
          }
        }

        if (executable.length >= 10) {
          this.saveUniverse(executable);
        }
      }
    } catch {
      // If network fails, keep current cached or default universe gracefully
    } finally {
      this.isRefreshing = false;
    }
  }
}
