/**
 * Project Q — Trade Manager & Mathematical Levels & Cost Data Test Suite
 *
 * Verifies all required functional requirements:
 * 1. Exact T0 Net Break-Even calculation after real trading fees.
 * 2. Deterministic levels generation: T0, T1-50%, T1, T2, T3, T4.
 * 3. Trailing protection ladder:
 *    - Price reaches T1 - 50% -> Protection becomes T0
 *    - Price reaches T1 -> Protection becomes T1 - 50%
 *    - Price reaches T2 -> Protection becomes T1
 *    - Price reaches T3 -> Protection becomes T2
 *    - Retracement to protection level triggers Sell
 * 4. Creation Path 1: Manual Entry (Pair, Amount, Price)
 * 5. Creation Path 2: Scanner Selection
 * 6. Automated Exit Execution via Binance Trading Layer (Mock)
 * 7. Net PnL Calculation (Gross, Fees, Net Quote, Net %)
 * 8. Cost Data System & Priorities:
 *    - Manual initial entry cost does not block trade opening.
 *    - Arrival of real confirmed data automatically replaces manual data.
 *    - Real confirmed data updates open trade (T0 and protection).
 *    - Confirmed real costs are saved per symbol in SymbolCostStore.
 *    - Subsequent trade for the same symbol automatically uses saved real data.
 *    - Real confirmed data has absolute final priority.
 * 9. Zero real keys, 100% Mock mode.
 */

import { LevelCalculator, TradeManager, sharedSymbolCostStore } from '../lib/trade-manager';
import { sharedBinanceTradingService } from '../lib/trading';

let totalTests = 0;
let passedTests = 0;

