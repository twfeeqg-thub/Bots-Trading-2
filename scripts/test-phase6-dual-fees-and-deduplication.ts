// Phase 6 Test Suite: Dual Fee Inputs (Percentage % & Currency Amount USDT),
// Mathematical Calculations, Local Persistence, Value Separation & Fee Deduplication.

import { LevelCalculator } from '../lib/trade-manager/level-calculator';
import { sharedSymbolCostStore } from '../lib/trade-manager/symbol-cost-store';
import {
  saveDefaultTradingSettings,
  loadDefaultTradingSettings,
  saveManualTradingSettings,
  loadManualTradingSettings,
  resetDefaultSettingsToSystem,
} from '../lib/trade-manager/trading-settings-store';
import { TradeManager } from '../lib/trade-manager/trade-manager';
import { BOT_STATE_METADATA, BotState } from '../lib/bots/types';
import { sharedMarketDataStore } from '../lib/market-data';

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

async function runPhase6Tests() {
  console.log('================================================================');
  console.log('  Executing Phase 6: Dual Fee Inputs, Separation & Deduplication');
  console.log('================================================================');

  // -------------------------------------------------------------
  // Section 1: Dual Fee Calculations (Percent % + Currency Amount USDT)
  // -------------------------------------------------------------
  console.log('\n--- Section 1: Dual Fee Mathematical Calculations ---');

  // Scenario 1A: Both Percentage % AND Flat Currency Amount USDT for Entry
  // 100 USDT, 0.2% = 0.20 USDT + 0.10 USDT flat = 0.30 USDT total entry fee
  const costConfigBoth = sharedSymbolCostStore.resolveInitialCostConfig({
    symbol: 'BTCUSDT',
    entryAmount: 100,
    manualEntryFeePercent: 0.2, // 0.2%
    manualEntryFeeAmount: 0.10, // 0.10 USDT
    manualExitFeePercent: 0.15, // 0.15%
    manualExitFeeAmount: 0.05, // 0.05 USDT
  });

  assert(Math.abs(costConfigBoth.entryCostAmount - 0.30) < 1e-6, 'Entry fee combines 0.2% (0.20 USDT) + 0.10 USDT = 0.30 USDT');
  assert(costConfigBoth.entryFeePercent === 0.2, 'Preserves entryFeePercent = 0.2%');
  assert(costConfigBoth.entryFeeAmount === 0.10, 'Preserves entryFeeAmount = 0.10 USDT');
  assert(costConfigBoth.exitFeePercent === 0.15, 'Preserves exitFeePercent = 0.15%');
  assert(costConfigBoth.exitFeeAmount === 0.05, 'Preserves exitFeeAmount = 0.05 USDT');

  // Scenario 1B: ONLY Percentage % (0.15%), No Flat Amount (0 USDT)
  const costConfigPercentOnly = sharedSymbolCostStore.resolveInitialCostConfig({
    symbol: 'ETHUSDT',
    entryAmount: 200,
    manualEntryFeePercent: 0.15,
    manualEntryFeeAmount: 0,
    manualExitFeePercent: 0.10,
    manualExitFeeAmount: 0,
  });
  // 200 * 0.15% = 0.30 USDT
  assert(Math.abs(costConfigPercentOnly.entryCostAmount - 0.30) < 1e-6, 'Entry fee calculates correctly with percentage only (200 * 0.15% = 0.30 USDT)');
  assert(costConfigPercentOnly.entryFeeAmount === 0, 'Entry flat amount is 0');

  // Scenario 1C: ONLY Currency Amount USDT (0.50 USDT), No Percentage (0%)
  const costConfigAmountOnly = sharedSymbolCostStore.resolveInitialCostConfig({
    symbol: 'SOLUSDT',
    entryAmount: 50,
    manualEntryFeePercent: 0,
    manualEntryFeeAmount: 0.50,
    manualExitFeePercent: 0,
    manualExitFeeAmount: 0.25,
  });
  assert(Math.abs(costConfigAmountOnly.entryCostAmount - 0.50) < 1e-6, 'Entry fee calculates correctly with flat amount only (0.50 USDT)');
  assert(costConfigAmountOnly.exitFeeAmount === 0.25, 'Exit fee amount is 0.25 USDT');

  // Scenario 1D: T0 Break-Even incorporates flat exit fee
  // Entry: 100 USDT price, quantity 1.0, entryCommission: 0.20 USDT, exitRate: 0.001 (0.1%), exitFeeAmount: 0.05 USDT
  // Invested cash = 100 + 0.20 = 100.20 USDT
  // Net cash received at exit = P_exit * 1 * (1 - 0.001) - 0.05
  // For net zero: P_exit * 0.999 = 100.20 + 0.05 = 100.25
  // T0 = 100.25 / 0.999 = 100.35035035
  const t0Calculated = LevelCalculator.calculateT0BreakEven(100, 1.0, 0.20, 0.001, 0.05);
  const expectedT0 = Number(((100.20 + 0.05) / 0.999).toFixed(8));
  assert(t0Calculated === expectedT0, `T0 exactly covers entry fee + flat exit fee (${t0Calculated} vs ${expectedT0})`);

  // Verify selling at T0 yields net zero (break-even)
  const sellGross = t0Calculated * 1.0;
  const sellExitFee = sellGross * 0.001 + 0.05;
  const netPnLAtT0 = sellGross - (100 + 0.20 + sellExitFee);
  assert(Math.abs(netPnLAtT0) < 0.0001, `Selling at T0 yields net break-even ~ 0.00 USDT (diff: ${netPnLAtT0.toFixed(6)})`);

  // -------------------------------------------------------------
  // Section 2: Local Persistence of Dual Fee Settings
  // -------------------------------------------------------------
  console.log('\n--- Section 2: Local Persistence of Dual Fee Settings ---');

  // Save custom dual fee defaults
  saveDefaultTradingSettings({
    defaultEntryFeePercent: 0.18,
    defaultEntryFeeAmount: 0.08,
    defaultExitFeePercent: 0.12,
    defaultExitFeeAmount: 0.06,
  });

  const loadedDefaults = loadDefaultTradingSettings();
  assert(loadedDefaults.defaultEntryFeePercent === 0.18, 'Custom defaultEntryFeePercent (0.18%) persisted');
  assert(loadedDefaults.defaultEntryFeeAmount === 0.08, 'Custom defaultEntryFeeAmount (0.08 USDT) persisted');
  assert(loadedDefaults.defaultExitFeePercent === 0.12, 'Custom defaultExitFeePercent (0.12%) persisted');
  assert(loadedDefaults.defaultExitFeeAmount === 0.06, 'Custom defaultExitFeeAmount (0.06 USDT) persisted');

  // Active manual inputs persistence
  saveManualTradingSettings({
    manualSymbol: 'AVAXUSDT',
    manualAmount: '120',
    manualEntryFeePercent: '0.25',
    manualEntryFeeAmount: '0.15',
    manualExitFeePercent: '0.20',
    manualExitFeeAmount: '0.10',
  });

  const loadedManual = loadManualTradingSettings();
  assert(loadedManual?.manualEntryFeePercent === '0.25', 'Active manualEntryFeePercent persisted');
  assert(loadedManual?.manualEntryFeeAmount === '0.15', 'Active manualEntryFeeAmount persisted');
  assert(loadedManual?.manualExitFeePercent === '0.20', 'Active manualExitFeePercent persisted');
  assert(loadedManual?.manualExitFeeAmount === '0.10', 'Active manualExitFeeAmount persisted');

  // Clean reset to baseline defaults
  resetDefaultSettingsToSystem();

  // -------------------------------------------------------------
  // Section 3: Separation of Manual Dual Values vs Binance Confirmed Values
  // -------------------------------------------------------------
  console.log('\n--- Section 3: Separation of Manual vs Confirmed Values & Deduplication ---');

  sharedMarketDataStore.updatePrice('DOTUSDT', 10.0);
  const tradeManager = TradeManager.getInstance();

  const trade = await tradeManager.createTradeFromManual({
    symbol: 'DOTUSDT',
    entryAmount: 100,
    entryPrice: 10.0,
    manualEntryFeePercent: 0.15, // 0.15% on 100 = 0.15 USDT
    manualEntryFeeAmount: 0.05, // 0.05 USDT flat
    manualExitFeePercent: 0.10, // 0.10%
    manualExitFeeAmount: 0.05, // 0.05 USDT flat
    immediateEntry: true,
  });

  // Verify manualValues contains both percentage and amount
  assert(trade.manualValues !== undefined, 'Trade has manualValues record');
  assert(trade.manualValues?.manualEntryFeePercent === 0.15, 'manualValues records manualEntryFeePercent = 0.15%');
  assert(trade.manualValues?.manualEntryFeeAmount === 0.05, 'manualValues records manualEntryFeeAmount = 0.05 USDT');
  assert(trade.manualValues?.manualExitFeePercent === 0.10, 'manualValues records manualExitFeePercent = 0.10%');
  assert(trade.manualValues?.manualExitFeeAmount === 0.05, 'manualValues records manualExitFeeAmount = 0.05 USDT');
  // Combined manual entry fee is 0.15 + 0.05 = 0.20 USDT
  assert(Math.abs(trade.manualValues!.manualEntryFee - 0.20) < 1e-6, 'manualValues records combined entry fee = 0.20 USDT');

  // Verify confirmedValues contains Binance actual fill fee without overwriting manual values
  assert(trade.confirmedValues !== null, 'Trade has confirmedValues record');
  assert(trade.confirmedValues?.exchangeSource === 'BINANCE_ACTUAL', 'confirmedValues exchangeSource is BINANCE_ACTUAL');
  assert(typeof trade.confirmedValues?.confirmedEntryFee === 'number', 'confirmedValues records actual Binance entry fee');
  assert(trade.confirmedValues?.isFeeDeduplicated === true, 'Anti-duplication flag isFeeDeduplicated is active');

  // Manual values remain strictly preserved
  assert(trade.manualValues?.manualEntryFeePercent === 0.15, 'Manual percentage was NOT overwritten by Binance fill');
  assert(trade.manualValues?.manualEntryFeeAmount === 0.05, 'Manual flat amount was NOT overwritten by Binance fill');

  // Verify deduplication: confirmed fee replaced manual fee in active costConfig, NOT summed twice!
  assert(
    trade.costConfig.entryCostAmount === trade.confirmedValues?.confirmedEntryFee,
    'Deduplication verified: costConfig entryCostAmount equals Binance confirmed fee (NOT manual + Binance)'
  );

  // -------------------------------------------------------------
  // Section 4: Bot Core 11-State Lifecycle & SEND -> VERIFY Protocol Intact
  // -------------------------------------------------------------
  console.log('\n--- Section 4: Preservation of 11-State Lifecycle & SEND -> VERIFY ---');

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

  assert(EXPECTED_11_STATES.length === 11, 'Full 11 states present in lifecycle');
  for (const st of EXPECTED_11_STATES) {
    const meta = BOT_STATE_METADATA[st];
    assert(meta !== undefined && typeof meta.index === 'number', `State ${st} is intact with index #${meta?.index}`);
  }

  console.log('\n================================================================');
  console.log(`  ALL ${passed} / ${total} PHASE 6 TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runPhase6Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
