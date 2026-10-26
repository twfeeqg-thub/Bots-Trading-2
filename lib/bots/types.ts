// Project Q — Bot Core: Types & Interfaces
// Closed Specification: Exactly two bot types, clear decoupling of Bot / Cycle / Trade,
// 11 distinct V1 lifecycle states, strict deterministic transitions, and error recovery.

/**
 * 1. Bot Types: Exactly two types permitted in Project Q.
 * - RANGE_BOT: بوت المسار العرضي
 * - DEAL_BOT: بوت الصفقة
 */
export type BotType = 'RANGE_BOT' | 'DEAL_BOT';

export const BOT_TYPE_LABELS: Record<BotType, { ar: string; en: string }> = {
  RANGE_BOT: { ar: 'بوت المسار العرضي', en: 'Sideways Range Bot' },
  DEAL_BOT: { ar: 'بوت الصفقة', en: 'Single Deal Bot' },
} as const;

/**
 * 2. 11 V1 Lifecycle States (دورة حياة البوت V1)
 */
export type BotState =
  | 'WAITING_FOR_ENTRY' // 1. بانتظار الدخول
  | 'MONITORING_ENTRY' // 2. مراقبة الدخول
  | 'ENTRY_TRIGGERED' // 3. الدخول متحقق
  | 'EXECUTING_BUY' // 4. تنفيذ الشراء
  | 'VERIFYING_BUY' // 5. التحقق من الشراء
  | 'POSITION_OPEN' // 6. الصفقة مفتوحة
  | 'EXECUTING_SELL' // 7. تنفيذ البيع
  | 'VERIFYING_SELL' // 8. التحقق من البيع
  | 'POSITION_CLOSED' // 9. الصفقة مغلقة
  | 'STOPPED' // 10. متوقف
  | 'ERROR'; // 11. خطأ

export const BOT_STATE_METADATA: Record<
  BotState,
  {
    index: number;
    ar: string;
    en: string;
    description: string;
    badgeColor: string;
  }
> = {
  WAITING_FOR_ENTRY: {
    index: 1,
    ar: 'بانتظار الدخول',
    en: 'Waiting for Entry',
    description: 'البوت جاهز وفي وضع الانتظار لبدء المراقبة',
    badgeColor: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  },
  MONITORING_ENTRY: {
    index: 2,
    ar: 'مراقبة الدخول',
    en: 'Monitoring Entry',
    description: 'مراقبة شروط وإشارات الدخول الحية في السوق',
    badgeColor: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  },
  ENTRY_TRIGGERED: {
    index: 3,
    ar: 'الدخول متحقق',
    en: 'Entry Triggered',
    description: 'تحقق شروط الدخول والاستعداد لإصدار أمر الشراء',
    badgeColor: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  },
  EXECUTING_BUY: {
    index: 4,
    ar: 'تنفيذ الشراء',
    en: 'Executing Buy',
    description: 'إرسال أمر الشراء إلى طبقة التنفيذ',
    badgeColor: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30',
  },
  VERIFYING_BUY: {
    index: 5,
    ar: 'التحقق من الشراء',
    en: 'Verifying Buy',
    description: 'التحقق من تنفيذ أمر الشراء وامتلاء الكمية المطلوبة',
    badgeColor: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
  },
  POSITION_OPEN: {
    index: 6,
    ar: 'الصفقة مفتوحة',
    en: 'Position Open',
    description: 'الصفقة نشطة ومفتوحة، ومراقبة شروط الخروج والأهداف ووقف الخسارة',
    badgeColor: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  },
  EXECUTING_SELL: {
    index: 7,
    ar: 'تنفيذ البيع',
    en: 'Executing Sell',
    description: 'إرسال أمر البيع لإغلاق الصفقة وفق الخطة',
    badgeColor: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
  },
  VERIFYING_SELL: {
    index: 8,
    ar: 'التحقق من البيع',
    en: 'Verifying Sell',
    description: 'التحقق من امتلاء أمر البيع وتأكيد التخارج بالكامل',
    badgeColor: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
  },
  POSITION_CLOSED: {
    index: 9,
    ar: 'الصفقة مغلقة',
    en: 'Position Closed',
    description: 'تم إغلاق الصفقة بنجاح وتوثيق نتيجتها',
    badgeColor: 'text-teal-300 bg-teal-500/10 border-teal-500/30',
  },
  STOPPED: {
    index: 10,
    ar: 'متوقف',
    en: 'Stopped',
    description: 'البوت في حالة توقف تام (نهاية الدورة أو إيقاف يدوي)',
    badgeColor: 'text-slate-400 bg-slate-800/50 border-slate-700/60',
  },
  ERROR: {
    index: 11,
    ar: 'خطأ',
    en: 'Error',
    description: 'حدث خطأ استثنائي؛ يمكن معالجته والاسترداد للحالة الآمنة',
    badgeColor: 'text-red-300 bg-red-500/10 border-red-500/30',
  },
};

/**
 * 3. Entry Method (طريقة الدخول)
 */
export type EntryMethod = 'MARKET' | 'LIMIT' | 'SIGNAL';

/**
 * 4. Stop Loss Configuration (وقف الخسارة الأولي)
 */
export interface InitialStopLossConfig {
  type: 'PERCENT' | 'PRICE';
  value: number; // e.g., 2.5 for 2.5% loss or an exact price level
}

