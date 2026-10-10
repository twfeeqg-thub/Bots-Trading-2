// Types and Interfaces for Project Q - Phase 1: Scanner

export type DataFreshness = 'NO_DATA' | 'FRESH' | 'STALE';

export type AlertState = 'NOT_ALERTED' | 'ALERTED';

export type AlertEvent = 'NEW_ALERT';

export type SortDirection = 'ASC' | 'DESC';

export type TimePeriod = 
  | '1m'
  | '3m'
  | '5m'
  | '10m'
  | '15m'
  | '30m'
  | '1h'
  | '12h'
  | '24h';

export const SUPPORTED_PERIODS: readonly TimePeriod[] = [
  '1m',
  '3m',
  '5m',
  '10m',
  '15m',
  '30m',
  '1h',
  '12h',
  '24h',
] as const;

export const PERIOD_DURATIONS_MS: Record<TimePeriod, number> = {
  '1m': 60 * 1000,
  '3m': 3 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '10m': 10 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

export interface PricePoint {
  timestamp: number; // in milliseconds
  price: number;
}

export interface CurrentPriceRecord {
  symbol: string;
  price: number;
  eventTime: number; // Binance event time (E)
  receivedAt: number; // Application receipt timestamp
  dataStatus: DataFreshness;
  // Backward compatibility aliases:
  currentPrice: number;
  timestamp: number; // in milliseconds
  freshness: DataFreshness;
}

export interface CalculationResult {
  referencePrice: number | null;
  referenceTimestamp: number | null;
  changePercent: number | null;
  status: 'VALID' | 'INSUFFICIENT_HISTORY' | 'NO_DATA' | 'STALE';
}

export interface ScannerTableRow {
  rank: number;
  asset: string;
  symbol: string; // e.g., BTCUSDT
  currentPrice: number | null;
  referencePrice: number | null;
  changePercent: number | null;
  dataStatus: DataFreshness;
  alertState: AlertState;
  hasRecentAlert: boolean; // flag when NEW_ALERT was recently triggered
  lastAlertTimestamp: number | null;
  lastUpdated: number | null;
}

export interface UniverseAsset {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  isSpotTradingAllowed: boolean;
}

export interface ScannerConfig {
  selectedPeriod: TimePeriod;
  alertThreshold: number; // e.g., 1.0 for +1.0%
  sortDirection: SortDirection;
  sortField: 'changePercent' | 'currentPrice' | 'asset' | 'rank';
  filterText: string;
}

export interface RawMiniTicker {
  e: string; // Event type
  E: number; // Event time in ms
  s: string; // Symbol (e.g. BTCUSDT)
  c: string; // Close price
  o: string; // Open price
  h: string; // High price
  l: string; // Low price
  v: string; // Total traded base asset volume
  q: string; // Total traded quote asset volume
}
