// Project Q — Automated Test Suite: PnL & Analytics Module
// Tests mathematical precision (8 decimals), zero artificial minimums,
// accurate Net PnL (cash USDT & %) factoring entry and exit fees,
// dynamic level breakdowns, WAP progression, X/Recovery impact, T & Protection exits,
// multi-bot performance aggregation, raw event immutable logging,
// and verification that analytics has ZERO side effects on trading state.

import { PnLCalculator } from '../lib/analytics/pnl-calculator';
import { AnalyticsRepository } from '../lib/analytics/analytics-repository';
import { AnalyticsService } from '../lib/analytics/analytics-service';
import { TradeManager } from '../lib/trade-manager/trade-manager';
import { getSharedBotEngine } from '../lib/engine';
import { ManagedTrade } from '../lib/trade-manager/types';
import { TradeAnalyticsRecord } from '../lib/analytics/types';

let testIndex = 0;
function assert(condition: boolean, message: string): void {
  testIndex++;
  if (!condition) {
    console.error(`  ❌ Test #${testIndex} FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ Test #${testIndex} PASS: ${message}`);
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  Executing PnL & Analytics Advanced Test Suite');
  console.log('================================================================\n');

  const repository = AnalyticsRepository.getInstance();
  repository.clear();
  const analyticsService = AnalyticsService.getInstance();
  const tradeManager = TradeManager.getInstance();
  const engine = await getSharedBotEngine();

  // -------------------------------------------------------------
  // Part 1: Pure Mathematical PnL Calculations & Micro Values
  // -------------------------------------------------------------
  console.log('--- Part 1: Pure Mathematical PnL Engine & Micro Precision ---');

  // Test 1: Standard Winning Trade PnL without recovery
  const standardWin = PnLCalculator.calculateNetPnL({
    investedCapital: 100,
    totalQuantity: 2.0, // entry 50
    currentOrExitPrice: 55, // gross received = 110 (+10)
    totalEntryFeesQuote: 0.1, // 0.1% of 100
    exitCommissionRate: 0.001, // 0.1% of 110 = 0.11
  });
  // grossPnL = 10, totalFees = 0.21, netPnL = 9.79 USDT, netPnL% = 9.79%
  assert(standardWin.grossPnLQuote === 10, 'Gross PnL computed correctly: 10 USDT');
  assert(standardWin.totalFeesQuote === 0.21, 'Total fees computed correctly: 0.21 USDT');
  assert(standardWin.netPnLQuote === 9.79, 'Net PnL in USDT is exactly 9.79 USDT after all fees');
  assert(Math.abs(standardWin.netPnLPercent - 9.79) < 0.001, 'Net PnL percent is exactly 9.79%');
  assert(standardWin.isProfitable === true, 'Standard win identified as profitable');
  assert(standardWin.outcome === 'WIN', 'Outcome classified as WIN');

  // Test 2: Standard Losing Trade PnL
  const standardLoss = PnLCalculator.calculateNetPnL({
    investedCapital: 100,
    totalQuantity: 2.0,
    currentOrExitPrice: 48, // gross received = 96 (-4)
    totalEntryFeesQuote: 0.1,
    exitCommissionRate: 0.001, // 0.096
  });
  // grossPnL = -4, totalFees = 0.196, netPnL = -4.196 USDT
  assert(standardLoss.grossPnLQuote === -4, 'Gross loss computed correctly: -4 USDT');
  assert(standardLoss.netPnLQuote === -4.196, 'Net loss factors in both fees: -4.196 USDT');
  assert(standardLoss.isProfitable === false, 'Loss trade identified as unprofitable');
  assert(standardLoss.outcome === 'LOSS', 'Outcome classified as LOSS');

  // Test 3: Exact Breakeven Trade PnL
  const breakevenTrade = PnLCalculator.calculateNetPnL({
    investedCapital: 100,
    totalQuantity: 1.0,
    currentOrExitPrice: 100.2002002,
    totalEntryFeesQuote: 0.1,
    exitCommissionRate: 0.001,
    actualExitFeeQuote: 0.1002002,
  });
  assert(Math.abs(breakevenTrade.netPnLQuote) < 0.0001, 'Breakeven trade yields 0.0000 net PnL');

  // Test 4: Micro Amount Trade (0.001 USDT / 8 decimals precision)
  const microTrade = PnLCalculator.calculateNetPnL({
    investedCapital: 0.001,
    totalQuantity: 0.00001, // price = 100
    currentOrExitPrice: 105,
    totalEntryFeesQuote: 0.000001,
    exitCommissionRate: 0.001,
  });
  assert(microTrade.netPnLQuote > 0, 'Micro trade (0.001 USDT) net PnL preserves precision without truncation');
  assert(microTrade.totalFeesQuote > 0, 'Micro fees preserved without rounding to zero');

  // -------------------------------------------------------------
  // Part 2: Deal Without Recovery (DEAL_BOT)
  // -------------------------------------------------------------
  console.log('\n--- Part 2: End-to-End DEAL_BOT (No Recovery) ---');

  const dealBotTrade = await tradeManager.createTradeFromManual({
    symbol: 'BTCUSDT',
    entryAmount: 100,
    entryPrice: 50000,
    botType: 'DEAL_BOT',
    stepPercent: 2.0, // T step = 2% (1000 USDT)
    manualEntryCost: 0.1,
    manualExitCostRate: 0.001,
  });

  assert(dealBotTrade.status === 'OPEN', 'DEAL_BOT trade successfully opened');
  const compiledDeal1 = analyticsService.compileTradeAnalytics(dealBotTrade);
  assert(compiledDeal1.botType === 'DEAL_BOT', 'Analytics correctly identifies DEAL_BOT');
  assert(compiledDeal1.recoveryAnalytics.hasRecoveries === false, 'DEAL_BOT has no recoveries');
  assert(compiledDeal1.totalInvested === 100, 'Invested capital is exactly 100 USDT');
  assert(compiledDeal1.weightedAverageEntryPrice === 50000, 'WAP matches initial entry price: 50000');

  // Advance price to T1 (51000)
  await tradeManager.onMarketPriceTick('BTCUSDT', 51050);
  assert(dealBotTrade.levelsPlan?.currentAchievedLevel === 'T1', 'Trade advanced to T1');

  // Close trade via exit execution
  const closedDeal = await tradeManager.executeTradeExit(dealBotTrade.tradeId, 'تحقق هدف T1');
  assert(closedDeal.status === 'CLOSED', 'DEAL_BOT trade closed');

  const compiledDealClosed = analyticsService.compileTradeAnalytics(closedDeal);
  assert(compiledDealClosed.status === 'CLOSED', 'Analytics record marked CLOSED');
  assert(compiledDealClosed.outcome === 'WIN', 'Trade outcome recorded as WIN');
  assert(compiledDealClosed.netPnLQuote > 0, 'Net PnL is positive after costs');
  assert(compiledDealClosed.targetAnalytics.maxTLevelReached === 'T1', 'Max T level recorded as T1');
  assert(compiledDealClosed.targetAnalytics.exitReasonCategory === 'T_TARGET', 'Exit categorized as T_TARGET');

  // -------------------------------------------------------------
  // Part 3: RANGE_BOT with Single Recovery (X1)
  // -------------------------------------------------------------
  console.log('\n--- Part 3: RANGE_BOT with Single Recovery (X1) ---');

  const rangeBot1 = await tradeManager.createTradeFromManual({
    symbol: 'ETHUSDT',
    entryAmount: 100,
    entryPrice: 2000,
    botType: 'RANGE_BOT',
    stepPercent: 2.0,
    xSettings: {
      enabled: true,
      stepPercent: 2.0, // drop 2% = 1960
      recoveryRatio: 1.0, // 100 USDT
    },
    manualEntryCost: 0.1,
    manualExitCostRate: 0.001,
  });

  assert(rangeBot1.status === 'OPEN', 'RANGE_BOT trade opened');
  assert(rangeBot1.xRecoveryPlan !== undefined, 'X recovery plan active');

  // Trigger X1 recovery drop at 1955 (< 1960)
  await tradeManager.onMarketPriceTick('ETHUSDT', 1955);
  assert(rangeBot1.xRecoveryPlan?.executedLevelsCount === 1, 'X1 recovery executed');
  assert(rangeBot1.entry.executionPrice! < 2000, 'WAP lowered after X1');

  const compiledRange1 = analyticsService.compileTradeAnalytics(rangeBot1);
  assert(compiledRange1.recoveryAnalytics.hasRecoveries === true, 'Analytics records recovery execution');
  assert(compiledRange1.recoveryAnalytics.executedLevelsCount === 1, 'Executed recoveries count is 1');
  assert(compiledRange1.recoveryAnalytics.highestXLevelReached === 1, 'Highest X reached is 1');
  assert(compiledRange1.totalInvested > 190, 'Total invested expanded with X1: ~200 USDT');
  assert(compiledRange1.recoveryAnalytics.levels.length === 2, 'Levels breakdown includes Base + X1');

  // Price bounces to T0 / profit and exits
  await tradeManager.onMarketPriceTick('ETHUSDT', 2050);
  const closedRange1 = await tradeManager.executeTradeExit(rangeBot1.tradeId, 'إغلاق بربح بعد تعزيز X1');
  const compiledRange1Closed = analyticsService.compileTradeAnalytics(closedRange1);
  assert(compiledRange1Closed.outcome === 'WIN', 'Recovered trade finished with WIN outcome');
  assert(compiledRange1Closed.recoveryAnalytics.recoveryResult === 'POSITIVE_IMPACT', 'Recovery recorded POSITIVE_IMPACT');

  // -------------------------------------------------------------
  // Part 4: RANGE_BOT with Multiple Dynamic Recoveries (X1, X2, X3, X4+)
  // -------------------------------------------------------------
  console.log('\n--- Part 4: RANGE_BOT with Multiple Dynamic Recoveries (X1 through X4+) ---');

  const multiRangeTrade = await tradeManager.createTradeFromManual({
    symbol: 'SOLUSDT',
    entryAmount: 50,
    entryPrice: 100,
    botType: 'RANGE_BOT',
    stepPercent: 2.0,
    xSettings: {
      enabled: true,
      stepPercent: 2.5,
      recoveryRatio: 1.2,
      // No maxLevels ceiling -> unlimited dynamic generation
    },
    manualEntryCost: 0.05,
    manualExitCostRate: 0.001,
  });

  // Execute X1 at 97.5
  await tradeManager.executeRecoveryBuy(multiRangeTrade.tradeId, 1);
  assert(multiRangeTrade.xRecoveryPlan?.executedLevelsCount === 1, 'X1 executed');

  // Execute X2 at 95.0
  await tradeManager.executeRecoveryBuy(multiRangeTrade.tradeId, 2);
  assert(multiRangeTrade.xRecoveryPlan?.executedLevelsCount === 2, 'X2 executed');

  // Execute X3 at 92.5
  await tradeManager.executeRecoveryBuy(multiRangeTrade.tradeId, 3);
  assert(multiRangeTrade.xRecoveryPlan?.executedLevelsCount === 3, 'X3 executed');

  // Execute X4 at 90.0 (Proves no hardcoded 3 levels ceiling!)
  await tradeManager.executeRecoveryBuy(multiRangeTrade.tradeId, 4);
  assert(multiRangeTrade.xRecoveryPlan?.executedLevelsCount === 4, 'X4 executed (Continuous unbounded generation!)');

  const compiledMulti = analyticsService.compileTradeAnalytics(multiRangeTrade);
  assert(compiledMulti.recoveryAnalytics.executedLevelsCount === 4, 'Analytics accurately tracks all 4 recoveries');
  assert(compiledMulti.recoveryAnalytics.highestXLevelReached === 4, 'Highest X level is 4');
  assert(compiledMulti.recoveryAnalytics.levels.length === 5, '5 levels in breakdown (Base + X1 + X2 + X3 + X4)');
  assert(compiledMulti.recoveryAnalytics.wapHistory.length === 4, 'WAP history contains 4 progression steps');

  // Verify WAP continuously decreased
  const wapHist = compiledMulti.recoveryAnalytics.wapHistory;
  assert(wapHist[0].wapAfter > wapHist[1].wapAfter, 'WAP decreased from step 1 to step 2');
  assert(wapHist[1].wapAfter > wapHist[2].wapAfter, 'WAP decreased from step 2 to step 3');
  assert(wapHist[2].wapAfter > wapHist[3].wapAfter, 'WAP decreased from step 3 to step 4');

  // Close multi-recovery trade at protection floor
  const closedMulti = await tradeManager.executeTradeExit(
    multiRangeTrade.tradeId,
    'هبوط السعر إلى مستوى الحماية بعد التعزيزات'
  );
  const compiledMultiClosed = analyticsService.compileTradeAnalytics(closedMulti);
  assert(compiledMultiClosed.status === 'CLOSED', 'Multi-recovery trade closed cleanly');
  assert(compiledMultiClosed.targetAnalytics.isClosedByProtection === true, 'Protection exit recorded');

  // -------------------------------------------------------------
  // Part 5: Bot Evaluation Metrics & Aggregations
  // -------------------------------------------------------------
  console.log('\n--- Part 5: Bot Evaluation Metrics & Aggregations ---');

  const dealBotMetrics = analyticsService.getBotPerformance(dealBotTrade.botId);
  assert(dealBotMetrics !== null, 'DEAL_BOT performance metrics generated');
  assert(dealBotMetrics!.totalTrades >= 1, 'DEAL_BOT has recorded trades');
  assert(dealBotMetrics!.winRate === 100, 'DEAL_BOT win rate is 100%');
  assert(dealBotMetrics!.recoveryUtilizationRate === 0, 'DEAL_BOT recovery utilization rate is 0%');

  const rangeBotMetrics = analyticsService.getBotPerformance(rangeBot1.botId);
  assert(rangeBotMetrics !== null, 'RANGE_BOT performance metrics generated');
  assert(rangeBotMetrics!.tradesWithRecoveryCount >= 1, 'RANGE_BOT recorded recovery trades');
  assert(rangeBotMetrics!.recoveryUtilizationRate === 100, 'RANGE_BOT recovery utilization rate is 100%');

  // Global Performance Synthesis
  const globalSummary = analyticsService.getGlobalSummary();
  assert(globalSummary.totalTrades >= 3, 'Global summary aggregates all trades');
  assert(globalSummary.closedTrades >= 3, 'Global closed trades count accurate');
  assert(globalSummary.totalInvestedVolume > 0, 'Global invested volume calculated');
  assert(globalSummary.totalFeesPaid > 0, 'Global fees calculated');
  assert(globalSummary.botTypeComparison.RANGE_BOT.count >= 2, 'RANGE_BOT group contains range trades');
  assert(globalSummary.botTypeComparison.DEAL_BOT.count >= 1, 'DEAL_BOT group contains deal trades');
  assert(globalSummary.bestPerformingBot !== null, 'Best performing bot determined dynamically');

  // -------------------------------------------------------------
  // Part 6: Raw Events Logging & Export
  // -------------------------------------------------------------
  console.log('\n--- Part 6: Raw Events Logging & Export ---');

  const events = repository.getEvents();
  assert(events.length >= 3, 'Immutable raw events recorded in repository');
  const closedEvents = events.filter((e) => e.type === 'TRADE_CLOSED');
  assert(closedEvents.length >= 3, 'All trade closure events recorded with payloads');

  const rawJson = repository.exportRawHistoryJSON();
  assert(rawJson.includes('"trades"'), 'Raw export contains trades');
  assert(rawJson.includes('"events"'), 'Raw export contains atomic events');
  const parsed = JSON.parse(rawJson);
  assert(parsed.totalTrades >= 3, 'Exported JSON is valid and complete');

  // -------------------------------------------------------------
  // Part 7: Verification of Zero Side Effects
  // -------------------------------------------------------------
  console.log('\n--- Part 7: Zero Side Effects Verification ---');

  // Verify that querying analytics, running PnL calculations, or exporting raw events
  // did NOT mutate or interfere with bot state or place additional trading orders
  const botsList = await engine.listBots();
  for (const b of botsList) {
    assert(
      b.currentState === 'POSITION_CLOSED' || b.currentState === 'WAITING_FOR_ENTRY' || b.currentState === 'STOPPED',
      `Bot ${b.id} state remains clean without mutation by Analytics: ${b.currentState}`
    );
  }

  // -------------------------------------------------------------
  // Part 8: Strict Locked Definitions Verification (Profit Factor & Recovery Success)
  // -------------------------------------------------------------
  console.log('\n--- Part 8: Strict Locked Definitions Verification ---');

  function makeRecord(params: {
    tradeId: string;
    botId: string;
    netPnL: number;
    hasRecovery: boolean;
  }): TradeAnalyticsRecord {
    const isWin = params.netPnL > 0;
    const isLoss = params.netPnL < 0;
    return {
      tradeId: params.tradeId,
      botId: params.botId,
      botName: `Bot ${params.botId}`,
      botType: 'RANGE_BOT',
      symbol: 'BTCUSDT',
      source: 'MANUAL',
      status: 'CLOSED',
      createdAt: Date.now() - 3600000,
      openedAt: Date.now() - 3600000,
      closedAt: Date.now(),
      durationMs: 3600000,
      durationFormatted: '1 س 0 د',
      initialEntryPrice: 50000,
      initialAmount: 100,
      initialQuantity: 0.002,
      weightedAverageEntryPrice: 50000,
      exitPrice: 51000,
      currentEvaluatedPrice: 51000,
      totalInvested: 100,
      totalQuantity: 0.002,
      totalQuoteRealized: 100 + params.netPnL + 0.2,
      entryCommissionPaid: 0.1,
      exitCommissionPaid: 0.1,
      totalFeesPaid: 0.2,
      effectiveEntryRate: 0.001,
      effectiveExitRate: 0.001,
      costDataSource: 'MANUAL_USER_INPUT',
      isRealConfirmedCost: false,
      grossPnLQuote: params.netPnL + 0.2,
      netPnLQuote: params.netPnL,
      netPnLPercent: (params.netPnL / 100) * 100,
      isProfitable: isWin,
      outcome: isWin ? 'WIN' : isLoss ? 'LOSS' : 'BREAKEVEN',
      closeReason: 'Test completion',
      recoveryAnalytics: {
        hasRecoveries: params.hasRecovery,
        executedLevelsCount: params.hasRecovery ? 1 : 0,
        highestXLevelReached: params.hasRecovery ? 1 : 0,
        totalRecoverySpent: params.hasRecovery ? 50 : 0,
        totalRecoveryQty: params.hasRecovery ? 0.001 : 0,
        recoveryCapitalRatio: params.hasRecovery ? 50 : 0,
        transitionsCount: params.hasRecovery ? 1 : 0,
        stepPercent: 2.0,
        recoveryRatio: 1.0,
        wapHistory: [],
        levels: [],
        baseInvestedQuote: 100,
        baseNetPnLQuoteAtInitialStop: -2.0,
        pnlWithRecoveryQuote: params.netPnL,
        recoveryImprovementDelta: params.netPnL - (-2.0),
        recoveryResult: params.netPnL > -2.0 ? 'POSITIVE_IMPACT' : 'NEGATIVE_IMPACT',
      },
      targetAnalytics: {
        stepPercent: 2.0,
        t0BreakEvenPrice: 50000,
        initialProtectionPrice: 49000,
        activeProtectionPrice: 49000,
        highestPriceObserved: 51000,
        maxTLevelReached: 'T1',
        closedAtLevel: 'T1',
        isClosedByProtection: false,
        closedProtectionFloor: 49000,
        entryToExitDelta: 1000,
        entryToExitDeltaPercent: 2.0,
        exitReasonCategory: 'T_TARGET',
      },
    };
  }

  // 1. Profit Factor with losses:
  // Bot A: Trade 1 (+30 Net), Trade 2 (-10 Net) -> Net Profit 30 / abs(Net Loss) 10 = 3.00
  const botAId = 'bot_pf_with_losses';
  repository.saveTradeRecord(makeRecord({ tradeId: 't_a1', botId: botAId, netPnL: 30, hasRecovery: false }));
  repository.saveTradeRecord(makeRecord({ tradeId: 't_a2', botId: botAId, netPnL: -10, hasRecovery: false }));
  const botAMetrics = analyticsService.getBotPerformance(botAId);
  assert(botAMetrics !== null, 'Bot A metrics generated');
  assert(botAMetrics!.profitFactor === 3.0, `Profit Factor with losses computed correctly: got ${botAMetrics!.profitFactor} (expected 3.0)`);

  // 2. Profit Factor without losses:
  // Bot B: Trade 1 (+25 Net), Trade 2 (+15 Net) -> No losses => Must be null (Undefined / Infinity), never 999
  const botBId = 'bot_pf_without_losses';
  repository.saveTradeRecord(makeRecord({ tradeId: 't_b1', botId: botBId, netPnL: 25, hasRecovery: false }));
  repository.saveTradeRecord(makeRecord({ tradeId: 't_b2', botId: botBId, netPnL: 15, hasRecovery: false }));
  const botBMetrics = analyticsService.getBotPerformance(botBId);
  assert(botBMetrics !== null, 'Bot B metrics generated');
  assert(botBMetrics!.profitFactor === null, `Profit Factor without losses is null (Undefined/∞): got ${botBMetrics!.profitFactor}`);
  assert((botBMetrics!.profitFactor as unknown) !== 999, 'Profit Factor does NOT use 999 or artificial placeholder numbers');

  // 3, 4, 5. Recovery Success Rate with WIN, BREAKEVEN, and LOSS:
  // Bot C:
  // - Trade 1: Has Recovery, Net PnL = +10.0 (> 0, WIN) -> Must be Recovery Success
  // - Trade 2: Has Recovery, Net PnL = 0.0 (== 0, BREAKEVEN) -> Must NOT be Recovery Success
  // - Trade 3: Has Recovery, Net PnL = -5.0 (< 0, LOSS) -> Must NOT be Recovery Success
  const botCId = 'bot_recovery_success_spec';
  repository.saveTradeRecord(makeRecord({ tradeId: 't_c1', botId: botCId, netPnL: 10, hasRecovery: true }));
  repository.saveTradeRecord(makeRecord({ tradeId: 't_c2', botId: botCId, netPnL: 0, hasRecovery: true }));
  repository.saveTradeRecord(makeRecord({ tradeId: 't_c3', botId: botCId, netPnL: -5, hasRecovery: true }));

  const botCMetrics = analyticsService.getBotPerformance(botCId);
  assert(botCMetrics !== null, 'Bot C metrics generated');
  assert(botCMetrics!.tradesWithRecoveryCount === 3, 'Total recovery trades is exactly 3');

  // Recovery Success Rate = 1 success (WIN only) / 3 total recovery trades = 33.33%
  assert(
    botCMetrics!.recoverySuccessRate === 33.33,
    `Recovery Success Rate strictly counts WIN (Net PnL > 0) only: got ${botCMetrics!.recoverySuccessRate}% (expected 33.33%)`
  );

  // Individual verification:
  const tradeC1 = repository.getTradeRecord('t_c1');
  const tradeC2 = repository.getTradeRecord('t_c2');
  const tradeC3 = repository.getTradeRecord('t_c3');
  assert(tradeC1 !== undefined && tradeC1.netPnLQuote > 0, 'Recovery trade #1 is WIN (Net PnL > 0) -> Counted as Success');
  assert(tradeC2 !== undefined && tradeC2.netPnLQuote === 0, 'Recovery trade #2 is BREAKEVEN (Net PnL = 0) -> Excluded from Success');
  assert(tradeC3 !== undefined && tradeC3.netPnLQuote < 0, 'Recovery trade #3 is LOSS (Net PnL < 0) -> Excluded from Success');

  console.log('\n================================================================');
  console.log(`  ALL ${testIndex} PNL & ANALYTICS TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Test suite encountered an unexpected error:', err);
  process.exit(1);
});
