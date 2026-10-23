// Project Q — Shared Central Market Data: Types & Models
// Closed Specification: Single centralized Binance Spot WebSocket (!miniTicker@arr),
// unified data model with strict 30s FRESH/STALE evaluation, and shared access.

export type MarketDataStatus = 'NO_DATA' | 'FRESH' | 'STALE';

/**
 * Backward compatibility alias for Scanner types
 */
export type DataFreshness = MarketDataStatus;

/**
 * Unified internal data model as strictly required:
 * - symbol: Trading pair symbol (e.g. BTCUSDT)
 * - price: Last valid real price received
 * - eventTime: Event timestamp from Binance (E)
 * - receivedAt: Timestamp of arrival inside the application
 * - dataStatus: 'NO_DATA' | 'FRESH' | 'STALE'
 */
export interface MarketPriceRecord {
  symbol: string;
  price: number;
  eventTime: number; // Binance event time (E)
  receivedAt: number; // Application receipt timestamp
  dataStatus: MarketDataStatus;

  // Aliases for seamless backward compatibility with existing Scanner modules
  currentPrice: number;
  timestamp: number;
  freshness: MarketDataStatus;
}

/**
 * Backward compatibility alias for Scanner CurrentPriceRecord
 */
export type CurrentPriceRecord = MarketPriceRecord;

/**
 * Central Market Data Connection Status
 */
export type MarketConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

/**
 * Freshness Threshold: exactly 30 seconds as closed specification
 */
export const FRESHNESS_THRESHOLD_MS = 30 * 1000; // 30,000 ms

/**
 * Listener types for decoupled subscriptions
 */
export type MarketPriceListener = (record: MarketPriceRecord) => void;
export type MarketConnectionListener = (status: MarketConnectionStatus) => void;
export type MarketStoreChangeListener = () => void;

/**
 * Raw Binance Mini-Ticker interface from !miniTicker@arr
 */
export interface RawBinanceMiniTicker {
  e: string; // Event type (24hrMiniTicker)
  E: number; // Event time in ms
  s: string; // Symbol (e.g. BTCUSDT)
  c: string; // Close price
  o: string; // Open price
  h: string; // High price
  l: string; // Low price
  v: string; // Total traded base asset volume
  q: string; // Total traded quote asset volume
}
