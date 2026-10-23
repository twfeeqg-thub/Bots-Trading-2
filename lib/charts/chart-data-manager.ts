// Central Chart Data Manager for Project Q
// Orchestrates multi-provider subscriptions (Kraken Primary -> Binance Fallback)
// Ensures no redundant WebSocket connections per ChartCard.

import { CandleStore, sharedCandleStore } from './candle-store';
import { KrakenProvider } from './providers/kraken-provider';
import { BinanceProvider } from './providers/binance-provider';
import {
  Candle,
  ChartConnectionStatus,
  ChartSubscriptionCallbacks,
  DataSource,
  NativeTimeframe,
  TIMEFRAME_SECONDS,
} from './types';

interface KeyState {
  symbol: string;
  timeframe: NativeTimeframe;
  activeSource: DataSource;
  subscribers: Map<string, ChartSubscriptionCallbacks>;
  unsubscribeProvider: (() => void) | null;
  isLoadingHistory: boolean;
  hasInitialized: boolean;
  lastStatus?: ChartConnectionStatus;
}

export class ChartDataManager {
  private krakenProvider: KrakenProvider;
  private binanceProvider: BinanceProvider;
  private candleStore: CandleStore;
  private keyStates: Map<string, KeyState> = new Map();

  constructor(
    candleStore: CandleStore = sharedCandleStore,
    krakenProvider?: KrakenProvider,
    binanceProvider?: BinanceProvider
  ) {
    this.candleStore = candleStore;
    this.krakenProvider = krakenProvider || new KrakenProvider();
    this.binanceProvider = binanceProvider || new BinanceProvider();
  }

  private getKey(symbol: string, timeframe: NativeTimeframe): string {
    return `${symbol.toUpperCase()}_${timeframe}`;
  }

  public subscribe(
    symbol: string,
    timeframe: NativeTimeframe,
    subscriberId: string,
    callbacks: ChartSubscriptionCallbacks
  ): () => void {
    const upperSymbol = symbol.toUpperCase();
    const key = this.getKey(upperSymbol, timeframe);

    let state = this.keyStates.get(key);
    if (!state) {
      state = {
        symbol: upperSymbol,
        timeframe,
        activeSource: this.krakenProvider.isTimeframeSupported(timeframe) ? 'kraken' : 'binance',
        subscribers: new Map(),
        unsubscribeProvider: null,
        isLoadingHistory: false,
        hasInitialized: false,
      };
      this.keyStates.set(key, state);
    }

    state.subscribers.set(subscriberId, callbacks);

    // If cached candles already exist in memory, send them immediately to this subscriber
    const existingCandles = this.candleStore.getCandles(upperSymbol, timeframe);
    if (existingCandles.length > 0) {
      callbacks.onCandlesReset?.(existingCandles);
      const latest = existingCandles[existingCandles.length - 1];
      callbacks.onPriceUpdate?.({
        symbol: upperSymbol,
        price: latest.close,
        timestamp: Date.now(),
      });
    }

    callbacks.onSourceChange?.(state.activeSource);

    // If this is the first subscriber or provider is not active, start stream
    if (!state.unsubscribeProvider) {
      this.startProviderStream(state);
      this.initHistoryAndRepairGap(state);
    }

    return () => {
      this.unsubscribe(upperSymbol, timeframe, subscriberId);
    };
  }

  public unsubscribe(symbol: string, timeframe: NativeTimeframe, subscriberId: string): void {
    const key = this.getKey(symbol, timeframe);
    const state = this.keyStates.get(key);
    if (!state) return;

    state.subscribers.delete(subscriberId);

    // When no subscribers remain, clean up stream to conserve network & CPU
    if (state.subscribers.size === 0) {
      if (state.unsubscribeProvider) {
        state.unsubscribeProvider();
        state.unsubscribeProvider = null;
      }
      this.keyStates.delete(key);
    }
  }

  public getCandles(symbol: string, timeframe: NativeTimeframe): Candle[] {
    return this.candleStore.getCandles(symbol, timeframe);
  }

