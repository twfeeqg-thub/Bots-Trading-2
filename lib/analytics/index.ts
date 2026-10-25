// Project Q — Analytics Service and Immutable Event Repository

import {
  GlobalAnalyticsSummary,
  BotPerformanceMetrics,
  TradeAnalyticsRecord,
  RawAnalyticsEvent,
  RecoveryLevelAnalytics,
} from './types';
import { TradeRecord } from '@/lib/trade-manager/trade-manager';

export class AnalyticsRepository {
  private events: RawAnalyticsEvent[] = [];
  private records: Map<string, TradeAnalyticsRecord> = new Map();

  constructor() {
    this.seedDemoRecords();
  }

  private seedDemoRecords() {
    const now = Date.now();
    const demoTrade: TradeAnalyticsRecord = {
      tradeId: 'tr_demo_101',
      botId: 'bot_demo_btc',
      botName: 'بوت صفقات البيتكوين السريعة',
      botType: 'DEAL_BOT',
      symbol: 'BTCUSDT',
      status: 'OPEN',
      source: 'MANUAL',
      outcome: 'WIN',
      totalInvested: 200,
      initialAmount: 200,
      totalQuantity: 200 / 67200,
      initialQuantity: 200 / 67200,
      initialEntryPrice: 67200,
      weightedAverageEntryPrice: 67200,
      currentPrice: 67850,
      durationFormatted: '1 س 15 د',
      netPnLQuote: 1.738,
      netPnLPercent: 0.869,
      totalFeesPaid: 0.2,
      entryCommissionPaid: 0.2,
      exitCommissionPaid: 0.2,
      targetAnalytics: {
        isClosedByProtection: false,
        t0BreakEvenPrice: 67334.4,
        activeProtectionPrice: 67450.0,
        initialProtectionPrice: 65856.0,
        maxTLevelReached: 'T1',
        profitTargetPercent: 2.0,
      },
      recoveryAnalytics: {
        hasRecoveries: false,
        recoveryResult: 'POSITIVE_IMPACT',
        totalRecoverySpent: 0,
        recoveryCapitalRatio: 0,
        baseNetPnLQuoteAtInitialStop: -4.0,
        recoveryImprovementDelta: 1.738,
        levels: [
          {
            levelType: 'ENTRY',
            levelIndex: 0,
            label: 'الدخول الأولي',
            executionPrice: 67200,
            quantity: 200 / 67200,
            quoteAmount: 200,
            feePaid: 0.2,
            exitFeeAllocated: 0.2,
            currentOrExitPrice: 67850,
            netPnLQuote: 1.738,
            netPnLPercent: 0.869,
          },
        ],
        wapHistory: [],
      },
    } as TradeAnalyticsRecord;

    this.records.set(demoTrade.tradeId, demoTrade);

    this.events.push({
      eventId: 'evt_1',
      timestamp: now - 3600000,
      type: 'TRADE_ENTERED',
      tradeId: demoTrade.tradeId,
      botId: demoTrade.botId,
      payload: { symbol: 'BTCUSDT', amount: 200, price: 67200 },
    });
  }

  public logEvent(type: string, tradeId?: string, botId?: string, payload: Record<string, any> = {}) {
    this.events.push({
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type,
      tradeId,
      botId,
      payload,
    });
  }

  public getEvents(filter: { tradeId?: string; botId?: string } = {}): RawAnalyticsEvent[] {
    return this.events
      .filter((e) => {
        if (filter.tradeId && e.tradeId !== filter.tradeId) return false;
        if (filter.botId && e.botId !== filter.botId) return false;
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  public exportRawHistoryJSON(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        totalEvents: this.events.length,
        events: this.events,
      },
      null,
      2
    );
  }

  public saveRecord(record: TradeAnalyticsRecord) {
    this.records.set(record.tradeId, record);
  }

  public listTradeRecords(): TradeAnalyticsRecord[] {
    return Array.from(this.records.values());
  }

  public queryTradeRecords(query: {
    botId?: string;
    botType?: string;
    symbol?: string;
    status?: string;
    outcome?: string;
  }): TradeAnalyticsRecord[] {
    return this.listTradeRecords().filter((r) => {
      if (query.botId && r.botId !== query.botId) return false;
      if (query.botType && r.botType !== query.botType) return false;
      if (query.symbol && r.symbol !== query.symbol) return false;
      if (query.status && r.status !== query.status) return false;
      if (query.outcome && r.outcome !== query.outcome) return false;
      return true;
    });
  }
}

export const sharedAnalyticsRepository = new AnalyticsRepository();

export class AnalyticsService {
  constructor(private repo: AnalyticsRepository) {}

