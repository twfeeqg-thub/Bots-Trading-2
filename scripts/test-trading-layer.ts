/**
 * Project Q — Binance Trading Layer (V1) Test Suite
 *
 * Verifies:
 * 1. Cryptographic HMAC SHA-256 Signer & deterministic clientOrderId generator.
 * 2. OrderLockManager: strict duplicate prevention & ambiguous lock handling.
 * 3. Separation of SEND and VERIFY.
 * 4. Successful Buy execution (FILLED -> SUCCESS, correct avgPrice, commission).
 * 5. Rejected Buy execution (4xx, e.g. insufficient balance -> FAILED, lock released, no blind retry).
 * 6. Ambiguous Buy execution (network drop/timeout -> AMBIGUOUS, needsVerification: true).
 * 7. Prevention of duplicate send while ambiguous (VERIFY FIRST!).
 * 8. Order Verification (querying Binance to resolve ambiguous order to FILLED or NOT_FOUND).
 * 9. Sell execution (both full sell and partial sell support).
 * 10. Bot Engine Integration:
 *     - Buy FILLED -> Bot Core advances ENTRY_TRIGGERED -> VERIFYING_BUY -> POSITION_OPEN.
 *     - Buy AMBIGUOUS -> Bot Core remains in VERIFYING_BUY (does NOT open position).
 *     - Verify resolves -> Bot Core advances to POSITION_OPEN.
 *     - Sell FILLED -> Bot Core advances POSITION_OPEN -> VERIFYING_SELL -> POSITION_CLOSED.
 * 11. Security: Zero real keys, 100% server-side mock transport.
 */

import {
  BinanceSigner,
  BinanceTradingClient,
  OrderLockManager,
  BinanceTradingService,
  IBinanceTransport,
  BinanceRawOrderResponse,
  BinanceRawQueryOrderResponse,
  BinanceOrderSide,
  BinanceOrderType,
  BinanceTimeInForce,
  BinanceApiError,
  NetworkAmbiguousError,
} from '../lib/trading';
import { BotEngine } from '../lib/engine/bot-engine';
import { InMemoryBotRepository } from '../lib/persistence/in-memory-bot-repository';

let passedTests = 0;
let totalTests = 0;

