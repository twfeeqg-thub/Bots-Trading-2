// Project Q — Bot Core Domain Types
// Strictly adhering to the 11 Deterministic States and Bot Architecture

export type BotType = 'DEAL_BOT' | 'RANGE_BOT' | 'GRID_BOT' | 'CUSTOM';

export type EntryMethod = 'MARKET' | 'LIMIT';

export type BotState =
  | 'WAITING_FOR_ENTRY'
  | 'MONITORING_ENTRY'
  | 'ENTRY_TRIGGERED'
  | 'EXECUTING_BUY'
  | 'VERIFYING_BUY'
  | 'POSITION_OPEN'
  | 'EXECUTING_SELL'
  | 'VERIFYING_SELL'
  | 'POSITION_CLOSED'
  | 'STOPPED'
  | 'ERROR';

export interface BotConfig {
  id: string;
  name: string;
  type: BotType;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  allocatedCapital: number;
  entryAmount?: number;
  entryMethod: EntryMethod;
  stepPercent?: number;
  recoveryRatio?: number;
  maxLevels?: number;
  customAllocation?: number;
  createdAt: number;
  updatedAt: number;
  enabled: boolean;
}

export interface BotTrade {
  tradeId?: string;
  orderId?: string;
  clientOrderId?: string;
  side?: 'BUY' | 'SELL';
  price?: number;
  quantity?: number;
  executedAmount?: number;
  fee?: number;
  feeAsset?: string;
  timestamp?: number;
  isRecovery?: boolean;
  levelIndex?: number;
  status?: 'OPEN' | 'CLOSED' | 'PENDING_ENTRY' | 'PENDING_EXIT';
  entry?: {
    orderId?: string;
    executionPrice?: number;
    filledQuantity?: number;
    executedAt?: number;
    totalCost?: number;
    fee?: number;
  };
  exit?: {
    orderId?: string;
    executionPrice?: number;
    filledQuantity?: number;
    executedAt?: number;
    totalCost?: number;
    fee?: number;
    pnlNet?: number;
    pnlPercent?: number;
  };
}

export interface StateTransitionEvent {
  from: BotState | string;
  to: BotState | string;
  timestamp: number;
  reason?: string;
}

export interface BotCycle {
  cycleId: string;
  botId: string;
  cycleNumber?: number;
  startTime?: number;
  startedAt?: number;
  endTime?: number;
  previousState?: BotState | string;
  activeTradeId?: string;
  stateHistory?: StateTransitionEvent[];
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  trades: BotTrade[];
  totalInvested: number;
  totalReturned: number;
  realizedPnl: number;
  realizedPnlPercent: number;
  netFee: number;
}

export interface CreateBotParams {
  name: string;
  type: BotType;
  symbol: string;
  amount: number;
  entryMethod?: EntryMethod;
  stepPercent?: number;
  recoveryRatio?: number;
  maxLevels?: number;
  customAllocation?: number;
  xSettings?: {
    enabled?: boolean;
    stepPercent?: number;
    recoveryRatio?: number;
    customAllocationQuote?: number;
  };
}

export const BOT_TYPE_LABELS: Record<BotType, { ar: string; en: string; description: string }> = {
  DEAL_BOT: {
    ar: 'بوت الصفقات الفورية (Deal Bot)',
    en: 'Spot Deal Bot',
    description: 'ينفذ صفقات فردية مستهدفة بناءً على مؤشرات رصد الصعود مع دعم التبريد والتأكيد الفعلي.',
  },
  RANGE_BOT: {
    ar: 'بوت النطاق العرضي (Range Bot)',
    en: 'Range Consolidation Bot',
    description: 'يتداول ضمن حدود الدعم والمقاومة مع طبقة الاسترداد المحسوبة X Recovery.',
  },
  GRID_BOT: {
    ar: 'بوت الشبكة الآلي (Grid Bot)',
    en: 'Grid Bot',
    description: 'توزيع أوامر شراء وبيع على مستويات سعرية متتالية للاستفادة من التذبذب السعري.',
  },
  CUSTOM: {
    ar: 'بوت مخصص (Custom Bot)',
    en: 'Custom Algorithmic Bot',
    description: 'إعدادات وخوارزميات مخصصة بحسب طلب المستخدم.',
  },
};

