// Project Q — Trade Manager: Confirmed Symbol Cost Store
// Stores and retrieves the latest confirmed real costs for each symbol/pair.
// Adheres to the priority rules:
// 1. Newly confirmed real data
// 2. Previously saved real data for the symbol
// 3. Manual user input

import { ConfirmedSymbolCost, CostDataSource, TradeCostConfig } from './types';

export class SymbolCostStore {
  private static instance: SymbolCostStore | null = null;
  private costs: Map<string, ConfirmedSymbolCost> = new Map();

  private constructor() {}

  public static getInstance(): SymbolCostStore {
    if (!SymbolCostStore.instance) {
      SymbolCostStore.instance = new SymbolCostStore();
    }
    return SymbolCostStore.instance;
  }

  /**
   * Saves the latest confirmed real cost data for a symbol.
   */
  public saveConfirmedCost(cost: ConfirmedSymbolCost): void {
    const symbol = cost.symbol.toUpperCase().trim();
    this.costs.set(symbol, {
      ...cost,
      symbol,
      confirmedAt: cost.confirmedAt || Date.now(),
    });
  }

  /**
   * Retrieves the latest confirmed real cost data for a symbol (if any).
   */
  public getConfirmedCost(symbol: string): ConfirmedSymbolCost | undefined {
    return this.costs.get(symbol.toUpperCase().trim());
  }

  /**
   * Resolves the initial cost configuration for a new trade adhering to priority:
   * 1. If user explicitly provided manual input -> use it as MANUAL_USER_INPUT
   * 2. Else if previously confirmed real data exists for this symbol -> use it as REAL_CONFIRMED_SAVED
   * 3. Else fallback to standard default initial manual data (never blocks trade opening!)
   */
  public resolveInitialCostConfig(params: {
    symbol: string;
    entryAmount: number;
    manualEntryCost?: number;
    manualExitCostRate?: number;
    manualEntryFeePercent?: number;
    manualEntryFeeAmount?: number;
    manualExitFeePercent?: number;
    manualExitFeeAmount?: number;
  }): TradeCostConfig {
    const symbol = params.symbol.toUpperCase().trim();
    const saved = this.getConfirmedCost(symbol);

    const hasExplicitManual =
      params.manualEntryFeePercent !== undefined ||
      params.manualEntryFeeAmount !== undefined ||
      params.manualExitFeePercent !== undefined ||
      params.manualExitFeeAmount !== undefined ||
      params.manualEntryCost !== undefined ||
      params.manualExitCostRate !== undefined;

    // Priority 1: User explicitly provided manual values (Percent, Amount, or Both)
    if (hasExplicitManual) {
      // 1. Calculate Entry Fee: Sum percent component + currency amount component
      const entryPercent = params.manualEntryFeePercent !== undefined ? params.manualEntryFeePercent : undefined;
      const entryFixedAmount =
        params.manualEntryFeeAmount !== undefined
          ? params.manualEntryFeeAmount
          : params.manualEntryCost !== undefined
          ? params.manualEntryCost
          : 0;

      let entryCostAmount = 0;
      if (entryPercent !== undefined) {
        entryCostAmount += params.entryAmount * (entryPercent / 100);
      }
      entryCostAmount += entryFixedAmount;

      // If user provided neither percent nor amount for entry, use saved or baseline 0.1%
      if (entryPercent === undefined && params.manualEntryFeeAmount === undefined && params.manualEntryCost === undefined) {
        entryCostAmount = saved ? params.entryAmount * saved.effectiveEntryRate : params.entryAmount * 0.001;
      }

      const entryCostRate =
        params.entryAmount > 0 ? entryCostAmount / params.entryAmount : 0.001;

      // 2. Calculate Exit Fee: Determine percent rate and currency amount component
      let exitCostRate = 0.001;
      let exitFeePercent = params.manualExitFeePercent;
      if (params.manualExitFeePercent !== undefined) {
        exitCostRate = params.manualExitFeePercent / 100;
      } else if (params.manualExitCostRate !== undefined) {
        exitCostRate = params.manualExitCostRate;
        exitFeePercent = params.manualExitCostRate * 100;
      } else if (saved) {
        exitCostRate = saved.effectiveExitRate;
        exitFeePercent = saved.effectiveExitRate * 100;
      }

      const exitFeeAmount =
        params.manualExitFeeAmount !== undefined && params.manualExitFeeAmount >= 0
          ? params.manualExitFeeAmount
          : 0;

      return {
        entryCostAmount: Number(entryCostAmount.toFixed(8)),
        entryCostRate: Number(entryCostRate.toFixed(8)),
        exitCostRate: Number(exitCostRate.toFixed(8)),
        entryFeePercent: entryPercent,
        entryFeeAmount: entryFixedAmount,
        exitFeePercent,
        exitFeeAmount,
        source: 'MANUAL_USER_INPUT',
        updatedAt: Date.now(),
        description: 'بيانات تكلفة يدوية مخصصة (نسبة ومبلغ بالعملة) مدخلة من المستخدم',
        isRealConfirmed: false,
      };
    }

    // Priority 2: Previously saved real data for this symbol
    if (saved) {
      const entryCostAmount = Number((params.entryAmount * saved.effectiveEntryRate).toFixed(8));
      return {
        entryCostAmount,
        entryCostRate: saved.effectiveEntryRate,
        exitCostRate: saved.effectiveExitRate,
        entryFeePercent: saved.effectiveEntryRate * 100,
        entryFeeAmount: 0,
        exitFeePercent: saved.effectiveExitRate * 100,
        exitFeeAmount: 0,
        source: 'REAL_CONFIRMED_SAVED',
        updatedAt: saved.confirmedAt,
        description: `بيانات حقيقية محفوظة سابقًا للعملة ${symbol}`,
        isRealConfirmed: true,
      };
    }

    // Priority 3: Fallback initial manual baseline (never block trade creation)
    const fallbackRate = 0.001; // 0.1% baseline
    const fallbackAmount = Number((params.entryAmount * fallbackRate).toFixed(8));

    return {
      entryCostAmount: fallbackAmount,
      entryCostRate: fallbackRate,
      exitCostRate: fallbackRate,
      entryFeePercent: 0.1,
      entryFeeAmount: 0,
      exitFeePercent: 0.1,
      exitFeeAmount: 0,
      source: 'MANUAL_USER_INPUT',
      updatedAt: Date.now(),
      description: 'بيانات يدوية افتراضية أولية لعدم توفر بيانات سابقة',
      isRealConfirmed: false,
    };
  }

  public getAll(): Record<string, ConfirmedSymbolCost> {
    const res: Record<string, ConfirmedSymbolCost> = {};
    this.costs.forEach((v, k) => {
      res[k] = { ...v };
    });
    return res;
  }

  public clear(): void {
    this.costs.clear();
  }
}

export const sharedSymbolCostStore = SymbolCostStore.getInstance();
