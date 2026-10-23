// React Hook for Project Q - Scanner
'use client';

import { useSyncExternalStore, useCallback, useState, useEffect } from 'react';
import { ScannerService, ScannerTableState } from '@/lib/scanner/scanner-service';
import { TimePeriod, SortDirection } from '@/lib/scanner/types';

export const DEFAULT_SCANNER_STATE: ScannerTableState = {
  rows: [],
  connectionStatus: 'DISCONNECTED',
  selectedPeriod: '5m',
  alertThreshold: 1.0,
  sortDirection: 'DESC',
  sortField: 'changePercent',
  filterQuery: '',
  lastUpdated: 0,
  activeAlertCount: 0,
};

const emptySubscribe = () => () => {};

export function useScanner() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const subscribe = useCallback((callback: () => void) => {
    if (typeof window === 'undefined') {
      return () => {};
    }
    return ScannerService.getInstance().subscribe(callback);
  }, []);

  const getSnapshot = useCallback((): ScannerTableState => {
    if (typeof window === 'undefined') {
      return DEFAULT_SCANNER_STATE;
    }
    return ScannerService.getInstance().getCurrentState();
  }, []);

  const getServerSnapshot = useCallback((): ScannerTableState => {
    return DEFAULT_SCANNER_STATE;
  }, []);

  const rawState = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const state = mounted ? rawState : DEFAULT_SCANNER_STATE;

  const setPeriod = useCallback((period: TimePeriod) => {
    ScannerService.getInstance().setPeriod(period);
  }, []);

  const setAlertThreshold = useCallback((threshold: number) => {
    ScannerService.getInstance().setAlertThreshold(threshold);
  }, []);

  const setSort = useCallback((field: 'changePercent' | 'currentPrice' | 'asset', dir?: SortDirection) => {
    ScannerService.getInstance().setSort(field, dir);
  }, []);

  const setFilter = useCallback((query: string) => {
    ScannerService.getInstance().setFilter(query);
  }, []);

  return {
    state,
    setPeriod,
    setAlertThreshold,
    setSort,
    setFilter,
  };
}
