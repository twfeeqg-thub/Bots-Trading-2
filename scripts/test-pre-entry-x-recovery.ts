/**
 * Phase 1 Test Suite: Pre-Entry X Recovery Logic
 * 
 * Verifies:
 * 1. Manual entry price is purely the start of monitoring price (سعر بدء المراقبة), not an order.
 * 2. Strict prohibition of buying during price drops or when touching/breaching X levels.
 * 3. Reaching a level during ascent counts as recovering it (مع اعتبار الوصول إلى المستوى استعادة له).
 * 4. Cancellation of count on re-drop (إلغاء العد عند عودة الهبوط).
 * 5. Requiring 3 consecutive X levels recovered during ascent to trigger purchase (استعادة 3 مستويات X متتالية).
 * 6. Full integration with TradeManager: trade stays in PENDING_ENTRY until 3 recoveries complete, then transitions to OPEN.
 */

import { XRecoveryManager } from '../lib/trade-manager/x-recovery-manager';
import { TradeManager } from '../lib/trade-manager/trade-manager';
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

async function runPreEntryRecoveryTests() {
  console.log('================================================================');
  console.log('  Executing Phase 1: Pre-Entry X Recovery Test Suite');
  console.log('================================================================\n');

  // --- Part 1: Monitor Initialization & Mathematical Levels ---
  console.log('--- Part 1: Monitor Initialization & Level Pricing ---');
  const watchPrice = 100;
  const stepPercent = 2.0; // 2% per X level

  assert(
    XRecoveryManager.calculateLevelPrice(watchPrice, stepPercent, 0) === 100,
    'Level 0 corresponds to watchPrice (100 USDT)'
  );
  assert(
    XRecoveryManager.calculateLevelPrice(watchPrice, stepPercent, 1) === 98,
    'Level X1 is exactly 100 * (1 - 2%) = 98 USDT'
  );
  assert(
    XRecoveryManager.calculateLevelPrice(watchPrice, stepPercent, 2) === 96,
    'Level X2 is exactly 100 * (1 - 4%) = 96 USDT'
  );
  assert(
    XRecoveryManager.calculateLevelPrice(watchPrice, stepPercent, 3) === 94,
    'Level X3 is exactly 100 * (1 - 6%) = 94 USDT'
  );
  assert(
    XRecoveryManager.calculateLevelPrice(watchPrice, stepPercent, 4) === 92,
    'Level X4 is exactly 100 * (1 - 8%) = 92 USDT'
  );
  assert(
    XRecoveryManager.calculateLevelPrice(watchPrice, stepPercent, 5) === 90,
    'Level X5 is exactly 100 * (1 - 10%) = 90 USDT'
  );

  const monitor = XRecoveryManager.buildPreEntryMonitor({
    watchPrice,
    stepPercent,
    requiredRecoveries: 3,
  });

  assert(monitor.watchPrice === 100, 'Watch price is recorded as 100 USDT');
  assert(monitor.status === 'MONITORING_DROP', 'Initial status is MONITORING_DROP');
  assert(monitor.shouldBuy === false, 'Initial state: NO BUY ORDER placed');
  assert(monitor.consecutiveRecoveries === 0, 'Initial consecutive recoveries count is 0');
  assert(monitor.deepestLevelIndexReached === 0, 'No levels reached yet');

  // --- Part 2: Prohibition of Buying During Drop & Touching X Levels ---
  console.log('\n--- Part 2: No Buying During Drop or Touching X Levels ---');

  // Tick 1: Price drops from 100 to 98 (touches X1)
  let res = XRecoveryManager.evaluatePreEntryTick(monitor, 98.0);
  assert(res.shouldBuy === false, 'Touching X1 (98.0) does NOT trigger buy');
  assert(monitor.deepestLevelIndexReached === 1, 'Deepest level reached is X1');
  assert(monitor.consecutiveRecoveries === 0, 'No recoveries during downward drop');

  // Tick 2: Price drops to 96 (touches X2)
  res = XRecoveryManager.evaluatePreEntryTick(monitor, 96.0);
  assert(res.shouldBuy === false, 'Touching X2 (96.0) does NOT trigger buy');
  assert(monitor.deepestLevelIndexReached === 2, 'Deepest level reached is X2');

  // Tick 3: Price drops to 94 (touches X3)
  res = XRecoveryManager.evaluatePreEntryTick(monitor, 94.0);
  assert(res.shouldBuy === false, 'Touching X3 (94.0) does NOT trigger buy');
  assert(monitor.deepestLevelIndexReached === 3, 'Deepest level reached is X3');

  // Tick 4: Price drops to 92 (touches X4)
  res = XRecoveryManager.evaluatePreEntryTick(monitor, 92.0);
  assert(res.shouldBuy === false, 'Touching X4 (92.0) does NOT trigger buy');
  assert(monitor.deepestLevelIndexReached === 4, 'Deepest level reached is X4');

  // Tick 5: Price overshoots down to 91.5 (local low below X4)
  res = XRecoveryManager.evaluatePreEntryTick(monitor, 91.5);
  assert(res.shouldBuy === false, 'Overshooting to 91.5 does NOT trigger buy');
  assert(monitor.lowestPriceObserved === 91.5, 'Lowest price observed recorded as 91.5');
  assert(monitor.consecutiveRecoveries === 0, 'Consecutive recoveries counter remains strictly 0');

  // --- Part 3: Ascent & Reaching Level Counts as Recovery ---
  console.log('\n--- Part 3: Ascent & Level Recovery ---');

  // Tick 6: Price climbs from 91.5 to 92.0 (reaches X4)
  res = XRecoveryManager.evaluatePreEntryTick(monitor, 92.0);
  assert(res.shouldBuy === false, 'First recovery does NOT trigger buy (need 3)');
  assert(res.consecutiveRecoveries === 1, 'Reaching X4 (92.0) counts as 1st recovery');
  assert(monitor.lastRecoveredLevelIndex === 4, 'Last recovered level is X4');
  assert(monitor.status === 'RECOVERING', 'Status transitioned to RECOVERING');

  // Tick 7: Price climbs to 94.0 (reaches X3)
  res = XRecoveryManager.evaluatePreEntryTick(monitor, 94.0);
  assert(res.shouldBuy === false, 'Second recovery does NOT trigger buy (need 3)');
  assert(res.consecutiveRecoveries === 2, 'Reaching X3 (94.0) counts as 2nd consecutive recovery');
  assert(monitor.lastRecoveredLevelIndex === 3, 'Last recovered level is X3');

  // --- Part 4: Cancellation on Re-drop (إلغاء العد عند عودة الهبوط) ---
  console.log('\n--- Part 4: Cancellation on Re-Drop ---');

  // Tick 8: Instead of reaching X2 (96.0), price drops back below X3 (e.g. to 93.8)
  res = XRecoveryManager.evaluatePreEntryTick(monitor, 93.8);
  assert(res.shouldBuy === false, 'Re-drop does not trigger buy');
  assert(res.consecutiveRecoveries === 0, 'Consecutive recoveries counter CANCELLED and reset to 0');
  assert(monitor.lastRecoveredLevelIndex === null, 'Last recovered level reset to null');
  assert(monitor.recoveredLevelsHistory.length === 0, 'Recovered history reset to empty');
  assert(monitor.status === 'MONITORING_DROP', 'Status reverted to MONITORING_DROP');

  // Tick 9: Price drops further to a new lower low: 89.5 (breaches X5 at 90.0)
  res = XRecoveryManager.evaluatePreEntryTick(monitor, 89.5);
  assert(res.shouldBuy === false, 'Falling to new low does not trigger buy');
  assert(monitor.deepestLevelIndexReached === 5, 'Deepest level updated to X5');
  assert(monitor.lowestPriceObserved === 89.5, 'Lowest price observed updated to 89.5');
  assert(monitor.consecutiveRecoveries === 0, 'Counter remains 0 at new low');

  // --- Part 5: Full 3 Consecutive Recoveries Ascent to Trigger Buy ---
  console.log('\n--- Part 5: Full 3 Consecutive Recoveries to Trigger Buy ---');

  // Tick 10: Price climbs to 90.0 (reaches X5)
  res = XRecoveryManager.evaluatePreEntryTick(monitor, 90.0);
  assert(res.shouldBuy === false, 'Recovery 1 of 3: no buy yet');
  assert(res.consecutiveRecoveries === 1, 'Reaching X5 (90.0) is recovery #1');
  assert(monitor.lastRecoveredLevelIndex === 5, 'Last recovered level is X5');

  // Tick 11: Price climbs to 92.0 (reaches X4)
  res = XRecoveryManager.evaluatePreEntryTick(monitor, 92.0);
  assert(res.shouldBuy === false, 'Recovery 2 of 3: no buy yet');
  assert(res.consecutiveRecoveries === 2, 'Reaching X4 (92.0) is recovery #2');
  assert(monitor.lastRecoveredLevelIndex === 4, 'Last recovered level is X4');

  // Tick 12: Price climbs to 94.0 (reaches X3)
  res = XRecoveryManager.evaluatePreEntryTick(monitor, 94.0);
  assert(res.shouldBuy === true, 'BUY CONDITION TRIGGERED upon 3rd consecutive recovery!');
  assert(res.consecutiveRecoveries === 3, 'Consecutive recoveries counter reached exactly 3');
  assert(monitor.status === 'BUY_TRIGGERED', 'Status is BUY_TRIGGERED');
  assert(monitor.recoveredLevelsHistory.join('->') === '5->4->3', 'Recovered sequence is X5 -> X4 -> X3');

  // --- Part 6: TradeManager Integration (End-to-End) ---
  console.log('\n--- Part 6: TradeManager End-to-End Integration ---');
  const tradeManager = new TradeManager();

  // Create a trade configured for Pre-Entry Recovery
  const testSymbol = 'AVAXUSDT';
  const preEntryTrade = await tradeManager.createTradeFromManual({
    symbol: testSymbol,
    entryAmount: 150,
    entryPrice: 100, // Watch price
    stepPercent: 2.0,
    isPreEntryRecovery: true,
  });

  assert(preEntryTrade.status === 'PENDING_ENTRY', 'Trade starts in PENDING_ENTRY state (no immediate buy)');
  assert(preEntryTrade.preEntryXMonitor !== undefined, 'Trade has active preEntryXMonitor');
  assert(preEntryTrade.preEntryXMonitor!.watchPrice === 100, 'Pre-entry monitor watchPrice is 100');

  // Feed dropping ticks: 98, 96, 94, 92, 91.5
  await tradeManager.onMarketPriceTick(testSymbol, 98.0);
  assert(preEntryTrade.status === 'PENDING_ENTRY', 'Price 98: Trade still in PENDING_ENTRY');

  await tradeManager.onMarketPriceTick(testSymbol, 96.0);
  await tradeManager.onMarketPriceTick(testSymbol, 94.0);
  await tradeManager.onMarketPriceTick(testSymbol, 92.0);
  await tradeManager.onMarketPriceTick(testSymbol, 91.5);
  assert(preEntryTrade.status === 'PENDING_ENTRY', 'Price 91.5: Trade still in PENDING_ENTRY (no buy during drop)');
  assert(preEntryTrade.preEntryXMonitor!.deepestLevelIndexReached === 4, 'Deepest level reached is X4');

  // Feed ascent ticks: Recover X4 (92.0), Recover X3 (94.0)
  await tradeManager.onMarketPriceTick(testSymbol, 92.0);
  assert(preEntryTrade.status === 'PENDING_ENTRY', 'Price 92: 1 recovery achieved, still PENDING_ENTRY');
  assert(preEntryTrade.preEntryXMonitor!.consecutiveRecoveries === 1, 'Counter is 1');

  await tradeManager.onMarketPriceTick(testSymbol, 94.0);
  assert(preEntryTrade.status === 'PENDING_ENTRY', 'Price 94: 2 recoveries achieved, still PENDING_ENTRY');
  assert(preEntryTrade.preEntryXMonitor!.consecutiveRecoveries === 2, 'Counter is 2');

  // Feed re-drop tick: 93.5 (drops below X3=94.0)
  await tradeManager.onMarketPriceTick(testSymbol, 93.5);
  assert(preEntryTrade.status === 'PENDING_ENTRY', 'Price 93.5: Still PENDING_ENTRY');
  assert(preEntryTrade.preEntryXMonitor!.consecutiveRecoveries === 0, 'Re-drop cancelled recovery counter back to 0');

  // Now price climbs back and achieves 3 consecutive recoveries:
  // From 93.5 -> climbs to 94.0 (recovers X3, count=1)
  await tradeManager.onMarketPriceTick(testSymbol, 94.0);
  assert(preEntryTrade.preEntryXMonitor!.consecutiveRecoveries === 1, 'Climbed to 94: count is 1');

  // Climbs to 96.0 (recovers X2, count=2)
  await tradeManager.onMarketPriceTick(testSymbol, 96.0);
  assert(preEntryTrade.preEntryXMonitor!.consecutiveRecoveries === 2, 'Climbed to 96: count is 2');

  // Climbs to 98.0 (recovers X1, count=3) -> triggers buy!
  await tradeManager.onMarketPriceTick(testSymbol, 98.0);
  assert(preEntryTrade.status === 'OPEN', '3rd consecutive recovery triggers buy -> Trade is now OPEN!');
  assert(preEntryTrade.entry.executionPrice !== undefined, 'Trade has confirmed execution price');
  assert(preEntryTrade.levelsPlan !== undefined, 'Trade has generated T-levels plan upon entry');
  assert(preEntryTrade.levelsPlan!.t0BreakEvenPrice > 0, 'Trade has calculated T0 Break-Even');

  console.log('\n================================================================');
  console.log(`  ALL ${totalTests} PRE-ENTRY X RECOVERY TESTS PASSED (100%)!`);
  console.log('================================================================');
}

runPreEntryRecoveryTests().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
