// Project Q — Bot Engine: Types & DTOs
// Defines engine configuration, status, and summary transfer objects.

import {
  BotType,
  BotState,
  BotConfig,
  BotCycle,
  BotTrade,
} from '@/lib/bots/types';
import { BotRepository } from '@/lib/persistence/types';
import { CentralMarketDataStore } from '@/lib/market-data';
import { BinanceTradingService } from '@/lib/trading';

export interface BotEngineConfig {
  repository?: BotRepository;
  port?: number;
  marketDataStore?: CentralMarketDataStore;
  tradingService?: BinanceTradingService;
}

export interface BotSummaryDTO {
  id: string;
  name: string;
  type: BotType;
  symbol: string;
  entryAmount: number;
  currentState: BotState;
  enabled: boolean;
  cycleNumber: number;
  hasOpenCycle: boolean;
  cycleStartedAt: number | null;
  activeTradeId: string | null;
  tradeStatus: string | null;
  lastError: string | null;
  config: BotConfig;
  currentCycle: BotCycle | null;
  currentTrade: BotTrade | null;
}

export interface BotEngineStatus {
  running: boolean;
  storageType: 'in-memory' | 'supabase';
  totalBots: number;
  activeCyclesCount: number;
  uptimeSeconds: number;
  initializedAt: number;
  storageHealthy: boolean;
}
