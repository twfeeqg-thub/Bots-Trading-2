// Phase 4 Test Suite: Settings & Inputs Persistence, Default Configs, and Manual vs Confirmed Separation
import {
  SYSTEM_DEFAULT_TRADING_SETTINGS,
  getSystemDefaultSettings,
  loadDefaultTradingSettings,
  saveDefaultTradingSettings,
  resetDefaultSettingsToSystem,
  loadManualTradingSettings,
  saveManualTradingSettings,
  mapDefaultsToManualInputs,
} from '../lib/trade-manager/trading-settings-store';
import { sharedTradeManager } from '../lib/trade-manager/trade-manager';
import { sharedSymbolCostStore } from '../lib/trade-manager/symbol-cost-store';

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

async function runPhase4Tests() {
  console.log('================================================================');
  console.log('  Executing Phase 4: Persistence, User Defaults & Value Separation');
  console.log('================================================================');

  // -------------------------------------------------------------
  // Section 1: Default Settings & User Modification & Persistence
  // -------------------------------------------------------------
  console.log('\n--- Section 1: Default Settings & User Modification ---');

  // Test 1: Factory default values match system baseline
  const baseline = getSystemDefaultSettings();
  assert(baseline.defaultSymbol === 'BTCUSDT', 'Baseline default symbol is BTCUSDT');
  assert(baseline.defaultAmount === 100, 'Baseline default amount is 100 USDT');
  assert(baseline.defaultStepPercent === 2.0, 'Baseline default step percent is 2.0%');

  // Test 2: User can customize default values and save them
  const customizedDefaults = saveDefaultTradingSettings({
    defaultSymbol: 'ETHUSDT',
    defaultAmount: 250,
    defaultStepPercent: 3.5,
    defaultStopLossPercent: -1.8,
    defaultManualEntryCost: 0.25,
    defaultManualExitCostRate: 0.002,
    defaultBotType: 'RANGE_BOT',
  });
  assert(customizedDefaults.defaultSymbol === 'ETHUSDT', 'Custom default symbol saved as ETHUSDT');
  assert(customizedDefaults.defaultAmount === 250, 'Custom default amount saved as 250');
  assert(customizedDefaults.defaultStepPercent === 3.5, 'Custom default step saved as 3.5%');

  // Test 3: Reloading defaults returns the persisted custom defaults
  const reloadedDefaults = loadDefaultTradingSettings();
  assert(reloadedDefaults.defaultSymbol === 'ETHUSDT', 'Reloaded default symbol retains ETHUSDT');
  assert(reloadedDefaults.defaultAmount === 250, 'Reloaded default amount retains 250');
  assert(reloadedDefaults.defaultStopLossPercent === -1.8, 'Reloaded stop-loss retains -1.8%');
  assert(reloadedDefaults.defaultBotType === 'RANGE_BOT', 'Reloaded bot type retains RANGE_BOT');

  // Test 4: User can reset defaults back to factory settings
  const resetDefaults = resetDefaultSettingsToSystem();
  assert(resetDefaults.defaultSymbol === 'BTCUSDT', 'Reset defaults restored BTCUSDT');
  assert(resetDefaults.defaultAmount === 100, 'Reset defaults restored 100 USDT');

  // -------------------------------------------------------------
  // Section 2: Manual Form Inputs Persistence (App Close/Reopen)
  // -------------------------------------------------------------
  console.log('\n--- Section 2: Manual Form Inputs Local Persistence ---');

  // Test 5: Saving manual inputs
  saveManualTradingSettings({
    manualSymbol: 'SOLUSDT',
    manualAmount: '75',
    manualPrice: '145.2',
    manualStepPercent: '1.75',
    manualStopLossPercent: '-1.5',
    manualEntryCost: '0.12',
    manualExitCostRate: '0.0012',
    botType: 'DEAL_BOT',
    entryExecutionMode: 'IMMEDIATE_BUY',
    xStepPercent: '1.75',
    xRangeCount: '4',
  });

  // Test 6: Simulating app reload: manual inputs are restored
  const restoredInputs = loadManualTradingSettings();
  assert(restoredInputs !== null, 'Restored inputs exist in local store');
  assert(restoredInputs?.manualSymbol === 'SOLUSDT', 'Restored symbol is SOLUSDT');
  assert(restoredInputs?.manualAmount === '75', 'Restored amount is 75');
  assert(restoredInputs?.manualPrice === '145.2', 'Restored price is 145.2');
  assert(restoredInputs?.manualStepPercent === '1.75', 'Restored step is 1.75%');
  assert(restoredInputs?.manualStopLossPercent === '-1.5', 'Restored stop-loss is -1.5%');

  // Test 7: Mapping defaults to manual inputs works seamlessly
  const mappedInputs = mapDefaultsToManualInputs(SYSTEM_DEFAULT_TRADING_SETTINGS);
  assert(mappedInputs.manualSymbol === 'BTCUSDT', 'Mapped input symbol is BTCUSDT');
  assert(mappedInputs.manualAmount === '100', 'Mapped input amount is 100');

  // -------------------------------------------------------------
  // Section 3: Separation of Manual Approved Values vs Binance Confirmed Values
  // -------------------------------------------------------------
  console.log('\n--- Section 3: Manual Values vs Binance Confirmed Values Separation ---');

  const { sharedMarketDataStore } = await import('../lib/market-data');
  const now = Date.now();
  sharedMarketDataStore.updatePrice('AVAXUSDT', 30.0, now, now);

  // Test 8: Create a manual trade with specific user-approved manual values
  const manualTrade = await sharedTradeManager.createTradeFromManual({
    symbol: 'AVAXUSDT',
    entryAmount: 150,
    entryPrice: 30.0,
    stepPercent: 2.5,
    initialStopLossPercent: -2.0,
    manualEntryCost: 0.15,
    manualExitCostRate: 0.0015,
    botType: 'DEAL_BOT',
    immediateEntry: true,
  });

  // Test 9: Trade contains explicit manualValues record
  assert(manualTrade.manualValues !== undefined, 'Trade has manualValues record');
  assert(manualTrade.manualValues?.manualAmount === 150, 'manualValues records approved amount 150 USDT');
  assert(manualTrade.manualValues?.manualPlannedPrice === 30.0, 'manualValues records planned price 30.0');
  assert(manualTrade.manualValues?.manualEstimatedQuantity === 5, 'manualValues computed estimated quantity 150/30 = 5');
  assert(manualTrade.manualValues?.manualStepPercent === 2.5, 'manualValues records step 2.5%');
  assert(manualTrade.manualValues?.manualEntryFee === 0.15, 'manualValues records manual entry fee 0.15');

  // Test 10: Binance confirmedValues is populated after fill
  assert(manualTrade.confirmedValues !== null, 'Trade has confirmedValues after execution');
  assert(manualTrade.confirmedValues?.exchangeSource === 'BINANCE_ACTUAL', 'confirmedValues source is BINANCE_ACTUAL');
  assert(typeof manualTrade.confirmedValues?.confirmedPrice === 'number', 'confirmedValues records actual price');
  assert(typeof manualTrade.confirmedValues?.confirmedQuantity === 'number', 'confirmedValues records actual quantity');
  assert(typeof manualTrade.confirmedValues?.confirmedEntryFee === 'number', 'confirmedValues records actual fee');

  // Test 11: CRITICAL REQUIREMENT: manualValues is NEVER replaced or overwritten by Binance confirmation!
  assert(manualTrade.manualValues?.manualAmount === 150, 'Manual amount remains 150 (not overwritten)');
  assert(manualTrade.manualValues?.manualPlannedPrice === 30.0, 'Manual planned price remains 30.0 (not overwritten)');
  assert(manualTrade.manualValues?.manualStepPercent === 2.5, 'Manual step percent remains 2.5% (not overwritten)');
  assert(manualTrade.manualValues?.manualEntryFee === 0.15, 'Manual entry fee remains 0.15 (not overwritten)');
  assert(manualTrade.manualValues !== (manualTrade.confirmedValues as any), 'manualValues and confirmedValues are strictly separate objects');

  // Test 12: Trading logic & T-levels calculations remain 100% intact
  assert(manualTrade.levelsPlan !== undefined, 'Trade levels plan exists and was computed');
  assert(manualTrade.levelsPlan?.t0BreakEvenPrice !== undefined, 'T0 break-even is computed');
  assert(manualTrade.levelsPlan!.t0BreakEvenPrice > manualTrade.entry.executionPrice!, 'T0 is higher than entry price to cover round-trip fees');
  assert(manualTrade.levelsPlan?.t1Price !== undefined, 'T1 target is computed');

  console.log('\n================================================================');
  console.log(`  ALL ${passed} / ${total} PHASE 4 TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runPhase4Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