export interface BotStateMeta {
  index: number;
  ar: string;
  en: string;
  badgeColor: string;
  color: string;
  bg: string;
  border: string;
  description: string;
}

export const BOT_STATE_METADATA: Record<BotState, BotStateMeta> = {
  WAITING_FOR_ENTRY: {
    index: 1,
    ar: 'انتظار شروط الدخول',
    en: 'Waiting For Entry',
    badgeColor: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
    color: 'text-slate-400',
    bg: 'bg-slate-800/40',
    border: 'border-slate-700',
    description: 'البوت في وضع الخمول بانتظار استيفاء مؤشرات الزخم والسيولة.',
  },
  MONITORING_ENTRY: {
    index: 2,
    ar: 'مراقبة إشارة الدخول',
    en: 'Monitoring Entry',
    badgeColor: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    color: 'text-sky-400',
    bg: 'bg-sky-950/40',
    border: 'border-sky-800',
    description: 'مراقبة الشموع ومستويات الصعود وتجهيز إشارة الشراء.',
  },
  ENTRY_TRIGGERED: {
    index: 3,
    ar: 'تم تحفيز الدخول',
    en: 'Entry Triggered',
    badgeColor: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    color: 'text-amber-400',
    bg: 'bg-amber-950/40',
    border: 'border-amber-800',
    description: 'تأكيد الإشارة وتجهيز أمر الشراء للإرسال الفوري.',
  },
  EXECUTING_BUY: {
    index: 4,
    ar: 'تنفيذ الشراء',
    en: 'Executing Buy',
    badgeColor: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
    color: 'text-yellow-400',
    bg: 'bg-yellow-950/40',
    border: 'border-yellow-800',
    description: 'إرسال أمر الشراء إلى طبقة التداول وتأكيد التخصيص.',
  },
  VERIFYING_BUY: {
    index: 5,
    ar: 'التحقق من الشراء',
    en: 'Verifying Buy',
    badgeColor: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
    color: 'text-orange-400',
    bg: 'bg-orange-950/40',
    border: 'border-orange-800',
    description: 'فحص الحقيقة التنفيذية وتأكيد التنفيذ الجزئي أو الكلي.',
  },
  POSITION_OPEN: {
    index: 6,
    ar: 'الصفقة مفتوحة',
    en: 'Position Open',
    badgeColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-800',
    description: 'الصفقة نشطة ومحسوبة الأرباح والخسائر مع مراقبة أهداف الخروج.',
  },
  EXECUTING_SELL: {
    index: 7,
    ar: 'تنفيذ البيع',
    en: 'Executing Sell',
    badgeColor: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    color: 'text-indigo-400',
    bg: 'bg-indigo-950/40',
    border: 'border-indigo-800',
    description: 'إرسال أمر بيع المركز وجني الأرباح إلى طبقة التداول.',
  },
  VERIFYING_SELL: {
    index: 8,
    ar: 'التحقق من البيع',
    en: 'Verifying Sell',
    badgeColor: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    color: 'text-purple-400',
    bg: 'bg-purple-950/40',
    border: 'border-purple-800',
    description: 'التأكد من تنفيذ أمر البيع بالكامل واستلام رصيد الـ USDT.',
  },
  POSITION_CLOSED: {
    index: 9,
    ar: 'الصفقة مغلقة بنجاح',
    en: 'Position Closed',
    badgeColor: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
    color: 'text-teal-400',
    bg: 'bg-teal-950/40',
    border: 'border-teal-800',
    description: 'اكتملت الدورة واحتُسبت الأرباح الحقيقية بعد خصم كافة الرسوم.',
  },
  STOPPED: {
    index: 10,
    ar: 'متوقف يدويًا',
    en: 'Stopped',
    badgeColor: 'bg-slate-700/20 text-slate-400 border-slate-700/40',
    color: 'text-slate-500',
    bg: 'bg-slate-900/60',
    border: 'border-slate-800',
    description: 'تم إيقاف تشغيل البوت بواسطة المستخدم.',
  },
  ERROR: {
    index: 11,
    ar: 'خطأ / فحص معلق',
    en: 'Error / Ambiguous',
    badgeColor: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    color: 'text-rose-400',
    bg: 'bg-rose-950/40',
    border: 'border-rose-800',
    description: 'حالة غير مؤكدة تتطلب التحقق اليدوي لحماية رأس المال.',
  },
};
