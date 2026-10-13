// Project Q — Trade Manager: Type Definitions
// Defines the two unified entry paths (Manual & Scanner),
// deterministic T-levels ladder (T0, T1-50%, T1, T2, T3...), trailing protection,
// Net PnL, and the Cost Data System (Manual vs Real Confirmed with 3-tier priority).

import { TradeEntryExecution, TradeExitExecution, TradeStatus, BotType, XRangeSettings } from '@/lib/bots/types';

export type TradeCreationSource = 'MANUAL' | 'SCANNER';

export type AchievedTargetLevel =
  | 'NONE'
  | 'T1_MINUS_50'
  | 'T1'
  | 'T2'
  | 'T3'
  | 'T4'
  | 'T5'
  | string;

export interface XRecoveryLevel {
  levelIndex: number; // 1, 2, ... maxLevels
  triggerPrice: number; // entryPrice * (1 - (levelIndex * stepPercent / 100))
  allocationQuote: number; // USDT allocated
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED';
  executedAt?: number;
  orderId?: string;
  fillPrice?: number;
  filledQty?: number;
  feePaid?: number;
}

export interface XRecoveryPlan {
  enabled: boolean;
  maxLevels?: number; // Optional user limit; undefined means continuous/unlimited
  stepPercent: number;
  recoveryRatio: number;
  customAllocationQuote?: number; // Optional direct custom allocation quote per level in USDT
  baseEntryPrice: number;
  baseEntryAmount: number;
  levels: XRecoveryLevel[];
  executedLevelsCount: number;
  totalRecoverySpent: number;
  totalRecoveryQty: number;
  averageEntryPrice: number;
}

export interface PreEntryXRecoveryMonitor {
  enabled: boolean;
  watchPrice: number; // سعر بدء المراقبة المحدد يدويًا (سعر الدخول اليدوي)
  stepPercent: number; // نسبة الخطوة لكل مستوى X (مثلاً 2%)
  requiredConsecutiveRecoveries: number; // عدد الاستعادات المتتالية المطلوبة (3 مستويات)
  deepestLevelIndexReached: number; // أقصى مستوى X وصل إليه الهبوط (1, 2, 3...)
  lowestPriceObserved: number; // أدنى سعر تم رصده منذ بدء المراقبة
  consecutiveRecoveries: number; // عداد الاستعادات الصاعدة المتتالية الحالي
  recoveredLevelsHistory: number[]; // تسلسل المستويات المستعادة في الصعود الحالي
  lastRecoveredLevelIndex: number | null; // رقم آخر مستوى تم استعادته
  lastEvaluatedPrice: number;
  status: 'MONITORING_DROP' | 'RECOVERING' | 'BUY_TRIGGERED';
  shouldBuy: boolean; // يتحقق فقط عند استعادة 3 مستويات X متتالية صاعدة
  triggeredAt?: number;
  notes?: string;
}

export interface PreEntryEvaluationResult {
  shouldBuy: boolean;
  stateChanged: boolean;
  consecutiveRecoveries: number;
  deepestLevelReached: number;
  lastRecoveredLevel: number | null;
  message?: string;
}

/**
 * Priority of Cost Data Sources:
 * 1. REAL_CONFIRMED_RECENT: Real data confirmed directly from latest execution/fill.
 * 2. REAL_CONFIRMED_SAVED: Real data confirmed and saved previously for this symbol.
 * 3. MANUAL_USER_INPUT: User's manual initial input (prevents blocking trade opening).
 */
export type CostDataSource =
  | 'REAL_CONFIRMED_RECENT'
  | 'REAL_CONFIRMED_SAVED'
  | 'MANUAL_USER_INPUT';

export interface TradeCostConfig {
  entryCostAmount: number; // In USDT / quote currency
  entryCostRate: number; // e.g. 0.001 (0.1%)
  exitCostRate: number; // e.g. 0.001 (0.1%)
  source: CostDataSource;
  updatedAt: number;
  description?: string;
  isRealConfirmed: boolean;
  // Phase 6: Dual fee definition (Percentage % + Currency Amount USDT)
  entryFeePercent?: number; // e.g. 0.1 for 0.1%
  entryFeeAmount?: number; // e.g. 0.05 for 0.05 USDT
  exitFeePercent?: number; // e.g. 0.15 for 0.15%
  exitFeeAmount?: number; // e.g. 0.05 for 0.05 USDT
}

