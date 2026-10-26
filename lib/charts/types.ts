// Project Q — Chart Data Types and Interfaces
// Closed Specification: Native timeframes: 1m, 3m, 5m, 15m, 30m, 1h

export type NativeTimeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h';

export const VALID_TIMEFRAMES: readonly NativeTimeframe[] = ['1m', '3m', '5m', '15m', '30m', '1h'] as const;

export const TIMEFRAME_SECONDS: Record<NativeTimeframe, number> = {
  '1m': 60,
  '3m': 180,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
} as const;

export type DataSource = 'kraken' | 'binance';

export type ChartConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closed: boolean; // Confirmed closed by source
}

export interface ChartSubscriptionKey {
  symbol: string; // e.g., 'BTCUSDT'
  timeframe: NativeTimeframe;
}

export interface LivePriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface ChartSubscriptionCallbacks {
  onCandleUpdate?: (candle: Candle, isNewCandle: boolean) => void;
  onCandlesReset?: (candles: Candle[]) => void;
  onPriceUpdate?: (update: LivePriceUpdate) => void;
  onStatusChange?: (status: ChartConnectionStatus) => void;
  onSourceChange?: (source: DataSource) => void;
  onError?: (err: Error) => void;
}

export interface MarketMatchingResult {
  source: DataSource;
  providerSymbol: string;
  isNativeIntervalSupported: boolean;
}
