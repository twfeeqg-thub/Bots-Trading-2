// Project Q — Bot Engine Types

import { BotConfig, BotCycle, BotState, BotTrade, BotType } from '@/lib/bots/types';

export interface BotSummaryDTO {
  id: string;
  name: string;
  type: BotType;
  symbol: string;
  currentState: BotState;
  entryAmount: number;
  cycleNumber: number;
  config: BotConfig;
  currentCycle?: BotCycle;
  currentTrade?: BotTrade;
  lastActionTimestamp?: number;
}

export interface BotStatusDTO {
  engineRunning: boolean;
  activeBotsCount: number;
  totalBotsCount: number;
  simulationMode: string;
  timestamp: number;
}
