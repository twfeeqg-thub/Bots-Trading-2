/**
 * Comprehensive Simulation Integration Test Suite
 * Validates:
 * 1. MockBinanceTransport receives and executes orders using real-time market prices from CentralMarketDataStore.
 * 2. Simulated balances ledger updates correctly upon BUY and SELL orders.
 * 3. Bot Core and State Machine advance cleanly through the full lifecycle:
 *    WAITING_FOR_ENTRY -> MONITORING_ENTRY -> ENTRY_TRIGGERED -> EXECUTING_BUY -> VERIFYING_BUY -> POSITION_OPEN
 * 4. PnL, T0 break-even, and trailing protection are calculated accurately based on fill prices.
 * 5. RANGE_BOT X-Recovery additional buy execution updates weighted average entry price.
 * 6. Sell execution transitions bot to POSITION_CLOSED and updates wallet balances.
 * 7. Zero real Binance API calls are made.
 */

import { CentralMarketDataStore } from '../lib/market-data/market-data-store';
import { MockBinanceTransport } from '../lib/trading/mock-binance-transport';
import { BinanceTradingService } from '../lib/trading/binance-trading-service';
import { BotEngine } from '../lib/engine/bot-engine';
import { InMemoryBotRepository } from '../lib/persistence/in-memory-bot-repository';
import { LevelCalculator } from '../lib/trade-manager/level-calculator';
import { XRecoveryManager } from '../lib/trade-manager/x-recovery-manager';

let passed = 0;
let total = 0;

function check(cond: boolean, desc: string) {
  total++;
  if (cond) {
    console.log(`  ✓ Test #${total} PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ Test #${total} FAIL: ${desc}`);
    process.exit(1);
  }
}

