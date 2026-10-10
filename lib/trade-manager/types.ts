// Project Q — Trade Manager: Type Definitions
// Defines the two unified entry paths (Manual & Scanner),
// deterministic T-levels ladder (T0, T1-50%, T1, T2, T3...), trailing protection,
// Net PnL, and the Cost Data System (Manual vs Real Confirmed with 3-tier priority).

import { TradeEntryExecution, TradeExitExecution, TradeStatus, BotType, XRangeSettings } from '@/lib/bots/types';

export type TradeCreationSource = 'MANUAL' | 'SCANNER';

export type AchievedTargetLevel =
  | 'NONE'
  | 'T1_MINUS_50'
  | 'T1'
  | 'T2'
  | 'T3'
  | 'T4'
  | 'T5'
  | string;

export interface XRecoveryLevel {
  levelIndex: number; // 1, 2, ... maxLevels
  triggerPrice: number; // entryPrice * (1 - (levelIndex * stepPercent / 100))
  allocationQuote: number; // USDT allocated
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED';
  executedAt?: number;
  orderId?: string;
  fillPrice?: number;
  filledQty?: number;
  feePaid?: number;
}

export interface XRecoveryPlan {
  enabled: boolean;
  maxLevels?: number; // Optional user limit; undefined means continuous/unlimited
  stepPercent: number;
  recoveryRatio: number;
  customAllocationQuote?: number; // Optional direct custom allocation quote per level in USDT
  baseEntryPrice: number;
  baseEntryAmount: number;
  levels: XRecoveryLevel[];
  executedLevelsCount: number;
  totalRecoverySpent: number;
  totalRecoveryQty: number;
  averageEntryPrice: number;
}

/**
 * Priority of Cost Data Sources:
 * 1. REAL_CONFIRMED_RECENT: Real data confirmed directly from latest execution/fill.
 * 2. REAL_CONFIRMED_SAVED: Real data confirmed and saved previously for this symbol.
 * 3. MANUAL_USER_INPUT: User's manual initial input (prevents blocking trade opening).
 */
export type CostDataSource =
  | 'REAL_CONFIRMED_RECENT'
  | 'REAL_CONFIRMED_SAVED'
  | 'MANUAL_USER_INPUT';

export interface TradeCostConfig {
  entryCostAmount: number; // In USDT / quote currency
  entryCostRate: number; // e.g. 0.001 (0.1%)
  exitCostRate: number; // e.g. 0.001 (0.1%)
  source: CostDataSource;
  updatedAt: number;
  description?: string;
  isRealConfirmed: boolean;
}

export interface ConfirmedSymbolCost {
  symbol: string;
  effectiveEntryRate: number;
  effectiveExitRate: number;
  lastConfirmedEntryFee: number;
  lastConfirmedExitFee?: number;
  confirmedAt: number;
  sourceTradeId?: string;
}

export interface TradeLevelsPlan {
  entryPrice: number;
  filledQuantity: number;
  entryCommissionQuote: number;
  exitCommissionRate: number; // e.g. 0.001 (0.1%)
  t0BreakEvenPrice: number; // Exact net break-even after entry and exit costs
  stepPercent: number; // Distance for each T level (e.g. 2.0%)
  t1Minus50Price: number; // Entry + 0.5 * step
  t1Price: number; // Entry + 1.0 * step
  t2Price: number; // Entry + 2.0 * step
  t3Price: number; // Entry + 3.0 * step
  t4Price: number; // Entry + 4.0 * step
  initialProtectionPrice: number; // Protection before T1-50%
  currentAchievedLevel: AchievedTargetLevel;
  activeProtectionPrice: number;
  highestPriceObserved: number;
  lastEvaluatedPrice?: number;
  lastEvaluatedAt?: number;
  costConfig: TradeCostConfig;
}

export interface TradePnL {
  grossReturnQuote: number; // (exitPrice - entryPrice) * filledQuantity
  totalFeesQuote: number; // entryCommission + exitCommission
  netReturnQuote: number; // grossReturnQuote - totalFeesQuote
  netReturnPercent: number; // (netReturnQuote / (entryPrice * filledQuantity)) * 100
  isProfitable: boolean;
}

export interface ManagedTrade {
  tradeId: string;
  botId: string;
  symbol: string;
  source: TradeCreationSource;
  botType?: BotType; // DEAL_BOT or RANGE_BOT
  status: TradeStatus; // PENDING_ENTRY | OPEN | PENDING_EXIT | CLOSED
  requestedAmount: number; // Quote currency (USDT)
  plannedPrice?: number | null;
  entry: TradeEntryExecution;
  exit?: TradeExitExecution;
  costConfig: TradeCostConfig;
  levelsPlan?: TradeLevelsPlan;
  xRecoveryPlan?: XRecoveryPlan;
  pnl?: TradePnL;
  createdAt: number;
  openedAt?: number | null;
  closedAt?: number | null;
  closeReason?: string | null;
  notes?: string;
}

export interface CreateTradeManualParams {
  symbol: string;
  entryAmount: number;
  entryPrice?: number;
  stepPercent?: number;
  manualEntryCost?: number; // User initial manual entry fee amount in USDT
  manualExitCostRate?: number; // User initial manual exit rate (e.g. 0.0015 for 0.15%)
  botType?: BotType;
  xSettings?: XRangeSettings;
  initialStopLossPercent?: number;
}

export interface CreateTradeScannerParams {
  symbol: string;
  scannerPrice: number;
  entryAmount: number;
  stepPercent?: number;
  manualEntryCost?: number;
  manualExitCostRate?: number;
  botType?: BotType;
  xSettings?: XRangeSettings;
  initialStopLossPercent?: number;
}

export interface LevelEvaluationResult {
  shouldSell: boolean;
  triggerReason?: string;
  levelAdvanced: boolean;
  previousAchievedLevel: AchievedTargetLevel;
  newAchievedLevel: AchievedTargetLevel;
  previousProtectionPrice: number;
  newProtectionPrice: number;
}