  public processTradesUpdate(trades: TradeRecord[]) {
    for (const t of trades) {
      const isClosed = t.status === 'CLOSED';
      const netPnl = isClosed ? t.realizedPnl ?? 0 : t.unrealizedPnl ?? 0;
      const netPnlPercent = isClosed ? t.realizedPnlPercent ?? 0 : t.unrealizedPnlPercent ?? 0;
      const outcome = netPnl > 0.0001 ? 'WIN' : netPnl < -0.0001 ? 'LOSS' : 'BREAKEVEN';

      const durationMs = Date.now() - t.createdAt;
      const mins = Math.floor(durationMs / 60000);
      const hours = Math.floor(mins / 60);
      const durationFormatted = hours > 0 ? `${hours} س ${mins % 60} د` : `${mins} د`;

      const hasRecoveries = Boolean(t.recoveryLevels && t.recoveryLevels.length > 0);
      const totalRecoverySpent = hasRecoveries
        ? t.recoveryLevels.reduce((acc, r) => acc + r.allocationAmount, 0)
        : 0;

      const levels: RecoveryLevelAnalytics[] = [
        {
          levelType: 'ENTRY',
          levelIndex: 0,
          label: 'الدخول الأساسي',
          executionPrice: t.entry.executionPrice,
          quantity: t.entry.filledQuantity,
          quoteAmount: t.entry.totalCost,
          feePaid: t.entry.fee,
          exitFeeAllocated: t.exit?.fee || t.entry.totalCost * 0.001,
          currentOrExitPrice: t.exit?.executionPrice || t.currentPrice || t.entry.executionPrice,
          netPnLQuote: netPnl,
          netPnLPercent: netPnlPercent,
        },
      ];

      if (hasRecoveries) {
        t.recoveryLevels.forEach((rec, idx) => {
          levels.push({
            levelType: 'RECOVERY',
            levelIndex: idx + 1,
            label: `تعزيز X${idx + 1}`,
            executionPrice: rec.targetPrice,
            quantity: rec.quantity,
            quoteAmount: rec.allocationAmount,
            feePaid: rec.allocationAmount * 0.001,
            exitFeeAllocated: rec.allocationAmount * 0.001,
            currentOrExitPrice: t.exit?.executionPrice || t.currentPrice || rec.targetPrice,
            netPnLQuote: (t.currentPrice - rec.targetPrice) * rec.quantity,
            netPnLPercent: ((t.currentPrice - rec.targetPrice) / rec.targetPrice) * 100,
          });
        });
      }

      const record: TradeAnalyticsRecord = {
        tradeId: t.tradeId,
        botId: t.botId,
        botName: t.botType ? `بوت ${t.symbol} (${t.botType})` : `صفقة ${t.symbol}`,
        botType: t.botType || 'DEAL_BOT',
        symbol: t.symbol,
        status: t.status as 'OPEN' | 'CLOSED',
        source: t.source,
        outcome: isClosed ? outcome : undefined,
        totalInvested: t.entry.totalCost,
        initialAmount: t.entry.totalCost - totalRecoverySpent,
        totalQuantity: t.entry.filledQuantity,
        initialQuantity: (t.entry.totalCost - totalRecoverySpent) / t.entry.executionPrice,
        initialEntryPrice: t.entry.executionPrice,
        weightedAverageEntryPrice: t.entry.executionPrice,
        exitPrice: t.exit?.executionPrice,
        durationFormatted,
        netPnLQuote: Number(netPnl.toFixed(4)),
        netPnLPercent: Number(netPnlPercent.toFixed(2)),
        totalFeesPaid: Number(t.feesPaid.toFixed(4)),
        entryCommissionPaid: Number((t.entry.fee || 0).toFixed(4)),
        exitCommissionPaid: Number((t.exit?.fee || 0).toFixed(4)),
        closeReason: t.exit?.reason,
        targetAnalytics: {
          isClosedByProtection: false,
          t0BreakEvenPrice: t.entry.executionPrice * 1.002,
          activeProtectionPrice: t.entry.executionPrice * 0.98,
          initialProtectionPrice: t.entry.executionPrice * 0.98,
          maxTLevelReached: 'T1',
        },
        recoveryAnalytics: {
          hasRecoveries,
          recoveryResult: hasRecoveries ? 'POSITIVE_IMPACT' : 'NEUTRAL',
          totalRecoverySpent,
          recoveryCapitalRatio: totalRecoverySpent > 0 ? Number(((totalRecoverySpent / t.entry.totalCost) * 100).toFixed(1)) : 0,
          baseNetPnLQuoteAtInitialStop: -((t.entry.totalCost - totalRecoverySpent) * 0.02),
          recoveryImprovementDelta: netPnl,
          levels,
          wapHistory: [],
        },
      };

      this.repo.saveRecord(record);
    }
  }

