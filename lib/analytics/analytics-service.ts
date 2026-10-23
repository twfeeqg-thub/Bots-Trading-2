// Project Q — Analytics Service: Central Analytics & Evaluation Engine
// Passively ingests real trade facts from TradeManager, BotEngine, and CostData.
// Compiles granular PnL metrics, bot evaluation aggregates, and historical archives.
// Strictly read-only observer: ZERO order executions, ZERO state mutations.

import {
  BotPerformanceMetrics,
  GlobalAnalyticsSummary,
  TradeAnalyticsRecord,
  TradeOutcome,
} from './types';
import { PnLCalculator } from './pnl-calculator';
import { AnalyticsRepository, sharedAnalyticsRepository } from './analytics-repository';
import { TradeManager } from '@/lib/trade-manager/trade-manager';
import { ManagedTrade } from '@/lib/trade-manager/types';
import { sharedMarketDataStore } from '@/lib/market-data';

export type AnalyticsChangeListener = () => void;

export class AnalyticsService {
  private static instance: AnalyticsService | null = null;
  private repository: AnalyticsRepository;
  private tradeManager: TradeManager;
  private listeners: Set<AnalyticsChangeListener> = new Set();
  private isSubscribed: boolean = false;

  private constructor() {
    this.repository = sharedAnalyticsRepository;
    this.tradeManager = TradeManager.getInstance();
    this.initPassiveSubscription();
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Subscribes to TradeManager events passively.
   */
  private initPassiveSubscription(): void {
    if (this.isSubscribed) return;
    this.isSubscribed = true;

    this.tradeManager.subscribe((trades) => {
      this.processTradesUpdate(trades);
    });
  }

  /**
   * Processes trade updates emitted by the TradeManager.
   */
  public processTradesUpdate(trades: ManagedTrade[]): void {
    for (const trade of trades) {
      this.compileTradeAnalytics(trade);
    }
    this.notifyListeners();
  }

  /**
   * Compiles and stores an analytical record for a single trade.
   */
  public compileTradeAnalytics(trade: ManagedTrade): TradeAnalyticsRecord {
    const symbolPrice = sharedMarketDataStore.getRecord(trade.symbol)?.price;
    const currentPrice =
      trade.status === 'CLOSED' && trade.exit?.executionPrice
        ? trade.exit.executionPrice
        : symbolPrice || trade.levelsPlan?.lastEvaluatedPrice || trade.entry.executionPrice || 1;

    const baseAmount = trade.xRecoveryPlan?.baseEntryAmount || trade.requestedAmount || 0;
    const basePrice = trade.xRecoveryPlan?.baseEntryPrice || trade.entry?.executionPrice || 1;
    const baseQty = basePrice > 0 ? baseAmount / basePrice : trade.entry?.filledQuantity || 0;

    // Aggregated position metrics
    let totalInvested = baseAmount || 0;
    let totalQuantity = baseQty || 0;
    let totalEntryFeesPaid = trade.costConfig.entryCostAmount || 0;

    if (trade.xRecoveryPlan?.levels) {
      for (const lvl of trade.xRecoveryPlan.levels) {
        if (lvl.status === 'EXECUTED') {
          const lvlPrice = lvl.fillPrice || lvl.triggerPrice;
          const lvlQty = lvl.filledQty || (lvlPrice > 0 ? lvl.allocationQuote / lvlPrice : 0);
          totalInvested += lvlPrice * lvlQty;
          totalQuantity += lvlQty;
          totalEntryFeesPaid += lvl.feePaid || 0;
        }
      }
    }

    const wap = totalQuantity > 0 ? totalInvested / totalQuantity : basePrice;

    // Actual or estimated exit fee
    const exitRate = trade.costConfig.exitCostRate || 0.001;
    let actualExitFeeQuote: number | undefined;

    if (trade.status === 'CLOSED') {
      if (trade.pnl?.totalFeesQuote !== undefined) {
        actualExitFeeQuote = trade.pnl.totalFeesQuote - (trade.levelsPlan?.entryCommissionQuote || totalEntryFeesPaid);
      }
    }

    const pnlResult = PnLCalculator.calculateNetPnL({
      investedCapital: totalInvested,
      totalQuantity,
      currentOrExitPrice: currentPrice,
      totalEntryFeesQuote: totalEntryFeesPaid,
      exitCommissionRate: exitRate,
      actualExitFeeQuote,
    });

    // Sub-module: Levels Breakdown
    const levelsBreakdown = PnLCalculator.calculateLevelsBreakdown(trade, currentPrice);

    // Sub-module: Recovery Analytics
    const executedRecoveries = trade.xRecoveryPlan?.levels.filter((l) => l.status === 'EXECUTED') || [];
    const highestX = executedRecoveries.reduce((max, l) => Math.max(max, l.levelIndex), 0);
    const recoverySpent = trade.xRecoveryPlan?.totalRecoverySpent || 0;

    const recoveryImpact = PnLCalculator.evaluateRecoveryImpact(
      trade,
      trade.xRecoveryPlan,
      currentPrice,
      pnlResult.netPnLQuote
    );

    // Build WAP progression history
    const wapHistory: Array<{
      levelIndex: number;
      wapBefore: number;
      wapAfter: number;
      price: number;
      quantity: number;
      fee: number;
      timestamp: number;
    }> = [];

    let runningCapital = baseAmount;
    let runningQty = baseQty;

    for (const lvl of executedRecoveries) {
      const fillP = lvl.fillPrice || lvl.triggerPrice;
      const fillQ = lvl.filledQty || lvl.allocationQuote / fillP;
      const wapBefore = runningQty > 0 ? runningCapital / runningQty : basePrice;
      runningCapital += fillP * fillQ;
      runningQty += fillQ;
      const wapAfter = runningQty > 0 ? runningCapital / runningQty : fillP;

      wapHistory.push({
        levelIndex: lvl.levelIndex,
        wapBefore: Number(wapBefore.toFixed(8)),
        wapAfter: Number(wapAfter.toFixed(8)),
        price: fillP,
        quantity: fillQ,
        fee: lvl.feePaid || 0,
        timestamp: lvl.executedAt || Date.now(),
      });
    }

    // Sub-module: Target & Protection Analytics
    const maxTLevelReached = trade.levelsPlan?.currentAchievedLevel || 'NONE';
    const exitPrice = trade.exit?.executionPrice || null;
    const isClosedByProtection =
      trade.status === 'CLOSED' &&
      (trade.closeReason?.includes('الحماية') ||
        trade.closeReason?.includes('Protection') ||
        trade.closeReason?.includes('T0') ||
        trade.closeReason?.includes('رجوع السعر'));

    let exitReasonCategory: 'T_TARGET' | 'TRAILING_PROTECTION' | 'INITIAL_STOP' | 'MANUAL' | 'OTHER' = 'OTHER';
    if (trade.status === 'CLOSED') {
      if (trade.closeReason?.includes('هدف') || trade.closeReason?.includes('Target')) {
        exitReasonCategory = 'T_TARGET';
      } else if (isClosedByProtection) {
        exitReasonCategory = 'TRAILING_PROTECTION';
      } else if (trade.closeReason?.includes('يدوي') || trade.closeReason?.includes('Manual')) {
        exitReasonCategory = 'MANUAL';
      } else if (trade.closeReason?.includes('وقف الخسارة الأولي') || trade.closeReason?.includes('Initial Stop')) {
        exitReasonCategory = 'INITIAL_STOP';
      }
    }

    const durationMs =
      trade.closedAt && trade.openedAt
        ? trade.closedAt - trade.openedAt
        : trade.openedAt
        ? Date.now() - trade.openedAt
        : null;

    const record: TradeAnalyticsRecord = {
      tradeId: trade.tradeId,
      botId: trade.botId,
      botName: `بوت ${trade.symbol} (${trade.botType || 'DEAL_BOT'})`,
      botType: trade.botType || 'DEAL_BOT',
      symbol: trade.symbol,
      source: trade.source,
      status: trade.status,

      createdAt: trade.createdAt,
      openedAt: trade.openedAt || null,
      closedAt: trade.closedAt || null,
      durationMs,
      durationFormatted: PnLCalculator.formatDuration(durationMs),

      initialEntryPrice: basePrice,
      initialAmount: baseAmount,
      initialQuantity: baseQty,
      weightedAverageEntryPrice: Number(wap.toFixed(8)),
      exitPrice,
      currentEvaluatedPrice: currentPrice,

      totalInvested: Number(totalInvested.toFixed(8)),
      totalQuantity: Number(totalQuantity.toFixed(8)),
      totalQuoteRealized: trade.status === 'CLOSED' && exitPrice ? Number((exitPrice * totalQuantity).toFixed(8)) : 0,

      entryCommissionPaid: Number(totalEntryFeesPaid.toFixed(8)),
      exitCommissionPaid: Number(pnlResult.exitFeeQuote.toFixed(8)),
      totalFeesPaid: Number(pnlResult.totalFeesQuote.toFixed(8)),
      effectiveEntryRate: trade.costConfig.entryCostRate || 0.001,
      effectiveExitRate: exitRate,
      costDataSource: trade.costConfig.source,
      isRealConfirmedCost: trade.costConfig.isRealConfirmed,

      grossPnLQuote: pnlResult.grossPnLQuote,
      netPnLQuote: pnlResult.netPnLQuote,
      netPnLPercent: pnlResult.netPnLPercent,
      isProfitable: pnlResult.isProfitable,
      outcome: trade.status === 'OPEN' ? 'OPEN' : pnlResult.outcome,
      closeReason: trade.closeReason || null,

      recoveryAnalytics: {
        hasRecoveries: executedRecoveries.length > 0,
        executedLevelsCount: executedRecoveries.length,
        highestXLevelReached: highestX,
        totalRecoverySpent: Number(recoverySpent.toFixed(8)),
        totalRecoveryQty: trade.xRecoveryPlan?.totalRecoveryQty || 0,
        recoveryCapitalRatio: totalInvested > 0 ? Number(((recoverySpent / totalInvested) * 100).toFixed(2)) : 0,
        transitionsCount: executedRecoveries.length,
        stepPercent: trade.xRecoveryPlan?.stepPercent || 0,
        recoveryRatio: trade.xRecoveryPlan?.recoveryRatio || 0,
        customAllocationQuote: trade.xRecoveryPlan?.customAllocationQuote,
        maxLevelsCeiling: trade.xRecoveryPlan?.maxLevels,
        wapHistory,
        levels: levelsBreakdown,
        baseInvestedQuote: baseAmount,
        baseNetPnLQuoteAtInitialStop: recoveryImpact.baseNetPnLAtStop,
        pnlWithRecoveryQuote: pnlResult.netPnLQuote,
        recoveryImprovementDelta: recoveryImpact.improvementDelta,
        recoveryResult: recoveryImpact.verdict,
      },

      targetAnalytics: {
        stepPercent: trade.levelsPlan?.stepPercent || 0,
        t0BreakEvenPrice: trade.levelsPlan?.t0BreakEvenPrice || wap,
        initialProtectionPrice: trade.levelsPlan?.initialProtectionPrice || basePrice * 0.98,
        activeProtectionPrice: trade.levelsPlan?.activeProtectionPrice || basePrice * 0.98,
        highestPriceObserved: trade.levelsPlan?.highestPriceObserved || currentPrice,
        maxTLevelReached,
        closedAtLevel: trade.status === 'CLOSED' ? maxTLevelReached : 'NONE',
        isClosedByProtection: isClosedByProtection || false,
        closedProtectionFloor: trade.levelsPlan?.activeProtectionPrice || null,
        entryToExitDelta: exitPrice ? Number((exitPrice - basePrice).toFixed(8)) : 0,
        entryToExitDeltaPercent: exitPrice ? Number((((exitPrice - basePrice) / basePrice) * 100).toFixed(4)) : 0,
        exitReasonCategory,
      },
    };

    this.repository.saveTradeRecord(record);

    // Also log immutable atomic facts
    if (trade.status === 'CLOSED') {
      this.repository.logEvent({
        tradeId: trade.tradeId,
        botId: trade.botId,
        timestamp: trade.closedAt || Date.now(),
        type: 'TRADE_CLOSED',
        payload: {
          exitPrice,
          netPnLQuote: record.netPnLQuote,
          netPnLPercent: record.netPnLPercent,
          outcome: record.outcome,
          closeReason: record.closeReason,
        },
      });
    }

    return record;
  }

  /**
   * Aggregates performance metrics for a specific bot.
   */
  public getBotPerformance(botId: string): BotPerformanceMetrics | null {
    const trades = this.repository.queryTradeRecords({ botId });
    if (trades.length === 0) return null;

    const closedTrades = trades.filter((t) => t.status === 'CLOSED');
    const openTrades = trades.filter((t) => t.status === 'OPEN');

    const winning = closedTrades.filter((t) => t.outcome === 'WIN');
    const losing = closedTrades.filter((t) => t.outcome === 'LOSS');
    const breakeven = closedTrades.filter((t) => t.outcome === 'BREAKEVEN');

    const totalClosed = closedTrades.length;
    const winRate = totalClosed > 0 ? (winning.length / totalClosed) * 100 : 0;
    const lossRate = totalClosed > 0 ? (losing.length / totalClosed) * 100 : 0;
    const breakevenRate = totalClosed > 0 ? (breakeven.length / totalClosed) * 100 : 0;

    let totalInvestedVolume = 0;
    let totalFeesPaid = 0;
    let grossProfitQuote = 0;
    let grossLossQuote = 0;
    let netProfitQuote = 0;
    let netLossQuote = 0;
    let overallNetPnLQuote = 0;

    let maxWinQuote = 0;
    let maxLossQuote = 0;
    let totalDurationMs = 0;
    let longestDurationMs = 0;
    let shortestDurationMs = Number.MAX_SAFE_INTEGER;

    // Recovery aggregates
    let tradesWithRecovery = 0;
    let totalRecoverySpent = 0;
    let maxRecoveryLevelsInTrade = 0;
    let recoveryPositiveImpactCount = 0;
    let recoveredTradesWinsOrBreakeven = 0;

    // Target exits aggregates
    let closedByTargetCount = 0;
    let closedByProtectionCount = 0;
    const tDist: Record<string, number> = {};

    for (const t of closedTrades) {
      totalInvestedVolume += t.totalInvested;
      totalFeesPaid += t.totalFeesPaid;
      overallNetPnLQuote += t.netPnLQuote;

      if (t.netPnLQuote > 0) {
        netProfitQuote += t.netPnLQuote;
        grossProfitQuote += t.grossPnLQuote;
        if (t.netPnLQuote > maxWinQuote) maxWinQuote = t.netPnLQuote;
      } else {
        netLossQuote += t.netPnLQuote;
        grossLossQuote += t.grossPnLQuote;
        if (t.netPnLQuote < maxLossQuote) maxLossQuote = t.netPnLQuote;
      }

      if (t.durationMs !== null) {
        totalDurationMs += t.durationMs;
        if (t.durationMs > longestDurationMs) longestDurationMs = t.durationMs;
        if (t.durationMs < shortestDurationMs) shortestDurationMs = t.durationMs;
      }

      if (t.recoveryAnalytics.hasRecoveries) {
        tradesWithRecovery++;
        totalRecoverySpent += t.recoveryAnalytics.totalRecoverySpent;
        if (t.recoveryAnalytics.executedLevelsCount > maxRecoveryLevelsInTrade) {
          maxRecoveryLevelsInTrade = t.recoveryAnalytics.executedLevelsCount;
        }
        if (t.recoveryAnalytics.recoveryResult === 'POSITIVE_IMPACT') {
          recoveryPositiveImpactCount++;
        }
        // Locked Definition: Recovery Success = trade used Recovery and ended with Net PnL > 0 (WIN only)
        if (t.netPnLQuote > 0) {
          recoveredTradesWinsOrBreakeven++;
        }
      }

      if (t.targetAnalytics.exitReasonCategory === 'T_TARGET') {
        closedByTargetCount++;
      } else if (t.targetAnalytics.exitReasonCategory === 'TRAILING_PROTECTION') {
        closedByProtectionCount++;
      }

      const lvl = t.targetAnalytics.maxTLevelReached;
      tDist[lvl] = (tDist[lvl] || 0) + 1;
    }

    const first = trades[0];
    const avgWinQuote = winning.length > 0 ? netProfitQuote / winning.length : 0;
    const avgLossQuote = losing.length > 0 ? netLossQuote / losing.length : 0;
    const avgPnLQuote = totalClosed > 0 ? overallNetPnLQuote / totalClosed : 0;

    // Locked Definition: Profit Factor = Net Profit of winning trades ÷ abs(Net Loss of losing trades)
    // When no losses: null (Undefined / Infinity) without arbitrary numbers like 999.
    const absNetLoss = Math.abs(netLossQuote);
    const profitFactor: number | null =
      absNetLoss > 0
        ? Number((netProfitQuote / absNetLoss).toFixed(2))
        : netProfitQuote > 0
        ? null
        : 0;

    return {
      botId,
      botName: first.botName,
      botType: first.botType,
      symbol: first.symbol,
      status: openTrades.length > 0 ? 'POSITION_OPEN' : 'IDLE',

      totalTrades: trades.length,
      openTradesCount: openTrades.length,
      closedTradesCount: totalClosed,
      winningTradesCount: winning.length,
      losingTradesCount: losing.length,
      breakevenTradesCount: breakeven.length,

      winRate: Number(winRate.toFixed(2)),
      lossRate: Number(lossRate.toFixed(2)),
      breakevenRate: Number(breakevenRate.toFixed(2)),

      totalInvestedVolume: Number(totalInvestedVolume.toFixed(8)),
      totalFeesPaid: Number(totalFeesPaid.toFixed(8)),
      grossProfitQuote: Number(grossProfitQuote.toFixed(8)),
      grossLossQuote: Number(grossLossQuote.toFixed(8)),
      netProfitQuote: Number(netProfitQuote.toFixed(8)),
      netLossQuote: Number(netLossQuote.toFixed(8)),
      overallNetPnLQuote: Number(overallNetPnLQuote.toFixed(8)),
      overallNetPnLPercent: totalInvestedVolume > 0 ? Number(((overallNetPnLQuote / totalInvestedVolume) * 100).toFixed(4)) : 0,
      profitFactor: profitFactor !== null ? Number(profitFactor.toFixed(2)) : null,

      averagePnLQuote: Number(avgPnLQuote.toFixed(8)),
      averagePnLPercent: totalInvestedVolume > 0 ? Number(((overallNetPnLQuote / totalInvestedVolume) * 100).toFixed(4)) : 0,
      averageWinQuote: Number(avgWinQuote.toFixed(8)),
      averageLossQuote: Number(avgLossQuote.toFixed(8)),
      maxWinQuote: Number(maxWinQuote.toFixed(8)),
      maxLossQuote: Number(maxLossQuote.toFixed(8)),

      averageDurationMs: totalClosed > 0 ? Math.round(totalDurationMs / totalClosed) : 0,
      longestDurationMs,
      shortestDurationMs: shortestDurationMs === Number.MAX_SAFE_INTEGER ? 0 : shortestDurationMs,

      tradesWithRecoveryCount: tradesWithRecovery,
      recoveryUtilizationRate: totalClosed > 0 ? Number(((tradesWithRecovery / totalClosed) * 100).toFixed(2)) : 0,
      totalRecoverySpent: Number(totalRecoverySpent.toFixed(8)),
      maxRecoveryLevelsInSingleTrade: maxRecoveryLevelsInTrade,
      averageRecoveryLevelsPerTrade: totalClosed > 0 ? Number((tradesWithRecovery / totalClosed).toFixed(2)) : 0,
      recoveryPositiveImpactCount,
      recoverySuccessRate: tradesWithRecovery > 0 ? Number(((recoveredTradesWinsOrBreakeven / tradesWithRecovery) * 100).toFixed(2)) : 0,

      closedByTargetCount,
      closedByProtectionCount,
      targetExitRate: totalClosed > 0 ? Number(((closedByTargetCount / totalClosed) * 100).toFixed(2)) : 0,
      protectionExitRate: totalClosed > 0 ? Number(((closedByProtectionCount / totalClosed) * 100).toFixed(2)) : 0,
      tLevelsAchievedDistribution: tDist,
    };
  }

  /**
   * Generates global analytical aggregates and cross-bot comparisons.
   */
  public getGlobalSummary(): GlobalAnalyticsSummary {
    const allRecords = this.repository.listTradeRecords();
    const closed = allRecords.filter((t) => t.status === 'CLOSED');
    const open = allRecords.filter((t) => t.status === 'OPEN');

    const winning = closed.filter((t) => t.outcome === 'WIN');
    const losing = closed.filter((t) => t.outcome === 'LOSS');
    const breakeven = closed.filter((t) => t.outcome === 'BREAKEVEN');

    const totalClosed = closed.length;
    const globalWinRate = totalClosed > 0 ? (winning.length / totalClosed) * 100 : 0;
    const globalLossRate = totalClosed > 0 ? (losing.length / totalClosed) * 100 : 0;

    let totalVolume = 0;
    let totalFees = 0;
    let totalNetQuote = 0;
    let netGains = 0;
    let netLosses = 0;

    let bestTrade: { tradeId: string; symbol: string; netPnLQuote: number } | null = null;
    let worstTrade: { tradeId: string; symbol: string; netPnLQuote: number } | null = null;

    let recoveryTradesCount = 0;
    let recoveryTotalSpent = 0;
    let recoverySuccessCount = 0;

    let closedByTarget = 0;
    let closedByProtection = 0;

    // Grouping structures
    const botIds = new Set<string>();
    const botPnL: Record<string, { name: string; netQuote: number; wins: number; total: number }> = {};
    const typeGroup: Record<
      'RANGE_BOT' | 'DEAL_BOT',
      { count: number; totalPnL: number; wins: number; invested: number }
    > = {
      RANGE_BOT: { count: 0, totalPnL: 0, wins: 0, invested: 0 },
      DEAL_BOT: { count: 0, totalPnL: 0, wins: 0, invested: 0 },
    };
    const symbolGroup: Record<string, { count: number; netQuote: number; wins: number }> = {};

    for (const t of closed) {
      totalVolume += t.totalInvested;
      totalFees += t.totalFeesPaid;
      totalNetQuote += t.netPnLQuote;

      if (t.netPnLQuote > 0) netGains += t.netPnLQuote;
      else if (t.netPnLQuote < 0) netLosses += t.netPnLQuote;

      if (!bestTrade || t.netPnLQuote > bestTrade.netPnLQuote) {
        bestTrade = { tradeId: t.tradeId, symbol: t.symbol, netPnLQuote: t.netPnLQuote };
      }
      if (!worstTrade || t.netPnLQuote < worstTrade.netPnLQuote) {
        worstTrade = { tradeId: t.tradeId, symbol: t.symbol, netPnLQuote: t.netPnLQuote };
      }

      if (t.recoveryAnalytics.hasRecoveries) {
        recoveryTradesCount++;
        recoveryTotalSpent += t.recoveryAnalytics.totalRecoverySpent;
        // Locked Definition: Recovery Success = used Recovery and ended with Net PnL > 0 (WIN only)
        if (t.netPnLQuote > 0) recoverySuccessCount++;
      }

      if (t.targetAnalytics.exitReasonCategory === 'T_TARGET') closedByTarget++;
      else if (t.targetAnalytics.exitReasonCategory === 'TRAILING_PROTECTION') closedByProtection++;

      botIds.add(t.botId);
      if (!botPnL[t.botId]) {
        botPnL[t.botId] = { name: t.botName, netQuote: 0, wins: 0, total: 0 };
      }
      botPnL[t.botId].netQuote += t.netPnLQuote;
      botPnL[t.botId].total++;
      if (t.outcome === 'WIN') botPnL[t.botId].wins++;

      const bType = t.botType === 'RANGE_BOT' ? 'RANGE_BOT' : 'DEAL_BOT';
      typeGroup[bType].count++;
      typeGroup[bType].totalPnL += t.netPnLQuote;
      typeGroup[bType].invested += t.totalInvested;
      if (t.outcome === 'WIN') typeGroup[bType].wins++;

      if (!symbolGroup[t.symbol]) {
        symbolGroup[t.symbol] = { count: 0, netQuote: 0, wins: 0 };
      }
      symbolGroup[t.symbol].count++;
      symbolGroup[t.symbol].netQuote += t.netPnLQuote;
      if (t.outcome === 'WIN') symbolGroup[t.symbol].wins++;
    }

    // Determine Best Performing Bot
    let bestBot: { botId: string; botName: string; netPnLQuote: number; winRate: number } | null = null;
    let mostActiveBot: { botId: string; botName: string; tradesCount: number } | null = null;

    for (const [id, data] of Object.entries(botPnL)) {
      const bWinRate = data.total > 0 ? (data.wins / data.total) * 100 : 0;
      if (!bestBot || data.netQuote > bestBot.netPnLQuote) {
        bestBot = { botId: id, botName: data.name, netPnLQuote: Number(data.netQuote.toFixed(8)), winRate: Number(bWinRate.toFixed(2)) };
      }
      if (!mostActiveBot || data.total > mostActiveBot.tradesCount) {
        mostActiveBot = { botId: id, botName: data.name, tradesCount: data.total };
      }
    }

    // Locked Definition: Profit Factor = Net Profit of winning trades ÷ abs(Net Loss of losing trades)
    // When no losses: null (Undefined / Infinity) without arbitrary numbers like 999.
    const absNetLosses = Math.abs(netLosses);
    const pf: number | null =
      absNetLosses > 0
        ? Number((netGains / absNetLosses).toFixed(2))
        : netGains > 0
        ? null
        : 0;

    return {
      totalBots: Math.max(botIds.size, 1),
      totalTrades: allRecords.length,
      openTrades: open.length,
      closedTrades: totalClosed,
      winningTrades: winning.length,
      losingTrades: losing.length,
      breakevenTrades: breakeven.length,
      globalWinRate: Number(globalWinRate.toFixed(2)),
      globalLossRate: Number(globalLossRate.toFixed(2)),

      totalInvestedVolume: Number(totalVolume.toFixed(8)),
      totalFeesPaid: Number(totalFees.toFixed(8)),
      totalNetPnLQuote: Number(totalNetQuote.toFixed(8)),
      totalNetPnLPercent: totalVolume > 0 ? Number(((totalNetQuote / totalVolume) * 100).toFixed(4)) : 0,
      profitFactor: pf !== null ? Number(pf.toFixed(2)) : null,

      averageTradePnLQuote: totalClosed > 0 ? Number((totalNetQuote / totalClosed).toFixed(8)) : 0,
      largestWinningTrade: bestTrade,
      largestLosingTrade: worstTrade,

      totalRecoveryTrades: recoveryTradesCount,
      recoveryUtilizationRate: totalClosed > 0 ? Number(((recoveryTradesCount / totalClosed) * 100).toFixed(2)) : 0,
      averageRecoveryLevels: totalClosed > 0 ? Number((recoveryTradesCount / totalClosed).toFixed(2)) : 0,
      totalRecoveryCapitalDeployed: Number(recoveryTotalSpent.toFixed(8)),
      recoverySuccessRate: recoveryTradesCount > 0 ? Number(((recoverySuccessCount / recoveryTradesCount) * 100).toFixed(2)) : 0,

      closedByTargetRate: totalClosed > 0 ? Number(((closedByTarget / totalClosed) * 100).toFixed(2)) : 0,
      closedByProtectionRate: totalClosed > 0 ? Number(((closedByProtection / totalClosed) * 100).toFixed(2)) : 0,

      bestPerformingBot: bestBot,
      mostActiveBot,

      botTypeComparison: {
        RANGE_BOT: {
          count: typeGroup.RANGE_BOT.count,
          totalPnLQuote: Number(typeGroup.RANGE_BOT.totalPnL.toFixed(8)),
          winRate: typeGroup.RANGE_BOT.count > 0 ? Number(((typeGroup.RANGE_BOT.wins / typeGroup.RANGE_BOT.count) * 100).toFixed(2)) : 0,
          avgPnLQuote: typeGroup.RANGE_BOT.count > 0 ? Number((typeGroup.RANGE_BOT.totalPnL / typeGroup.RANGE_BOT.count).toFixed(8)) : 0,
        },
        DEAL_BOT: {
          count: typeGroup.DEAL_BOT.count,
          totalPnLQuote: Number(typeGroup.DEAL_BOT.totalPnL.toFixed(8)),
          winRate: typeGroup.DEAL_BOT.count > 0 ? Number(((typeGroup.DEAL_BOT.wins / typeGroup.DEAL_BOT.count) * 100).toFixed(2)) : 0,
          avgPnLQuote: typeGroup.DEAL_BOT.count > 0 ? Number((typeGroup.DEAL_BOT.totalPnL / typeGroup.DEAL_BOT.count).toFixed(8)) : 0,
        },
      },

      symbolPerformance: Object.entries(symbolGroup).reduce((acc, [sym, s]) => {
        acc[sym] = {
          tradesCount: s.count,
          netPnLQuote: Number(s.netQuote.toFixed(8)),
          winRate: s.count > 0 ? Number(((s.wins / s.count) * 100).toFixed(2)) : 0,
        };
        return acc;
      }, {} as Record<string, { tradesCount: number; netPnLQuote: number; winRate: number }>),
    };
  }

  public subscribe(listener: AnalyticsChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch {
        // ignore errors
      }
    });
  }
}

export const sharedAnalyticsService = AnalyticsService.getInstance();
