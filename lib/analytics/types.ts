// Project Q — Analytics Domain Types

export interface RecoveryLevelAnalytics {
  levelType: string;
  levelIndex: number;
  label: string;
  executionPrice: number;
  quantity: number;
  quoteAmount: number;
  feePaid: number;
  exitFeeAllocated: number;
  currentOrExitPrice: number;
  netPnLQuote: number;
  netPnLPercent: number;
}

export interface TradeAnalyticsRecord {
  tradeId: string;
  botId?: string;
  botName?: string;
  botType: string;
  symbol: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  source: string;
  outcome?: 'WIN' | 'LOSS' | 'BREAKEVEN';
  totalInvested: number;
  initialAmount: number;
  totalQuantity: number;
  initialQuantity: number;
  initialEntryPrice: number;
  weightedAverageEntryPrice: number;
  exitPrice?: number;
  durationFormatted: string;
  netPnLQuote: number;
  netPnLPercent: number;
  totalFeesPaid: number;
  entryCommissionPaid: number;
  exitCommissionPaid: number;
  closeReason?: string;
  targetAnalytics: {
    isClosedByProtection: boolean;
    t0BreakEvenPrice: number;
    activeProtectionPrice: number;
    initialProtectionPrice: number;
    maxTLevelReached: string | number;
    profitTargetPercent?: number;
    trailingStopPercent?: number;
  };
  recoveryAnalytics: {
    hasRecoveries: boolean;
    recoveryResult?: 'POSITIVE_IMPACT' | 'NEGATIVE_IMPACT' | 'NEUTRAL';
    totalRecoverySpent: number;
    recoveryCapitalRatio: number;
    baseNetPnLQuoteAtInitialStop: number;
    recoveryImprovementDelta: number;
    levels: RecoveryLevelAnalytics[];
    wapHistory: { levelIndex: number; wapBefore: number; wapAfter: number }[];
  };
}

export interface BotPerformanceMetrics {
  botId: string;
  botName: string;
  botType: string;
  symbol: string;
  totalTrades: number;
  closedTradesCount: number;
  openTradesCount: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalInvestedVolume: number;
  totalFeesPaid: number;
  profitFactor: number | null;
  recoveryUtilizationRate: number;
  tradesWithRecoveryCount: number;
  overallNetPnLQuote: number;
  overallNetPnLPercent: number;
}

export interface GlobalAnalyticsSummary {
  totalNetPnLQuote: number;
  totalNetPnLPercent: number;
  globalWinRate: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  totalInvestedVolume: number;
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  totalFeesPaid: number;
  profitFactor: number | null;
  recoverySuccessRate: number;
  totalRecoveryTrades: number;
  totalRecoveryCapitalDeployed: number;
  averageRecoveryLevels: number;
  bestPerformingBot?: {
    botId: string;
    botName: string;
    netPnLQuote: number;
    winRate: number;
  } | null;
  botTypeComparison: {
    RANGE_BOT: { totalPnLQuote: number; winRate: number; tradesCount: number };
    DEAL_BOT: { totalPnLQuote: number; winRate: number; tradesCount: number };
  };
}

export interface RawAnalyticsEvent {
  eventId: string;
  timestamp: number;
  type: string;
  tradeId?: string;
  botId?: string;
  payload: Record<string, any>;
}
