// Project Q — Trade Manager: Mathematical Level Calculator
// Computes exact Net Break-Even (T0), T-levels (T1-50%, T1, T2, T3...),
// trailing protection rules, and Net PnL based on actual Binance execution costs.
// Supports dynamic recalculation when real confirmed cost data arrives
// or when X/Recovery executes additional volume in a RANGE_BOT.
// Accepts ANY positive amount or step %, and accepts negative or positive stop-loss %.

import {
  AchievedTargetLevel,
  LevelEvaluationResult,
  TradeCostConfig,
  TradeLevelsPlan,
  TradePnL,
} from './types';

export class LevelCalculator {
  /**
   * Computes the exact Net Break-Even price (T0) after factoring in:
   * 1. Actual Entry Execution Price and filled quantity
   * 2. Actual/Specified Entry Commission paid (in USDT)
   * 3. Exit Commission Rate (e.g. 0.001 or actual confirmed rate)
   * High precision (8 decimals) prevents truncation of small values.
   */
  public static calculateT0BreakEven(
    entryPrice: number,
    filledQuantity: number,
    entryCommissionQuote: number = 0,
    exitCommissionRate: number = 0.001,
    exitFeeAmount: number = 0
  ): number {
    if (filledQuantity <= 0 || entryPrice <= 0) return entryPrice;

    // Total cash invested at entry = (entryPrice * filledQuantity) + entryCommissionQuote
    const totalCashInvested = entryPrice * filledQuantity + entryCommissionQuote;

    // At exit: Net cash received = (exitPrice * filledQuantity * (1 - exitCommissionRate)) - exitFeeAmount
    // For net break-even: Net cash received = totalCashInvested
    // T0 = (totalCashInvested + exitFeeAmount) / (filledQuantity * (1 - exitCommissionRate))
    const netExitMultiplier = 1 - exitCommissionRate;
    if (netExitMultiplier <= 0) return entryPrice;

    const t0 = (totalCashInvested + exitFeeAmount) / (filledQuantity * netExitMultiplier);
    return Number(t0.toFixed(8));
  }

  /**
   * Constructs the initial deterministic levels plan once entry is confirmed.
   * Handles negative or positive initialStopPercent seamlessly without artificial limits.
   */
  public static buildTradeLevelsPlan(params: {
    entryPrice: number;
    filledQuantity: number;
    costConfig: TradeCostConfig;
    stepPercent?: number; // Distance for each T step (e.g. 0.1%, 2.0%)
    initialStopPercent?: number; // Supports negative (e.g. -2.5) or positive (2.5)
  }): TradeLevelsPlan {
    const entryPrice = params.entryPrice;
    const filledQuantity = params.filledQuantity;
    const costConfig = params.costConfig;
    const entryCommissionQuote = costConfig.entryCostAmount || 0;
    const exitCommissionRate = costConfig.exitCostRate || 0.001;
    const exitFeeAmount = costConfig.exitFeeAmount || 0;
    const stepPercent = params.stepPercent !== undefined && params.stepPercent > 0 ? params.stepPercent : 2.0;

    // Accepts negative (e.g. -2.5%) or positive (e.g. 2.5%)
    const rawStop = params.initialStopPercent !== undefined ? params.initialStopPercent : 2.0;
    const stopMagnitude = Math.abs(rawStop);

    const t0BreakEvenPrice = LevelCalculator.calculateT0BreakEven(
      entryPrice,
      filledQuantity,
      entryCommissionQuote,
      exitCommissionRate,
      exitFeeAmount
    );

    const stepDelta = entryPrice * (stepPercent / 100);

    const t1Minus50Price = Number((entryPrice + 0.5 * stepDelta).toFixed(8));
    const t1Price = Number((entryPrice + 1.0 * stepDelta).toFixed(8));
    const t2Price = Number((entryPrice + 2.0 * stepDelta).toFixed(8));
    const t3Price = Number((entryPrice + 3.0 * stepDelta).toFixed(8));
    const t4Price = Number((entryPrice + 4.0 * stepDelta).toFixed(8));

    // Initial floor before T1-50% is achieved
    const initialProtectionPrice = Number(
      (entryPrice * (1 - stopMagnitude / 100)).toFixed(8)
    );

    return {
      entryPrice,
      filledQuantity,
      entryCommissionQuote,
      exitCommissionRate,
      exitFeeAmount,
      t0BreakEvenPrice,
      stepPercent,
      t1Minus50Price,
      t1Price,
      t2Price,
      t3Price,
      t4Price,
      initialProtectionPrice,
      currentAchievedLevel: 'NONE',
      activeProtectionPrice: initialProtectionPrice,
      highestPriceObserved: entryPrice,
      lastEvaluatedPrice: entryPrice,
      lastEvaluatedAt: Date.now(),
      costConfig: { ...costConfig },
    };
  }

