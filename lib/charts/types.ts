// Project Q — Chart Types Definition

export interface Candle {
  time: number; // Unix timestamp in seconds (or milliseconds for lightweight-charts converted)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closed?: boolean;
}

export type NativeTimeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '1d';

export const VALID_TIMEFRAMES: NativeTimeframe[] = ['1m', '3m', '5m', '15m', '30m', '1h'];
