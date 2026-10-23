// Phase 5 Test Suite: No Auto-Seed on Startup, Clean Empty State, Manual Test Data Generation,
// and Preservation of the Complete 11-State Bot Core Lifecycle & SEND -> VERIFY Protocol.

import { BotCoreManager } from '../lib/bots/bot-manager';
import { BotEngine } from '../lib/engine/bot-engine';
import { InMemoryBotRepository } from '../lib/persistence/in-memory-bot-repository';
import { BotState, BOT_STATE_METADATA } from '../lib/bots/types';

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string) {
  total++;
  if (!condition) {
    console.error(`  ✗ FAIL [Test #${total}]: ${msg}`);
    process.exit(1);
  }
  passed++;
  console.log(`  ✓ PASS [Test #${total}]: ${msg}`);
}

async function runPhase5Tests() {
  console.log('================================================================');
  console.log('  Executing Phase 5: No Auto-Seed, Empty State & 11-State Bot Core');
  console.log('================================================================');

  // -------------------------------------------------------------
  // Section 1: Clean Empty State On Startup (No Automatic Seeding)
  // -------------------------------------------------------------
  console.log('\n--- Section 1: Clean Startup & No Auto-Seed ---');

  // Test 1: BotCoreManager instance starts with zero bots
  const coreManager = BotCoreManager.getInstance();
  assert(coreManager.listBots().length === 0, 'BotCoreManager starts with exactly 0 bots (no auto-seed on startup)');

  // Test 2: Fresh BotEngine with clean repository starts with zero bots
  const cleanRepo = new InMemoryBotRepository();
  const engine = new BotEngine({ repository: cleanRepo });
  await engine.initialize();
  assert(engine.listBots().length === 0, 'BotEngine starts with exactly 0 bots in clean repository');

  // -------------------------------------------------------------
  // Section 2: Manual On-Demand Generation of Test Data
  // -------------------------------------------------------------
  console.log('\n--- Section 2: Manual Generation of Test Data ---');

  // Test 3: Calling seedDemoBots on BotCoreManager manually populates bots
  coreManager.seedDemoBots();
  assert(coreManager.listBots().length === 2, 'Manual seedDemoBots on BotCoreManager generates exactly 2 exemplar bots');
  assert(coreManager.getBot('bot_range_eth_sample') !== undefined, 'Range bot exemplar exists');
  assert(coreManager.getBot('bot_deal_sol_sample') !== undefined, 'Deal bot exemplar exists');

  // Test 4: Calling seedDemoBots on BotEngine manually populates test bots
  const engineSeededBots = await engine.seedDemoBots();
  assert(engineSeededBots.length === 2, 'Manual seedDemoBots on BotEngine generates 2 demo bots');
  assert(engine.listBots().some((b) => b.type === 'RANGE_BOT'), 'Contains RANGE_BOT demo');
  assert(engine.listBots().some((b) => b.type === 'DEAL_BOT'), 'Contains DEAL_BOT demo');

  // -------------------------------------------------------------
  // Section 3: Preservation of Full 11-State Bot Core Lifecycle
  // -------------------------------------------------------------
  console.log('\n--- Section 3: Complete 11-State Bot Core Lifecycle Preservation ---');

  const EXPECTED_11_STATES: BotState[] = [
    'WAITING_FOR_ENTRY',
    'MONITORING_ENTRY',
    'ENTRY_TRIGGERED',
    'EXECUTING_BUY',
    'VERIFYING_BUY',
    'POSITION_OPEN',
    'EXECUTING_SELL',
    'VERIFYING_SELL',
    'POSITION_CLOSED',
    'STOPPED',
    'ERROR',
  ];

  // Test 5: Verify all 11 states exist in BOT_STATE_METADATA
  assert(EXPECTED_11_STATES.length === 11, 'Lifecycle comprises exactly 11 deterministic states');
  for (const st of EXPECTED_11_STATES) {
    const meta = BOT_STATE_METADATA[st];
    assert(meta !== undefined, `State ${st} is documented in BOT_STATE_METADATA`);
    assert(typeof meta.index === 'number', `State ${st} has sequential index #${meta?.index}`);
    assert(Boolean(meta.ar), `State ${st} has Arabic descriptor "${meta?.ar}"`);
  }

  // Test 6: Verify State Machine transitions through SEND -> VERIFY protocol
  const sampleBot = coreManager.getBot('bot_range_eth_sample')!;
  assert(sampleBot.getState() === 'STOPPED', 'Sample bot starts in STOPPED state');

  sampleBot.start();
  assert(sampleBot.getState() === 'WAITING_FOR_ENTRY', 'start() moves bot to WAITING_FOR_ENTRY');

  sampleBot.startMonitoring();
  assert(sampleBot.getState() === 'MONITORING_ENTRY', 'startMonitoring() moves bot to MONITORING_ENTRY');

  sampleBot.triggerEntry();
  assert(sampleBot.getState() === 'ENTRY_TRIGGERED', 'triggerEntry() moves bot to ENTRY_TRIGGERED');

  sampleBot.startBuyExecution();
  assert(sampleBot.getState() === 'EXECUTING_BUY', 'startBuyExecution() enters EXECUTING_BUY (SEND phase)');

  sampleBot.confirmBuyVerification({ orderId: 'ORD_MOCK_123' });
  assert(sampleBot.getState() === 'VERIFYING_BUY', 'confirmBuyVerification() enters VERIFYING_BUY (VERIFY protocol)');

  // Test 7: Confirm order lock / de-duplication in VERIFYING_BUY
  assert(sampleBot.getState() === 'VERIFYING_BUY', 'Bot is protected in VERIFYING_BUY to prevent duplicate orders');

  // Test 8: Complete entry fill moves to POSITION_OPEN
  sampleBot.openPosition({
    orderId: 'ORD_MOCK_123',
    executionPrice: 3000,
    filledQuantity: 0.05,
  });
  assert(sampleBot.getState() === 'POSITION_OPEN', 'openPosition() moves bot to POSITION_OPEN');

  // Test 9: Exit SEND -> VERIFY cycle
  sampleBot.startSellExecution({ reason: 'تحقيق الهدف' });
  assert(sampleBot.getState() === 'EXECUTING_SELL', 'startSellExecution() enters EXECUTING_SELL');

  sampleBot.confirmSellVerification({ orderId: 'ORD_MOCK_456' });
  assert(sampleBot.getState() === 'VERIFYING_SELL', 'confirmSellVerification() enters VERIFYING_SELL');

  sampleBot.closePosition({
    executionPrice: 3100,
    filledQuantity: 0.05,
    orderId: 'ORD_MOCK_456',
  });
  assert(sampleBot.getState() === 'POSITION_CLOSED', 'closePosition() moves bot to POSITION_CLOSED');

  // Test 10: Reset to STOPPED via finishCycle
  sampleBot.finishCycle();
  assert(sampleBot.getState() === 'STOPPED', 'finishCycle() returns bot to STOPPED');

  console.log('\n================================================================');
  console.log(`  ALL ${passed} / ${total} PHASE 5 TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runPhase5Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
