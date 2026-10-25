// Project Q — Chart Persistence & Configuration

export type RedrawRateOption = 0 | 100 | 250 | 500 | 1000;

export interface HorizontalLineConfig {
  id: string;
  price: number;
  color: string;
  textColor?: string;
  textSize?: number;
  lineWidth: 1 | 2 | 3 | 4;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  label: string;
  createdAt?: number;
}

export const MAX_ACTIVE_CHARTS = 10;

export interface SavedChartLayout {
  id: string;
  symbol: string;
  timeframe: string;
  horizontalLines: HorizontalLineConfig[];
}