/**
 * 5. T Rule Configuration (قاعدة T)
 */
export interface TRuleConfig {
  targetType: 'FIXED_PERCENT' | 'RATIO' | 'DYNAMIC';
  targetValue: number; // e.g., 3.0 for +3%
  t0Level?: number; // Optional baseline T0 reference
  description?: string;
}

/**
 * 6. X Settings (إعدادات X عند كون البوت من نوع المسار العرضي)
 */
export interface XRangeSettings {
  enabled: boolean;
  maxLevels?: number; // Max recovery/grid levels (optional, undefined = unlimited)
  stepPercent?: number; // Distance between levels in %
  recoveryRatio?: number; // Multiplier/ratio for recovery allocations
  customAllocationQuote?: number; // Optional direct custom allocation quote per level in USDT
  extraConfig?: Record<string, unknown>;
}

/**
 * 7. Alert Settings (إعدادات التنبيهات)
 */
export interface BotAlertSettings {
  onEntry: boolean;
  onExit: boolean;
  onError: boolean;
  onStateChange: boolean;
}

/**
 * 8. Concept 1: The Bot Model (البوت - الخطة الدائمة وإعداداتها)
 */
export interface BotConfig {
  id: string; // Unique Bot identifier
  type: BotType; // RANGE_BOT or DEAL_BOT
  name: string; // Bot display name
  symbol: string; // Trading pair symbol (e.g. BTCUSDT)
  entryAmount: number; // Amount in quote currency (USDT) allocated per run
  entryMethod: EntryMethod; // MARKET, LIMIT, or SIGNAL
  plannedEntryPrice: number | null; // Planned entry price if limit/conditional
  initialStopLoss: InitialStopLossConfig; // Initial stop-loss specification
  tRuleConfig: TRuleConfig; // T rule specification
  xSettings?: XRangeSettings; // X settings for RANGE_BOT
  alertSettings: BotAlertSettings; // Alert notifications configuration
  extraConfig?: Record<string, unknown>; // Extensible configurations for future phases
  createdAt: number;
  updatedAt: number;
}

/**
 * 9. Concept 2: The Cycle Model (الدورة - دورة تشغيل واحدة للبوت)
 */
export interface StateTransitionRecord {
  from: BotState | null;
  to: BotState;
  timestamp: number;
  reason?: string;
}

export interface BotErrorRecord {
  code: string;
  message: string;
  timestamp: number;
  stateAtError: BotState;
  recoverable: boolean;
}

export interface BotCycle {
  cycleId: string;
  botId: string;
  cycleNumber: number; // 1-indexed run counter for this bot
  currentState: BotState;
  previousState: BotState | null;
  startedAt: number;
  endedAt: number | null;
  stateHistory: StateTransitionRecord[];
  activeTradeId: string | null;
  lastError: BotErrorRecord | null;
}

/**
 * 10. Concept 3: The Trade/Position Model (الصفقة - التنفيذ الفعلي الناتج عن دورة دخول ناجحة)
 */
export type TradeStatus = 'PENDING_ENTRY' | 'OPEN' | 'PENDING_EXIT' | 'CLOSED';

export interface TradeEntryExecution {
  requestedAmount: number;
  plannedPrice?: number | null;
  executionPrice?: number | null;
  filledQuantity?: number | null;
  executedAt?: number | null;
  orderId?: string | null;
}

export interface TradeExitExecution {
  plannedPrice?: number | null;
  executionPrice?: number | null;
  filledQuantity?: number | null;
  executedAt?: number | null;
  orderId?: string | null;
  reason?: string | null; // e.g. 'T_TARGET_HIT', 'STOP_LOSS', 'MANUAL'
}

export interface BotTrade {
  tradeId: string;
  cycleId: string;
  botId: string;
  symbol: string;
  status: TradeStatus;
  entry: TradeEntryExecution;
  exit: TradeExitExecution;
  openedAt?: number | null;
  closedAt?: number | null;
  notes?: string;
}

/**
 * 11. State Machine Result Types
 */
export interface TransitionResult {
  success: boolean;
  from: BotState;
  to: BotState;
  error?: string;
  timestamp: number;
}

export interface ErrorRecoveryResult {
  success: boolean;
  recoveredState: BotState;
  previousError: BotErrorRecord | null;
  timestamp: number;
  error?: string;
}

/**
 * 12. Bot Creation Parameters
 */
export interface CreateBotParams {
  id?: string;
  type: BotType;
  name: string;
  symbol: string;
  entryAmount: number;
  entryMethod?: EntryMethod;
  plannedEntryPrice?: number | null;
  initialStopLoss?: InitialStopLossConfig;
  tRuleConfig?: TRuleConfig;
  xSettings?: XRangeSettings;
  alertSettings?: Partial<BotAlertSettings>;
  extraConfig?: Record<string, unknown>;
}

/**
 * 13. Decoupled Core Event Listeners
 */
export type BotStateChangeListener = (
  botId: string,
  from: BotState,
  to: BotState,
  cycle: BotCycle
) => void;

export type BotTradeUpdateListener = (
  botId: string,
  trade: BotTrade
) => void;

export type BotErrorListener = (
  botId: string,
  error: BotErrorRecord
) => void;
