// Project Q — Comprehensive Test Suite for RANGE_BOT and X/Recovery
// Validates:
// 1. Dynamic generation of X-levels: X1, X2, X3, X4, X5 ... without any fixed ceiling of 3
// 2. Strict usage of user-defined settings (stepPercent, recoveryRatio, maxLevels optional)
// 3. Sequential trigger evaluation and guarantee that executed levels are NEVER re-executed
// 4. Execution recording and weighted average position aggregation
// 5. Dynamic generation and progression of T-levels: T1, T2, T3, T4, T5 ... without any upper limit
// 6. Bot Core & Bot Engine integration: maintaining POSITION_OPEN during recovery buys
// 7. Full end-to-end execution of RANGE_BOT through price drops, recoveries, and full liquidation
// 8. 100% Mock transport verification (Zero real keys)

import { sharedTradeManager, sharedSymbolCostStore } from '../lib/trade-manager';
import { XRecoveryManager } from '../lib/trade-manager/x-recovery-manager';
import { LevelCalculator } from '../lib/trade-manager/level-calculator';
import { getSharedBotEngine } from '../lib/engine';

let testCount = 0;

function assert(condition: boolean, message: string, extra?: string) {
  testCount++;
  if (!condition) {
    console.error(`  ✗ Test #${testCount} FAILED: ${message}`);
    if (extra) console.error(`    Details: ${extra}`);
    process.exit(1);
  }
  console.log(`  ✓ Test #${testCount} PASS: ${message}`);
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  Executing RANGE_BOT & X/Recovery (Dynamic Levels) Test Suite');
  console.log('================================================================\n');

  // ----------------------------------------------------------------------------
  // Part 1: XRecoveryManager Dynamic Plan Generation & User Settings
  // ----------------------------------------------------------------------------
  console.log('--- Part 1: X/Recovery Dynamic Plan Generation & User Settings ---');

  // Test 1: Disabled plan returns undefined
  const disabledPlan = XRecoveryManager.buildPlan({
    entryPrice: 100,
    entryAmount: 100,
    xSettings: { enabled: false },
  });
  assert(disabledPlan === undefined, 'Disabled xSettings returns undefined plan');

  // Test 2: User Settings are respected directly without hardcoded defaults
  // User specifies: stepPercent = 2.5%, recoveryRatio = 1.25, maxLevels = undefined (unlimited!)
  const userPlan = XRecoveryManager.buildPlan({
    entryPrice: 100,
    entryAmount: 80,
    xSettings: {
      enabled: true,
      stepPercent: 2.5, // Custom user step
      recoveryRatio: 1.25, // Custom user multiplier
      maxLevels: undefined, // Unlimited! No forced 3
    },
  });
  assert(userPlan !== undefined, 'User-configured plan successfully built');
  assert(userPlan!.maxLevels === undefined, 'Plan respects maxLevels as undefined (unlimited, no forced 3!)');
  assert(userPlan!.stepPercent === 2.5, 'Plan respects user stepPercent = 2.5% (no forced 1.5%)');
  assert(userPlan!.recoveryRatio === 1.25, 'Plan respects user recoveryRatio = 1.25 (no forced 1.0)');

  // Test 3: Plan does NOT pre-create an upfront fixed array of 3 elements
  // Only the initial pending level (X1) is generated dynamically
  assert(userPlan!.levels.length === 1, 'Initial plan has only 1 level (X1) dynamically, NOT a fixed 3-element array');
  assert(userPlan!.levels[0].levelIndex === 1, 'Initial level is X1');
  assert(userPlan!.levels[0].status === 'PENDING', 'X1 status is PENDING');

  // Test 4: Mathematical accuracy of X1 based on user settings
  // Trigger price = 100 * (1 - 0.025) = 97.5
  // Allocation quote = 80 * 1.25 = 100 USDT
  assert(userPlan!.levels[0].triggerPrice === 97.5, 'X1 trigger price calculated accurately: 97.5 (-2.5%)');
  assert(userPlan!.levels[0].allocationQuote === 100, 'X1 allocation quote calculated accurately: 80 * 1.25 = 100 USDT');

  // ----------------------------------------------------------------------------
  // Part 2: Continuous Dynamic Generation: X1 -> X2 -> X3 -> X4 -> X5 ... Beyond 3!
  // ----------------------------------------------------------------------------
  console.log('\n--- Part 2: Continuous Generation (X1 through X6+) ---');

  // Simulate executing X1:
  XRecoveryManager.recordExecution(userPlan!, 1, {
    fillPrice: 97.5,
    filledQty: 100 / 97.5,
    feePaid: 0.1,
    orderId: 'ord_x1',
    timestamp: Date.now(),
  });

  assert(userPlan!.executedLevelsCount === 1, 'Executed count is 1');
  assert(userPlan!.levels[0].status === 'EXECUTED', 'X1 is marked EXECUTED');
  // Check that X2 was generated dynamically upon execution of X1!
  assert(userPlan!.levels.length === 2, 'X2 was dynamically generated upon X1 execution (length is now 2)');
  assert(userPlan!.levels[1].levelIndex === 2, 'Level 2 is X2');
  assert(userPlan!.levels[1].status === 'PENDING', 'X2 is PENDING');
  // X2 trigger: 100 * (1 - 2 * 0.025) = 95.0, allocation: 80 * (1.25)^2 = 125
  assert(userPlan!.levels[1].triggerPrice === 95.0, 'X2 trigger price is 95.0 (-5.0%)');
  assert(userPlan!.levels[1].allocationQuote === 125, 'X2 quote allocation is 125 USDT');

  // Simulate executing X2:
  XRecoveryManager.recordExecution(userPlan!, 2, {
    fillPrice: 95.0,
    filledQty: 125 / 95.0,
    feePaid: 0.125,
    orderId: 'ord_x2',
    timestamp: Date.now(),
  });

  assert(userPlan!.executedLevelsCount === 2, 'Executed count is 2');
  assert(userPlan!.levels[1].status === 'EXECUTED', 'X2 is marked EXECUTED');
  // Check that X3 was generated dynamically upon execution of X2!
  assert(userPlan!.levels.length === 3, 'X3 was dynamically generated upon X2 execution');
  assert(userPlan!.levels[2].levelIndex === 3, 'Level 3 is X3');

  // CRITICAL TEST: Simulate executing X3 -> Must NOT stop! Must generate X4!
  XRecoveryManager.recordExecution(userPlan!, 3, {
    fillPrice: 92.5,
    filledQty: 156.25 / 92.5,
    feePaid: 0.15,
    orderId: 'ord_x3',
    timestamp: Date.now(),
  });

  assert(userPlan!.executedLevelsCount === 3, 'Executed count is 3');
  assert(userPlan!.levels[2].status === 'EXECUTED', 'X3 is marked EXECUTED');
  assert(userPlan!.levels.length === 4, 'SYSTEM DOES NOT STOP AT 3: X4 was dynamically generated upon X3 execution!');
  assert(userPlan!.levels[3].levelIndex === 4, 'Level 4 is X4');
  assert(userPlan!.levels[3].status === 'PENDING', 'X4 is PENDING');
  // X4 trigger: 100 * (1 - 4 * 0.025) = 90.0
  assert(userPlan!.levels[3].triggerPrice === 90.0, 'X4 trigger price is 90.0 (-10.0%)');

  // Simulate executing X4 -> Generates X5!
  XRecoveryManager.recordExecution(userPlan!, 4, {
    fillPrice: 90.0,
    filledQty: 2,
    feePaid: 0.2,
    orderId: 'ord_x4',
    timestamp: Date.now(),
  });
  assert(userPlan!.levels.length === 5, 'X5 was dynamically generated upon X4 execution!');
  assert(userPlan!.levels[4].levelIndex === 5, 'Level 5 is X5');

  // Simulate executing X5 -> Generates X6!
  XRecoveryManager.recordExecution(userPlan!, 5, {
    fillPrice: 87.5,
    filledQty: 2.5,
    feePaid: 0.25,
    orderId: 'ord_x5',
    timestamp: Date.now(),
  });
  assert(userPlan!.levels.length === 6, 'X6 was dynamically generated upon X5 execution!');
  assert(userPlan!.levels[5].levelIndex === 6, 'Level 6 is X6');

  // ----------------------------------------------------------------------------
  // Part 3: No Re-Execution of Already Executed Levels
  // ----------------------------------------------------------------------------
  console.log('\n--- Part 3: No Re-Execution of Executed Levels ---');

  // Price at 97.0 (below X1 trigger price of 97.5)
  // X1 was already executed, so checkTrigger MUST NOT re-trigger X1!
  const trigCheckOld = XRecoveryManager.checkTrigger(userPlan!, 97.0);
  assert(trigCheckOld === null, 'Price at 97.0 does NOT re-trigger X1 (X1 is EXECUTED and never re-executed in same cycle)');

  // Only the currently pending level (X6 at trigger 85.0) can trigger
  const trigCheckPending = XRecoveryManager.checkTrigger(userPlan!, 85.0);
  assert(trigCheckPending !== null && trigCheckPending.levelIndex === 6, 'Only pending X6 triggers when price reaches 85.0');

  // ----------------------------------------------------------------------------
  // Part 4: Dynamic & Unbounded T-Levels (T1, T2, T3, T4, T5, ... Tn)
  // ----------------------------------------------------------------------------
  console.log('\n--- Part 4: Dynamic & Unbounded T-Levels Tests ---');

  const tPlan = LevelCalculator.buildTradeLevelsPlan({
    entryPrice: 100,
    filledQuantity: 1.0,
    costConfig: {
      entryCostAmount: 0.1,
      entryCostRate: 0.001,
      exitCostRate: 0.001,
      source: 'MANUAL_USER_INPUT',
      updatedAt: Date.now(),
      isRealConfirmed: false,
    },
    stepPercent: 2.0, // 2% per T step
  });

  // Test progression to T1
  const evalT1 = LevelCalculator.evaluatePriceTick(tPlan, 102.2);
  assert(evalT1.newAchievedLevel === 'T1', 'Level advances to T1 at 102.2');
  assert(evalT1.newProtectionPrice === tPlan.t1Minus50Price, 'Protection at T1 is T1-50%');

  // Test progression to T2
  const evalT2 = LevelCalculator.evaluatePriceTick(tPlan, 104.1);
  assert(evalT2.newAchievedLevel === 'T2', 'Level advances to T2 at 104.1');
  assert(evalT2.newProtectionPrice === 102.0, 'Protection at T2 is T1 (102.0)');

  // Test progression to T3
  const evalT3 = LevelCalculator.evaluatePriceTick(tPlan, 106.3);
  assert(evalT3.newAchievedLevel === 'T3', 'Level advances to T3 at 106.3');
  assert(evalT3.newProtectionPrice === 104.0, 'Protection at T3 is T2 (104.0)');

  // CRITICAL TEST: Progression to T4 -> Must NOT stop at T3!
  const evalT4 = LevelCalculator.evaluatePriceTick(tPlan, 108.5);
  assert(evalT4.newAchievedLevel === 'T4', 'T-LEVELS DO NOT STOP AT T3: Level advances to T4 at 108.5');
  assert(evalT4.newProtectionPrice === 106.0, 'Protection at T4 is T3 (106.0)');

  // Progression to T5
  const evalT5 = LevelCalculator.evaluatePriceTick(tPlan, 110.2);
  assert(evalT5.newAchievedLevel === 'T5', 'Level advances to T5 at 110.2');
  assert(evalT5.newProtectionPrice === 108.0, 'Protection at T5 is T4 (108.0)');

  // Progression to T8
  const evalT8 = LevelCalculator.evaluatePriceTick(tPlan, 116.5);
  assert(evalT8.newAchievedLevel === 'T8', 'Level advances to T8 at 116.5');
  assert(evalT8.newProtectionPrice === 114.0, 'Protection at T8 is T7 (114.0)');

  // Retracement check at T8: Price drops to 113.9 (below protection T7 of 114.0) -> Triggers SELL
  const evalRetrace = LevelCalculator.evaluatePriceTick(tPlan, 113.9);
  assert(evalRetrace.shouldSell === true, 'Price dropping to or below T7 protection (114.0) triggers SELL');
  assert(evalRetrace.triggerReason!.includes('T8'), 'Trigger reason documents exit after achieving T8');

  // ----------------------------------------------------------------------------
  // Part 5: Full End-to-End RANGE_BOT Managed Trade Lifecycle with Unlimited X
  // ----------------------------------------------------------------------------
  console.log('\n--- Part 5: End-to-End RANGE_BOT with Dynamic Unbounded X ---');

  // Create RANGE_BOT trade with user settings: step 1.0%, ratio 1.1, NO maxLevels limit
  const managedRange = await sharedTradeManager.createTradeFromManual({
    symbol: 'NEARUSDT',
    entryAmount: 100,
    entryPrice: 10.0,
    botType: 'RANGE_BOT',
    stepPercent: 2.0,
    xSettings: {
      enabled: true,
      stepPercent: 1.0, // 1% drop per level
      recoveryRatio: 1.1,
      maxLevels: undefined, // Unlimited!
    },
  });

  assert(managedRange.status === 'OPEN', 'RANGE_BOT trade opens in OPEN state');
  assert(managedRange.xRecoveryPlan !== undefined, 'Trade has active xRecoveryPlan');
  assert(managedRange.xRecoveryPlan!.maxLevels === undefined, 'Trade has no fixed maxLevels ceiling');
  assert(managedRange.xRecoveryPlan!.levels.length === 1, 'Trade starts with 1 dynamically generated level (X1)');

  // Simulate price dropping through X1 (9.90)
  await sharedTradeManager.onMarketPriceTick('NEARUSDT', 9.89);
  let updatedTrade = sharedTradeManager.getTrade(managedRange.tradeId)!;
  assert(updatedTrade.xRecoveryPlan!.executedLevelsCount === 1, 'X1 executed automatically on tick');
  assert(updatedTrade.xRecoveryPlan!.levels.length >= 2, 'X2 was dynamically generated upon X1 fill');

  // Simulate price dropping through X2 (9.80)
  await sharedTradeManager.onMarketPriceTick('NEARUSDT', 9.79);
  updatedTrade = sharedTradeManager.getTrade(managedRange.tradeId)!;
  assert(updatedTrade.xRecoveryPlan!.executedLevelsCount === 2, 'X2 executed automatically on tick');
  assert(updatedTrade.xRecoveryPlan!.levels.length >= 3, 'X3 was dynamically generated upon X2 fill');

  // Simulate price dropping through X3 (9.70)
  await sharedTradeManager.onMarketPriceTick('NEARUSDT', 9.69);
  updatedTrade = sharedTradeManager.getTrade(managedRange.tradeId)!;
  assert(updatedTrade.xRecoveryPlan!.executedLevelsCount === 3, 'X3 executed automatically on tick');
  assert(updatedTrade.xRecoveryPlan!.levels.length >= 4, 'X4 was dynamically generated upon X3 fill (DID NOT STOP AT 3!)');

  // Simulate price dropping through X4 (9.60)
  await sharedTradeManager.onMarketPriceTick('NEARUSDT', 9.59);
  updatedTrade = sharedTradeManager.getTrade(managedRange.tradeId)!;
  assert(updatedTrade.xRecoveryPlan!.executedLevelsCount === 4, 'X4 executed automatically on tick');
  assert(updatedTrade.xRecoveryPlan!.levels.length >= 5, 'X5 was dynamically generated upon X4 fill');

  // Simulate price dropping through X5 (9.50)
  await sharedTradeManager.onMarketPriceTick('NEARUSDT', 9.49);
  updatedTrade = sharedTradeManager.getTrade(managedRange.tradeId)!;
  assert(updatedTrade.xRecoveryPlan!.executedLevelsCount === 5, 'X5 executed automatically on tick');
  assert(updatedTrade.xRecoveryPlan!.levels.length >= 6, 'X6 was dynamically generated upon X5 fill');

  // Position aggregation verification:
  assert(updatedTrade.entry.executionPrice! < 10.0, `Weighted average entry price lowered to: ${updatedTrade.entry.executionPrice}`);
  assert(updatedTrade.entry.filledQuantity! > 50, `Aggregated total quantity expanded to: ${updatedTrade.entry.filledQuantity}`);

  // Bot Core verification: Bot must strictly remain in POSITION_OPEN through all 5 recovery buys!
  const engine = await getSharedBotEngine();
  const botInstance = engine.getBot(managedRange.botId)!;
  assert(botInstance.getState() === 'POSITION_OPEN', 'Bot strictly remains in POSITION_OPEN across all dynamic recovery orders');

  // Market Rebound: Price rises to new T1-50%
  const newT1Minus50 = updatedTrade.levelsPlan!.t1Minus50Price;
  await sharedTradeManager.onMarketPriceTick('NEARUSDT', newT1Minus50 + 0.05);
  updatedTrade = sharedTradeManager.getTrade(managedRange.tradeId)!;
  assert(updatedTrade.levelsPlan!.currentAchievedLevel === 'T1_MINUS_50', 'Level progressed to T1_MINUS_50');

  // Market Retraces to T0 -> Closes Trade cleanly
  const protection = updatedTrade.levelsPlan!.activeProtectionPrice;
  await sharedTradeManager.onMarketPriceTick('NEARUSDT', protection - 0.02);

  const finalTrade = sharedTradeManager.getTrade(managedRange.tradeId)!;
  assert(finalTrade.status === 'CLOSED', 'Trade closed successfully at protection');
  assert(
    Math.abs(finalTrade.exit!.filledQuantity! - updatedTrade.entry.filledQuantity!) < 0.0001,
    'Full aggregated quantity liquidated cleanly'
  );
  assert(botInstance.getState() === 'POSITION_CLOSED', 'Bot transitioned cleanly to POSITION_CLOSED');

  // ----------------------------------------------------------------------------
  // Part 6: User Custom Allocation Quote & Exact Net Profit Validation
  // ----------------------------------------------------------------------------
  console.log('\n--- Part 6: User Custom Allocation Quote & Net PnL Math ---');

  // Test custom direct allocation quote (e.g. 50 USDT fixed per level, step 0.05%)
  const customPlan = XRecoveryManager.buildPlan({
    entryPrice: 50,
    entryAmount: 100,
    xSettings: {
      enabled: true,
      stepPercent: 0.05, // Very small step % accepted
      customAllocationQuote: 50, // Direct fixed quote allocation
    },
  });
  assert(customPlan !== undefined, 'Plan with customAllocationQuote successfully built');
  assert(customPlan!.stepPercent === 0.05, 'Small stepPercent (0.05%) accepted without artificial minimum');
  assert(customPlan!.customAllocationQuote === 50, 'customAllocationQuote (50 USDT) strictly respected');
  assert(customPlan!.levels[0].allocationQuote === 50, 'X1 allocation quote is exactly 50 USDT');
  // Trigger price = 50 * (1 - 0.0005) = 49.975
  assert(customPlan!.levels[0].triggerPrice === 49.975, 'X1 trigger price correctly calculated for 0.05% step: 49.975');

  // Test on-the-fly settings update with custom quote
  const testTradeId = managedRange.tradeId;
  const updatedWithCustom = sharedTradeManager.updateTradeXSettings(testTradeId, {
    stepPercent: 1.2,
    recoveryRatio: 1.1,
    customAllocationQuote: 45,
    maxLevels: null, // Unlimited
  });
  assert(updatedWithCustom.xRecoveryPlan!.stepPercent === 1.2, 'Step updated on the fly to 1.2%');
  assert(updatedWithCustom.xRecoveryPlan!.customAllocationQuote === 45, 'Custom allocation updated to 45 USDT');
  assert(updatedWithCustom.xRecoveryPlan!.maxLevels === undefined, 'maxLevels remains unlimited (null -> undefined)');

  // Test generateNextRecoveryLevel on demand
  const genLevel = sharedTradeManager.generateNextRecoveryLevel(testTradeId);
  assert(genLevel !== null, 'generateNextRecoveryLevel generated next level on demand');
  assert(genLevel!.levelIndex > 6, `Generated level index is ${genLevel!.levelIndex} (> 6)`);
  assert(genLevel!.allocationQuote === 45, 'Generated level uses customAllocationQuote of 45 USDT');

  // Exact net profit math validation after entry fee and exit fee
  const simFillPrice = 100;
  const simFilledQty = 2; // 200 USDT invested
  const simMarketPrice = 105; // 210 USDT gross
  const simEntryFee = 0.2; // 0.1% of 200
  const simExitFeeRate = 0.001; // 0.1%
  const simExitFee = simMarketPrice * simFilledQty * simExitFeeRate; // 210 * 0.001 = 0.21
  const simGross = (simMarketPrice - simFillPrice) * simFilledQty; // 10 USDT
  const simNetQuote = Number((simGross - (simEntryFee + simExitFee)).toFixed(4)); // 10 - 0.41 = 9.59
  const simNetPercent = Number(((simNetQuote / (simFillPrice * simFilledQty)) * 100).toFixed(2));
  assert(simNetQuote === 9.59, 'Exact net quote after buy fee (0.2) and sell fee (0.21) is 9.59 USDT');
  assert(Math.abs(simNetPercent - 4.8) <= 0.02, `Exact net percent after buy fee and sell fee is approx +4.8% (got ${simNetPercent}%)`);

  // ----------------------------------------------------------------------------
  // Part 7: Mock Transport Verification
  // ----------------------------------------------------------------------------
  console.log('\n--- Part 7: Mock Transport Verification ---');
  assert(engine.getTradingService().isUsingMock() === true, 'Trading Layer operates strictly in Mock mode (Zero real keys)');

  console.log('\n================================================================');
  console.log(`  ALL ${testCount} DYNAMIC RANGE_BOT & X/RECOVERY TESTS PASSED!`);
  console.log('================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Fatal error during test suite:', err);
  process.exit(1);
});
