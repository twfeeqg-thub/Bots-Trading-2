// Project Q — Advanced Range Analysis & Quality Scoring
// Detects consolidation ranges, support/resistance clustering, and net realizable margin

export interface KlineData {
  openTime?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime?: number;
}

export interface RangeBounds {
  supportPrice: number;
  resistancePrice: number;
  grossRangePercent: number;
  swingCount: number;
  hasClusteredBounds?: boolean;
}

export interface RangeRealizable {
  realizableRangePercent: number;
  effectiveLow: number;
  effectiveHigh: number;
}

export interface RangeCosts {
  totalFrictionPercent: number;
  confirmedFeePercent: number;
  assumedSlippagePercent: number;
}

export interface RangeQuality {
  totalScore: number;
  touchScore: number;
  volumeScore: number;
  durationScore: number;
}

export interface RangeAnalysisResult {
  isValid: boolean;
  classification: 'TIGHT_ACCUMULATION' | 'WIDE_CONSOLIDATION' | 'VOLATILE_RANGE' | 'NOT_IN_RANGE';
  lastClosePrice: number;
  bounds: RangeBounds | null;
  realizable: RangeRealizable | null;
  costs: RangeCosts | null;
  netRealizableMarginPercent: number;
  quality: RangeQuality | null;
  summaryExplanation: string;
  analyzedCandlesCount: number;
}

export interface DetectRangeOptions {
  windowSize?: number;
  trimRatio?: number;
  feePercent?: number;
  slippagePercent?: number;
}

export function detectRangePattern(
  klines: KlineData[],
  options: DetectRangeOptions = {}
): RangeAnalysisResult {
  if (!klines || klines.length < 15) {
    return {
      isValid: false,
      classification: 'NOT_IN_RANGE',
      lastClosePrice: 0,
      bounds: null,
      realizable: null,
      costs: null,
      netRealizableMarginPercent: 0,
      quality: null,
      summaryExplanation: 'بيانات غير كافية لرصد النطاق السعري',
      analyzedCandlesCount: klines?.length || 0,
    };
  }

  const windowSize = Math.min(options.windowSize || 40, klines.length);
  const recent = klines.slice(-windowSize);
  const lastClose = recent[recent.length - 1].close;

  const highs = recent.map((k) => k.high);
  const lows = recent.map((k) => k.low);

  // Calculate sorted prices to find robust clustered bounds
  const sortedHighs = [...highs].sort((a, b) => b - a);
  const sortedLows = [...lows].sort((a, b) => a - b);

  // 10th percentile for support, 90th percentile for resistance
  const highIndex = Math.floor(sortedHighs.length * 0.15);
  const lowIndex = Math.floor(sortedLows.length * 0.15);

  const resistancePrice = sortedHighs[highIndex] || Math.max(...highs);
  const supportPrice = sortedLows[lowIndex] || Math.min(...lows);

  if (supportPrice <= 0 || resistancePrice <= supportPrice) {
    return {
      isValid: false,
      classification: 'NOT_IN_RANGE',
      lastClosePrice: lastClose,
      bounds: null,
      realizable: null,
      costs: null,
      netRealizableMarginPercent: 0,
      quality: null,
      summaryExplanation: 'تعذر تحديد حدود النطاق السعري بدقة',
      analyzedCandlesCount: recent.length,
    };
  }

  const grossRangePercent = ((resistancePrice - supportPrice) / supportPrice) * 100;

  // Swings count (bounces off support or resistance within 1.5% margin)
  let swingCount = 0;
  const tolerance = (resistancePrice - supportPrice) * 0.12;

  for (let i = 1; i < recent.length - 1; i++) {
    const k = recent[i];
    if (Math.abs(k.low - supportPrice) <= tolerance) swingCount++;
    if (Math.abs(k.high - resistancePrice) <= tolerance) swingCount++;
  }

  // Fees and friction
  const confirmedFeePercent = options.feePercent ?? 0.15; // 0.15% roundtrip (Spot maker/taker)
  const assumedSlippagePercent = options.slippagePercent ?? 0.10; // 0.10% conservative slippage
  const totalFrictionPercent = confirmedFeePercent + assumedSlippagePercent;

  // Realizable range with safety margin buffers
  const realizableRangePercent = Math.max(0, grossRangePercent * 0.85);
  const netRealizableMarginPercent = Math.max(0, realizableRangePercent - totalFrictionPercent);

  // Quality score: 0 to 100
  const touchScore = Math.min(40, swingCount * 8);
  const marginScore = Math.min(35, (netRealizableMarginPercent / 5) * 35);
  const consistencyScore = grossRangePercent >= 2 && grossRangePercent <= 18 ? 25 : 10;
  const totalScore = Math.round(Math.min(100, Math.max(10, touchScore + marginScore + consistencyScore)));

  let classification: RangeAnalysisResult['classification'] = 'WIDE_CONSOLIDATION';
  if (grossRangePercent < 4) {
    classification = 'TIGHT_ACCUMULATION';
  } else if (grossRangePercent > 14) {
    classification = 'VOLATILE_RANGE';
  }

  const isValid = grossRangePercent >= 1.8 && swingCount >= 2;

  return {
    isValid,
    classification,
    lastClosePrice: lastClose,
    bounds: {
      supportPrice,
      resistancePrice,
      grossRangePercent: Number(grossRangePercent.toFixed(2)),
      swingCount,
      hasClusteredBounds: swingCount >= 3,
    },
    realizable: {
      realizableRangePercent: Number(realizableRangePercent.toFixed(2)),
      effectiveLow: supportPrice * 1.002,
      effectiveHigh: resistancePrice * 0.998,
    },
    costs: {
      totalFrictionPercent: Number(totalFrictionPercent.toFixed(2)),
      confirmedFeePercent: Number(confirmedFeePercent.toFixed(2)),
      assumedSlippagePercent: Number(assumedSlippagePercent.toFixed(2)),
    },
    netRealizableMarginPercent: Number(netRealizableMarginPercent.toFixed(2)),
    quality: {
      totalScore,
      touchScore,
      volumeScore: 20,
      durationScore: 20,
    },
    summaryExplanation: `نطاق تذبذب بعرض إجمالي ${grossRangePercent.toFixed(2)}% وصافي هامش ربحي متحقق ${netRealizableMarginPercent.toFixed(2)}% بعد خصم الرسوم والانزلاق. عدد الارتدادات: ${swingCount}`,
    analyzedCandlesCount: recent.length,
  };
}
