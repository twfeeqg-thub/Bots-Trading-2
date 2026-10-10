// Project Q — Trade Manager: X/Recovery Engine for RANGE_BOT
// Manages the recovery allocations and levels when running a RANGE_BOT.
// Respects existing Bot Core, Bot Engine, and Trading Layer (Mock) architectures.
// Does NOT invent new unapproved rules:
// - All volume aggregates into a unified weighted average price.
// - T0 and trailing T-levels recalculate from the aggregated average price.
// - Zero real keys, 100% Mock mode.

import { XRangeSettings } from '@/lib/bots/types';
import { XRecoveryLevel, XRecoveryPlan } from './types';

export class XRecoveryManager {
  /**
   * Constructs the X/Recovery plan for a RANGE_BOT upon entry confirmation.
   * Does NOT force a fixed ceiling of 3 levels or fixed defaults over user input.
   * Generates Level 1 dynamically. Subsequent levels are generated sequentially on demand.
   */
  public static buildPlan(params: {
    entryPrice: number;
    entryAmount: number;
    xSettings?: XRangeSettings;
  }): XRecoveryPlan | undefined {
    if (!params.xSettings || !params.xSettings.enabled) {
      return undefined;
    }

    // Respect user's explicit limit; if undefined or not set, generation is unlimited
    const maxLevels = params.xSettings.maxLevels;
    const stepPercent =
      params.xSettings.stepPercent !== undefined && params.xSettings.stepPercent > 0
        ? params.xSettings.stepPercent
        : 1.5;
    const recoveryRatio =
      params.xSettings.recoveryRatio !== undefined && params.xSettings.recoveryRatio > 0
        ? params.xSettings.recoveryRatio
        : 1.0;
    const customAllocationQuote =
      params.xSettings.customAllocationQuote !== undefined && params.xSettings.customAllocationQuote > 0
        ? params.xSettings.customAllocationQuote
        : undefined;

    const plan: XRecoveryPlan = {
      enabled: true,
      maxLevels,
      stepPercent,
      recoveryRatio,
      customAllocationQuote,
      baseEntryPrice: params.entryPrice,
      baseEntryAmount: params.entryAmount,
      levels: [],
      executedLevelsCount: 0,
      totalRecoverySpent: 0,
      totalRecoveryQty: 0,
      averageEntryPrice: params.entryPrice,
    };

    // Dynamically generate the first level (X1) without pre-allocating a fixed array
    XRecoveryManager.generateNextLevel(plan);

    return plan;
  }

  /**
   * Dynamically generates the next sequential recovery level when conditions are met.
   * Continuous generation: X1, X2, X3, X4, X5 ... without any artificial ceiling.
   */
  public static generateNextLevel(plan: XRecoveryPlan): XRecoveryLevel | null {
    const nextIndex = plan.levels.length + 1;

    // If user explicitly configured a maxLevels ceiling, respect it
    if (plan.maxLevels !== undefined && nextIndex > plan.maxLevels) {
      return null;
    }

    const dropMultiplier = 1 - (nextIndex * plan.stepPercent) / 100;
    if (dropMultiplier <= 0) {
      return null; // Cannot drop below zero
    }

    const triggerPrice = Number((plan.baseEntryPrice * dropMultiplier).toFixed(8));
    const allocationQuote =
      plan.customAllocationQuote !== undefined && plan.customAllocationQuote > 0
        ? Number(plan.customAllocationQuote.toFixed(8))
        : Number(
            (plan.baseEntryAmount * Math.pow(plan.recoveryRatio, nextIndex)).toFixed(8)
          );

    const level: XRecoveryLevel = {
      levelIndex: nextIndex,
      triggerPrice,
      allocationQuote,
      status: 'PENDING',
    };

    plan.levels.push(level);
    return level;
  }

  /**
   * Checks if any pending recovery level has been triggered by current market price.
   * Returns the next pending level that was breached, or null.
   * Respects that an executed level is NEVER re-executed in the same cycle.
   */
  public static checkTrigger(
    plan: XRecoveryPlan,
    currentPrice: number
  ): XRecoveryLevel | null {
    if (!plan.enabled) return null;

    // Check existing pending levels
    for (const lvl of plan.levels) {
      if (lvl.status === 'PENDING' && currentPrice <= lvl.triggerPrice) {
        return lvl;
      }
    }

    return null;
  }

  /**
   * Records the execution of a recovery order and updates recovery metrics.
   * Immediately triggers dynamic generation of the next level (X_next).
   */
  public static recordExecution(
    plan: XRecoveryPlan,
    levelIndex: number,
    execution: {
      fillPrice: number;
      filledQty: number;
      feePaid: number;
      orderId: string;
      timestamp: number;
    }
  ): void {
    const level = plan.levels.find((l) => l.levelIndex === levelIndex);
    if (!level) return;

    level.status = 'EXECUTED';
    level.fillPrice = execution.fillPrice;
    level.filledQty = execution.filledQty;
    level.feePaid = execution.feePaid;
    level.orderId = execution.orderId;
    level.executedAt = execution.timestamp;

    plan.executedLevelsCount++;
    plan.totalRecoverySpent += execution.fillPrice * execution.filledQty;
    plan.totalRecoveryQty += execution.filledQty;

    // Dynamically generate the next level immediately
    XRecoveryManager.generateNextLevel(plan);
  }

  /**
   * Recomputes the aggregated weighted average entry price, total quantity, and total entry fees.
   */
  public static calculateAggregatedPosition(
    initialEntry: { price: number; qty: number; fee: number },
    plan: XRecoveryPlan
  ): {
    averageEntryPrice: number;
    totalQuantity: number;
    totalEntryFees: number;
    totalInvested: number;
  } {
    const initialInvested = initialEntry.price * initialEntry.qty;
    const totalInvested = initialInvested + plan.totalRecoverySpent;
    const totalQuantity = initialEntry.qty + plan.totalRecoveryQty;

    const averageEntryPrice =
      totalQuantity > 0 ? Number((totalInvested / totalQuantity).toFixed(8)) : initialEntry.price;

    let totalFees = initialEntry.fee;
    for (const lvl of plan.levels) {
      if (lvl.status === 'EXECUTED' && lvl.feePaid) {
        totalFees += lvl.feePaid;
      }
    }

    plan.averageEntryPrice = averageEntryPrice;

    return {
      averageEntryPrice,
      totalQuantity,
      totalEntryFees: Number(totalFees.toFixed(8)),
      totalInvested: Number(totalInvested.toFixed(8)),
    };
  }
}
