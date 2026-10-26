// Project Q — PnL & Analytics: Types and Domain Definitions
// Defines raw historical trade records, atomic event logs, dynamic level analytics,
// and multi-dimensional bot performance metrics. Strict separation of raw facts
// from analytical computation. Single Source of Truth (SSOT) from Trade Manager & Cost Data.

import { TradeCreationSource, AchievedTargetLevel, CostDataSource } from '@/lib/trade-manager/types';
import { BotType, TradeStatus } from '@/lib/bots/types';

/**
 * Outcome category of a trade.
 */
export type TradeOutcome = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN';

/**
 * Atomic event types recorded in the raw historical log.
 */
export type AnalyticsEventType =
  | 'TRADE_CREATED'
  | 'ENTRY_FILLED'
  | 'COST_UPDATED'
  | 'RECOVERY_TRIGGERED'
  | 'RECOVERY_EXECUTED'
  | 'LEVEL_ADVANCED'
  | 'PROTECTION_TRIGGERED'
  | 'EXIT_TRIGGERED'
  | 'EXIT_FILLED'
  | 'TRADE_CLOSED';

/**
 * Raw atomic event capturing an immutable fact in the trade lifecycle.
 */
export interface RawAnalyticsEvent {
  eventId: string;
  tradeId: string;
  botId: string;
  timestamp: number;
  type: AnalyticsEventType;
  payload: Record<string, unknown>;
}

/**
 * Detailed metrics for each executed level (Base entry or X-recovery level).
 */
export interface LevelPnLMetric {
  levelType: 'BASE' | 'RECOVERY';
  levelIndex: number; // 0 for base, 1, 2, ... for X1, X2...
  label: string; // e.g. "Base Entry" or "Recovery X1"
  status: 'EXECUTED' | 'PENDING' | 'CANCELLED';
  triggerPrice: number;
  executionPrice: number;
  quantity: number;
  quoteAmount: number;
  feePaid: number;
  executedAt?: number;
  orderId?: string;
  currentOrExitPrice: number;
  grossPnLQuote: number;
  exitFeeAllocated: number;
  netPnLQuote: number;
  netPnLPercent: number;
}

/**
 * Recovery / Boost analytics for a specific trade.
 */
export interface TradeRecoveryAnalytics {
  hasRecoveries: boolean;
  executedLevelsCount: number;
  highestXLevelReached: number; // 0 if none, 1, 2, 3...
  totalRecoverySpent: number; // USDT
  totalRecoveryQty: number;
  recoveryCapitalRatio: number; // totalRecoverySpent / totalInvested
  transitionsCount: number;
  stepPercent: number;
  recoveryRatio: number;
  customAllocationQuote?: number;
  maxLevelsCeiling?: number; // undefined = unlimited
  wapHistory: Array<{
    levelIndex: number;
    wapBefore: number;
    wapAfter: number;
    price: number;
    quantity: number;
    fee: number;
    timestamp: number;
  }>;
  levels: LevelPnLMetric[];
  baseInvestedQuote: number;
  baseNetPnLQuoteAtInitialStop: number; // What the loss would have been without recovery
  pnlWithRecoveryQuote: number;
  recoveryImprovementDelta: number; // pnlWithRecoveryQuote - baseNetPnLQuoteAtInitialStop
  recoveryResult: 'POSITIVE_IMPACT' | 'NEGATIVE_IMPACT' | 'NEUTRAL';
}

/**
 * T-levels and Protection analytics for a specific trade.
 */
export interface TradeTargetAnalytics {
  stepPercent: number;
  t0BreakEvenPrice: number;
  initialProtectionPrice: number;
  activeProtectionPrice: number;
  highestPriceObserved: number;
  maxTLevelReached: AchievedTargetLevel; // 'NONE', 'T1_MINUS_50', 'T1', 'T2', 'T3', 'T4'...
  closedAtLevel: AchievedTargetLevel;
  isClosedByProtection: boolean;
  closedProtectionFloor: number | null;
  entryToExitDelta: number; // exitPrice - entryPrice
  entryToExitDeltaPercent: number;
  exitReasonCategory: 'T_TARGET' | 'TRAILING_PROTECTION' | 'INITIAL_STOP' | 'MANUAL' | 'OTHER';
}

/**
 * Comprehensive analytical record of a single trade (Active or Closed).
 */
export interface TradeAnalyticsRecord {
  tradeId: string;
  botId: string;
  botName: string;
  botType: BotType;
  symbol: string;
  source: TradeCreationSource;
  status: TradeStatus;

  // Timestamps & Duration
  createdAt: number;
  openedAt: number | null;
  closedAt: number | null;
  durationMs: number | null;
  durationFormatted: string;

  // Pricing & Quantities
  initialEntryPrice: number;
  initialAmount: number;
  initialQuantity: number;
  weightedAverageEntryPrice: number; // WAP
  exitPrice: number | null;
  currentEvaluatedPrice: number;