  /**
   * Recalculates levels plan (especially T0 and active protection) when real confirmed
   * cost data arrives, replacing initial manual data without restarting the trade.
   */
  public static recalculateWithUpdatedCosts(
    plan: TradeLevelsPlan,
    newCostConfig: TradeCostConfig
  ): TradeLevelsPlan {
    plan.costConfig = { ...newCostConfig };
    plan.entryCommissionQuote = newCostConfig.entryCostAmount;
    plan.exitCommissionRate = newCostConfig.exitCostRate;
    plan.exitFeeAmount = newCostConfig.exitFeeAmount || 0;

    // Recalculate T0 Net Break-Even with new confirmed costs
    plan.t0BreakEvenPrice = LevelCalculator.calculateT0BreakEven(
      plan.entryPrice,
      plan.filledQuantity,
      plan.entryCommissionQuote,
      plan.exitCommissionRate,
      plan.exitFeeAmount
    );

    // If currently at T1-50%, the active protection level is T0, so update it!
    if (plan.currentAchievedLevel === 'T1_MINUS_50') {
      plan.activeProtectionPrice = plan.t0BreakEvenPrice;
    }

    return plan;
  }

  /**
   * Recalculates T-levels and T0 Break-Even when additional volume is filled
   * via an X/Recovery execution in a RANGE_BOT.
   */
  public static recalculateWithAggregatedEntry(
    plan: TradeLevelsPlan,
    newAverageEntryPrice: number,
    newTotalQuantity: number,
    newTotalEntryCommission: number
  ): TradeLevelsPlan {
    const oldEntryPrice = plan.entryPrice;
    plan.entryPrice = newAverageEntryPrice;
    plan.filledQuantity = newTotalQuantity;
    plan.entryCommissionQuote = newTotalEntryCommission;

    const exitFeeAmount = plan.exitFeeAmount || plan.costConfig?.exitFeeAmount || 0;

    // Recalculate T0 based on aggregated volume and costs
    plan.t0BreakEvenPrice = LevelCalculator.calculateT0BreakEven(
      newAverageEntryPrice,
      newTotalQuantity,
      newTotalEntryCommission,
      plan.exitCommissionRate,
      exitFeeAmount
    );

    // Recompute T-levels anchored to the new weighted average entry price
    const stepDelta = newAverageEntryPrice * (plan.stepPercent / 100);
    plan.t1Minus50Price = Number((newAverageEntryPrice + 0.5 * stepDelta).toFixed(8));
    plan.t1Price = Number((newAverageEntryPrice + 1.0 * stepDelta).toFixed(8));
    plan.t2Price = Number((newAverageEntryPrice + 2.0 * stepDelta).toFixed(8));
    plan.t3Price = Number((newAverageEntryPrice + 3.0 * stepDelta).toFixed(8));
    plan.t4Price = Number((newAverageEntryPrice + 4.0 * stepDelta).toFixed(8));

    // Update active protection based on current achieved level
    if (plan.currentAchievedLevel === 'NONE') {
      const stopMagnitude =
        oldEntryPrice > 0
          ? Math.abs(oldEntryPrice - plan.initialProtectionPrice) / oldEntryPrice
          : 0.02;
      plan.initialProtectionPrice = Number(
        (newAverageEntryPrice * (1 - stopMagnitude)).toFixed(8)
      );
      plan.activeProtectionPrice = plan.initialProtectionPrice;
    } else if (plan.currentAchievedLevel === 'T1_MINUS_50') {
      plan.activeProtectionPrice = plan.t0BreakEvenPrice;
    } else if (plan.currentAchievedLevel === 'T1') {
      plan.activeProtectionPrice = plan.t1Minus50Price;
    } else if (plan.currentAchievedLevel.startsWith('T')) {
      const k = parseFloat(plan.currentAchievedLevel.substring(1));
      if (!isNaN(k)) {
        plan.activeProtectionPrice = LevelCalculator.getTProtection(plan, k);
      } else {
        plan.activeProtectionPrice = plan.t1Minus50Price;
      }
    }

    plan.entryPrice = newAverageEntryPrice;
    plan.filledQuantity = newTotalQuantity;
    plan.entryCommissionQuote = newTotalEntryCommission;

    return plan;
  }

  /**
   * Returns the exact target price for any T-level k (e.g. k=1 -> T1, k=2 -> T2, k=5 -> T5...).
   * Supports unlimited, continuous generation: T1, T2, T3, T4, T5, ... Tk.
   */
  public static getTPrice(plan: TradeLevelsPlan, k: number): number {
    const stepDelta = plan.entryPrice * (plan.stepPercent / 100);
    return Number((plan.entryPrice + k * stepDelta).toFixed(8));
  }

  /**
   * Returns the trailing protection price for any achieved T-level.
   * - Level 0.5 (T1_MINUS_50): Protection is T0 (Net Break-Even)
   * - Level 1 (T1): Protection is T1 - 50%
   * - Level k >= 2 (Tk): Protection is T(k - 1)
   */
  public static getTProtection(plan: TradeLevelsPlan, k: number): number {
    if (k <= 0) {
      return plan.initialProtectionPrice;
    }
    if (k === 0.5) {
      return plan.t0BreakEvenPrice;
    }
    if (k === 1) {
      return plan.t1Minus50Price;
    }
    return LevelCalculator.getTPrice(plan, k - 1);
  }

