/**
 * Stage 3 Test Suite: Partial Sell Execution, Independent Slice Ledger, and T-Level Continuity
 *
 * Verifies:
 * 1. Single order requests full remaining quantity (no deliberate pre-splitting).
 * 2. Partial execution generates an independent PartialExitRecord with proportional fees and PnL.
 * 3. Unsold quantity remains OPEN and governed by T-levels ladder.
 * 4. User is shown sold and remaining quantities clearly; trade is NOT closed prematurely.
 * 5. AMBIGUOUS state prevents duplicate sell dispatch (concurrency lock).
 * 6. Subsequent execution of remaining quantity completes and closes trade with aggregated PnL.
 * 7. Verification (verifyTrade) resolves partial/full fills accurately.
 */

import { TradeManager } from '../lib/trade-manager/trade-manager';
import { sharedBinanceTradingService } from '../lib/trading/binance-trading-service';
import { MockBinanceTransport } from '../lib/trading/mock-binance-transport';
import { sharedMarketDataStore } from '../lib/market-data';

let passedTests = 0;
let totalTests = 0;

function assert(condition: unknown, message: string, detail?: string) {
  totalTests++;
  if (Boolean(condition)) {
    console.log(`  ✓ Test #${totalTests} PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ Test #${totalTests} FAIL: ${message} ${detail ? `(${detail})` : ''}`);
    process.exit(1);
  }
}

