// React Hook for Project Q — Phase 2: Basic Chart
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { sharedChartDataManager } from '@/lib/charts/chart-data-manager';
import { 
  Candle, 
  ChartConnectionStatus, 
  DataSource, 
  NativeTimeframe, 
  VALID_TIMEFRAMES 
} from '@/lib/charts/types';

export interface UseChartOptions {
  initialSymbol?: string;
  initialTimeframe?: NativeTimeframe;
}

export interface UseChartReturn {
  symbol: string;
  timeframe: NativeTimeframe;
  candles: Candle[];
  currentPrice: number | null;
  connectionStatus: ChartConnectionStatus;
  activeSource: DataSource;
  isLoadingOlder: boolean;
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: NativeTimeframe) => void;
  loadOlderHistory: () => Promise<void>;
  supportedTimeframes: readonly NativeTimeframe[];
}

function mergeLiveCandle(prev: Candle[], candle: Candle): Candle[] {
  if (prev.length === 0) return [candle];
  const lastIndex = prev.length - 1;
  const last = prev[lastIndex];

  if (candle.time === last.time) {
    const updated = [...prev];
    updated[lastIndex] = candle;
    return updated;
  }

  if (candle.time > last.time) {
    const updated = [...prev];
    if (!last.closed) {
      updated[lastIndex] = { ...last, closed: true };
    }
    updated.push(candle);
    return updated;
  }

  // If candle.time < last.time, merge and deduplicate to prevent duplicate timestamps
  const map = new Map<number, Candle>();
  for (const c of prev) {
    map.set(c.time, c);
  }
  map.set(candle.time, candle);
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

let subscriberCounter = 0;

export function useChart({
  initialSymbol = 'BTCUSDT',
  initialTimeframe = '5m',
}: UseChartOptions = {}): UseChartReturn {
  const [symbol, setSymbolState] = useState<string>(initialSymbol.toUpperCase());
  const [timeframe, setTimeframeState] = useState<NativeTimeframe>(initialTimeframe);
  const [candles, setCandles] = useState<Candle[]>(() => {
    return sharedChartDataManager.getCandles(initialSymbol.toUpperCase(), initialTimeframe);
  });
  const [currentPrice, setCurrentPrice] = useState<number | null>(() => {
    const initial = sharedChartDataManager.getCandles(initialSymbol.toUpperCase(), initialTimeframe);
    return initial.length > 0 ? initial[initial.length - 1].close : null;
  });
  const [connectionStatus, setConnectionStatus] = useState<ChartConnectionStatus>('CONNECTING');
  const [activeSource, setActiveSource] = useState<DataSource>(() => {
    return sharedChartDataManager.getActiveSource(initialSymbol.toUpperCase(), initialTimeframe);
  });
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);

  // Keep a stable subscriber ID per hook instance
  const subscriberIdRef = useRef<string>(`chart_hook_${++subscriberCounter}`);

  const setSymbol = useCallback((newSymbol: string) => {
    const clean = newSymbol.trim().toUpperCase();
    if (clean) {
      setSymbolState(clean);
    }
  }, []);

  const setTimeframe = useCallback((newTf: NativeTimeframe) => {
    if (VALID_TIMEFRAMES.includes(newTf)) {
      setTimeframeState(newTf);
    }
  }, []);

  // Main subscription effect
  useEffect(() => {
    let isCancelled = false;
    let unsubscribeFn: (() => void) | null = null;

    const currentSubId = subscriberIdRef.current;
    const cleanSymbol = symbol.toUpperCase();

    // Defer initial subscription and callbacks outside of synchronous effect body
    const timeoutId = setTimeout(() => {
      if (isCancelled) return;

      const initialCandles = sharedChartDataManager.getCandles(cleanSymbol, timeframe);
      setCandles(initialCandles);
      if (initialCandles.length > 0) {
        setCurrentPrice(initialCandles[initialCandles.length - 1].close);
      }
      setActiveSource(sharedChartDataManager.getActiveSource(cleanSymbol, timeframe));

      unsubscribeFn = sharedChartDataManager.subscribe(
        cleanSymbol,
        timeframe,
        currentSubId,
        {
          onCandlesReset: (newCandles) => {
            if (isCancelled) return;
            const map = new Map<number, Candle>();
            for (const c of newCandles) {
              if (typeof c.time === 'number' && !isNaN(c.time)) {
                map.set(c.time, c);
              }
            }
            const deduplicated = Array.from(map.values()).sort((a, b) => a.time - b.time);
            setCandles(deduplicated);
            if (deduplicated.length > 0) {
              setCurrentPrice(deduplicated[deduplicated.length - 1].close);
            }
          },
          onCandleUpdate: (candle) => {
            if (isCancelled) return;
            setCandles((prev) => mergeLiveCandle(prev, candle));
            setCurrentPrice(candle.close);
          },
          onPriceUpdate: (update) => {
            if (isCancelled) return;
            if (update.symbol === cleanSymbol) {
              setCurrentPrice(update.price);
            }
          },
          onStatusChange: (status) => {
            if (isCancelled) return;
            setConnectionStatus(status);
          },
          onSourceChange: (source) => {
            if (isCancelled) return;
            setActiveSource(source);
          },
        }
      );
    }, 0);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
      if (unsubscribeFn) {
        unsubscribeFn();
      }
    };
  }, [symbol, timeframe]);

  const loadOlderHistory = useCallback(async () => {
    if (isLoadingOlder) return;
    setIsLoadingOlder(true);
    try {
      await sharedChartDataManager.fetchOlderHistory(symbol, timeframe, 100);
      // The shared manager updates the store and broadcasts onCandlesReset
    } catch {
      // Handled gracefully
    } finally {
      setIsLoadingOlder(false);
    }
  }, [symbol, timeframe, isLoadingOlder]);

  return {
    symbol,
    timeframe,
    candles,
    currentPrice,
    connectionStatus,
    activeSource,
    isLoadingOlder,
    setSymbol,
    setTimeframe,
    loadOlderHistory,
    supportedTimeframes: VALID_TIMEFRAMES,
  };
}