  /**
   * Evaluates a live market price tick against the trade levels plan.
   * Dynamically progresses upward through unlimited T levels (T1, T2, T3, T4, T5... Tn).
   */
  public static evaluatePriceTick(
    plan: TradeLevelsPlan,
    currentPrice: number
  ): LevelEvaluationResult {
    const prevLevel = plan.currentAchievedLevel;
    const prevProtection = plan.activeProtectionPrice;

    let newLevel = prevLevel;
    let newProtection = prevProtection;
    let levelAdvanced = false;

    // Track highest price
    if (currentPrice > plan.highestPriceObserved) {
      plan.highestPriceObserved = currentPrice;
    }

    const stepDelta = plan.entryPrice * (plan.stepPercent / 100);

    // Parse current achieved numeric level index
    let prevIndex = 0;
    if (prevLevel === 'T1_MINUS_50') {
      prevIndex = 0.5;
    } else if (prevLevel.startsWith('T')) {
      const parsed = parseFloat(prevLevel.substring(1));
      if (!isNaN(parsed)) prevIndex = parsed;
    }

    // Step 1: Upward Progression Evaluation (Dynamic & Continuous without any ceiling)
    let highestK = 0;
    if (stepDelta > 0 && currentPrice >= plan.entryPrice + stepDelta) {
      highestK = Math.floor((currentPrice - plan.entryPrice) / stepDelta);
    }

    if (highestK >= 1 && highestK > prevIndex) {
      newLevel = `T${highestK}`;
      newProtection = LevelCalculator.getTProtection(plan, highestK);
      levelAdvanced = true;
    } else if (highestK < 1 && currentPrice >= plan.t1Minus50Price && prevIndex < 0.5) {
      newLevel = 'T1_MINUS_50';
      newProtection = plan.t0BreakEvenPrice; // Protection is T0 (Net Break-Even)
      levelAdvanced = true;
    }

    // Step 2: Downward Retracement Check (Sell Trigger)
    let shouldSell = false;
    let triggerReason: string | undefined;

    if (currentPrice <= newProtection) {
      shouldSell = true;
      if (newLevel === 'NONE') {
        triggerReason = `لم يتحقق T1 وهبط السعر إلى مستوى الحماية الأولي (${newProtection})`;
      } else if (newLevel === 'T1_MINUS_50') {
        triggerReason = `رجوع السعر بعد T1-50% إلى سعر التعادل الصافي T0 (${newProtection})`;
      } else if (newLevel === 'T1') {
        triggerReason = `رجوع السعر بعد تحقيق T1 إلى مستوى الحماية T1-50% (${newProtection})`;
      } else {
        const k = parseFloat(newLevel.substring(1));
        const prevLevelName = !isNaN(k) && k > 1 ? `T${k - 1}` : 'السابق';
        triggerReason = `رجوع السعر بعد تحقيق ${newLevel} إلى مستوى الحماية ${prevLevelName} (${newProtection})`;
      }
    }

    // Update in-place
    plan.currentAchievedLevel = newLevel;
    plan.activeProtectionPrice = newProtection;
    plan.lastEvaluatedPrice = currentPrice;
    plan.lastEvaluatedAt = Date.now();

    return {
      shouldSell,
      triggerReason,
      levelAdvanced,
      previousAchievedLevel: prevLevel,
      newAchievedLevel: newLevel,
      previousProtectionPrice: prevProtection,
      newProtectionPrice: newProtection,
    };
  }

  /**
   * Calculates actual Net PnL after trade closure using real execution prices and fees.
   * High precision ensures micro-amounts (e.g. 0.0001 USDT) are calculated accurately.
   */
  public static calculateNetPnL(params: {
    entryPrice: number;
    exitPrice: number;
    filledQuantity: number;
    entryCommissionQuote: number;
    exitCommissionQuote: number;
  }): TradePnL {
    const grossReturnQuote =
      (params.exitPrice - params.entryPrice) * params.filledQuantity;
    const totalFeesQuote =
      params.entryCommissionQuote + params.exitCommissionQuote;
    const netReturnQuote = grossReturnQuote - totalFeesQuote;

    const investedCapital = params.entryPrice * params.filledQuantity;
    const netReturnPercent =
      investedCapital > 0 ? (netReturnQuote / investedCapital) * 100 : 0;

    return {
      grossReturnQuote: Number(grossReturnQuote.toFixed(8)),
      totalFeesQuote: Number(totalFeesQuote.toFixed(8)),
      netReturnQuote: Number(netReturnQuote.toFixed(8)),
      netReturnPercent: Number(netReturnPercent.toFixed(6)),
      isProfitable: netReturnQuote > 0,
    };
  }
}