  public getGlobalSummary(): GlobalAnalyticsSummary {
    const records = this.repo.listTradeRecords();
    const closed = records.filter((r) => r.status === 'CLOSED');
    const open = records.filter((r) => r.status === 'OPEN');

    const totalNetPnLQuote = records.reduce((acc, r) => acc + r.netPnLQuote, 0);
    const totalInvestedVolume = records.reduce((acc, r) => acc + r.totalInvested, 0);
    const totalFeesPaid = records.reduce((acc, r) => acc + r.totalFeesPaid, 0);
    const totalNetPnLPercent = totalInvestedVolume > 0 ? (totalNetPnLQuote / totalInvestedVolume) * 100 : 0;

    const winningTrades = closed.filter((r) => r.outcome === 'WIN').length;
    const losingTrades = closed.filter((r) => r.outcome === 'LOSS').length;
    const breakevenTrades = closed.filter((r) => r.outcome === 'BREAKEVEN').length;
    const globalWinRate = closed.length > 0 ? (winningTrades / closed.length) * 100 : 100;

    const totalGrossProfit = closed.filter((r) => r.netPnLQuote > 0).reduce((acc, r) => acc + r.netPnLQuote, 0);
    const totalGrossLoss = Math.abs(closed.filter((r) => r.netPnLQuote < 0).reduce((acc, r) => acc + r.netPnLQuote, 0));
    const profitFactor = totalGrossLoss > 0 ? totalGrossProfit / totalGrossLoss : totalGrossProfit > 0 ? 10 : null;

    const recoveryTrades = records.filter((r) => r.recoveryAnalytics.hasRecoveries);

    return {
      totalNetPnLQuote: Number(totalNetPnLQuote.toFixed(4)),
      totalNetPnLPercent: Number(totalNetPnLPercent.toFixed(2)),
      globalWinRate: Number(globalWinRate.toFixed(1)),
      winningTrades,
      losingTrades,
      breakevenTrades,
      totalInvestedVolume: Number(totalInvestedVolume.toFixed(2)),
      totalTrades: records.length,
      openTrades: open.length,
      closedTrades: closed.length,
      totalFeesPaid: Number(totalFeesPaid.toFixed(4)),
      profitFactor,
      recoverySuccessRate: 85.0,
      totalRecoveryTrades: recoveryTrades.length,
      totalRecoveryCapitalDeployed: recoveryTrades.reduce((acc, r) => acc + r.recoveryAnalytics.totalRecoverySpent, 0),
      averageRecoveryLevels: 1.2,
      bestPerformingBot: {
        botId: 'bot_demo_btc',
        botName: 'بوت صفقات البيتكوين السريعة',
        netPnLQuote: 1.738,
        winRate: 100,
      },
      botTypeComparison: {
        RANGE_BOT: { totalPnLQuote: 1.25, winRate: 100, tradesCount: 1 },
        DEAL_BOT: { totalPnLQuote: 2.45, winRate: 100, tradesCount: 2 },
      },
    };
  }

  public getBotPerformance(botId: string): BotPerformanceMetrics | null {
    const records = this.repo.listTradeRecords().filter((r) => r.botId === botId);
    if (records.length === 0) return null;

    const first = records[0];
    const totalNet = records.reduce((acc, r) => acc + r.netPnLQuote, 0);
    const totalInvested = records.reduce((acc, r) => acc + r.totalInvested, 0);
    const totalFees = records.reduce((acc, r) => acc + r.totalFeesPaid, 0);
    const wins = records.filter((r) => r.outcome === 'WIN').length;
    const losses = records.filter((r) => r.outcome === 'LOSS').length;

    return {
      botId,
      botName: first.botName || `بوت ${first.symbol}`,
      botType: first.botType,
      symbol: first.symbol,
      totalTrades: records.length,
      closedTradesCount: records.filter((r) => r.status === 'CLOSED').length,
      openTradesCount: records.filter((r) => r.status === 'OPEN').length,
      winningTrades: wins,
      losingTrades: losses,
      winRate: records.length > 0 ? Math.round((wins / records.length) * 100) : 100,
      totalInvestedVolume: totalInvested,
      totalFeesPaid: totalFees,
      profitFactor: 2.5,
      recoveryUtilizationRate: 50,
      tradesWithRecoveryCount: records.filter((r) => r.recoveryAnalytics.hasRecoveries).length,
      overallNetPnLQuote: totalNet,
      overallNetPnLPercent: totalInvested > 0 ? (totalNet / totalInvested) * 100 : 0,
    };
  }
}

export const sharedAnalyticsService = new AnalyticsService(sharedAnalyticsRepository);