  public getActiveSource(symbol: string, timeframe: NativeTimeframe): DataSource {
    const state = this.keyStates.get(this.getKey(symbol, timeframe));
    return state ? state.activeSource : 'kraken';
  }

  private startProviderStream(state: KeyState): void {
    if (state.unsubscribeProvider) {
      state.unsubscribeProvider();
      state.unsubscribeProvider = null;
    }

    const { symbol, timeframe, activeSource } = state;

    if (activeSource === 'kraken') {
      state.unsubscribeProvider = this.krakenProvider.subscribe(symbol, timeframe, {
        onCandle: (candle) => this.handleLiveCandle(state, candle),
        onStatus: (status) => this.broadcastStatus(state, status),
        onFallbackNeeded: () => this.fallbackToBinance(state),
      });
    } else {
      state.unsubscribeProvider = this.binanceProvider.subscribe(symbol, timeframe, {
        onCandle: (candle) => this.handleLiveCandle(state, candle),
        onStatus: (status) => this.broadcastStatus(state, status),
      });
    }

    this.broadcastSource(state, state.activeSource);
  }

  private fallbackToBinance(state: KeyState): void {
    if (state.activeSource === 'binance') return;

    state.activeSource = 'binance';
    this.broadcastSource(state, 'binance');

    // Restart with Binance provider
    this.startProviderStream(state);

    // Check if we need history from Binance
    const existing = this.candleStore.getCandles(state.symbol, state.timeframe);
    if (existing.length === 0) {
      this.fetchInitialHistoryFromProvider(state, 'binance').catch(() => {});
    }
  }

  private async initHistoryAndRepairGap(state: KeyState): Promise<void> {
    if (state.isLoadingHistory) return;
    state.isLoadingHistory = true;

    const { symbol, timeframe } = state;

    try {
      // 1. Try restoring from IndexedDB storage first
      let cached = this.candleStore.getCandles(symbol, timeframe);
      if (cached.length === 0) {
        cached = await this.candleStore.restoreFromStorage(symbol, timeframe);
      }

      if (cached.length === 0) {
        // No stored history, fetch initial batch via REST
        await this.fetchInitialHistoryFromProvider(state, state.activeSource);
      } else {
        // We have cached history. Check if there's a gap between last candle and now
        const latestTime = cached[cached.length - 1].time;
        const intervalSec = TIMEFRAME_SECONDS[timeframe];
        const nowSec = Math.floor(Date.now() / 1000);

        if (nowSec - latestTime > intervalSec * 1.5) {
          // Gap detected: fetch only missing gap range via REST
          await this.repairGap(state, latestTime);
        } else {
          this.broadcastCandlesReset(state, cached);
        }
      }
    } catch {
      // If error occurred with Kraken REST, try fallback
      if (state.activeSource === 'kraken') {
        this.fallbackToBinance(state);
      }
    } finally {
      state.isLoadingHistory = false;
      state.hasInitialized = true;
    }
  }

  private async fetchInitialHistoryFromProvider(state: KeyState, source: DataSource): Promise<void> {
    const { symbol, timeframe } = state;
    let candles: Candle[] = [];

    if (source === 'kraken') {
      try {
        candles = await this.krakenProvider.fetchHistoricalCandles(symbol, timeframe);
      } catch {
        // Switch to Binance if Kraken REST fails
        this.fallbackToBinance(state);
        return;
      }
    } else {
      try {
        candles = await this.binanceProvider.fetchHistoricalCandles(symbol, timeframe, 200);
      } catch {
        candles = [];
      }
    }

    if (candles.length > 0) {
      this.candleStore.setCandles(symbol, timeframe, candles);
      const clean = this.candleStore.getCandles(symbol, timeframe);
      this.broadcastCandlesReset(state, clean);

      if (clean.length > 0) {
        const latest = clean[clean.length - 1];
        this.broadcastPrice(state, latest.close);
      }
    }
  }