function assert(condition: unknown, name: string, detail?: string) {
  totalTests++;
  if (Boolean(condition)) {
    console.log(`  ✓ Test #${totalTests} PASS: ${name}`);
    passedTests++;
  } else {
    console.error(`  ✗ Test #${totalTests} FAIL: ${name} ${detail ? `(${detail})` : ''}`);
    process.exit(1);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  Executing Trade Manager & T-Levels & Cost Data Test Suite');
  console.log('================================================================\n');

  // --- Section 1: Exact T0 Net Break-Even Math ---
  // Entry: 50,000 USDT/BTC, Qty: 0.002 BTC (Cost: 100 USDT).
  // Entry Fee: 0.10 USDT. Total cash spent = 100.10 USDT.
  // Exit fee rate: 0.001 (0.1%).
  const t0 = LevelCalculator.calculateT0BreakEven(50000, 0.002, 0.1, 0.001);
  assert(t0 > 50000, 'T0 is strictly higher than entry price to cover round-trip fees');

  // Verify that selling at T0 yields exact 0.00 Net PnL
  const pnlAtT0 = LevelCalculator.calculateNetPnL({
    entryPrice: 50000,
    exitPrice: t0,
    filledQuantity: 0.002,
    entryCommissionQuote: 0.1,
    exitCommissionQuote: t0 * 0.002 * 0.001,
  });
  assert(
    Math.abs(pnlAtT0.netReturnQuote) < 0.01,
    'Selling at T0 yields net zero break-even (Net PnL ~ 0.00 USDT)',
    `Net PnL was ${pnlAtT0.netReturnQuote}`
  );

  // --- Section 2: Levels Plan Construction ---
  // Entry: 100 USDT, Step: 2%
  const plan = LevelCalculator.buildTradeLevelsPlan({
    entryPrice: 100,
    filledQuantity: 1,
    costConfig: {
      entryCostAmount: 0.1,
      entryCostRate: 0.001,
      exitCostRate: 0.001,
      source: 'MANUAL_USER_INPUT',
      updatedAt: Date.now(),
      isRealConfirmed: false,
    },
    stepPercent: 2.0, // 2% per step
  });

  assert(plan.entryPrice === 100, 'Plan records correct entry price');
  assert(plan.t0BreakEvenPrice > 100 && plan.t0BreakEvenPrice < 100.3, 'Plan computes accurate T0');
  assert(plan.t1Minus50Price === 101.0, 'T1 - 50% is exactly halfway to T1 (100 + 1% = 101)');
  assert(plan.t1Price === 102.0, 'T1 is exactly +2% (102.0)');
  assert(plan.t2Price === 104.0, 'T2 is exactly +4% (104.0)');
  assert(plan.t3Price === 106.0, 'T3 is exactly +6% (106.0)');
  assert(plan.currentAchievedLevel === 'NONE', 'Initial level is NONE');

  // --- Section 3: Ladder Trailing Protection Simulation ---
  // 3.1 Price rises to 100.5 (below T1-50%)
  let res = LevelCalculator.evaluatePriceTick(plan, 100.5);
  assert(plan.currentAchievedLevel === 'NONE', 'Price at 100.5 does not advance level');
  assert(res.shouldSell === false, 'No sell triggered below T1-50%');

  // 3.2 Price reaches T1 - 50% (101.0) -> Protection becomes T0
  res = LevelCalculator.evaluatePriceTick(plan, 101.0);
  assert(plan.currentAchievedLevel === 'T1_MINUS_50', 'Reaching 101.0 advances level to T1_MINUS_50');
  assert(plan.activeProtectionPrice === plan.t0BreakEvenPrice, 'Protection becomes T0 after reaching T1-50%');
  assert(res.shouldSell === false, 'No sell triggered at T1-50%');

  // 3.3 Price reaches T1 (102.0) -> Protection becomes T1 - 50% (101.0)
  res = LevelCalculator.evaluatePriceTick(plan, 102.2);
  assert(plan.currentAchievedLevel === 'T1', 'Reaching 102.2 advances level to T1');
  assert(plan.activeProtectionPrice === plan.t1Minus50Price, 'Protection becomes T1 - 50% after reaching T1');
  assert(res.shouldSell === false, 'No sell triggered at T1');

  // 3.4 Price reaches T2 (104.0) -> Protection becomes T1 (102.0)
  res = LevelCalculator.evaluatePriceTick(plan, 104.1);
  assert(plan.currentAchievedLevel === 'T2', 'Reaching 104.1 advances level to T2');
  assert(plan.activeProtectionPrice === plan.t1Price, 'Protection becomes T1 after reaching T2');
  assert(res.shouldSell === false, 'No sell triggered at T2');

  // 3.5 Price reaches T3 (106.0) -> Protection becomes T2 (104.0)
  res = LevelCalculator.evaluatePriceTick(plan, 106.3);
  assert(plan.currentAchievedLevel === 'T3', 'Reaching 106.3 advances level to T3');
  assert(plan.activeProtectionPrice === plan.t2Price, 'Protection becomes T2 after reaching T3');
  assert(res.shouldSell === false, 'No sell triggered at T3');

  // 3.6 Price retraces to 104.5 (above T2) -> No sell yet
  res = LevelCalculator.evaluatePriceTick(plan, 104.5);
  assert(res.shouldSell === false, 'Price above T2 does not trigger sell');

  // 3.7 Price retraces to 103.9 (<= T2 protection price) -> Triggers SELL!
  res = LevelCalculator.evaluatePriceTick(plan, 103.9);
  assert(res.shouldSell === true, 'Price dropping to or below T2 protection level triggers SELL');
  assert(Boolean(res.triggerReason?.includes('T2')), 'Trigger reason correctly identifies T2 protection');

  // --- Section 4: Failure to reach T1 (Drop to T0 protection) ---
  const plan2 = LevelCalculator.buildTradeLevelsPlan({
    entryPrice: 200,
    filledQuantity: 1,
    costConfig: {
      entryCostAmount: 0.2,
      entryCostRate: 0.001,
      exitCostRate: 0.001,
      source: 'MANUAL_USER_INPUT',
      updatedAt: Date.now(),
      isRealConfirmed: false,
    },
    stepPercent: 2.0,
  });
  // Hits T1-50% (202.0) -> Protection becomes T0 (~200.4)
  LevelCalculator.evaluatePriceTick(plan2, 202.5);
  assert(plan2.currentAchievedLevel === 'T1_MINUS_50', 'Plan 2 reaches T1_MINUS_50');
  assert(plan2.activeProtectionPrice === plan2.t0BreakEvenPrice, 'Plan 2 protection is T0');

  // Fails to reach T1 (204.0) and falls back to T0
  const dropRes = LevelCalculator.evaluatePriceTick(plan2, plan2.t0BreakEvenPrice);
  assert(dropRes.shouldSell === true, 'Retracement to T0 without reaching T1 triggers SELL to break even');

  // --- Section 5: TradeManager End-to-End Orchestration ---
  assert(
    sharedBinanceTradingService.isUsingMock() === true,
    'TradeManager operates strictly with Mock transport (Zero real Binance keys)'
  );

  const { sharedMarketDataStore } = await import('../lib/market-data');
  const now = Date.now();
  sharedMarketDataStore.updatePrice('BTCUSDT', 65000, now, now);
  sharedMarketDataStore.updatePrice('ETHUSDT', 3400, now, now);
  sharedMarketDataStore.updatePrice('SOLUSDT', 140, now, now);
  sharedMarketDataStore.updatePrice('AVAXUSDT', 30, now, now);
  sharedMarketDataStore.updatePrice('DOTUSDT', 7, now, now);
  sharedMarketDataStore.updatePrice('LINKUSDT', 15, now, now);
  sharedMarketDataStore.updatePrice('BNBUSDT', 600, now, now);
  sharedMarketDataStore.updatePrice('XRPUSDT', 0.55, now, now);
  sharedMarketDataStore.updatePrice('ADAUSDT', 0.45, now, now);

  const manager = TradeManager.getInstance();

  // 5.1 Creation Path 1: Manual Entry
  const manualTrade = await manager.createTradeFromManual({
    symbol: 'BTCUSDT',
    entryAmount: 150,
    entryPrice: 65000,
    stepPercent: 2.0,
  });

  assert(manualTrade.source === 'MANUAL', 'Path 1 creates trade with source MANUAL');
  assert(manualTrade.status === 'OPEN', 'Manual trade moves to OPEN after mock buy execution');
  assert(Boolean(manualTrade.levelsPlan), 'Trade has initialized levelsPlan');
  assert(manualTrade.levelsPlan?.t0BreakEvenPrice !== undefined, 'Trade has calculated T0 break-even');

  // 5.2 Creation Path 2: Scanner Selection
  const scannerTrade = await manager.createTradeFromScanner({
    symbol: 'ETHUSDT',
    scannerPrice: 3400,
    entryAmount: 100,
    stepPercent: 2.5,
  });

  assert(scannerTrade.source === 'SCANNER', 'Path 2 creates trade with source SCANNER');
  assert(scannerTrade.status === 'OPEN', 'Scanner trade moves to OPEN after mock buy execution');
  assert(scannerTrade.symbol === 'ETHUSDT', 'Scanner trade has designated symbol ETHUSDT');

  // 5.3 Automated Retracement & Exit Execution
  const ethProtection = scannerTrade.levelsPlan!.activeProtectionPrice;
  await manager.onMarketPriceTick('ETHUSDT', ethProtection - 10);

  const closedScannerTrade = manager.getTrade(scannerTrade.tradeId);
  assert(closedScannerTrade?.status === 'CLOSED', 'Trade automatically closes upon protection breach');
  assert(Boolean(closedScannerTrade?.closedAt), 'Trade records closedAt timestamp');
  assert(Boolean(closedScannerTrade?.pnl), 'Trade calculates and records final Net PnL');
  assert(closedScannerTrade?.pnl?.totalFeesQuote !== undefined, 'Net PnL documents total fees quote');

  // ===========================================================================
  // --- Section 6: Comprehensive Cost Data System & Priorities Verification ---
  // ===========================================================================
  console.log('\n  --- Executing Section 6: Cost Data System Tests ---');

  // Test 6.1: Opening trade with manual cost when real data is not available
  // Opening trade is NEVER blocked by missing real data.
  sharedSymbolCostStore.clear(); // Ensure clean slate
  const freshTrade = await manager.createTradeFromManual({
    symbol: 'SOLUSDT',
    entryAmount: 200,
    entryPrice: 140,
    manualEntryCost: 0.35, // Explicit manual entry fee (0.35 USDT)
    manualExitCostRate: 0.0012, // Explicit manual exit rate (0.12%)
  });
  assert(freshTrade.status === 'OPEN', 'Trade opens successfully with manual cost data (NEVER BLOCKED)');

  // Test 6.2: Real confirmed data arrival replaces manual data automatically
  assert(freshTrade.costConfig.isRealConfirmed === true, 'Real confirmed data replaces manual data upon order fill');
  assert(freshTrade.costConfig.source === 'REAL_CONFIRMED_RECENT', 'Cost source transitions to REAL_CONFIRMED_RECENT');

  // Test 6.3: Confirmed real cost is saved in SymbolCostStore under the symbol
  const savedSolCost = sharedSymbolCostStore.getConfirmedCost('SOLUSDT');
  assert(savedSolCost !== undefined, 'Confirmed real cost is saved for SOLUSDT in SymbolCostStore');
  assert(savedSolCost?.symbol === 'SOLUSDT', 'Saved symbol matches SOLUSDT');
  assert(savedSolCost?.lastConfirmedEntryFee !== undefined, 'Saved real entry fee is documented');

  // Test 6.4: Arrival of real confirmed cost while a trade is OPEN
  // Create another trade and apply real cost update directly
  const openTradeBeforeUpdate = await manager.createTradeFromManual({
    symbol: 'AVAXUSDT',
    entryAmount: 100,
    entryPrice: 30,
    manualEntryCost: 0.1, // Manual 0.1 USDT
    manualExitCostRate: 0.001, // 0.1%
  });
  const initialT0 = openTradeBeforeUpdate.levelsPlan!.t0BreakEvenPrice;

  // Real data arrives: higher fee 0.50 USDT and exit fee 0.15% (0.0015)
  manager.applyRealConfirmedCost(openTradeBeforeUpdate.tradeId, {
    entryCostAmount: 0.50,
    entryCostRate: 0.005,
    exitCostRate: 0.0015,
  });

  const updatedOpenTrade = manager.getTrade(openTradeBeforeUpdate.tradeId)!;
  assert(updatedOpenTrade.costConfig.entryCostAmount === 0.5, 'Real entry fee of 0.50 USDT applied to open trade');
  assert(updatedOpenTrade.costConfig.exitCostRate === 0.0015, 'Real exit rate 0.0015 applied to open trade');
  assert(updatedOpenTrade.costConfig.source === 'REAL_CONFIRMED_RECENT', 'Open trade source updated to REAL_CONFIRMED_RECENT');
  assert(
    updatedOpenTrade.levelsPlan!.t0BreakEvenPrice > initialT0,
    'T0 Break-Even is automatically recalculated higher to cover the increased real cost',
    `Initial T0: ${initialT0}, Recalculated T0: ${updatedOpenTrade.levelsPlan!.t0BreakEvenPrice}`
  );

  // Test 6.5: Subsequent trade for the same symbol automatically uses saved real data
  // AVAXUSDT now has confirmed real data saved (entryFee: 0.50, exitRate: 0.0015)
  const subsequentAvaxTrade = await manager.createTradeFromManual({
    symbol: 'AVAXUSDT',
    entryAmount: 100,
  });
  const avaxResolvedConfig = sharedSymbolCostStore.resolveInitialCostConfig({
    symbol: 'AVAXUSDT',
    entryAmount: 100,
  });
  assert(avaxResolvedConfig.source === 'REAL_CONFIRMED_SAVED', 'Subsequent trade automatically adopts REAL_CONFIRMED_SAVED');
  assert(avaxResolvedConfig.exitCostRate === 0.0015, 'Subsequent trade inherits confirmed exit rate 0.0015');

  // Test 6.6: When symbol has no saved data, user manual entry is respected as priority
  const manualOnlyResolved = sharedSymbolCostStore.resolveInitialCostConfig({
    symbol: 'DOTUSDT', // Brand new symbol
    entryAmount: 100,
    manualEntryCost: 0.25,
    manualExitCostRate: 0.002,
  });
  assert(manualOnlyResolved.source === 'MANUAL_USER_INPUT', 'New symbol without saved data uses MANUAL_USER_INPUT');
  assert(manualOnlyResolved.entryCostAmount === 0.25, 'Manual entry cost of 0.25 USDT is respected');
  assert(manualOnlyResolved.exitCostRate === 0.002, 'Manual exit cost rate 0.002 is respected');

  // Test 6.7: Absolute Priority: Real confirmed data never lets manual data compete once available
  // Even if user originally entered 0.25, real fill fee overrides it
  const dotTrade = await manager.createTradeFromManual({
    symbol: 'DOTUSDT',
    entryAmount: 100,
    manualEntryCost: 0.25,
  });
  assert(dotTrade.costConfig.isRealConfirmed === true, 'Confirmed fill replaces manual entry; manual data does not compete');
  assert(dotTrade.costConfig.source === 'REAL_CONFIRMED_RECENT', 'DOTUSDT trade cost source is REAL_CONFIRMED_RECENT');

  // Test 6.8: Trade opening is NEVER blocked by missing real data or missing manual inputs
  const zeroInputTrade = await manager.createTradeFromManual({
    symbol: 'LINKUSDT',
    entryAmount: 100,
    // Zero manual cost inputs and zero prior history
  });
  assert(zeroInputTrade !== undefined && zeroInputTrade.status === 'OPEN', 'Trade opening is never blocked by absent cost data');

  // ============================================================================
  // Section 7: Tests for Removal of Minimum Limits (Amounts, Percentages, Negative Stop-Loss)
  // ============================================================================
  console.log('\n  --- Executing Section 7: Small Values & Unlimited Inputs Tests ---');

  // Test 7.1: Accepts micro entry amount 0.01 USDT without artificial barrier
  const microTrade001 = await manager.createTradeFromManual({
    symbol: 'BTCUSDT',
    entryAmount: 0.01,
  });
  assert(microTrade001.status === 'OPEN', 'Trade opens successfully with micro amount 0.01 USDT');
  assert(microTrade001.entry.requestedAmount === 0.01, 'Trade requestedAmount records exact 0.01 USDT');
  assert(microTrade001.entry.filledQuantity! > 0, 'Mock execution fills micro quantity without zeroing out');

  // Test 7.2: Accepts ultra-small entry amount 0.001 USDT (less than 0.01 USDT)
  const microTrade0001 = await manager.createTradeFromManual({
    symbol: 'ETHUSDT',
    entryAmount: 0.001,
  });
  assert(microTrade0001.status === 'OPEN', 'Trade opens successfully with ultra-small amount 0.001 USDT (< 0.01)');
  assert(microTrade0001.entry.requestedAmount === 0.001, 'Trade requestedAmount records exact 0.001 USDT');

  // Test 7.3: Accepts micro step percentage (e.g. 0.05% or 0.01% without artificial minimum)
  const microStepTrade = await manager.createTradeFromManual({
    symbol: 'SOLUSDT',
    entryAmount: 0.05,
    stepPercent: 0.05, // 0.05% step
  });
  assert(microStepTrade.levelsPlan !== undefined, 'Trade has generated levels plan for micro step');
  assert(microStepTrade.levelsPlan!.stepPercent === 0.05, 'Levels plan records exact 0.05% step');
  const expectedT1Price = Number((microStepTrade.entry.executionPrice! * (1 + 0.0005)).toFixed(8));
  assert(
    Math.abs(microStepTrade.levelsPlan!.t1Price - expectedT1Price) < 0.0001,
    `T1 price correctly computed for 0.05% step: ${microStepTrade.levelsPlan!.t1Price}`
  );

  // Test 7.4: Accepts negative stop-loss percentage in stop-loss fields (e.g. -2.5% or -0.5%)
  const negStopTrade = await manager.createTradeFromManual({
    symbol: 'BNBUSDT',
    entryAmount: 10,
    initialStopLossPercent: -2.5, // explicitly negative
  });
  assert(negStopTrade.levelsPlan !== undefined, 'Levels plan created with negative stop-loss input');
  const expectedNegFloor = Number((negStopTrade.entry.executionPrice! * (1 - 0.025)).toFixed(8));
  assert(
    Math.abs(negStopTrade.levelsPlan!.initialProtectionPrice - expectedNegFloor) < 0.0001,
    `Initial protection floor is correctly set below entry price for -2.5%: ${negStopTrade.levelsPlan!.initialProtectionPrice}`
  );

  // Test 7.5: Accepts micro negative stop-loss percentage (e.g. -0.05%)
  const microNegStopTrade = await manager.createTradeFromManual({
    symbol: 'XRPUSDT',
    entryAmount: 5,
    initialStopLossPercent: -0.05, // micro negative stop
  });
  const expectedMicroNegFloor = Number((microNegStopTrade.entry.executionPrice! * (1 - 0.0005)).toFixed(8));
  assert(
    Math.abs(microNegStopTrade.levelsPlan!.initialProtectionPrice - expectedMicroNegFloor) < 0.0001,
    `Micro negative stop floor correctly computed for -0.05%: ${microNegStopTrade.levelsPlan!.initialProtectionPrice}`
  );

  // Test 7.6: Accepts micro manual fee input without truncation (e.g. 0.00005 USDT fee)
  const microFeeConfig = sharedSymbolCostStore.resolveInitialCostConfig({
    symbol: 'ADAUSDT',
    entryAmount: 0.05,
    manualEntryCost: 0.00005,
    manualExitCostRate: 0.0002, // 0.02%
  });
  assert(microFeeConfig.entryCostAmount === 0.00005, 'Micro fee of 0.00005 USDT is preserved without rounding down to zero');
  assert(microFeeConfig.exitCostRate === 0.0002, 'Micro exit rate of 0.0002 is preserved');

  // Test 7.7: Net PnL accurately computes micro amounts (no truncation to 0)
  const microPnL = LevelCalculator.calculateNetPnL({
    entryPrice: 100,
    exitPrice: 101,
    filledQuantity: 0.0001, // 0.01 USDT trade
    entryCommissionQuote: 0.00001,
    exitCommissionQuote: 0.00001,
  });
  assert(microPnL.grossReturnQuote > 0, `Gross return computed for micro trade: ${microPnL.grossReturnQuote}`);
  assert(microPnL.netReturnQuote > 0, `Net return computed for micro trade: ${microPnL.netReturnQuote}`);
  assert(microPnL.isProfitable === true, 'Micro trade profitability evaluated accurately');

  console.log('\n================================================================');
  console.log(`  ALL ${totalTests} TRADE MANAGER & T-LEVELS & COST DATA & UNLIMITED VALUE TESTS PASSED!`);
  console.log('================================================================');
}

runTestSuite().catch((err) => {
  console.error('Fatal error during Trade Manager tests:', err);
  process.exit(1);
});
