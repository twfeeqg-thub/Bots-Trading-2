// Project Q — PnL Calculator: Pure Math Engine
// Implements exact PnL and analytics mathematical calculations
// with 8 decimal floating point precision. Zero artificial minimums.
// Sourced strictly from real Trade Manager and Cost Data models.

import { LevelPnLMetric, TradeOutcome } from './types';
import { ManagedTrade, XRecoveryPlan } from '@/lib/trade-manager/types';

export class PnLCalculator {
  /**
   * Calculates net PnL in USDT and percentage with 8 decimals precision.
   * Total invested = sum of cash spent on all fills (entry + recoveries).
   * Total quantity = sum of tokens bought.
   * Gross quote received = exitPrice * totalQuantity.
   * Total fees = entry commissions paid + exit commission.
   * Net PnL = gross quote received - (invested capital + total fees).
   */
  public static calculateNetPnL(params: {
    investedCapital: number;
    totalQuantity: number;
    currentOrExitPrice: number;
    totalEntryFeesQuote: number;
    exitCommissionRate: number; // e.g. 0.001 (0.1%)
    actualExitFeeQuote?: number; // If trade is closed and exact fee is known
  }): {
    grossQuoteReceived: number;
    grossPnLQuote: number;
    exitFeeQuote: number;
    totalFeesQuote: number;
    netPnLQuote: number;
    netPnLPercent: number;
    isProfitable: boolean;
    outcome: TradeOutcome;
  } {
    const {
      investedCapital,
      totalQuantity,
      currentOrExitPrice,
      totalEntryFeesQuote,
      exitCommissionRate,
      actualExitFeeQuote,
    } = params;

    const grossQuoteReceived = currentOrExitPrice * totalQuantity;
    const grossPnLQuote = grossQuoteReceived - investedCapital;

    // Use actual exit fee if known; otherwise estimate via exitCommissionRate
    const exitFeeQuote =
      actualExitFeeQuote !== undefined
        ? actualExitFeeQuote
        : grossQuoteReceived * (exitCommissionRate || 0.001);

    const totalFeesQuote = totalEntryFeesQuote + exitFeeQuote;
    const netPnLQuote = grossPnLQuote - totalFeesQuote;

    const netPnLPercent =
      investedCapital > 0 ? (netPnLQuote / investedCapital) * 100 : 0;

    let outcome: TradeOutcome = 'BREAKEVEN';
    if (netPnLQuote > 0.00000001) {
      outcome = 'WIN';
    } else if (netPnLQuote < -0.00000001) {
      outcome = 'LOSS';
    }

    return {
      grossQuoteReceived: Number(grossQuoteReceived.toFixed(8)),
      grossPnLQuote: Number(grossPnLQuote.toFixed(8)),
      exitFeeQuote: Number(exitFeeQuote.toFixed(8)),
      totalFeesQuote: Number(totalFeesQuote.toFixed(8)),
      netPnLQuote: Number(netPnLQuote.toFixed(8)),
      netPnLPercent: Number(netPnLPercent.toFixed(6)),
      isProfitable: netPnLQuote > 0,
      outcome,
    };
  }