function assert(condition: unknown, testName: string, detail?: string) {
  totalTests++;
  if (Boolean(condition)) {
    console.log(`  ✓ Test #${totalTests} PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ Test #${totalTests} FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    process.exit(1);
  }
}

/**
 * Mock Transport for deterministic testing of all execution paths
 */
class MockBinanceTransport implements IBinanceTransport {
  public nextSendBehavior:
    | { type: 'SUCCESS'; fills?: Array<{ price: string; qty: string; commission: string; commissionAsset: string; tradeId: number }>; status?: 'FILLED' | 'PARTIALLY_FILLED' | 'NEW' }
    | { type: 'API_ERROR'; code: number; msg: string }
    | { type: 'NETWORK_TIMEOUT'; msg: string }
    | { type: 'SERVER_5XX'; status: number; msg: string } = { type: 'SUCCESS', status: 'FILLED' };

  public nextQueryBehavior:
    | { type: 'FOUND'; status: 'FILLED' | 'PARTIALLY_FILLED' | 'NEW' | 'CANCELED'; side: BinanceOrderSide; executedQty: string; cummulativeQuoteQty: string }
    | { type: 'NOT_FOUND'; code: number; msg: string }
    | { type: 'TIMEOUT'; msg: string } = {
    type: 'FOUND',
    status: 'FILLED',
    side: 'BUY',
    executedQty: '0.0015',
    cummulativeQuoteQty: '100.0',
  };

  public lastSentParams: Record<string, unknown> | null = null;
  public lastQueryParams: Record<string, unknown> | null = null;

  public async sendOrder(params: {
    symbol: string;
    side: BinanceOrderSide;
    type: BinanceOrderType;
    quantity?: number;
    quoteOrderQty?: number;
    price?: number;
    timeInForce?: BinanceTimeInForce;
    newClientOrderId: string;
  }): Promise<BinanceRawOrderResponse> {
    this.lastSentParams = params;

    if (this.nextSendBehavior.type === 'NETWORK_TIMEOUT') {
      throw new NetworkAmbiguousError(this.nextSendBehavior.msg, params.newClientOrderId);
    }

    if (this.nextSendBehavior.type === 'SERVER_5XX') {
      throw new NetworkAmbiguousError(`Binance 5xx Server Error (${this.nextSendBehavior.status}): ${this.nextSendBehavior.msg}`, params.newClientOrderId);
    }

    if (this.nextSendBehavior.type === 'API_ERROR') {
      throw new BinanceApiError(`Binance API Error [${this.nextSendBehavior.code}]: ${this.nextSendBehavior.msg}`, this.nextSendBehavior.code, 400, params.newClientOrderId);
    }

    const isBuy = params.side === 'BUY';
    const executedQty = params.quantity ? String(params.quantity) : '0.00154';
    const quoteQty = params.quoteOrderQty ? String(params.quoteOrderQty) : '100.0';

    return {
      symbol: params.symbol,
      orderId: Math.floor(Math.random() * 1000000) + 1000,
      orderListId: -1,
      clientOrderId: params.newClientOrderId,
      transactTime: Date.now(),
      price: params.price ? String(params.price) : '65000.00',
      origQty: executedQty,
      executedQty,
      cummulativeQuoteQty: quoteQty,
      status: this.nextSendBehavior.status || 'FILLED',
      timeInForce: 'GTC',
      type: params.type,
      side: params.side,
      fills: this.nextSendBehavior.fills || [
        {
          price: '65000.00',
          qty: executedQty,
          commission: '0.000015',
          commissionAsset: isBuy ? 'BTC' : 'USDT',
          tradeId: 123456,
        },
      ],
    };
  }

  public async queryOrder(params: {
    symbol: string;
    orderId?: number;
    origClientOrderId?: string;
  }): Promise<BinanceRawQueryOrderResponse> {
    this.lastQueryParams = params;

    if (this.nextQueryBehavior.type === 'TIMEOUT') {
      throw new NetworkAmbiguousError(`Query timeout: ${this.nextQueryBehavior.msg}`, params.origClientOrderId);
    }

    if (this.nextQueryBehavior.type === 'NOT_FOUND') {
      throw new BinanceApiError(
        `Binance Query Error [${this.nextQueryBehavior.code}]: ${this.nextQueryBehavior.msg}`,
        this.nextQueryBehavior.code,
        400,
        params.origClientOrderId
      );
    }

    return {
      symbol: params.symbol,
      orderId: params.orderId || 998877,
      orderListId: -1,
      clientOrderId: params.origClientOrderId || 'MOCK_CLIENT_ID',
      price: '65000.00',
      origQty: this.nextQueryBehavior.executedQty,
      executedQty: this.nextQueryBehavior.executedQty,
      cummulativeQuoteQty: this.nextQueryBehavior.cummulativeQuoteQty,
      status: this.nextQueryBehavior.status,
      timeInForce: 'GTC',
      type: 'MARKET',
      side: this.nextQueryBehavior.side,
      time: Date.now() - 5000,
      updateTime: Date.now(),
      isWorking: false,
    };
  }

  public async cancelOrder(): Promise<BinanceRawOrderResponse> {
    throw new Error('Not implemented in mock');
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  Executing Binance Trading Layer Test Suite (V1)');
  console.log('================================================================\n');

  // --- Checkpoint 0: Safe Mock Default & Security Hardening (Zero Real Keys Required) ---
  const defaultService = new BinanceTradingService();
  assert(defaultService.isUsingMock() === true, 'Default BinanceTradingService safely uses MockBinanceTransport when real keys are absent (Zero real Binance calls)');

  // 0.1 Placeholder keys must NEVER be considered valid
  const placeholderSigner = new BinanceSigner({
    apiKey: 'your-binance-api-key-placeholder',
    apiSecret: 'your-binance-api-secret-placeholder',
    baseUrl: 'https://api.binance.com',
  });
  assert(placeholderSigner.hasCredentials() === false, 'Placeholder credentials from .env.example strictly evaluate hasCredentials() === false');

  // 0.2 Dummy/Short keys without live flag must NEVER be considered valid
  const dummySigner = new BinanceSigner({
    apiKey: 'dummy_test_key_12345',
    apiSecret: 'dummy_secret_54321',
    baseUrl: 'https://api.binance.com',
  });
  assert(dummySigner.hasCredentials() === false, 'Dummy/test keys evaluate hasCredentials() === false');

  // 0.3 BINANCE_API_BASE_URL alone must NEVER trigger real connection
  const baseUrlOnlySigner = new BinanceSigner({
    baseUrl: 'https://api.binance.com',
  });
  assert(baseUrlOnlySigner.hasCredentials() === false, 'BINANCE_API_BASE_URL alone evaluates hasCredentials() === false');

  // 0.4 BinanceTradingClient must strictly BLOCK any outbound call when hasCredentials() === false
  const blockedClient = new BinanceTradingClient(placeholderSigner);
  let blockedErrorCaught = false;
  try {
    await blockedClient.sendOrder({
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'MARKET',
      quoteOrderQty: 10,
      newClientOrderId: 'TEST_BLOCKED',
    });
  } catch (err: unknown) {
    if ((err as Error).message.includes('Outbound call blocked')) {
      blockedErrorCaught = true;
    }
  }
  assert(blockedErrorCaught === true, 'BinanceTradingClient strictly blocks outbound HTTP fetch when live trading is disabled');

  // --- Checkpoint 1: Cryptographic Signer & ClientOrderId ---
  const signer = new BinanceSigner({
    apiKey: 'test-api-key',
    apiSecret: 'test-secret-key-very-secure',
    baseUrl: 'https://api.binance.com',
  });

  const signed = signer.signParams({ symbol: 'BTCUSDT', side: 'BUY' });
  assert(signed.includes('signature=') && signed.includes('timestamp='), 'BinanceSigner generates valid signed query with timestamp and HMAC signature');

  const buyClientOrderId = BinanceSigner.generateClientOrderId('BUY', 'bot_123', 'cycle_1');
  const sellClientOrderId = BinanceSigner.generateClientOrderId('SELL', 'bot_123', 'trade_1');

  assert(buyClientOrderId.startsWith('Q_BUY_') && buyClientOrderId.length <= 36, 'generateClientOrderId creates valid <=36 char ID with Q_BUY_ prefix');
  assert(sellClientOrderId.startsWith('Q_SELL_') && sellClientOrderId.length <= 36, 'generateClientOrderId creates valid <=36 char ID with Q_SELL_ prefix');

  // --- Checkpoint 2: OrderLockManager (Duplicate Prevention & Ambiguous Management) ---
  const lockManager = new OrderLockManager();

  // Test IDLE state
  const idleCheck = lockManager.canSend('bot_test_1', 'BUY');
  assert(idleCheck.allowed === true, 'OrderLockManager allows sending when IDLE');

  // Acquire lock
  const acquireRes = lockManager.acquireLock('bot_test_1', 'BUY', 'BTCUSDT', buyClientOrderId, 'cycle_1');
  assert(acquireRes.acquired === true, 'OrderLockManager acquires lock for new order');

  // Attempt duplicate send while IN_FLIGHT
  const duplicateCheck = lockManager.canSend('bot_test_1', 'BUY');
  assert(duplicateCheck.allowed === false, 'OrderLockManager BLOCKS duplicate order while IN_FLIGHT');

  // Mark ambiguous upon network issue
  lockManager.markAmbiguous('bot_test_1', 'BUY', buyClientOrderId, 'Simulated timeout');
  const ambiguousCheck = lockManager.canSend('bot_test_1', 'BUY');
  assert(ambiguousCheck.allowed === false && ambiguousCheck.reason?.includes('VERIFY'), 'OrderLockManager BLOCKS subsequent send when AMBIGUOUS (VERIFY FIRST)');

  // Release lock
  lockManager.releaseLock('bot_test_1', 'BUY', buyClientOrderId);
  const releasedCheck = lockManager.canSend('bot_test_1', 'BUY');
  assert(releasedCheck.allowed === true, 'OrderLockManager allows send after lock is released');

  // --- Checkpoint 3: Successful Buy Execution (SEND -> FILLED -> SUCCESS) ---
  const mockTransport = new MockBinanceTransport();
  const testLockManager = new OrderLockManager();
  const tradingService = new BinanceTradingService({
    transport: mockTransport,
    lockManager: testLockManager,
  });

  mockTransport.nextSendBehavior = { type: 'SUCCESS', status: 'FILLED' };
  const buySuccessResult = await tradingService.executeBuy({
    botId: 'bot_alpha',
    cycleId: 'cycle_100',
    symbol: 'BTCUSDT',
    quoteOrderQty: 150,
  });

  assert(buySuccessResult.sent === true, 'Buy sent flag is true');
  assert(buySuccessResult.outcome === 'SUCCESS', 'Buy outcome is SUCCESS when Binance returns FILLED');
  assert(buySuccessResult.isFinal === true, 'Buy isFinal is true when FILLED');
  assert(buySuccessResult.needsVerification === false, 'Buy needsVerification is false when FILLED');
  assert(Boolean(buySuccessResult.orderId), 'Buy orderId is populated from Binance response');
  assert(buySuccessResult.avgPrice === 65000, 'Buy avgPrice is calculated accurately from fills');
  assert(buySuccessResult.commission?.asset === 'BTC', 'Buy commission is extracted accurately');
  assert(testLockManager.canSend('bot_alpha', 'BUY').allowed === true, 'Lock is released after successful FILLED execution');

  // --- Checkpoint 4: Rejected Buy Execution (4xx Client Error -> FAILED, No blind retry) ---
  mockTransport.nextSendBehavior = { type: 'API_ERROR', code: -2010, msg: 'Account has insufficient balance for requested action.' };

  const buyRejectedResult = await tradingService.executeBuy({
    botId: 'bot_beta',
    cycleId: 'cycle_101',
    symbol: 'ETHUSDT',
    quoteOrderQty: 500,
  });

  assert(buyRejectedResult.sent === false, 'Buy sent flag is false when rejected by Binance API');
  assert(buyRejectedResult.outcome === 'FAILED', 'Buy outcome is FAILED when Binance returns 4xx (-2010)');
  assert(buyRejectedResult.isFinal === true, 'Buy isFinal is true when definitively rejected');
  assert(buyRejectedResult.needsVerification === false, 'Buy needsVerification is false when rejected');
  assert(Boolean(buyRejectedResult.error?.includes('-2010')), 'Buy error message preserves Binance error code');
  assert(testLockManager.canSend('bot_beta', 'BUY').allowed === true, 'Lock is released after definitive rejection (ready for safe retry if desired)');

  // --- Checkpoint 5: Ambiguous Buy Execution (Network Timeout -> AMBIGUOUS, VERIFY FIRST) ---
  mockTransport.nextSendBehavior = { type: 'NETWORK_TIMEOUT', msg: 'Socket connection timed out after 8000ms' };

  const buyTimeoutResult = await tradingService.executeBuy({
    botId: 'bot_gamma',
    cycleId: 'cycle_102',
    symbol: 'SOLUSDT',
    quoteOrderQty: 200,
  });

  assert(buyTimeoutResult.sent === true, 'Buy sent is true (dispatched over wire, outcome unknown on matching engine)');
  assert(buyTimeoutResult.outcome === 'AMBIGUOUS', 'Buy outcome is AMBIGUOUS upon timeout');
  assert(buyTimeoutResult.isFinal === false, 'Buy isFinal is false upon timeout');
  assert(buyTimeoutResult.needsVerification === true, 'Buy needsVerification is true upon timeout');

  // Checkpoint 6: Strict Duplicate Prevention while Ambiguous
  const secondBuyAttempt = await tradingService.executeBuy({
    botId: 'bot_gamma',
    cycleId: 'cycle_102',
    symbol: 'SOLUSDT',
    quoteOrderQty: 200,
  });

  assert(secondBuyAttempt.sent === false, 'Second buy attempt is BLOCKED while previous is AMBIGUOUS');
  assert(Boolean(secondBuyAttempt.error?.includes('VERIFY')), 'Second buy error explicitly informs caller to VERIFY first');

  // --- Checkpoint 7: Order Verification Resolves Ambiguous State to FILLED ---
  mockTransport.nextQueryBehavior = {
    type: 'FOUND',
    status: 'FILLED',
    side: 'BUY',
    executedQty: '1.45',
    cummulativeQuoteQty: '200.0',
  };

  const verifyResult = await tradingService.verifyOrder({
    botId: 'bot_gamma',
    symbol: 'SOLUSDT',
    clientOrderId: buyTimeoutResult.clientOrderId,
  });

  assert(verifyResult.found === true, 'Verify query successfully finds order on Binance');
  assert(verifyResult.outcome === 'SUCCESS', 'Verify query resolves ambiguous order to SUCCESS');
  assert(verifyResult.status === 'FILLED', 'Verify query confirms FILLED status from Binance');
  assert(verifyResult.isFinal === true, 'Verify outcome is now final');
  assert(verifyResult.needsVerification === false, 'Verify needsVerification is now false');
  assert(testLockManager.canSend('bot_gamma', 'BUY').allowed === true, 'Lock for bot_gamma is released after verify confirmed FILLED');

  // --- Checkpoint 8: Order Verification with -2011 Handling ---
  // Case 8.1: If operation was AMBIGUOUS, -2011 does NOT blindly release lock or allow blind resend!
  testLockManager.acquireLock('bot_delta', 'BUY', 'ADAUSDT', 'Q_BUY_delta_123', 'cycle_1');
  testLockManager.markAmbiguous('bot_delta', 'BUY', 'Q_BUY_delta_123', 'Simulated disconnect');

  mockTransport.nextQueryBehavior = {
    type: 'NOT_FOUND',
    code: -2011,
    msg: 'Unknown order sent. Order does not exist.',
  };

  const verifyAmbiguousNotFoundResult = await tradingService.verifyOrder({
    botId: 'bot_delta',
    symbol: 'ADAUSDT',
    clientOrderId: 'Q_BUY_delta_123',
  });

  assert(verifyAmbiguousNotFoundResult.found === false, 'Verify reports found: false for -2011');
  assert(verifyAmbiguousNotFoundResult.status === 'NOT_FOUND', 'Verify status is NOT_FOUND');
  assert(verifyAmbiguousNotFoundResult.outcome === 'AMBIGUOUS', 'When operation was ambiguous, -2011 preserves AMBIGUOUS outcome (not blind FAILED)');
  assert(verifyAmbiguousNotFoundResult.isFinal === false, 'Outcome is NOT final upon a single -2011 in ambiguous state');
  assert(verifyAmbiguousNotFoundResult.needsVerification === true, 'needsVerification remains true');
  assert(testLockManager.canSend('bot_delta', 'BUY').allowed === false, 'Lock is NOT released upon -2011 when ambiguous (BLIND RESEND PREVENTED)');
  assert(Boolean(verifyAmbiguousNotFoundResult.error?.includes('المتاح')), 'Error wording accurately states order not found with available identifier');

  // Case 8.2: Explicit clearLock allows resend after intentional resolution
  tradingService.clearLock('bot_delta', 'BUY', 'Q_BUY_delta_123');
  assert(testLockManager.canSend('bot_delta', 'BUY').allowed === true, 'Lock is released only after explicit intentional clearLock');

  // Case 8.3: If operation was NOT ambiguous, -2011 returns definitive FAILED
  const verifyNonAmbiguousResult = await tradingService.verifyOrder({
    botId: 'bot_epsilon',
    symbol: 'ADAUSDT',
    clientOrderId: 'Q_BUY_epsilon_456',
  });
  assert(verifyNonAmbiguousResult.outcome === 'FAILED', 'Non-ambiguous query returning -2011 returns FAILED');
  assert(verifyNonAmbiguousResult.isFinal === true, 'Non-ambiguous query returning -2011 is final');

  // --- Checkpoint 9: Sell Operations (Full & Partial Sell) ---
  // 9.1 Full Sell
  mockTransport.nextSendBehavior = { type: 'SUCCESS', status: 'FILLED' };
  const fullSellResult = await tradingService.executeSell({
    botId: 'bot_sell_1',
    cycleId: 'cycle_200',
    tradeId: 'trade_200',
    symbol: 'BTCUSDT',
    quantity: 0.005,
    isPartial: false,
  });

  assert(fullSellResult.sent === true && fullSellResult.outcome === 'SUCCESS', 'Full Sell executes to SUCCESS when FILLED');
  assert(fullSellResult.isPartial === false, 'Full Sell marks isPartial as false');
  assert(fullSellResult.isFinal === true, 'Full Sell is final');

  // 9.2 Partial Sell
  mockTransport.nextSendBehavior = { type: 'SUCCESS', status: 'PARTIALLY_FILLED' };
  const partialSellResult = await tradingService.executeSell({
    botId: 'bot_sell_2',
    cycleId: 'cycle_201',
    tradeId: 'trade_201',
    symbol: 'BTCUSDT',
    quantity: 0.010,
    isPartial: true,
  });

  assert(partialSellResult.sent === true && partialSellResult.outcome === 'PARTIAL', 'Partial Sell executes to PARTIAL when PARTIALLY_FILLED');
  assert(partialSellResult.isPartial === true, 'Partial Sell marks isPartial as true');
  assert(partialSellResult.needsVerification === true, 'Partial Sell requires ongoing verification for remainder');

  // --- Checkpoint 10: Bot Engine Integration ---
  const engineRepo = new InMemoryBotRepository();
  const engineTradingService = new BinanceTradingService({
    transport: mockTransport,
    lockManager: new OrderLockManager(),
  });

  const engine = new BotEngine({
    repository: engineRepo,
    tradingService: engineTradingService,
  });
  await engine.initialize();

  // Create a test bot
  const botInstance = await engine.createBot({
    id: 'bot_engine_test_1',
    type: 'DEAL_BOT',
    name: 'بوت اختبار التداول الحقيقي',
    symbol: 'BTCUSDT',
    entryAmount: 100,
  });

  // 10.1 Start Bot Cycle -> WAITING_FOR_ENTRY
  await engine.startBot('bot_engine_test_1');
  assert(botInstance.getState() === 'WAITING_FOR_ENTRY', 'Bot is in WAITING_FOR_ENTRY');

  // 10.2 Bot Engine executes Buy (FILLED)
  mockTransport.nextSendBehavior = { type: 'SUCCESS', status: 'FILLED' };
  const botBuyRes = await engine.executeBotBuy('bot_engine_test_1', { quoteOrderQty: 100 });

  assert(botBuyRes.outcome === 'SUCCESS', 'Bot Engine executeBotBuy returns SUCCESS');
  assert(botInstance.getState() === 'POSITION_OPEN', 'Bot Core transitioned to POSITION_OPEN after confirmed buy execution');
  assert(botInstance.getCurrentTrade()?.status === 'OPEN', 'Bot trade is OPEN with verified fill details');
  assert(botInstance.getCurrentTrade()?.entry.filledQuantity !== null, 'Trade filledQuantity is documented');

  // 10.3 Bot Engine executes Sell (FILLED)
  mockTransport.nextSendBehavior = { type: 'SUCCESS', status: 'FILLED' };
  const botSellRes = await engine.executeBotSell('bot_engine_test_1', { quantity: 0.00154 });

  assert(botSellRes.outcome === 'SUCCESS', 'Bot Engine executeBotSell returns SUCCESS');
  assert(botInstance.getState() === 'POSITION_CLOSED', 'Bot Core transitioned to POSITION_CLOSED after confirmed sell execution');
  assert(botInstance.getCurrentTrade()?.status === 'CLOSED', 'Bot trade status is CLOSED');

  // 10.4 Bot Engine executes Buy with AMBIGUOUS outcome (timeout)
  const bot2 = await engine.createBot({
    id: 'bot_engine_test_2',
    type: 'RANGE_BOT',
    name: 'بوت اختبار الغموض',
    symbol: 'ETHUSDT',
    entryAmount: 50,
  });
  await engine.startBot('bot_engine_test_2');

  mockTransport.nextSendBehavior = { type: 'NETWORK_TIMEOUT', msg: 'Gateway timeout 504' };
  const bot2BuyRes = await engine.executeBotBuy('bot_engine_test_2', { quoteOrderQty: 50 });

  assert(bot2BuyRes.outcome === 'AMBIGUOUS', 'Bot 2 Buy outcome is AMBIGUOUS');
  assert(bot2.getState() === 'VERIFYING_BUY', 'Bot 2 remains in VERIFYING_BUY (does NOT open position on ambiguous send!)');

  // 10.5 Bot Engine resolves ambiguous order via verifyBotOrder
  mockTransport.nextQueryBehavior = {
    type: 'FOUND',
    status: 'FILLED',
    side: 'BUY',
    executedQty: '0.015',
    cummulativeQuoteQty: '50.0',
  };

  const bot2VerifyRes = await engine.verifyBotOrder('bot_engine_test_2', bot2BuyRes.orderId, bot2BuyRes.clientOrderId);
  assert(bot2VerifyRes.outcome === 'SUCCESS', 'verifyBotOrder returns SUCCESS');
  assert(bot2.getState() === 'POSITION_OPEN', 'Bot 2 transitions to POSITION_OPEN only AFTER Binance verification confirms FILLED');

  await engine.shutdown();
  console.log('\n================================================================');
  console.log(`  ALL ${totalTests} BINANCE TRADING LAYER TESTS PASSED!`);
  console.log('================================================================');
}

runTestSuite().catch((err) => {
  console.error('Fatal error during trading layer tests:', err);
  process.exit(1);
});
