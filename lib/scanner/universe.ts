// Project Q — Executable Traded Universe
// Traded spot and convert universe on Binance (USDT pairs)

export interface TradedAsset {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: 'TRADING' | 'HALT' | 'BREAK';
  minQty: number;
  maxQty: number;
  stepSize: number;
  minNotional: number;
}

export const DEFAULT_EXECUTABLE_UNIVERSE: TradedAsset[] = [
  { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.00001, maxQty: 9000, stepSize: 0.00001, minNotional: 5 },
  { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.0001, maxQty: 9000, stepSize: 0.0001, minNotional: 5 },
  { symbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.01, maxQty: 90000, stepSize: 0.01, minNotional: 5 },
  { symbol: 'BNBUSDT', baseAsset: 'BNB', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.001, maxQty: 90000, stepSize: 0.001, minNotional: 5 },
  { symbol: 'XRPUSDT', baseAsset: 'XRP', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.1, maxQty: 9000000, stepSize: 0.1, minNotional: 5 },
  { symbol: 'DOGEUSDT', baseAsset: 'DOGE', quoteAsset: 'USDT', status: 'TRADING', minQty: 1, maxQty: 9000000, stepSize: 1, minNotional: 5 },
  { symbol: 'ADAUSDT', baseAsset: 'ADA', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.1, maxQty: 9000000, stepSize: 0.1, minNotional: 5 },
  { symbol: 'AVAXUSDT', baseAsset: 'AVAX', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.01, maxQty: 900000, stepSize: 0.01, minNotional: 5 },
  { symbol: 'LINKUSDT', baseAsset: 'LINK', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.01, maxQty: 900000, stepSize: 0.01, minNotional: 5 },
  { symbol: 'SUIUSDT', baseAsset: 'SUI', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.1, maxQty: 9000000, stepSize: 0.1, minNotional: 5 },
  { symbol: 'NEARUSDT', baseAsset: 'NEAR', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.1, maxQty: 9000000, stepSize: 0.1, minNotional: 5 },
  { symbol: 'APTUSDT', baseAsset: 'APT', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.01, maxQty: 900000, stepSize: 0.01, minNotional: 5 },
  { symbol: 'LTCUSDT', baseAsset: 'LTC', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.001, maxQty: 90000, stepSize: 0.001, minNotional: 5 },
  { symbol: 'PEPEUSDT', baseAsset: 'PEPE', quoteAsset: 'USDT', status: 'TRADING', minQty: 100, maxQty: 9000000000, stepSize: 100, minNotional: 5 },
  { symbol: 'SHIBUSDT', baseAsset: 'SHIB', quoteAsset: 'USDT', status: 'TRADING', minQty: 100, maxQty: 9000000000, stepSize: 100, minNotional: 5 },
  { symbol: 'ARBUSDT', baseAsset: 'ARB', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.1, maxQty: 9000000, stepSize: 0.1, minNotional: 5 },
  { symbol: 'OPUSDT', baseAsset: 'OP', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.1, maxQty: 9000000, stepSize: 0.1, minNotional: 5 },
  { symbol: 'DOTUSDT', baseAsset: 'DOT', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.01, maxQty: 900000, stepSize: 0.01, minNotional: 5 },
  { symbol: 'RENDERUSDT', baseAsset: 'RENDER', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.01, maxQty: 900000, stepSize: 0.01, minNotional: 5 },
  { symbol: 'FETUSDT', baseAsset: 'FET', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.1, maxQty: 9000000, stepSize: 0.1, minNotional: 5 },
  { symbol: 'TAOUSDT', baseAsset: 'TAO', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.001, maxQty: 9000, stepSize: 0.001, minNotional: 5 },
  { symbol: 'INJUSDT', baseAsset: 'INJ', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.01, maxQty: 900000, stepSize: 0.01, minNotional: 5 },
  { symbol: 'SEIUSDT', baseAsset: 'SEI', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.1, maxQty: 9000000, stepSize: 0.1, minNotional: 5 },
  { symbol: 'POLUSDT', baseAsset: 'POL', quoteAsset: 'USDT', status: 'TRADING', minQty: 0.1, maxQty: 9000000, stepSize: 0.1, minNotional: 5 },
];