  /**
   * Computes per-level PnL breakdown for each executed level in an active or closed trade.
   * Shows exact performance of Base Entry, X1, X2, ... individually.
   */
  public static calculateLevelsBreakdown(
    trade: ManagedTrade,
    currentMarketPrice: number
  ): LevelPnLMetric[] {
    const metrics: LevelPnLMetric[] = [];
    const evaluationPrice =
      trade.status === 'CLOSED' && trade.exit?.executionPrice
        ? trade.exit.executionPrice
        : currentMarketPrice || trade.entry.executionPrice || 1;

    const exitRate = trade.costConfig.exitCostRate || 0.001;

    // 1. Base Entry Layer
    const basePrice =
      trade.xRecoveryPlan?.baseEntryPrice ||
      trade.entry.executionPrice ||
      trade.requestedAmount / (trade.entry.filledQuantity || 1);

    const baseAmount = trade.xRecoveryPlan?.baseEntryAmount || trade.requestedAmount;
    const baseQty =
      basePrice > 0
        ? Number((baseAmount / basePrice).toFixed(8))
        : trade.entry.filledQuantity || 0;

    const baseEntryFee = trade.costConfig.entryCostAmount || 0;
    const baseGrossRealized = evaluationPrice * baseQty;
    const baseExitFee = Number((baseGrossRealized * exitRate).toFixed(8));
    const baseGrossPnL = baseGrossRealized - baseAmount;
    const baseNetPnL = baseGrossPnL - (baseEntryFee + baseExitFee);
    const baseNetPct = baseAmount > 0 ? (baseNetPnL / baseAmount) * 100 : 0;

    metrics.push({
      levelType: 'BASE',
      levelIndex: 0,
      label: 'نقطة الدخول الأساسية (Base Entry)',
      status: 'EXECUTED',
      triggerPrice: basePrice,
      executionPrice: basePrice,
      quantity: baseQty,
      quoteAmount: baseAmount,
      feePaid: baseEntryFee,
      executedAt: trade.openedAt || trade.createdAt,
      orderId: trade.entry.orderId || 'base_order',
      currentOrExitPrice: evaluationPrice,
      grossPnLQuote: Number(baseGrossPnL.toFixed(8)),
      exitFeeAllocated: baseExitFee,
      netPnLQuote: Number(baseNetPnL.toFixed(8)),
      netPnLPercent: Number(baseNetPct.toFixed(4)),
    });

    // 2. Recovery Levels (if RANGE_BOT with plan)
    if (trade.xRecoveryPlan?.levels) {
      for (const lvl of trade.xRecoveryPlan.levels) {
        if (lvl.status === 'EXECUTED') {
          const fillPrice = lvl.fillPrice || lvl.triggerPrice;
          const qty = lvl.filledQty || lvl.allocationQuote / fillPrice;
          const feePaid = lvl.feePaid || 0;
          const grossVal = evaluationPrice * qty;
          const levelExitFee = Number((grossVal * exitRate).toFixed(8));
          const invested = fillPrice * qty;
          const grossPnL = grossVal - invested;
          const netPnL = grossPnL - (feePaid + levelExitFee);
          const netPct = invested > 0 ? (netPnL / invested) * 100 : 0;

          metrics.push({
            levelType: 'RECOVERY',
            levelIndex: lvl.levelIndex,
            label: `تعزيز مسار X${lvl.levelIndex}`,
            status: 'EXECUTED',
            triggerPrice: lvl.triggerPrice,
            executionPrice: fillPrice,
            quantity: Number(qty.toFixed(8)),
            quoteAmount: Number(invested.toFixed(8)),
            feePaid: Number(feePaid.toFixed(8)),
            executedAt: lvl.executedAt,
            orderId: lvl.orderId,
            currentOrExitPrice: evaluationPrice,
            grossPnLQuote: Number(grossPnL.toFixed(8)),
            exitFeeAllocated: levelExitFee,
            netPnLQuote: Number(netPnL.toFixed(8)),
            netPnLPercent: Number(netPct.toFixed(4)),
          });
        }
      }
    }

    return metrics;
  }

  /**
   * Evaluates the impact of X/Recovery on the trade:
   * Compares the actual trade outcome with the hypothetical outcome
   * if the trade had exited at the initial stop-loss without any recoveries.
   */
  public static evaluateRecoveryImpact(
    trade: ManagedTrade,
    recoveryPlan: XRecoveryPlan | undefined,
    currentOrExitPrice: number,
    finalNetPnLQuote: number
  ): {
    baseNetPnLAtStop: number;
    improvementDelta: number;
    verdict: 'POSITIVE_IMPACT' | 'NEGATIVE_IMPACT' | 'NEUTRAL';
  } {
    if (!recoveryPlan || recoveryPlan.executedLevelsCount === 0) {
      return {
        baseNetPnLAtStop: 0,
        improvementDelta: 0,
        verdict: 'NEUTRAL',
      };
    }

    // Hypothetical loss at initial stop floor:
    const initialStop = trade.levelsPlan?.initialProtectionPrice || recoveryPlan.baseEntryPrice * 0.98;
    const baseAmount = recoveryPlan.baseEntryAmount;
    const basePrice = recoveryPlan.baseEntryPrice;
    const baseQty = basePrice > 0 ? baseAmount / basePrice : 0;
    const entryFee = trade.costConfig.entryCostAmount || 0;
    const hypotheticalExitFee = initialStop * baseQty * (trade.costConfig.exitCostRate || 0.001);
    const hypotheticalGrossPnL = (initialStop - basePrice) * baseQty;
    const baseNetPnLAtStop = Number((hypotheticalGrossPnL - (entryFee + hypotheticalExitFee)).toFixed(8));

    const improvementDelta = Number((finalNetPnLQuote - baseNetPnLAtStop).toFixed(8));

    let verdict: 'POSITIVE_IMPACT' | 'NEGATIVE_IMPACT' | 'NEUTRAL' = 'NEUTRAL';
    if (improvementDelta > 0.0001) {
      verdict = 'POSITIVE_IMPACT';
    } else if (improvementDelta < -0.0001) {
      verdict = 'NEGATIVE_IMPACT';
    }

    return {
      baseNetPnLAtStop,
      improvementDelta,
      verdict,
    };
  }

  /**
   * Helper to format durations into human readable Arabic string.
   */
  public static formatDuration(durationMs: number | null): string {
    if (durationMs === null || durationMs === undefined || durationMs < 0) {
      return 'جارية (نشطة)';
    }
    const seconds = Math.floor(durationMs / 1000);
    if (seconds < 60) return `${seconds} ثانية`;
    const minutes = Math.floor(seconds / 60);
    const remainingSec = seconds % 60;
    if (minutes < 60) return `${minutes} د ${remainingSec} ث`;
    const hours = Math.floor(minutes / 60);
    const remainingMin = minutes % 60;
    return `${hours} س ${remainingMin} د`;
  }
}
