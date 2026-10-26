// Project Q — Trading Settings & Local Storage Store (المرحلة الرابعة)
// Handles local persistence of trading settings, manual inputs, and user-configurable defaults.
// Preserves all values across browser closing/reopening with SSR hydration safety and separation.

export interface TradingDefaultSettings {
  defaultSymbol: string;
  defaultAmount: number; // USDT
  defaultStepPercent: number; // e.g. 2.0%
  defaultStopLossPercent: number; // e.g. 0.0% or negative
  defaultManualEntryCost: number; // USDT (backward compat)
  defaultManualExitCostRate: number; // e.g. 0.0015 (backward compat)
  // Phase 6: Dual fee defaults (Percentage % and Currency Amount USDT)
  defaultEntryFeePercent: number; // e.g. 0.1%
  defaultEntryFeeAmount: number; // e.g. 0.05 USDT
  defaultExitFeePercent: number; // e.g. 0.1%
  defaultExitFeeAmount: number; // e.g. 0.05 USDT
  defaultBotType: 'DEAL_BOT' | 'RANGE_BOT';
  defaultImmediateEntry: boolean;
  defaultXStepPercent: number;
  defaultXRangeCount: number;
  defaultTrailingStopLossPercent: number;
  updatedAt: number;
}

export interface ManualTradingInputsState {
  manualSymbol: string;
  manualAmount: string;
  manualPrice: string;
  manualStepPercent: string;
  manualStopLossPercent: string;
  // Phase 6: Dual manual fee inputs (User enters whatever they want)
  manualEntryFeePercent?: string; // %
  manualEntryFeeAmount?: string; // USDT
  manualExitFeePercent?: string; // %
  manualExitFeeAmount?: string; // USDT
  manualEntryCost?: string;
  manualEntryFee?: string;
  manualExitCostRate?: string;
  manualExitFeeRate?: string;
  botType: 'DEAL_BOT' | 'RANGE_BOT';
  entryExecutionMode: 'IMMEDIATE_BUY' | 'PRE_ENTRY_RECOVERY';
  xStepPercent: string;
  xRangeCount: string;
  trailingStopLossPercent: string;
  lastSavedAt: number;
}

export const SYSTEM_DEFAULT_TRADING_SETTINGS: TradingDefaultSettings = {
  defaultSymbol: 'BTCUSDT',
  defaultAmount: 100,
  defaultStepPercent: 2.0,
  defaultStopLossPercent: 0.0,
  defaultManualEntryCost: 0.1,
  defaultManualExitCostRate: 0.0015,
  defaultEntryFeePercent: 0.1,
  defaultEntryFeeAmount: 0.0,
  defaultExitFeePercent: 0.1,
  defaultExitFeeAmount: 0.0,
  defaultBotType: 'DEAL_BOT',
  defaultImmediateEntry: true,
  defaultXStepPercent: 2.0,
  defaultXRangeCount: 5,
  defaultTrailingStopLossPercent: 0.0,
  updatedAt: 0,
};

const STORAGE_KEYS = {
  USER_DEFAULT_SETTINGS: 'q_trading_default_settings_v4',
  ACTIVE_MANUAL_INPUTS: 'q_active_manual_trading_inputs_v4',
};

// In-memory fallback for environments without localStorage (Node.js tests, SSR)
const memoryStorage: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return memoryStorage[key] || null;
  } catch {
    return memoryStorage[key] || null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
    memoryStorage[key] = value;
  } catch {
    memoryStorage[key] = value;
  }
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
    delete memoryStorage[key];
  } catch {
    delete memoryStorage[key];
  }
}

/**
 * Returns baseline factory default trading settings.
 */
export function getSystemDefaultSettings(): TradingDefaultSettings {
  return { ...SYSTEM_DEFAULT_TRADING_SETTINGS };
}

/**
 * Loads user-customized default trading settings from local storage.
 * Falls back to system defaults if none exist.
 */