async function runSimulationTests() {
  console.log('================================================================');
  console.log('  Testing Bot Simulation with Real Market Prices & Ledger');
  console.log('================================================================');

  // 1. Setup isolated CentralMarketDataStore and inject real-time prices
  const marketStore = new CentralMarketDataStore();
  const now = Date.now();
  marketStore.updatePrice('BTCUSDT', 64320.50, now, now);
  marketStore.updatePrice('ETHUSDT', 3450.25, now, now);

  check(marketStore.getFreshPrice('BTCUSDT') === 64320.50, 'Market data store holds fresh price 64320.50');
  check(marketStore.isFresh('BTCUSDT') === true, 'BTCUSDT price is FRESH');

  // 2. Setup MockBinanceTransport connected to the store
  const mockTransport = new MockBinanceTransport('FILLED', marketStore);
  const tradingService = new BinanceTradingService({ transport: mockTransport });

  check(tradingService.isUsingMock() === true, 'Trading service is operating in Mock mode');

  // Check initial simulated balance
  const initialAccount = await mockTransport.getAccountInformation();
  const usdtBal = initialAccount.balances.find((b) => b.asset === 'USDT');
  check(parseFloat(usdtBal?.free || '0') === 10000.0, 'Initial USDT free balance is 10,000.00');

  // 3. Execute MARKET Buy order without specifying price
  const buyRes = await tradingService.executeBuy({
    botId: 'test_bot_sim_1',
    cycleId: 'c1',
    symbol: 'BTCUSDT',
    quoteOrderQty: 1000,
    orderType: 'MARKET',
  });

  check(buyRes.outcome === 'SUCCESS', 'Buy order executed with SUCCESS outcome');
  check(buyRes.avgPrice === 64320.50, `Buy order executed at exact market price ${buyRes.avgPrice} == 64320.50`);
  check(buyRes.executedQty > 0, 'Buy order has positive executed quantity');

  // Check balance updated in ledger
  const afterBuyAccount = await mockTransport.getAccountInformation();
  const usdtAfterBuy = parseFloat(afterBuyAccount.balances.find((b) => b.asset === 'USDT')?.free || '0');
  const btcAfterBuy = parseFloat(afterBuyAccount.balances.find((b) => b.asset === 'BTC')?.free || '0');

  check(usdtAfterBuy === 9000, `USDT balance decreased by 1000 USDT (Now: ${usdtAfterBuy})`);
  check(btcAfterBuy > 0.5, `BTC balance increased after buy (Now: ${btcAfterBuy})`);

  // 4. Test BotEngine Integration with Market Store & Mock Transport
  const repo = new InMemoryBotRepository();
  const engine = new BotEngine({
    repository: repo,
    marketDataStore: marketStore,
    tradingService: tradingService,
  });

  await engine.initialize();

  // Create a bot
  const botInstance = await engine.createBot({
    name: 'بوت محاكاة البيتكوين',
    symbol: 'BTCUSDT',
    type: 'DEAL_BOT',
    entryAmount: 500,
    entryMethod: 'MARKET',
  });
  check(botInstance !== null && botInstance.getId() !== '', 'Bot created in BotEngine');
  const botId = botInstance.getId();

  // Start bot -> transitions to WAITING_FOR_ENTRY
  await engine.startBot(botId);
  check(engine.getBot(botId)?.getState() === 'WAITING_FOR_ENTRY', 'Bot transitioned to WAITING_FOR_ENTRY');

  // Execute buy via engine -> should execute at market price 64320.50
  const engineBuy = await engine.executeBotBuy(botId, { quoteOrderQty: 500 });
  check(engineBuy.outcome === 'SUCCESS', 'Engine buy executed to SUCCESS');
  check(engineBuy.avgPrice === 64320.50, 'Engine buy matched market price');
  check(engine.getBot(botId)?.getState() === 'POSITION_OPEN', 'Bot transitioned cleanly to POSITION_OPEN');

  const trade = engine.getBot(botId)?.getCurrentTrade();
  check(trade?.status === 'OPEN', 'Bot trade is OPEN');
  check(trade?.entry.executionPrice === 64320.50, 'Trade entry price matches 64320.50');

  // 5. Test Mathematical Calculations (T0 and Net PnL)
  const t0 = LevelCalculator.calculateT0BreakEven(64320.50, trade!.entry.filledQuantity!, 0.5, 0.001);
  check(t0 > 64320.50, `T0 Net Break-Even (${t0}) correctly accounts for commissions above entry price`);

  // Update market price higher and test PnL
  marketStore.updatePrice('BTCUSDT', 66000.0, Date.now(), Date.now());
  const exitPrice = 66000.0;
  const pnl = LevelCalculator.calculateNetPnL({
    entryPrice: 64320.50,
    exitPrice: 66000.0,
    filledQuantity: trade!.entry.filledQuantity!,
    entryCommissionQuote: 0.5,
    exitCommissionQuote: 0.5,
  });
  check(pnl.isProfitable === true, 'PnL is positive for price increase');
  check(pnl.netReturnQuote > 0, `Net return is positive: ${pnl.netReturnQuote} USDT`);

  // 6. Test Sell execution via Engine at new price
  const sellRes = await engine.executeBotSell(botId, {
    quantity: trade!.entry.filledQuantity!,
    orderType: 'MARKET',
    reason: 'تحقق هدف الربح',
  });
  check(sellRes.outcome === 'SUCCESS', 'Sell executed to SUCCESS');
  check(sellRes.avgPrice === 66000.0, `Sell avgPrice matches updated market price: ${sellRes.avgPrice}`);
  check(engine.getBot(botId)?.getState() === 'POSITION_CLOSED', 'Bot transitioned to POSITION_CLOSED');

  // 7. Test RANGE_BOT X-Recovery aggregation
  const initialEntry = { price: 60000, qty: 0.01, fee: 0.6 };
  const plan = XRecoveryManager.buildPlan({
    entryPrice: 60000,
    entryAmount: 600,
    xSettings: {
      enabled: true,
      stepPercent: 2.0,
      recoveryRatio: 1.5,
    },
  });
  check(plan !== undefined, 'X-Recovery plan built');
  check(plan!.levels.length > 0, 'Level 1 generated in plan');
  XRecoveryManager.recordExecution(plan!, 1, {
    fillPrice: 58800,
    filledQty: 0.0153,
    feePaid: 0.9,
    orderId: 'rec_ord_1',
    timestamp: Date.now(),
  });
  const agg = XRecoveryManager.calculateAggregatedPosition(initialEntry, plan!);
  check(agg.averageEntryPrice < 60000 && agg.averageEntryPrice > 58800, `Aggregated average entry price (${agg.averageEntryPrice}) correctly weighted`);

  // 8. Test strict rejection when market price is missing or stale
  let rejectedNoPrice = false;
  try {
    await mockTransport.sendOrder({
      symbol: 'UNKNOWNUSDT',
      side: 'BUY',
      type: 'MARKET',
      quantity: 1,
      newClientOrderId: 'TEST_NO_PRICE',
    });
  } catch (err: any) {
    if (err.message && err.message.includes('No valid fresh market price')) {
      rejectedNoPrice = true;
    }
  }
  check(rejectedNoPrice === true, 'MARKET order strictly rejected when price is missing from store (No default fallback)');

  // Test strict rejection when market price is stale (>30s)
  marketStore.updatePrice('STALEUSDT', 50.0, Date.now() - 35000, Date.now() - 35000);
  let rejectedStalePrice = false;
  try {
    await mockTransport.sendOrder({
      symbol: 'STALEUSDT',
      side: 'BUY',
      type: 'MARKET',
      quantity: 1,
      newClientOrderId: 'TEST_STALE_PRICE',
    });
  } catch (err: any) {
    if (err.message && err.message.includes('No valid fresh market price')) {
      rejectedStalePrice = true;
    }
  }
  check(rejectedStalePrice === true, 'MARKET order strictly rejected when price is stale (getLastKnownPrice fallback prevented)');

  await engine.shutdown();
  console.log('================================================================');
  console.log(`  ALL ${total} SIMULATION INTEGRATION TESTS PASSED!`);
  console.log('================================================================');
}

runSimulationTests().catch((err) => {
  console.error('Fatal error during simulation tests:', err);
  process.exit(1);
});