export interface ConfirmedSymbolCost {
  symbol: string;
  effectiveEntryRate: number;
  effectiveExitRate: number;
  lastConfirmedEntryFee: number;
  lastConfirmedExitFee?: number;
  confirmedAt: number;
  sourceTradeId?: string;
}

export interface TradeLevelsPlan {
  entryPrice: number;
  filledQuantity: number;
  entryCommissionQuote: number;
  exitCommissionRate: number; // e.g. 0.001 (0.1%)
  exitFeeAmount?: number; // Phase 6: Flat exit commission component in USDT
  t0BreakEvenPrice: number; // Exact net break-even after entry and exit costs
  stepPercent: number; // Distance for each T level (e.g. 2.0%)
  t1Minus50Price: number; // Entry + 0.5 * step
  t1Price: number; // Entry + 1.0 * step
  t2Price: number; // Entry + 2.0 * step
  t3Price: number; // Entry + 3.0 * step
  t4Price: number; // Entry + 4.0 * step
  initialProtectionPrice: number; // Protection before T1-50%
  currentAchievedLevel: AchievedTargetLevel;
  activeProtectionPrice: number;
  highestPriceObserved: number;
  lastEvaluatedPrice?: number;
  lastEvaluatedAt?: number;
  costConfig: TradeCostConfig;
}

export interface TradePnL {
  grossReturnQuote: number; // (exitPrice - entryPrice) * filledQuantity
  totalFeesQuote: number; // entryCommission + exitCommission
  netReturnQuote: number; // grossReturnQuote - totalFeesQuote
  netReturnPercent: number; // (netReturnQuote / (entryPrice * filledQuantity)) * 100
  isProfitable: boolean;
}

export interface PartialExitRecord {
  recordId: string;
  orderId?: string | null;
  executionPrice: number;
  soldQuantity: number;
  remainingQuantityAfter: number;
  entryCostQuotePortion: number; // Proportional share of initial entry fee attributed to this slice
  exitCostQuote: number; // Actual exit commission for this execution
  grossReturnQuote: number; // (executionPrice - entryPrice) * soldQuantity
  netReturnQuote: number; // grossReturnQuote - (entryCostQuotePortion + exitCostQuote)
  netReturnPercent: number; // (netReturnQuote / (entryPrice * soldQuantity)) * 100
  isProfitable: boolean;
  executedAt: number;
  reason: string;
}

/**
 * Phase 4 & Phase 6: Explicit separation between User-Approved Manual Inputs
 * and Binance Confirmed Actual Execution Values.
 * Manual values are preserved and never automatically replaced.
 * Supports dual fee specifications: Percentage % + Currency Amount USDT.
 */
export interface ManualApprovedTradeValues {
  manualAmount: number; // Approved USDT input
  manualPlannedPrice: number | null; // Approved manual reference price if provided
  manualEstimatedQuantity: number | null; // Computed from manualAmount / manualPrice
  // Phase 6: Dual manual fee parameters
  manualEntryFeePercent?: number; // Manual entry fee percentage (e.g. 0.1 for 0.1%)
  manualEntryFeeAmount?: number; // Manual entry fee flat amount in USDT (e.g. 0.05)
  manualExitFeePercent?: number; // Manual exit fee percentage (e.g. 0.15 for 0.15%)
  manualExitFeeAmount?: number; // Manual exit fee flat amount in USDT (e.g. 0.05)
  manualEntryFee: number; // Combined total manual entry fee in USDT (preserved for backward compatibility)
  manualExitFeeRate: number; // Combined effective manual exit fee rate (preserved for backward compatibility)
  manualStepPercent: number; // Approved step percent (e.g. 2.0%)
  manualStopLossPercent?: number; // Approved stop-loss percent
  approvedAt: number; // Timestamp of manual submission/approval
}