export function loadDefaultTradingSettings(): TradingDefaultSettings {
  try {
    const raw = safeGetItem(STORAGE_KEYS.USER_DEFAULT_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...SYSTEM_DEFAULT_TRADING_SETTINGS,
        ...parsed,
      };
    }
  } catch (err) {
    console.warn('[TradingSettingsStore] Error reading default settings:', err);
  }
  return getSystemDefaultSettings();
}

/**
 * Saves user-customized default trading settings to local storage.
 */
export function saveDefaultTradingSettings(settings: Partial<TradingDefaultSettings>): TradingDefaultSettings {
  const current = loadDefaultTradingSettings();
  const updated: TradingDefaultSettings = {
    ...current,
    ...settings,
    updatedAt: Date.now(),
  };
  safeSetItem(STORAGE_KEYS.USER_DEFAULT_SETTINGS, JSON.stringify(updated));
  return updated;
}

/**
 * Resets user default settings back to factory system defaults.
 */
export function resetDefaultSettingsToSystem(): TradingDefaultSettings {
  safeRemoveItem(STORAGE_KEYS.USER_DEFAULT_SETTINGS);
  return getSystemDefaultSettings();
}

/**
 * Loads last preserved manual trading form inputs from local storage.
 */
export function loadManualTradingSettings(): Partial<ManualTradingInputsState> | null {
  try {
    const raw = safeGetItem(STORAGE_KEYS.ACTIVE_MANUAL_INPUTS);
    if (raw) {
      return JSON.parse(raw) as Partial<ManualTradingInputsState>;
    }
  } catch (err) {
    console.warn('[TradingSettingsStore] Error reading manual trading inputs:', err);
  }
  return null;
}

/**
 * Saves current manual trading inputs to local storage to persist across sessions/reloads.
 */
export function saveManualTradingSettings(inputs: Partial<ManualTradingInputsState>): void {
  try {
    const existing = loadManualTradingSettings() || {};
    const updated = {
      ...existing,
      ...inputs,
      lastSavedAt: Date.now(),
    };
    safeSetItem(STORAGE_KEYS.ACTIVE_MANUAL_INPUTS, JSON.stringify(updated));
  } catch (err) {
    console.warn('[TradingSettingsStore] Error saving manual trading inputs:', err);
  }
}

/**
 * Converts user default settings into manual form inputs for resetting or applying defaults.
 */
export function mapDefaultsToManualInputs(defaults: TradingDefaultSettings): Partial<ManualTradingInputsState> {
  return {
    manualSymbol: defaults.defaultSymbol,
    manualAmount: String(defaults.defaultAmount),
    manualStepPercent: String(defaults.defaultStepPercent),
    manualStopLossPercent: String(defaults.defaultStopLossPercent),
    manualEntryCost: String(defaults.defaultManualEntryCost),
    manualEntryFee: String(defaults.defaultManualEntryCost),
    manualExitCostRate: String(defaults.defaultManualExitCostRate),
    manualExitFeeRate: String(defaults.defaultManualExitCostRate),
    manualEntryFeePercent: String(defaults.defaultEntryFeePercent ?? 0.1),
    manualEntryFeeAmount: String(defaults.defaultEntryFeeAmount ?? 0.0),
    manualExitFeePercent: String(defaults.defaultExitFeePercent ?? 0.1),
    manualExitFeeAmount: String(defaults.defaultExitFeeAmount ?? 0.0),
    botType: defaults.defaultBotType,
    entryExecutionMode: defaults.defaultImmediateEntry ? 'IMMEDIATE_BUY' : 'PRE_ENTRY_RECOVERY',
    xStepPercent: String(defaults.defaultXStepPercent),
    xRangeCount: String(defaults.defaultXRangeCount),
    trailingStopLossPercent: String(defaults.defaultTrailingStopLossPercent),
    lastSavedAt: Date.now(),
  };
}
