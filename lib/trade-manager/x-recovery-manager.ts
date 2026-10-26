// Project Q — Trade Manager: X/Recovery Engine for RANGE_BOT
// Manages the recovery allocations and levels when running a RANGE_BOT.
// Respects existing Bot Core, Bot Engine, and Trading Layer (Mock) architectures.
// Does NOT invent new unapproved rules:
// - All volume aggregates into a unified weighted average price.
// - T0 and trailing T-levels recalculate from the aggregated average price.
// - Zero real keys, 100% Mock mode.

import { XRangeSettings } from '@/lib/bots/types';
import {
  XRecoveryLevel,
  XRecoveryPlan,
  PreEntryXRecoveryMonitor,
  PreEntryEvaluationResult,
} from './types';

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

  // =========================================================================
  // Phase 1: Pre-Entry X Recovery Logic (منطق الدخول بالتعافي قبل فتح الصفقة)
  // =========================================================================

  /**
   * Calculates the exact trigger price of level k based on watchPrice and stepPercent.
   * Level 0 = watchPrice
   * Level 1 = watchPrice * (1 - 1*step/100)
   * Level 2 = watchPrice * (1 - 2*step/100), etc.
   */
  public static calculateLevelPrice(
    watchPrice: number,
    stepPercent: number,
    levelIndex: number
  ): number {
    if (levelIndex <= 0) return watchPrice;
    const dropMultiplier = 1 - (levelIndex * stepPercent) / 100;
    return Number((watchPrice * Math.max(0, dropMultiplier)).toFixed(8));
  }

  /**
   * Initializes a pre-entry monitoring session where the manual entry price
   * acts strictly as the baseline watch price (سعر بدء المراقبة), NOT an order.
   */
  public static buildPreEntryMonitor(params: {
    watchPrice: number;
    stepPercent?: number;
    requiredRecoveries?: number;
    enabled?: boolean;
  }): PreEntryXRecoveryMonitor {
    const stepPercent =
      params.stepPercent !== undefined && params.stepPercent > 0 ? params.stepPercent : 2.0;
    const requiredRecoveries =
      params.requiredRecoveries !== undefined && params.requiredRecoveries > 0
        ? params.requiredRecoveries
        : 3;

    return {
      enabled: params.enabled !== false,
      watchPrice: params.watchPrice,
      stepPercent,
      requiredConsecutiveRecoveries: requiredRecoveries,
      deepestLevelIndexReached: 0,
      lowestPriceObserved: params.watchPrice,
      consecutiveRecoveries: 0,
      recoveredLevelsHistory: [],
      lastRecoveredLevelIndex: null,
      lastEvaluatedPrice: params.watchPrice,
      status: 'MONITORING_DROP',
      shouldBuy: false,
      notes: `بدء مراقبة التعافي: سعر البدء ${params.watchPrice} USDT، الخطوة ${stepPercent}%، يُشترط استعادة 3 مستويات X متتالية صاعدة للشراء.`,
    };
  }

  /**
   * Resets the consecutive recovery counter when price re-drops.
   */
  public static resetRecoveryCount(monitor: PreEntryXRecoveryMonitor, reason?: string): void {
    monitor.consecutiveRecoveries = 0;
    monitor.recoveredLevelsHistory = [];
    monitor.lastRecoveredLevelIndex = null;
    monitor.status = 'MONITORING_DROP';
    if (reason) {
      monitor.notes = reason;
    }
  }

  /**
   * Evaluates market price ticks against pre-entry recovery rules:
   * 1. Manual entry price is purely the start of monitoring price (سعر بدء المراقبة).
   * 2. NO BUYING allowed while price is dropping or touching/breaching X levels.
   * 3. Ascent: reaching or crossing a level counts as recovering it.
   * 4. Consecutive count: Requires 3 consecutive X levels recovered during the ascent.
   * 5. Re-drop: If price drops back below the last recovered level during recovery,
   *    the consecutive counter is cancelled and reset to 0 immediately.
   */
  public static evaluatePreEntryTick(
    monitor: PreEntryXRecoveryMonitor,
    currentPrice: number
  ): PreEntryEvaluationResult {
    if (!monitor.enabled) {
      return {
        shouldBuy: false,
        stateChanged: false,
        consecutiveRecoveries: monitor.consecutiveRecoveries,
        deepestLevelReached: monitor.deepestLevelIndexReached,
        lastRecoveredLevel: monitor.lastRecoveredLevelIndex,
      };
    }

    if (monitor.shouldBuy) {
      return {
        shouldBuy: true,
        stateChanged: false,
        consecutiveRecoveries: monitor.consecutiveRecoveries,
        deepestLevelReached: monitor.deepestLevelIndexReached,
        lastRecoveredLevel: monitor.lastRecoveredLevelIndex,
        message: 'تم تفعيل أمر الشراء مسبقاً',
      };
    }

    let stateChanged = false;
    let message = '';
    const previousPrice = monitor.lastEvaluatedPrice;
    monitor.lastEvaluatedPrice = currentPrice;

    const getLvlPrice = (lvl: number) =>
      XRecoveryManager.calculateLevelPrice(monitor.watchPrice, monitor.stepPercent, lvl);

    // Track lowest price observed during monitoring
    if (currentPrice < monitor.lowestPriceObserved) {
      monitor.lowestPriceObserved = currentPrice;
    }

    const isPriceDropping = currentPrice < previousPrice;
    const isPriceAscending = currentPrice > previousPrice;

    // Rule 1 & 2: Tracking downward breaches (يُمنع الشراء أثناء الهبوط أو لمس مستويات X)
    let currentDeepest = monitor.deepestLevelIndexReached;
    let testLevel = currentDeepest + 1;
    while (testLevel <= 100) {
      const priceAtTest = getLvlPrice(testLevel);
      if (currentPrice <= priceAtTest) {
        currentDeepest = testLevel;
        testLevel++;
      } else {
        break;
      }
    }

    if (currentDeepest > monitor.deepestLevelIndexReached) {
      monitor.deepestLevelIndexReached = currentDeepest;
      monitor.status = 'MONITORING_DROP';
      stateChanged = true;
      message = `هبوط السعر وملامسة مستوى X${currentDeepest} (${getLvlPrice(currentDeepest)} USDT) - يُمنع الشراء أثناء الهبوط.`;

      // Any drop to new lower levels cancels in-progress recovery counts
      if (monitor.consecutiveRecoveries > 0) {
        XRecoveryManager.resetRecoveryCount(
          monitor,
          'تم إلغاء عداد الاستعادة لتسجيل كسر مستوى هابط جديد.'
        );
        message += ' تم إلغاء عداد الاستعادة.';
      }
    }

    // Rule 5: Cancellation on re-drop (وإلغاء العد عند عودة الهبوط)
    if (monitor.consecutiveRecoveries > 0 && monitor.lastRecoveredLevelIndex !== null) {
      const lastLevelPrice = getLvlPrice(monitor.lastRecoveredLevelIndex);
      if (currentPrice < lastLevelPrice) {
        const lostLevel = monitor.lastRecoveredLevelIndex;
        XRecoveryManager.resetRecoveryCount(
          monitor,
          `تم إلغاء عداد الاستعادة بسبب عودة هبوط السعر (${currentPrice} USDT) دون المستوى المستعاد X${lostLevel} (${lastLevelPrice} USDT).`
        );
        stateChanged = true;
        message = monitor.notes || 'تم إلغاء عداد الاستعادة لعودة الهبوط.';
      }
    }

    // Rule 3 & 4: Ascent recovery (استعادة 3 مستويات X متتالية أثناء الصعود)
    // Only processed if price is ascending or above lowest, and has previously reached levels
    if (
      isPriceAscending &&
      monitor.deepestLevelIndexReached > 0 &&
      monitor.status !== 'BUY_TRIGGERED'
    ) {
      while (!monitor.shouldBuy && monitor.deepestLevelIndexReached > 0) {
        let nextTargetLevel: number | null = null;
        if (monitor.lastRecoveredLevelIndex === null) {
          // Find lowest breached level where previous price was at or below trigger price
          for (let lvl = monitor.deepestLevelIndexReached; lvl >= 0; lvl--) {
            const lvlPrice = getLvlPrice(lvl);
            if (previousPrice <= lvlPrice) {
              nextTargetLevel = lvl;
              break;
            }
          }
          if (nextTargetLevel === null) break;
        } else {
          nextTargetLevel = monitor.lastRecoveredLevelIndex - 1;
        }

        if (nextTargetLevel < 0) break;

        const targetLevelPrice = getLvlPrice(nextTargetLevel);
        // "مع اعتبار الوصول إلى المستوى استعادةً له"
        if (currentPrice >= targetLevelPrice) {
          monitor.consecutiveRecoveries += 1;
          monitor.lastRecoveredLevelIndex = nextTargetLevel;
          monitor.recoveredLevelsHistory.push(nextTargetLevel);
          monitor.status = 'RECOVERING';
          stateChanged = true;

          if (monitor.consecutiveRecoveries >= monitor.requiredConsecutiveRecoveries) {
            monitor.shouldBuy = true;
            monitor.status = 'BUY_TRIGGERED';
            monitor.triggeredAt = Date.now();
            message = `تحقق شرط الشراء بالتعافي! تم استعادة ${monitor.consecutiveRecoveries} مستويات X متتالية أثناء الصعود بنجاح (المستويات: ${monitor.recoveredLevelsHistory.map((l) => `X${l}`).join(' -> ')}).`;
            monitor.notes = message;
            break;
          } else {
            message = `تمت استعادة المستوى X${nextTargetLevel} بنجاح عند السعر ${currentPrice} USDT (العداد: ${monitor.consecutiveRecoveries}/${monitor.requiredConsecutiveRecoveries}).`;
            monitor.notes = message;
          }
        } else {
          break;
        }
      }
    }

    return {
      shouldBuy: monitor.shouldBuy,
      stateChanged,
      consecutiveRecoveries: monitor.consecutiveRecoveries,
      deepestLevelReached: monitor.deepestLevelIndexReached,
      lastRecoveredLevel: monitor.lastRecoveredLevelIndex,
      message: message || monitor.notes,
    };
  }
}