export interface BinanceConfirmedTradeValues {
  confirmedPrice: number; // Actual fill price from Binance
  confirmedQuantity: number; // Actual filled base quantity from Binance
  confirmedQuoteAmount: number; // Actual quote USDT spent from Binance fill
  confirmedEntryFee: number; // Actual entry fee charged by Binance in USDT
  confirmedExitFee?: number; // Actual exit fee charged by Binance in USDT
  orderId?: string | null; // Binance order ID
  confirmedAt: number; // Timestamp of confirmed fill
  exchangeSource: 'BINANCE_ACTUAL';
  // Phase 6: Anti-duplication flag ensuring fees are never counted twice
  isFeeDeduplicated?: boolean;
}

export interface ManagedTrade {
  tradeId: string;
  botId: string;
  symbol: string;
  source: TradeCreationSource;
  botType?: BotType; // DEAL_BOT or RANGE_BOT
  status: TradeStatus; // PENDING_ENTRY | OPEN | PENDING_EXIT | CLOSED
  requestedAmount: number; // Quote currency (USDT)
  plannedPrice?: number | null;
  entry: TradeEntryExecution;
  exit?: TradeExitExecution;
  costConfig: TradeCostConfig;
  levelsPlan?: TradeLevelsPlan;
  positionManager?: 'UNIFIED_T_LADDER'; // Unified T-level ladder sole authority
  isExiting?: boolean; // Concurrency protection against conflicting managers
  xRecoveryPlan?: XRecoveryPlan;
  preEntryXMonitor?: PreEntryXRecoveryMonitor;
  pnl?: TradePnL;
  initialQuantity?: number; // Total quantity initially purchased
  remainingQuantity?: number; // Open unsold quantity governed by T levels
  soldQuantity?: number; // Cumulative quantity sold across all executions
  partialExits?: PartialExitRecord[]; // Independent ledger of each executed sale
  // Phase 4 & Phase 6: Coexisting, separated manual inputs and Binance confirmed values
  manualValues?: ManualApprovedTradeValues;
  confirmedValues?: BinanceConfirmedTradeValues | null;
  createdAt: number;
  openedAt?: number | null;
  closedAt?: number | null;
  closeReason?: string | null;
  notes?: string;
}

export interface CreateTradeManualParams {
  symbol: string;
  entryAmount: number;
  entryPrice?: number;
  stepPercent?: number;
  manualEntryCost?: number; // Legacy total entry fee in USDT
  manualExitCostRate?: number; // Legacy total exit fee rate
  // Phase 6: Dual fee inputs (percentage % and/or currency amount USDT)
  manualEntryFeePercent?: number;
  manualEntryFeeAmount?: number;
  manualExitFeePercent?: number;
  manualExitFeeAmount?: number;
  botType?: BotType;
  xSettings?: XRangeSettings;
  initialStopLossPercent?: number;
  immediateEntry?: boolean; // Whether to execute immediate Market Buy (default: true)
  isPreEntryRecovery?: boolean; // Explicit flag for pre-entry recovery monitoring
}

export interface CreateTradeScannerParams {
  symbol: string;
  scannerPrice: number;
  entryAmount: number;
  stepPercent?: number;
  manualEntryCost?: number;
  manualExitCostRate?: number;
  // Phase 6: Dual fee inputs
  manualEntryFeePercent?: number;
  manualEntryFeeAmount?: number;
  manualExitFeePercent?: number;
  manualExitFeeAmount?: number;
  botType?: BotType;
  xSettings?: XRangeSettings;
  initialStopLossPercent?: number;
  immediateEntry?: boolean;
  isPreEntryRecovery?: boolean;
}

export interface LevelEvaluationResult {
  shouldSell: boolean;
  triggerReason?: string;
  levelAdvanced: boolean;
  previousAchievedLevel: AchievedTargetLevel;
  newAchievedLevel: AchievedTargetLevel;
  previousProtectionPrice: number;
  newProtectionPrice: number;
}