  totalInvested: number; // Total USDT spent across all fills
  totalQuantity: number; // Total tokens accumulated
  totalQuoteRealized: number; // Total USDT received at exit (0 if open)

  // Cost Data
  entryCommissionPaid: number;
  exitCommissionPaid: number;
  totalFeesPaid: number;
  effectiveEntryRate: number;
  effectiveExitRate: number;
  costDataSource: CostDataSource;
  isRealConfirmedCost: boolean;

  // PnL Metrics (Real-time for OPEN, Final for CLOSED)
  grossPnLQuote: number;
  netPnLQuote: number; // USDT after ALL fees
  netPnLPercent: number; // % relative to totalInvested
  isProfitable: boolean;
  outcome: TradeOutcome; // WIN, LOSS, BREAKEVEN, OPEN
  closeReason: string | null;

  // Detailed Sub-modules
  recoveryAnalytics: TradeRecoveryAnalytics;
  targetAnalytics: TradeTargetAnalytics;
}

/**
 * Summary metrics of a specific Bot's performance over time.
 */
export interface BotPerformanceMetrics {
  botId: string;
  botName: string;
  botType: BotType;
  symbol: string;
  status: string;

  // Volume & Trade counts
  totalTrades: number;
  openTradesCount: number;
  closedTradesCount: number;
  winningTradesCount: number;
  losingTradesCount: number;
  breakevenTradesCount: number;

  // Success Rates
  winRate: number; // %
  lossRate: number; // %
  breakevenRate: number; // %

  // Financial aggregates
  totalInvestedVolume: number;
  totalFeesPaid: number;
  grossProfitQuote: number;
  grossLossQuote: number;
  netProfitQuote: number;
  netLossQuote: number;
  overallNetPnLQuote: number;
  overallNetPnLPercent: number;
  profitFactor: number | null; // netProfitQuote / abs(netLossQuote), or null (undefined/∞) when no losses

  // Averages and Extremes
  averagePnLQuote: number;
  averagePnLPercent: number;
  averageWinQuote: number;
  averageLossQuote: number;
  maxWinQuote: number;
  maxLossQuote: number;

  // Durations
  averageDurationMs: number;
  longestDurationMs: number;
  shortestDurationMs: number;

  // Recovery & Boost Metrics
  tradesWithRecoveryCount: number;
  recoveryUtilizationRate: number; // % of trades that had X recovery
  totalRecoverySpent: number;
  maxRecoveryLevelsInSingleTrade: number;
  averageRecoveryLevelsPerTrade: number;
  recoveryPositiveImpactCount: number;
  recoverySuccessRate: number; // % of recovered trades that ended in WIN/BREAKEVEN

  // Target & Protection Exits
  closedByTargetCount: number;
  closedByProtectionCount: number;
  targetExitRate: number; // %
  protectionExitRate: number; // %
  tLevelsAchievedDistribution: Record<string, number>; // e.g. { T1: 5, T2: 3, T3: 1, T4: 1 }
}

/**
 * Global macro performance aggregates across all bots and symbols.
 */
export interface GlobalAnalyticsSummary {
  totalBots: number;
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  globalWinRate: number;
  globalLossRate: number;

  totalInvestedVolume: number;
  totalFeesPaid: number;
  totalNetPnLQuote: number;
  totalNetPnLPercent: number;
  profitFactor: number | null; // netGains / abs(netLosses), or null (undefined/∞) when no losses

  averageTradePnLQuote: number;
  largestWinningTrade: { tradeId: string; symbol: string; netPnLQuote: number } | null;
  largestLosingTrade: { tradeId: string; symbol: string; netPnLQuote: number } | null;

  totalRecoveryTrades: number;
  recoveryUtilizationRate: number;
  averageRecoveryLevels: number;
  totalRecoveryCapitalDeployed: number;
  recoverySuccessRate: number;

  closedByTargetRate: number;
  closedByProtectionRate: number;

  // Bot Comparisons & Insights
  bestPerformingBot: { botId: string; botName: string; netPnLQuote: number; winRate: number } | null;
  mostActiveBot: { botId: string; botName: string; tradesCount: number } | null;
  botTypeComparison: {
    RANGE_BOT: { count: number; totalPnLQuote: number; winRate: number; avgPnLQuote: number };
    DEAL_BOT: { count: number; totalPnLQuote: number; winRate: number; avgPnLQuote: number };
  };
  symbolPerformance: Record<string, { tradesCount: number; netPnLQuote: number; winRate: number }>;
}

/**
 * Analytical questions & findings synthesis.
 */
export interface AnalyticsInsights {
  bestPerformingBotName: string;
  mostProfitableType: 'RANGE_BOT' | 'DEAL_BOT' | 'EQUAL';
  recoveryEffectivenessVerdict: string;
  tLevelEfficiencyVerdict: string;
  protectionExitImpact: string;
  costImpactPercentage: number; // Fees as % of gross turnover
}
