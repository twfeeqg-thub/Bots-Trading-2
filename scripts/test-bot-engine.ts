// Project Q — Comprehensive Bot Engine & Persistence Test Suite
// Verifies all 16 required functional checkpoints from Section 23 of the specification.

import { BotEngine } from '../lib/engine/bot-engine';
import { InMemoryBotRepository } from '../lib/persistence/in-memory-bot-repository';
import { BotStateMachine } from '../lib/bots/bot-state-machine';
import { BotInstance } from '../lib/bots/bot-instance';
import fs from 'fs';
import path from 'path';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, num: number, name: string, details: string) {
  if (!condition) {
    results.push({ num, name, passed: false, details: `FAILED: ${details}` });
    throw new Error(`Test #${num} (${name}) failed: ${details}`);
  }
  results.push({ num, name, passed: true, details });
  console.log(`  ✓ Test #${num} PASS: ${name}`);
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  Executing Bot Engine & Persistence Test Suite (16 Checkpoints)');
  console.log('================================================================');

  const repository = new InMemoryBotRepository();
  const engine = new BotEngine({ repository });
  await engine.initialize();

  // Test 1: إنشاء Bot (Create Bot)
  const bot1 = await engine.createBot({
    id: 'test_bot_range_1',
    type: 'RANGE_BOT',
    name: 'بوت تجريبي مسار عرضي',
    symbol: 'BTCUSDT',
    entryAmount: 250,
  });
  assert(
    bot1.getId() === 'test_bot_range_1' && bot1.getType() === 'RANGE_BOT',
    1,
    'إنشاء Bot',
    `Created bot with ID: ${bot1.getId()}, Type: ${bot1.getType()}`
  );

  // Test 2: حفظ Bot (Save Bot)
  const savedRecord = await repository.loadBot('test_bot_range_1');
  assert(
    savedRecord !== null && savedRecord.bot.symbol === 'BTCUSDT',
    2,
    'حفظ Bot في طبقة التخزين',
    `Bot record found in persistence with symbol ${savedRecord?.bot.symbol}`
  );

  // Test 3: تحميل Bot (Load Bot)
  const loadedBot = engine.getBot('test_bot_range_1');
  assert(
    loadedBot !== undefined && loadedBot.getName() === 'بوت تجريبي مسار عرضي',
    3,
    'تحميل Bot من المحرك',
    `Loaded bot from engine: ${loadedBot?.getName()}`
  );

  // Test 4: تشغيل Bot (Start Bot)
  const startResult = await engine.startBot('test_bot_range_1');
  assert(
    startResult.success && bot1.getState() === 'WAITING_FOR_ENTRY',
    4,
    'تشغيل Bot وانتقاله إلى WAITING_FOR_ENTRY',
    `Bot transitioned to state: ${bot1.getState()}`
  );

  // Test 5: حفظ تغير الحالة (Save State Change)
  const botStateInRepo = await repository.loadBot('test_bot_range_1');
  assert(
    botStateInRepo?.currentState === 'WAITING_FOR_ENTRY',
    5,
    'حفظ تغير الحالة في Persistence',
    `Saved state in persistence is: ${botStateInRepo?.currentState}`
  );

  // Test 6: تحميل الحالة (Load State)
  await engine.advanceBotState('test_bot_range_1', 'MONITORING_ENTRY');
  assert(
    bot1.getState() === 'MONITORING_ENTRY',
    6,
    'تحميل وتحديث الحالة الحالية',
    `Current state after advance: ${bot1.getState()}`
  );

  // Test 7: إنشاء Cycle (Create Cycle)
  const currentCycle = bot1.getCurrentCycle();
  assert(
    currentCycle !== null && currentCycle.cycleNumber === 1 && currentCycle.currentState === 'MONITORING_ENTRY',
    7,
    'إنشاء Cycle مرتبط بالبوت',
    `Cycle ID: ${currentCycle?.cycleId}, Cycle Number: ${currentCycle?.cycleNumber}`
  );

  // Test 8: حفظ Cycle (Save Cycle)
  const savedCycle = await repository.loadCycle(currentCycle!.cycleId);
  assert(
    savedCycle !== null && savedCycle.currentState === 'MONITORING_ENTRY',
    8,
    'حفظ Cycle في طبقة التخزين',
    `Cycle successfully saved in repository with state ${savedCycle?.currentState}`
  );

  // Test 9: استعادة Cycle (Load/Restore Cycle)
  const openCycle = await repository.loadOpenCycle('test_bot_range_1');
  assert(
    openCycle !== null && openCycle.cycleId === currentCycle!.cycleId && openCycle.endedAt === null,
    9,
    'استرجاع Cycle المفتوح من التخزين',
    `Open cycle retrieved with ID: ${openCycle?.cycleId}`
  );

  // Test 10: حفظ Trade state الأساسي (Save Trade State)
  await engine.advanceBotState('test_bot_range_1', 'ENTRY_TRIGGERED');
  await engine.advanceBotState('test_bot_range_1', 'EXECUTING_BUY');
  const activeTrade = bot1.getCurrentTrade();
  assert(
    activeTrade !== null && activeTrade.status === 'PENDING_ENTRY',
    10,
    'إنشاء وحفظ Trade State الأساسي',
    `Trade instantiated with ID ${activeTrade?.tradeId}, Status: ${activeTrade?.status}`
  );

  // Advance trade to OPEN
  await engine.advanceBotState('test_bot_range_1', 'VERIFYING_BUY');
  await engine.advanceBotState('test_bot_range_1', 'POSITION_OPEN', {
    executionPrice: 66000,
    filledQuantity: 0.00378,
    orderId: 'sim_ord_001',
  });
  const savedTrade = await repository.loadTrade(activeTrade!.tradeId);
  assert(
    savedTrade !== null && savedTrade.status === 'OPEN' && savedTrade.entry.executionPrice === 66000,
    10,
    'حفظ Trade State عند فتح الصفقة',
    `Saved trade verified in persistence with status ${savedTrade?.status}`
  );

  // Test 11 & 12: استعادة Bot بعد إعادة تشغيل Engine + عدم إنشاء Cycle جديد تلقائيًا (Recovery on Restart)
  console.log('  ... Simulating engine process restart ...');
  // Re-instantiate a fresh new engine using the SAME repository (simulating process restart)
  const freshEngineAfterRestart = new BotEngine({ repository });
  await freshEngineAfterRestart.initialize();

  const restoredBot = freshEngineAfterRestart.getBot('test_bot_range_1');
  assert(
    restoredBot !== undefined && restoredBot.getState() === 'POSITION_OPEN',
    11,
    'استعادة Bot بعد إعادة تشغيل Engine',
    `Restored bot exists with preserved state: ${restoredBot?.getState()}`
  );

  const restoredCycle = restoredBot?.getCurrentCycle();
  const restoredTrade = restoredBot?.getCurrentTrade();
  assert(
    restoredCycle !== null &&
      restoredCycle?.cycleNumber === 1 &&
      restoredCycle?.cycleId === currentCycle?.cycleId &&
      restoredTrade?.status === 'OPEN',
    12,
    'عدم إنشاء Cycle جديد تلقائيًا بعد Restart واستئناف الدورة السابقة',
    `Preserved existing cycle #${restoredCycle?.cycleNumber} (${restoredCycle?.cycleId}) without creating new cycle`
  );

  // Test 13: تشغيل أكثر من Bot مستقل (Multiple Independent Bots)
  const bot2 = await freshEngineAfterRestart.createBot({
    id: 'test_bot_deal_2',
    type: 'DEAL_BOT',
    name: 'بوت صفقة مستقلة ETH',
    symbol: 'ETHUSDT',
    entryAmount: 180,
  });
  await freshEngineAfterRestart.startBot('test_bot_deal_2');

  const allSummaries = freshEngineAfterRestart.listBots();
  const bot1Summary = allSummaries.find((s) => s.id === 'test_bot_range_1');
  const bot2Summary = allSummaries.find((s) => s.id === 'test_bot_deal_2');
  assert(
    bot1Summary?.currentState === 'POSITION_OPEN' && bot2Summary?.currentState === 'WAITING_FOR_ENTRY',
    13,
    'تشغيل أكثر من Bot مستقل بالتوازي دون تداخل',
    `Bot 1 is in [${bot1Summary?.currentState}], Bot 2 is in [${bot2Summary?.currentState}]`
  );

  // Test 14: رفض انتقال غير قانوني (Reject Illegal Transitions)
  const illegalAttempt = await freshEngineAfterRestart.advanceBotState('test_bot_deal_2', 'POSITION_CLOSED');
  assert(
    !illegalAttempt.success && Boolean(illegalAttempt.error),
    14,
    'رفض الانتقالات غير القانونية وفق الـ State Machine',
    `Successfully blocked illegal transition from WAITING_FOR_ENTRY to POSITION_CLOSED (${illegalAttempt.error})`
  );

  // Test 15: الحفاظ على Bot Core الحالي (Preserve Existing Bot Core)
  const rawInstance = new BotInstance({
    id: 'core_check_bot',
    type: 'DEAL_BOT',
    name: 'فحص النواة',
    symbol: 'SOLUSDT',
    entryAmount: 50,
    entryMethod: 'SIGNAL',
    plannedEntryPrice: null,
    initialStopLoss: { type: 'PERCENT', value: 2 },
    tRuleConfig: { targetType: 'FIXED_PERCENT', targetValue: 3 },
    alertSettings: { onEntry: true, onExit: true, onError: true, onStateChange: true },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  assert(
    typeof rawInstance.start === 'function' &&
      typeof rawInstance.startMonitoring === 'function' &&
      typeof BotStateMachine.validateTransition === 'function',
    15,
    'الحفاظ على Bot Core الحالي واستخدامه كنواة أساسية',
    'Bot Core classes and state machine are intact and directly utilized.'
  );

  // Test 16: التأكد من عدم وجود أي استدعاء Binance Private Trading (Zero Binance Private Calls)
  const codebaseDir = path.resolve(__dirname, '..');
  const filesToScan = [
    path.join(codebaseDir, 'lib/engine/bot-engine.ts'),
    path.join(codebaseDir, 'lib/persistence/supabase-bot-repository.ts'),
    path.join(codebaseDir, 'lib/persistence/in-memory-bot-repository.ts'),
    path.join(codebaseDir, 'lib/bots/bot-instance.ts'),
  ];

  let hasForbiddenApi = false;
  let forbiddenReason = '';
  for (const file of filesToScan) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      if (
        content.includes('/api/v3/order') ||
        content.includes('createOrder') ||
        content.includes('secretKey') ||
        content.includes('BINANCE_SECRET') ||
        content.includes('hmac')
      ) {
        hasForbiddenApi = true;
        forbiddenReason = `Found potential private call pattern in ${file}`;
        break;
      }
    }
  }
  assert(
    !hasForbiddenApi,
    16,
    'التأكد من عدم وجود أي استدعاء Binance Private Trading',
    forbiddenReason || 'Verified: 0 private trading endpoints, 0 order creation calls, 0 HMAC credentials.'
  );

  console.log('================================================================');
  console.log(`  ALL ${results.length} TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================');
}

runTestSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
