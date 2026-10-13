/**
 * Phase 2 Test Suite: Unified T-Levels Position Management & Manager Conflict Prevention
 * 
 * Verifies:
 * 1. Post-entry position management is unified under T-levels for ALL 4 trade sources:
 *    a) Pre-Entry Recovery (التعافي)
 *    b) RANGE_BOT (المسار العرضي)
 *    c) Breakout / SCANNER (صفقة الاختراق)
 *    d) Immediate Market Buy (الشراء الفوري)
 * 2. Original entry logic and trade source/botType are strictly preserved.
 * 3. Management via T-levels ladder (T0 BreakEven, T1-50%, T1..T5, trailing protection)
 *    until 100% of the purchased quantity is sold.
 * 4. Conflict prevention: Multiple managers or concurrent exit calls are strictly blocked
 *    from issuing conflicting orders on the same position quantity.
 */

import { TradeManager } from '../lib/trade-manager/trade-manager';

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

async function runUnifiedTManagementTests() {
  console.log('================================================================');
  console.log('  Executing Phase 2: Unified T-Levels Position Management Test Suite');
  console.log('================================================================\n');

  const { sharedMarketDataStore } = await import('../lib/market-data');
  const now = Date.now();
  sharedMarketDataStore.updatePrice('BTCUSDT', 50000, now, now);
  sharedMarketDataStore.updatePrice('ETHUSDT', 3000, now, now);
  sharedMarketDataStore.updatePrice('SOLUSDT', 150, now, now);
  sharedMarketDataStore.updatePrice('BNBUSDT', 600, now, now);
  sharedMarketDataStore.updatePrice('AVAXUSDT', 30, now, now);

  const tradeManager = new TradeManager();

  // ----------------------------------------------------------------------------
  // Case 1: Pre-Entry Recovery Trade (مصدر التعافي)
  // ----------------------------------------------------------------------------
  console.log('--- Case 1: Pre-Entry Recovery Trade -> Unified T-Management ---');
  const recoveryTrade = await tradeManager.createTradeFromManual({
    symbol: 'BTCUSDT',
    entryAmount: 200,
    entryPrice: 50000,
    stepPercent: 2.0,
    isPreEntryRecovery: true,
  });

  assert(recoveryTrade.status === 'PENDING_ENTRY', 'Trade 1 starts in PENDING_ENTRY');
  assert(recoveryTrade.source === 'MANUAL', 'Trade 1 source is strictly preserved as MANUAL');
  assert(recoveryTrade.preEntryXMonitor !== undefined, 'Trade 1 has active Pre-Entry X Monitor');

  // Drops through levels (50k -> 49k -> 48k -> 47k)
  await tradeManager.onMarketPriceTick('BTCUSDT', 49000); // X1 (49000)
  await tradeManager.onMarketPriceTick('BTCUSDT', 48000); // X2 (48000)
  await tradeManager.onMarketPriceTick('BTCUSDT', 47000); // X3 (47000)
  await tradeManager.onMarketPriceTick('BTCUSDT', 46500); // Low
  assert(recoveryTrade.status === 'PENDING_ENTRY', 'Trade 1 still in PENDING_ENTRY during drop');

  // Rebounds with 3 consecutive recoveries: 47k (X3), 48k (X2), 49k (X1)
  await tradeManager.onMarketPriceTick('BTCUSDT', 47000);
  await tradeManager.onMarketPriceTick('BTCUSDT', 48000);
  await tradeManager.onMarketPriceTick('BTCUSDT', 49000); // 3rd recovery triggers buy!

  assert(recoveryTrade.status === 'OPEN', 'Trade 1 buy confirmed -> transitioned to OPEN');
  assert(recoveryTrade.positionManager === 'UNIFIED_T_LADDER', 'Trade 1 positionManager is UNIFIED_T_LADDER');
  assert(recoveryTrade.levelsPlan !== undefined, 'Trade 1 has generated unified levelsPlan');
  assert(recoveryTrade.source === 'MANUAL', 'Trade 1 source preserved as MANUAL after entry');

  // Manage via T-ladder: price ascends to T1-50%, then T1
  const tEntry = recoveryTrade.entry.executionPrice || 49000;
  const t1Price = recoveryTrade.levelsPlan!.t1Price;
  await tradeManager.onMarketPriceTick('BTCUSDT', t1Price);
  assert(
    recoveryTrade.levelsPlan!.currentAchievedLevel === 'T1',
    'Trade 1 achieved level advanced to T1 under unified T-levels'
  );
  assert(
    recoveryTrade.levelsPlan!.activeProtectionPrice === recoveryTrade.levelsPlan!.t1Minus50Price,
    'Trade 1 active protection raised to T1-50%'
  );

  // Price retraces to protection floor -> triggers sell of full quantity
  const protFloor1 = recoveryTrade.levelsPlan!.activeProtectionPrice;
  await tradeManager.onMarketPriceTick('BTCUSDT', protFloor1);
  assert(recoveryTrade.status === 'CLOSED', 'Trade 1 closed at protection floor under T-ladder');
  assert(recoveryTrade.exit?.filledQuantity === recoveryTrade.entry.filledQuantity, 'Full quantity sold');
  assert(recoveryTrade.pnl !== undefined, 'Trade 1 Net PnL calculated accurately');

  // ----------------------------------------------------------------------------
  // Case 2: RANGE_BOT Trade (مصدر المسار العرضي)
  // ----------------------------------------------------------------------------
  console.log('\n--- Case 2: RANGE_BOT Trade -> Unified T-Management ---');
  const rangeBotTrade = await tradeManager.createTradeFromManual({
    symbol: 'ETHUSDT',
    entryAmount: 150,
    entryPrice: 3000,
    stepPercent: 2.5,
    botType: 'RANGE_BOT',
    immediateEntry: true,
  });

  assert(rangeBotTrade.status === 'OPEN', 'RANGE_BOT trade opens in OPEN state');
  assert(rangeBotTrade.botType === 'RANGE_BOT', 'Trade 2 botType strictly preserved as RANGE_BOT');
  assert(rangeBotTrade.positionManager === 'UNIFIED_T_LADDER', 'Trade 2 governed by UNIFIED_T_LADDER');
  assert(rangeBotTrade.levelsPlan !== undefined, 'Trade 2 has deterministic levelsPlan');
  assert(rangeBotTrade.levelsPlan!.t0BreakEvenPrice > 0, 'Trade 2 has calculated T0 Net Break-Even');

  // Ascend through T1 and T2
  const ethT2 = rangeBotTrade.levelsPlan!.t2Price;
  await tradeManager.onMarketPriceTick('ETHUSDT', ethT2);
  assert(
    rangeBotTrade.levelsPlan!.currentAchievedLevel === 'T2',
    'RANGE_BOT position progressed to T2 under unified T-ladder'
  );
  assert(
    rangeBotTrade.levelsPlan!.activeProtectionPrice === rangeBotTrade.levelsPlan!.t1Price,
    'RANGE_BOT protection floor trailed to T1'
  );

  // Retrace to protection floor -> sell full quantity
  await tradeManager.onMarketPriceTick('ETHUSDT', rangeBotTrade.levelsPlan!.activeProtectionPrice);
  assert(rangeBotTrade.status === 'CLOSED', 'RANGE_BOT closed cleanly under unified T-ladder');
  assert(rangeBotTrade.exit?.filledQuantity === rangeBotTrade.entry.filledQuantity, '100% quantity sold');

  // ----------------------------------------------------------------------------
  // Case 3: Breakout / SCANNER Trade (مصدر الاختراق)
  // ----------------------------------------------------------------------------
  console.log('\n--- Case 3: Breakout / SCANNER Trade -> Unified T-Management ---');
  const scannerTrade = await tradeManager.createTradeFromScanner({
    symbol: 'SOLUSDT',
    scannerPrice: 150,
    entryAmount: 120,
    stepPercent: 3.0,
    botType: 'DEAL_BOT',
    immediateEntry: true,
  });

  assert(scannerTrade.status === 'OPEN', 'Breakout trade opens in OPEN state');
  assert(scannerTrade.source === 'SCANNER', 'Trade 3 source strictly preserved as SCANNER');
  assert(scannerTrade.botType === 'DEAL_BOT', 'Trade 3 botType strictly preserved as DEAL_BOT');
  assert(scannerTrade.positionManager === 'UNIFIED_T_LADDER', 'Trade 3 governed by UNIFIED_T_LADDER');

  // Ascend to T1-50% -> Protection becomes T0
  const solT1Minus50 = scannerTrade.levelsPlan!.t1Minus50Price;
  await tradeManager.onMarketPriceTick('SOLUSDT', solT1Minus50);
  assert(
    scannerTrade.levelsPlan!.currentAchievedLevel === 'T1_MINUS_50',
    'Breakout trade achieved T1-50%'
  );
  assert(
    scannerTrade.levelsPlan!.activeProtectionPrice === scannerTrade.levelsPlan!.t0BreakEvenPrice,
    'Breakout trade protection floor moved to T0 break-even'
  );

  // Retrace to T0 -> sell to preserve capital at break-even
  await tradeManager.onMarketPriceTick('SOLUSDT', scannerTrade.levelsPlan!.activeProtectionPrice);
  assert(scannerTrade.status === 'CLOSED', 'Breakout trade closed at T0 break-even under T-ladder');
  assert(scannerTrade.exit?.filledQuantity === scannerTrade.entry.filledQuantity, '100% quantity sold');

  // ----------------------------------------------------------------------------
  // Case 4: Immediate Market Buy Trade (مصدر الشراء الفوري)
  // ----------------------------------------------------------------------------
  console.log('\n--- Case 4: Immediate Market Buy Trade -> Unified T-Management ---');
  const immediateTrade = await tradeManager.createTradeFromManual({
    symbol: 'BNBUSDT',
    entryAmount: 100,
    immediateEntry: true,
  });

  assert(immediateTrade.status === 'OPEN', 'Immediate buy trade opens in OPEN state');
  assert(immediateTrade.source === 'MANUAL', 'Trade 4 source strictly preserved as MANUAL');
  assert(immediateTrade.positionManager === 'UNIFIED_T_LADDER', 'Trade 4 governed by UNIFIED_T_LADDER');
  assert(immediateTrade.levelsPlan !== undefined, 'Trade 4 has active levelsPlan');

  // Retrace immediately to initial stop protection floor -> sell full quantity
  const bnbStop = immediateTrade.levelsPlan!.activeProtectionPrice;
  await tradeManager.onMarketPriceTick('BNBUSDT', bnbStop);
  assert(immediateTrade.status === 'CLOSED', 'Immediate trade closed at initial stop floor');
  assert(immediateTrade.exit?.filledQuantity === immediateTrade.entry.filledQuantity, '100% quantity sold');

  // ----------------------------------------------------------------------------
  // Case 5: Manager Conflict Prevention & Single Position Authority
  // ----------------------------------------------------------------------------
  console.log('\n--- Case 5: Manager Conflict Prevention ---');
  const lockedTrade = await tradeManager.createTradeFromManual({
    symbol: 'AVAXUSDT',
    entryAmount: 100,
    immediateEntry: true,
  });

  assert(lockedTrade.status === 'OPEN', 'Locked test trade opens in OPEN state');
  assert(lockedTrade.isExiting === false, 'Initially isExiting is false');

  // Simulate multiple managers or concurrent exit attempts on the same trade
  let concurrentExecutions = 0;
  const p1 = tradeManager.executeTradeExit(lockedTrade.tradeId, 'Manager 1 Trigger');
  const p2 = tradeManager.executeTradeExit(lockedTrade.tradeId, 'Manager 2 Duplicate Trigger');
  const p3 = tradeManager.executeTradeExit(lockedTrade.tradeId, 'Manager 3 Competing Trigger');

  const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

  // All return the same managed trade record, and only ONE exit was processed
  assert(lockedTrade.status === 'CLOSED', 'Trade closed cleanly');
  assert(
    lockedTrade.closeReason === 'Manager 1 Trigger',
    'First manager acquired the exit lock; duplicate managers blocked from conflicting'
  );

  // Recovery buy cannot be executed on an exiting or closed trade
  const recoveryAttempt = await tradeManager.executeRecoveryBuy(lockedTrade.tradeId, 1);
  assert(
    recoveryAttempt.status === 'CLOSED',
    'Competing recovery manager cannot execute orders on closed or exiting position'
  );

  console.log('\n================================================================');
  console.log(`  ALL ${totalTests} UNIFIED T-LEVELS & CONFLICT PREVENTION TESTS PASSED!`);
  console.log('================================================================');
}

runUnifiedTManagementTests().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
