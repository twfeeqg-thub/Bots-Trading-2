// Project Q — Phase 4: Chart UI + Persistence
// Closed Specification: Persistence for multiple charts, horizontal lines, order, minimize, closed charts
'use client';

import { NativeTimeframe } from './types';

export type RedrawRateOption = 0 | 50 | 100 | 150 | 200 | 250 | 300;

export interface HorizontalLineConfig {
  id: string;
  price: number;
  label: string;
  color: string; // Hex color (e.g. #10B981)
  textColor: string; // Hex color for label text (e.g. #FFFFFF)
  textSize: number; // 10, 12, 14, 16
  lineWidth: 1 | 2 | 3;
  lineStyle: 'solid' | 'dashed' | 'dotted';
}

export interface ChartItemConfig {
  id: string;
  symbol: string;
  timeframe: NativeTimeframe;
  order: number;
  isMinimized: boolean;
  isClosed: boolean;
  closedAt?: number;
  horizontalLines: HorizontalLineConfig[];
  redrawRateMs: RedrawRateOption;
}

export const CHARTS_STORAGE_KEY = 'project_q_charts_state_v2';
export const MAX_ACTIVE_CHARTS = 10;

// Default initial chart if user has zero saved charts
export const DEFAULT_INITIAL_CHARTS: ChartItemConfig[] = [
  {
    id: 'chart_default_btc',
    symbol: 'BTCUSDT',
    timeframe: '5m',
    order: 0,
    isMinimized: false,
    isClosed: false,
    horizontalLines: [],
    redrawRateMs: 0,
  },
];

/**
 * Load persisted charts from localStorage
 * Filters out transient properties (Fullscreen, Floating, Orientation are never stored)
 */
export function loadPersistedCharts(): ChartItemConfig[] {
  if (typeof window === 'undefined') {
    return DEFAULT_INITIAL_CHARTS;
  }

  try {
    const raw = localStorage.getItem(CHARTS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_INITIAL_CHARTS;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_INITIAL_CHARTS;
    }

    // Sanitize and validate loaded charts
    const sanitized: ChartItemConfig[] = parsed.map((item, index) => ({
      id: String(item.id || `chart_persisted_${index}`),
      symbol: String(item.symbol || 'BTCUSDT').toUpperCase(),
      timeframe: (item.timeframe || '5m') as NativeTimeframe,
      order: typeof item.order === 'number' ? item.order : index,
      isMinimized: Boolean(item.isMinimized),
      isClosed: Boolean(item.isClosed),
      closedAt: item.closedAt ? Number(item.closedAt) : undefined,
      horizontalLines: Array.isArray(item.horizontalLines)
        ? item.horizontalLines.map((hl: Partial<HorizontalLineConfig>, hlIndex: number) => ({
            id: String(hl.id || `hl_persisted_${index}_${hlIndex}`),
            price: Number(hl.price) || 0,
            label: String(hl.label || `مستوى ${hlIndex + 1}`),
            color: String(hl.color || '#10B981'),
            textColor: String(hl.textColor || '#FFFFFF'),
            textSize: Number(hl.textSize) || 12,
            lineWidth: (Number(hl.lineWidth) || 1) as 1 | 2 | 3,
            lineStyle: (hl.lineStyle === 'dashed' || hl.lineStyle === 'dotted' ? hl.lineStyle : 'solid') as 'solid' | 'dashed' | 'dotted',
          }))
        : [],
      redrawRateMs: (typeof item.redrawRateMs === 'number' ? item.redrawRateMs : 0) as RedrawRateOption,
    }));

    return sanitized;
  } catch (err) {
    console.warn('[ChartPersistence] Failed to parse charts from localStorage:', err);
    return DEFAULT_INITIAL_CHARTS;
  }
}

/**
 * Save charts state to localStorage automatically.
 * Fullscreen, Floating, and Orientation states are NEVER saved.
 */
export function savePersistedCharts(charts: ChartItemConfig[]): void {
  if (typeof window === 'undefined') return;

  try {
    // Only persist fields required by the Phase 4 specification
    const cleanToStore = charts.map((c, index) => ({
      id: c.id,
      symbol: c.symbol,
      timeframe: c.timeframe,
      order: typeof c.order === 'number' ? c.order : index,
      isMinimized: c.isMinimized,
      isClosed: c.isClosed,
      closedAt: c.closedAt,
      horizontalLines: c.horizontalLines.map((hl) => ({
        id: hl.id,
        price: hl.price,
        label: hl.label,
        color: hl.color,
        textColor: hl.textColor,
        textSize: hl.textSize,
        lineWidth: hl.lineWidth,
        lineStyle: hl.lineStyle,
      })),
      redrawRateMs: c.redrawRateMs,
    }));

    localStorage.setItem(CHARTS_STORAGE_KEY, JSON.stringify(cleanToStore));
  } catch (err) {
    console.error('[ChartPersistence] Error saving charts to localStorage:', err);
  }
}
