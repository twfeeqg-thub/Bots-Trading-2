/**
 * Project Q — Bot Management Screen Integration Test Suite
 *
 * Verifies end-to-end integration of Bot Management Screen workflows:
 * 1. Fetching bot list (GET /api/engine/bots)
 * 2. Creating bot (POST /api/engine/bots)
 * 3. Starting bot cycle (POST /api/engine/bots/:id/actions with start)
 * 4. Advancing bot state (advance)
 * 5. Executing Buy via Binance Trading Layer (Mock)
 * 6. Verifying Buy fill (Verify)
 * 7. Executing Partial Sell via Binance Trading Layer (Mock)
 * 8. Executing Full Sell via Binance Trading Layer (Mock)
 * 9. Deleting bot
 * 10. Security: 100% Mock mode, zero real Binance keys.
 */

import { getSharedBotEngine } from '../lib/engine';
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
  console.log('  Executing Bot Management Screen Integration Test Suite');
  console.log('================================================================\n');

  // Checkpoint 1: Trading service is strictly in Mock mode
  assert(
    sharedBinanceTradingService.isUsingMock() === true,
    'Bot Engine trading service is operating strictly in Mock mode (Zero real Binance keys)'
  );

  const engine = await getSharedBotEngine();

  // Checkpoint 2: Create Bot
  const testBot = await engine.createBot({
    id: 'ui_integration_bot_1',
    type: 'DEAL_BOT',
    name: 'بوت تجربة واجهة الإدارة',
    symbol: 'BTCUSDT',
    entryAmount: 120,
    entryMethod: 'MARKET',
  });
  assert(testBot.getId() === 'ui_integration_bot_1', 'Create Bot via Engine');

  // Checkpoint 3: List Bots includes created bot
  const botList = engine.listBots();
  const found = botList.find((b) => b.id === 'ui_integration_bot_1');
  assert(Boolean(found && found.currentState === 'STOPPED'), 'Bot appears in listBots with initial state STOPPED');

  // Checkpoint 4: Start Bot Cycle
  const startRes = await engine.startBot('ui_integration_bot_1');
  assert(startRes.success === true && testBot.getState() === 'WAITING_FOR_ENTRY', 'Start Bot cycle moves to WAITING_FOR_ENTRY');

  // Checkpoint 5: Advance to MONITORING_ENTRY and ENTRY_TRIGGERED
  const adv1 = await engine.advanceBotState('ui_integration_bot_1', 'MONITORING_ENTRY');
  assert(adv1.success === true && testBot.getState() === 'MONITORING_ENTRY', 'Advance to MONITORING_ENTRY');

  const adv2 = await engine.advanceBotState('ui_integration_bot_1', 'ENTRY_TRIGGERED', {
    reason: 'تحقق إشارة الشاشة',
  });
  assert(adv2.success === true && testBot.getState() === 'ENTRY_TRIGGERED', 'Advance to ENTRY_TRIGGERED');

  // Checkpoint 6: Execute Buy via Trading Layer (Mock)
  const buyRes = await engine.executeBotBuy('ui_integration_bot_1', {
    quoteOrderQty: 120,
    orderType: 'MARKET',
  });
  assert(buyRes.outcome === 'SUCCESS', 'executeBotBuy returns SUCCESS outcome from Mock transport');
  assert(testBot.getState() === 'POSITION_OPEN', 'Bot transitions to POSITION_OPEN after buy execution');
  assert(testBot.getCurrentTrade()?.status === 'OPEN', 'Active trade record is OPEN');
  assert(Boolean(testBot.getCurrentTrade()?.entry.executionPrice), 'Trade execution price is documented');
  assert(Boolean(testBot.getCurrentTrade()?.entry.filledQuantity), 'Trade filled quantity is documented');

  // Checkpoint 7: Verify Order with Binance Mock
  const verifyRes = await engine.verifyBotOrder(
    'ui_integration_bot_1',
    testBot.getCurrentTrade()?.entry.orderId,
    testBot.getCurrentTrade()?.tradeId
  );
  assert(verifyRes.found === true && verifyRes.status === 'FILLED', 'verifyBotOrder returns FILLED status from Mock transport');

  // Checkpoint 8: Execute Partial Sell (Mock)
  const totalQty = testBot.getCurrentTrade()?.entry.filledQuantity || 1;
  const partialQty = Number((totalQty / 2).toFixed(6));
  const partialSellRes = await engine.executeBotSell('ui_integration_bot_1', {
    isPartial: true,
    quantity: partialQty,
    orderType: 'MARKET',
    reason: 'بيع جزئي 50%',
  });
  assert(partialSellRes.isPartial === true, 'executeBotSell partial sell returns isPartial: true');
  assert(testBot.getState() === 'VERIFYING_SELL', 'Bot enters VERIFYING_SELL for remaining quantity and does NOT close position');
  assert(testBot.getCurrentTrade()?.status !== 'CLOSED', 'Trade status remains active (NOT closed)');

  // Checkpoint 9: Execute Full Sell (Mock) from VERIFYING_SELL to close position
  const fullSellRes = await engine.executeBotSell('ui_integration_bot_1', {
    isPartial: false,
    quantity: totalQty,
    orderType: 'MARKET',
    reason: 'إغلاق بيع كامل',
  });
  assert(fullSellRes.outcome === 'SUCCESS', 'executeBotSell full sell returns SUCCESS outcome');
  assert(testBot.getState() === 'POSITION_CLOSED', 'Bot transitions to POSITION_CLOSED after full sell execution');
  assert(testBot.getCurrentTrade()?.status === 'CLOSED', 'Trade status is CLOSED');

  // Checkpoint 10: Clean up test bot
  await engine.advanceBotState('ui_integration_bot_1', 'STOPPED');
  const deleteRes = await engine.deleteBot('ui_integration_bot_1');
  assert(deleteRes === true, 'Delete bot removes test bot cleanly from engine and persistence');

  console.log('\n================================================================');
  console.log(`  ALL ${totalTests} BOT MANAGEMENT INTEGRATION TESTS PASSED!`);
  console.log('================================================================');
}

runTestSuite().catch((err) => {
  console.error('Fatal error during bot management tests:', err);
  process.exit(1);
});