  private async repairGap(state: KeyState, lastCachedTimeSec: number): Promise<void> {
    const { symbol, timeframe, activeSource } = state;
    let gapCandles: Candle[] = [];

    try {
      if (activeSource === 'kraken') {
        gapCandles = await this.krakenProvider.fetchHistoricalCandles(symbol, timeframe, lastCachedTimeSec);
      } else {
        gapCandles = await this.binanceProvider.fetchHistoricalCandles(
          symbol,
          timeframe,
          100,
          undefined,
          lastCachedTimeSec * 1000
        );
      }

      if (gapCandles.length > 0) {
        this.candleStore.repairGapCandles(symbol, timeframe, gapCandles);
        const allCandles = this.candleStore.getCandles(symbol, timeframe);
        this.broadcastCandlesReset(state, allCandles);
      }
    } catch {
      // Fallback
    }
  }

  public async fetchOlderHistory(
    symbol: string,
    timeframe: NativeTimeframe,
    limit: number = 100
  ): Promise<Candle[]> {
    const key = this.getKey(symbol, timeframe);
    const state = this.keyStates.get(key);
    const oldestTime = this.candleStore.getOldestTime(symbol, timeframe);

    if (!oldestTime) return [];

    let olderCandles: Candle[] = [];
    const source = state ? state.activeSource : 'binance';

    try {
      if (source === 'binance') {
        const endTimeMs = (oldestTime - 1) * 1000;
        olderCandles = await this.binanceProvider.fetchHistoricalCandles(symbol, timeframe, limit, endTimeMs);
      } else {
        // Kraken REST doesn't support endTime directly, fallback to Binance for deep backward history
        const endTimeMs = (oldestTime - 1) * 1000;
        olderCandles = await this.binanceProvider.fetchHistoricalCandles(symbol, timeframe, limit, endTimeMs);
      }

      if (olderCandles.length > 0) {
        this.candleStore.prependOlderCandles(symbol, timeframe, olderCandles);
        if (state) {
          const all = this.candleStore.getCandles(symbol, timeframe);
          this.broadcastCandlesReset(state, all);
        }
      }
    } catch {
      // Ignore
    }

    return olderCandles;
  }

  private handleLiveCandle(state: KeyState, candle: Candle): void {
    const { isNew } = this.candleStore.updateLiveCandle(state.symbol, state.timeframe, candle);

    // 1. Broadcast immediate price update
    this.broadcastPrice(state, candle.close);

    // 2. Broadcast candle update
    state.subscribers.forEach((cb) => {
      try {
        cb.onCandleUpdate?.(candle, isNew);
      } catch {
        // Listener error safety
      }
    });
  }

  private broadcastPrice(state: KeyState, price: number): void {
    const update = {
      symbol: state.symbol,
      price,
      timestamp: Date.now(),
    };
    state.subscribers.forEach((cb) => {
      try {
        cb.onPriceUpdate?.(update);
      } catch {
        // Safe
      }
    });
  }

  private broadcastCandlesReset(state: KeyState, candles: Candle[]): void {
    state.subscribers.forEach((cb) => {
      try {
        cb.onCandlesReset?.(candles);
      } catch {
        // Safe
      }
    });
  }

  private broadcastStatus(state: KeyState, status: ChartConnectionStatus): void {
    const prevStatus = state.lastStatus;
    state.lastStatus = status;

    // After reconnection from disconnect or reconnecting state, check for and repair any gap
    if (status === 'CONNECTED' && (prevStatus === 'RECONNECTING' || prevStatus === 'DISCONNECTED')) {
      const latestTime = this.candleStore.getLatestTime(state.symbol, state.timeframe);
      if (latestTime) {
        this.repairGap(state, latestTime);
      }
    }

    state.subscribers.forEach((cb) => {
      try {
        cb.onStatusChange?.(status);
      } catch {
        // Safe
      }
    });
  }

  private broadcastSource(state: KeyState, source: DataSource): void {
    state.subscribers.forEach((cb) => {
      try {
        cb.onSourceChange?.(source);
      } catch {
        // Safe
      }
    });
  }
}

export const sharedChartDataManager = new ChartDataManager();