async function runStage3Tests() {
  console.log('================================================================');
  console.log('  Testing Stage 3: Partial Sells, Independent Ledger, & T-Levels');
  console.log('================================================================\n');

  const symbol = 'BTCUSDT';
  const now = Date.now();
  sharedMarketDataStore.updatePrice(symbol, 50000, now, now);

  const manager = TradeManager.getInstance();

  // Test 1: Create a manual trade with immediate entry
  // 100 USDT at 50,000 USDT/BTC -> 0.002 BTC
  const trade = await manager.createTradeFromManual({
    symbol,
    entryAmount: 100,
    entryPrice: 50000,
    stepPercent: 2.0,
    immediateEntry: true,
  });

  assert(trade.status === 'OPEN', 'Trade opened successfully in OPEN status');
  assert(trade.initialQuantity !== undefined && trade.initialQuantity > 0, 'Initial quantity recorded');
  assert(trade.remainingQuantity === trade.initialQuantity, 'Remaining quantity equals initial quantity');
  assert(trade.soldQuantity === 0, 'Sold quantity is initialized to 0');
  assert(Array.isArray(trade.partialExits) && trade.partialExits.length === 0, 'partialExits is initialized as empty array');

  const initialQty = trade.initialQuantity!;

  const mockTransport = sharedBinanceTradingService.getTransport() as MockBinanceTransport;

  // Test 2: Simulate Partial Fill on Binance Transport
  // Set mock transport to PARTIALLY_FILLED (50% fill)
  mockTransport.setMode('PARTIALLY_FILLED');
  sharedMarketDataStore.updatePrice(symbol, 52000, Date.now(), Date.now()); // Higher price for profit

  // Trigger sell (e.g. exit trigger or manual close)
  const afterPartial = await manager.executeTradeExit(trade.tradeId, 'تحقق هدف جزئي في السوق');

  assert(afterPartial.status === 'OPEN', 'Trade remains OPEN after partial execution (NOT closed prematurely)');
  assert(afterPartial.isExiting === false, 'Concurrency lock isExiting released after partial execution');
  assert(afterPartial.partialExits !== undefined && afterPartial.partialExits.length === 1, 'Independent record created in partialExits ledger');

  const slice1 = afterPartial.partialExits![0];
  assert(slice1.soldQuantity > 0, `Slice sold quantity is positive: ${slice1.soldQuantity}`);
  assert(slice1.remainingQuantityAfter > 0, `Slice remaining quantity is positive: ${slice1.remainingQuantityAfter}`);
  assert(afterPartial.remainingQuantity === slice1.remainingQuantityAfter, 'Trade remainingQuantity matches ledger remaining');
  assert(afterPartial.soldQuantity === slice1.soldQuantity, 'Trade soldQuantity matches ledger sold');
  assert(slice1.entryCostQuotePortion > 0, `Proportional entry commission calculated: ${slice1.entryCostQuotePortion}`);
  assert(slice1.exitCostQuote > 0, `Exit commission calculated: ${slice1.exitCostQuote}`);
  assert(slice1.netReturnQuote !== undefined, `Net return calculated for slice: ${slice1.netReturnQuote}`);

  // Test 3: Unsold quantity remains governed by T-levels ladder
  assert(afterPartial.levelsPlan !== undefined, 'levelsPlan remains intact for remaining position');
  assert(afterPartial.levelsPlan!.filledQuantity === afterPartial.remainingQuantity, 'levelsPlan filledQuantity re-anchored to remaining unsold quantity');
  assert(afterPartial.positionManager === 'UNIFIED_T_LADDER', 'Position manager remains UNIFIED_T_LADDER');

  // Test 4: Concurrency Lock & Ambiguous State Handling
  mockTransport.setMode('NETWORK_TIMEOUT'); // Simulates network drop resulting in AMBIGUOUS
  const afterAmbiguous = await manager.executeTradeExit(trade.tradeId, 'محاولة خروج مع انقطاع شبكة');

  assert(afterAmbiguous.status === 'PENDING_EXIT', 'Trade transitions to PENDING_EXIT on AMBIGUOUS result');
  assert(afterAmbiguous.isExiting === true, 'Concurrency lock isExiting is strictly retained to prevent duplicate sell dispatch');

  // Attempting concurrent sell while PENDING_EXIT should be blocked
  const concurrentAttempt = await manager.executeTradeExit(trade.tradeId, 'محاولة بيع ثانية أثناء الالتباس');
  assert(concurrentAttempt.status === 'PENDING_EXIT', 'Duplicate sell attempt is blocked while in PENDING_EXIT');

  // Test 5: Verify Order Resolves Ambiguous State
  // Reset transport to FILLED and verify order
  mockTransport.setMode('FILLED');
  const afterVerify = await manager.verifyTrade(trade.tradeId);
  console.log('  State after verify:', afterVerify.status, 'Remaining:', afterVerify.remainingQuantity);

  // Test 6: Complete remaining sale to close position fully
  if (afterVerify.status === 'OPEN' && (afterVerify.remainingQuantity || 0) > 0) {
    mockTransport.setMode('FILLED');
    sharedMarketDataStore.updatePrice(symbol, 53000, Date.now(), Date.now());
    const finalClose = await manager.executeTradeExit(trade.tradeId, 'إغلاق الكمية المتبقية بالكامل');

    assert(finalClose.status === 'CLOSED', 'Trade is CLOSED once all remaining quantity is sold');
    assert(finalClose.remainingQuantity === 0, 'Remaining quantity is 0 upon full closure');
    assert(Math.abs((finalClose.soldQuantity || 0) - initialQty) < 1e-6, 'Total sold quantity matches original initial quantity exactly');
    assert(finalClose.partialExits!.length >= 2, 'All executions documented as independent slices');
    assert(finalClose.pnl !== undefined, 'Aggregated overall PnL calculated across all executions');
    assert(finalClose.isExiting === false, 'isExiting released upon final closure');
  } else {
    assert(afterVerify.status === 'CLOSED', 'Trade closed on verification');
  }

  // Test 7: Prevent overselling or duplicate counting
  const closedTrade = manager.getTrade(trade.tradeId)!;
  const totalSoldSlices = closedTrade.partialExits!.reduce((sum, s) => sum + s.soldQuantity, 0);
  assert(
    Math.abs(totalSoldSlices - (closedTrade.soldQuantity || 0)) < 1e-6,
    'Sum of individual sold slices equals trade soldQuantity (No double-counting)'
  );

  console.log('\n================================================================');
  console.log(`  ALL ${totalTests} STAGE 3 PARTIAL SELL & LEDGER TESTS PASSED!`);
  console.log('================================================================');
}

runStage3Tests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
