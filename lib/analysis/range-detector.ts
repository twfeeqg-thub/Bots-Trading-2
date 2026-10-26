// Project Q — Pure Mathematical Engine for Range Detection & Viability Assessment
// Strictly isolated from trading engines, bot managers, and order executions.

export interface KlineData {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime?: number;
}

export interface RangeCostOptions {
  buyFeeRate?: number; // Confirmed spot buy fee rate (e.g., 0.001 = 0.10%)
  sellFeeRate?: number; // Confirmed spot sell fee rate (e.g., 0.001 = 0.10%)
  slippageBuffer?: number; // Assumed slippage & spread buffer (e.g., 0.001 = 0.10%)
}

export interface IndicatorWeightsOptions {
  enableRsiWeight?: boolean; // Toggle RSI confirmation factor (default: true)
  enableEmaWeight?: boolean; // Toggle EMA convergence factor (default: true)
  enableVolumeWeight?: boolean; // Toggle volume stability factor (default: true)
}

export interface RangeDetectionOptions {
  windowSize?: number; // Number of closed candles to analyze (default: 40, min: 20)
  trimRatio?: number; // Margin trimmed from each boundary (default: 0.15 = 15%)
  costOptions?: RangeCostOptions;
  indicatorOptions?: IndicatorWeightsOptions;
  experimentalThresholds?: {
    viableHighThreshold?: number; // Net margin % for high viability (default: 2.2%)
    viableModerateThreshold?: number; // Net margin % for moderate viability (default: 1.2%)
  };
}

export type RangeViabilityClassification =
  | 'VIABLE_HIGH'
  | 'VIABLE_MODERATE'
  | 'UNVIABLE_LOW_MARGIN'
  | 'NOT_IN_RANGE';

export interface PriceCluster {
  centerPrice: number;
  minPrice: number;
  maxPrice: number;
  touchCount: number;
  prices: number[];
}

export interface RangeBounds {
  supportPrice: number;
  resistancePrice: number;
  grossWidth: number; // Resistance - Support
  grossRangePercent: number; // ((Resistance - Support) / Support) * 100
  swingCount: number; // Number of confirmed local swings
  peakCount: number;
  troughCount: number;
  isHorizontallyAligned: boolean;
  hasClusteredBounds?: boolean;
  supportTouchCount?: number;
  resistanceTouchCount?: number;
  hasSufficientBounces?: boolean;
}

export interface RealizableRangeResult {
  entryZone: number; // Support + trimRatio * Width
  exitZone: number; // Resistance - trimRatio * Width
  effectiveSpread: number; // ExitZone - EntryZone
  realizableRangePercent: number; // ((ExitZone - EntryZone) / EntryZone) * 100
  trimRatio: number;
}

export interface CostBreakdown {
  confirmedFeePercent: number; // (buyFeeRate + sellFeeRate) * 100
  assumedSlippagePercent: number; // slippageBuffer * 100
  totalFrictionPercent: number; // confirmedFeePercent + assumedSlippagePercent
  isCustomCost: boolean;
}

export interface RangeQualityFactors {
  priceStructureScore: number; // 0-40 based on swing touches, symmetry, and candle containment
  emaAlignmentScore: number; // 0-25 based on EMA20 and EMA50 proximity (if enabled)
  rsiBalanceScore: number; // 0-20 based on non-extreme RSI oscillation (if enabled)
  volumeConsistencyScore: number; // 0-15 based on lack of disruptive volume anomalies (if enabled)
  totalScore: number; // 0-100 overall confidence score
  factorsEvaluated: {
    rsiEnabled: boolean;
    emaEnabled: boolean;
    volumeEnabled: boolean;
  };
}

export interface RangeAnalysisResult {
  isValid: boolean;
  error?: string;
  symbol?: string;
  interval?: string;
  analyzedCandlesCount?: number;
  lastClosePrice?: number;
  bounds?: RangeBounds;
  realizable?: RealizableRangeResult;
  costs?: CostBreakdown;
  netRealizableMarginPercent?: number; // RealizableRange% - TotalFriction%
  quality?: RangeQualityFactors;
  classification?: RangeViabilityClassification;
  summaryExplanation?: string;
}

// -------------------------------------------------------------------------
// 1. PURE MATHEMATICAL FUNCTIONS
// -------------------------------------------------------------------------

/**
 * Calculates the exact realizable swing range after trimming safety buffers
 * from both the top and bottom of the identified range.
 *
 * Formula:
 * Width = Resistance - Support
 * EntryZone = Support + trimRatio * Width
 * ExitZone = Resistance - trimRatio * Width
 * RealizableRange% = ((ExitZone - EntryZone) / EntryZone) * 100
 *
 * Note: RealizableRange% is strictly less than (1 - 2*trimRatio) * GrossRange%
 * because EntryZone > Support.
 */
export function calculateExactRealizableRange(
  support: number,
  resistance: number,
  trimRatio: number = 0.15
): RealizableRangeResult {
  if (support <= 0 || resistance <= 0 || resistance <= support) {
    throw new Error('Support and resistance must be positive numbers with resistance > support');
  }

  const boundedTrim = Math.max(0, Math.min(0.45, trimRatio));
  const width = resistance - support;
  const entryZone = support + boundedTrim * width;
  const exitZone = resistance - boundedTrim * width;
  const effectiveSpread = exitZone - entryZone;
  const realizableRangePercent = (effectiveSpread / entryZone) * 100;

  return {
    entryZone: Number(entryZone.toFixed(6)),
    exitZone: Number(exitZone.toFixed(6)),
    effectiveSpread: Number(effectiveSpread.toFixed(6)),
    realizableRangePercent: Number(realizableRangePercent.toFixed(4)),
    trimRatio: boundedTrim,
  };
}

/**
 * Calculates trading costs breakdown, clearly distinguishing confirmed exchange fees
 * from assumed slippage and spread buffers.
 */
export function calculateCostBreakdown(costs?: RangeCostOptions): CostBreakdown {
  const buyFee = costs?.buyFeeRate !== undefined ? Math.max(0, costs.buyFeeRate) : 0.001; // Default 0.10%
  const sellFee = costs?.sellFeeRate !== undefined ? Math.max(0, costs.sellFeeRate) : 0.001; // Default 0.10%
  const slippage = costs?.slippageBuffer !== undefined ? Math.max(0, costs.slippageBuffer) : 0.001; // Default 0.10%

  const confirmedFeePercent = (buyFee + sellFee) * 100;
  const assumedSlippagePercent = slippage * 100;
  const totalFrictionPercent = confirmedFeePercent + assumedSlippagePercent;

  const isCustomCost =
    costs?.buyFeeRate !== undefined ||
    costs?.sellFeeRate !== undefined ||
    costs?.slippageBuffer !== undefined;

  return {
    confirmedFeePercent: Number(confirmedFeePercent.toFixed(4)),
    assumedSlippagePercent: Number(assumedSlippagePercent.toFixed(4)),
    totalFrictionPercent: Number(totalFrictionPercent.toFixed(4)),
    isCustomCost,
  };
}

/**
 * Evaluates net viability after subtracting all friction from realizable range.
 */
export function evaluateNetViability(
  realizableRangePercent: number,
  totalFrictionPercent: number
): number {
  return Number((realizableRangePercent - totalFrictionPercent).toFixed(4));
}

/**
 * Calculates Exponential Moving Average (EMA) for an array of numbers.
 */
export function calculateEMA(prices: number[], period: number): number | undefined {
  if (prices.length < period || period <= 0) return undefined;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((acc, p) => acc + p, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

/**
 * Calculates Relative Strength Index (RSI) using Wilder's smoothing.
 */
export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length <= period) return 50;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

/**
 * Identifies local peaks and troughs using a 2-candle window.
 */
export function extractLocalExtrema(klines: KlineData[]): {
  peaks: Array<{ index: number; price: number }>;
  troughs: Array<{ index: number; price: number }>;
} {
  const peaks: Array<{ index: number; price: number }> = [];
  const troughs: Array<{ index: number; price: number }> = [];

  for (let i = 2; i < klines.length - 2; i++) {
    const currentHigh = klines[i].high;
    const currentLow = klines[i].low;

    // Local peak: strictly higher than adjacent candles
    if (
      currentHigh >= klines[i - 1].high &&
      currentHigh >= klines[i - 2].high &&
      currentHigh >= klines[i + 1].high &&
      currentHigh >= klines[i + 2].high
    ) {
      peaks.push({ index: i, price: currentHigh });
    }

    // Local trough: strictly lower than adjacent candles
    if (
      currentLow <= klines[i - 1].low &&
      currentLow <= klines[i - 2].low &&
      currentLow <= klines[i + 1].low &&
      currentLow <= klines[i + 2].low
    ) {
      troughs.push({ index: i, price: currentLow });
    }
  }

  return { peaks, troughs };
}

/**
 * Clusters price extrema into density groups within an adaptive tolerance window.
 * Solitary spikes, flash wicks, or isolated noise form single-touch clusters and are dismissed.
 */
export function clusterExtrema(
  extrema: Array<{ index: number; price: number }>,
  tolerance: number
): PriceCluster[] {
  if (!extrema || extrema.length === 0) return [];

  // Sort ascending by price
  const sorted = [...extrema].sort((a, b) => a.price - b.price);
  const clusters: PriceCluster[] = [];

  for (const item of sorted) {
    const price = item.price;
    let matchedCluster: PriceCluster | null = null;
    let minDistance = Infinity;

    for (const cluster of clusters) {
      const dist = Math.abs(price - cluster.centerPrice);
      if (dist <= tolerance && dist < minDistance) {
        matchedCluster = cluster;
        minDistance = dist;
      }
    }

    if (matchedCluster) {
      matchedCluster.prices.push(price);
      matchedCluster.touchCount++;
      matchedCluster.minPrice = Math.min(matchedCluster.minPrice, price);
      matchedCluster.maxPrice = Math.max(matchedCluster.maxPrice, price);
      matchedCluster.centerPrice =
        matchedCluster.prices.reduce((sum, p) => sum + p, 0) / matchedCluster.prices.length;
    } else {
      clusters.push({
        centerPrice: price,
        minPrice: price,
        maxPrice: price,
        touchCount: 1,
        prices: [price],
      });
    }
  }

  // Sort clusters by touchCount descending, then by centerPrice descending
  return clusters.sort((a, b) => {
    if (b.touchCount !== a.touchCount) {
      return b.touchCount - a.touchCount;
    }
    return b.centerPrice - a.centerPrice;
  });
}

/**
 * Validates candle data integrity.
 */
export function validateKlineData(klines: KlineData[], minCandles = 20): { isValid: boolean; error?: string } {
  if (!Array.isArray(klines) || klines.length === 0) {
    return { isValid: false, error: 'قائمة الشموع فارغة' };
  }
  if (klines.length < minCandles) {
    return {
      isValid: false,
      error: `عدد الشموع المتاحة (${klines.length}) غير كافٍ، يلزم توفر ${minCandles} شمعة على الأقل`,
    };
  }

  for (let i = 0; i < klines.length; i++) {
    const k = klines[i];
    if (
      isNaN(k.open) ||
      isNaN(k.high) ||
      isNaN(k.low) ||
      isNaN(k.close) ||
      k.open <= 0 ||
      k.high <= 0 ||
      k.low <= 0 ||
      k.close <= 0 ||
      k.high < k.low
    ) {
      return { isValid: false, error: `بيانات الشمعة رقم ${i + 1} تحتوي على أرقام غير صالحة أو مشوهة` };
    }
  }

  return { isValid: true };
}

// -------------------------------------------------------------------------
// 2. MAIN RANGE DETECTION & ANALYSIS ENGINE
// -------------------------------------------------------------------------

/**
 * Analyzes candle series to discover range boundaries, calculate realizable
 * swing space, factor costs, evaluate soft quality weights, and classify viability.
 */
export function detectRangePattern(
  rawKlines: KlineData[],
  options?: RangeDetectionOptions
): RangeAnalysisResult {
  const windowSize = Math.max(20, options?.windowSize || 40);
  const trimRatio = options?.trimRatio !== undefined ? options.trimRatio : 0.15;
  const costOptions = options?.costOptions;
  const indicatorOptions = options?.indicatorOptions;
  const highThreshold = options?.experimentalThresholds?.viableHighThreshold ?? 2.2;
  const moderateThreshold = options?.experimentalThresholds?.viableModerateThreshold ?? 1.2;

  // 1. Data Validation
  const validation = validateKlineData(rawKlines, 20);
  if (!validation.isValid) {
    return {
      isValid: false,
      error: validation.error,
    };
  }

  // Use only the latest windowSize candles
  const klines = rawKlines.slice(-windowSize);
  const closes = klines.map((k) => k.close);
  const highs = klines.map((k) => k.high);
  const lows = klines.map((k) => k.low);
  const volumes = klines.map((k) => k.volume);
  const lastClose = closes[closes.length - 1];

  // 2. Extract Extrema & Adaptive Price Clustering
  const { peaks, troughs } = extractLocalExtrema(klines);

  const medianPrice = closes[Math.floor(closes.length / 2)] || lastClose;
  const avgCandleRange = klines.reduce((acc, k) => acc + (k.high - k.low), 0) / klines.length;
  // Adaptive tolerance: proportional to average candle range and median price
  const clusterTolerance = Math.max(
    medianPrice * 0.005,
    Math.min(medianPrice * 0.02, avgCandleRange * 1.0)
  );

  const peakClusters = clusterExtrema(peaks, clusterTolerance);
  const troughClusters = clusterExtrema(troughs, clusterTolerance);

  let resistancePrice: number;
  let supportPrice: number;
  let hasClusteredBounds = false;
  let resClusterTouches = 0;
  let supClusterTouches = 0;

  // Filter clusters with recurring touches (>= 2 touches)
  const recurrentPeakClusters = peakClusters.filter(
    (c) => c.touchCount >= 2 && c.centerPrice >= medianPrice * 0.99
  );
  const recurrentTroughClusters = troughClusters.filter(
    (c) => c.touchCount >= 2 && c.centerPrice <= medianPrice * 1.01
  );

  if (recurrentPeakClusters.length > 0 && recurrentTroughClusters.length > 0) {
    // Highest recurrent peak cluster represents the recurring resistance ceiling
    const bestResCluster = recurrentPeakClusters.reduce((prev, curr) =>
      curr.centerPrice > prev.centerPrice ? curr : prev
    );
    // Lowest recurrent trough cluster represents the recurring support floor
    const bestSupCluster = recurrentTroughClusters.reduce((prev, curr) =>
      curr.centerPrice < prev.centerPrice ? curr : prev
    );

    resistancePrice = bestResCluster.centerPrice;
    supportPrice = bestSupCluster.centerPrice;
    resClusterTouches = bestResCluster.touchCount;
    supClusterTouches = bestSupCluster.touchCount;
    hasClusteredBounds = true;
  } else if (peakClusters.length > 0 && troughClusters.length > 0) {
    // If no cluster reached >= 2 touches, pick top cluster candidate but flag non-clustered
    const topPeakCluster = peakClusters[0];
    const topTroughCluster = troughClusters[0];
    resistancePrice = topPeakCluster.centerPrice;
    supportPrice = topTroughCluster.centerPrice;
    resClusterTouches = topPeakCluster.touchCount;
    supClusterTouches = topTroughCluster.touchCount;
    hasClusteredBounds = false;
  } else {
    // Fallback quantile estimation if extrema are completely sparse
    const sortedHighs = [...highs].sort((a, b) => a - b);
    const sortedLows = [...lows].sort((a, b) => a - b);
    resistancePrice = sortedHighs[Math.floor(sortedHighs.length * 0.88)];
    supportPrice = sortedLows[Math.floor(sortedLows.length * 0.12)];
    hasClusteredBounds = false;
  }

  if (resistancePrice <= supportPrice) {
    // Inverted bounds safeguard
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    resistancePrice = maxHigh;
    supportPrice = minLow;
    hasClusteredBounds = false;
  }

  const grossWidth = resistancePrice - supportPrice;
  const grossRangePercent = (grossWidth / supportPrice) * 100;

  // Count swings that bounced within the tolerance zone of resistance or support
  const thresholdZone = Math.max(grossWidth * 0.14, clusterTolerance);
  const upperTouches = klines.filter(
    (k) => k.high >= resistancePrice - thresholdZone && k.high <= resistancePrice + thresholdZone * 1.5
  ).length;
  const lowerTouches = klines.filter(
    (k) => k.low <= supportPrice + thresholdZone && k.low >= supportPrice - thresholdZone * 1.5
  ).length;
  const swingCount = upperTouches + lowerTouches;

  // Trend detection: Check for clear non-range trend
  const firstClose = closes[0];
  const overallTrendChange = Math.abs((lastClose - firstClose) / firstClose) * 100;
  const isHorizontallyAligned = overallTrendChange <= grossRangePercent * 0.8;

  // Range must have verified clustered bounds, touches on both sides, and adequate swings
  const hasSufficientBounces =
    hasClusteredBounds &&
    resClusterTouches >= 2 &&
    supClusterTouches >= 2 &&
    upperTouches >= 2 &&
    lowerTouches >= 2 &&
    swingCount >= 4;

  const bounds: RangeBounds = {
    supportPrice: Number(supportPrice.toFixed(6)),
    resistancePrice: Number(resistancePrice.toFixed(6)),
    grossWidth: Number(grossWidth.toFixed(6)),
    grossRangePercent: Number(grossRangePercent.toFixed(4)),
    swingCount,
    peakCount: peaks.length,
    troughCount: troughs.length,
    isHorizontallyAligned,
    hasClusteredBounds,
    supportTouchCount: supClusterTouches,
    resistanceTouchCount: resClusterTouches,
    hasSufficientBounces,
  };

  // 3. Exact Realizable Range
  const realizable = calculateExactRealizableRange(supportPrice, resistancePrice, trimRatio);

  // 4. Costs
  const costs = calculateCostBreakdown(costOptions);

  // 5. Net Margin
  const netRealizableMarginPercent = evaluateNetViability(
    realizable.realizableRangePercent,
    costs.totalFrictionPercent
  );

  // 6. Soft Quality Factors (Confirmation Scoring)
  const enableRsi = indicatorOptions?.enableRsiWeight !== false;
  const enableEma = indicatorOptions?.enableEmaWeight !== false;
  const enableVolume = indicatorOptions?.enableVolumeWeight !== false;

  // Factor A: Price Structure (0 - 40 pts)
  let priceStructureScore = 0;
  if (hasClusteredBounds && swingCount >= 4) priceStructureScore += 20;
  else if (swingCount >= 4) priceStructureScore += 16;
  else if (swingCount >= 2) priceStructureScore += 10;
  else priceStructureScore += 4;

  if (isHorizontallyAligned) priceStructureScore += 15;
  if (grossRangePercent >= 1.5 && grossRangePercent <= 18) priceStructureScore += 5;

  // Factor B: EMA Alignment (0 - 25 pts)
  let emaAlignmentScore = 0;
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  if (enableEma && ema20 && ema50) {
    const emaDiffPercent = (Math.abs(ema20 - ema50) / ema50) * 100;
    if (emaDiffPercent < 0.6) emaAlignmentScore = 25;
    else if (emaDiffPercent < 1.2) emaAlignmentScore = 18;
    else if (emaDiffPercent < 2.0) emaAlignmentScore = 10;
    else emaAlignmentScore = 4;
  } else if (!enableEma) {
    // If disabled, award baseline neutral allocation
    emaAlignmentScore = 15;
  }

  // Factor C: RSI Oscillation (0 - 20 pts)
  let rsiBalanceScore = 0;
  const rsi = calculateRSI(closes, 14);
  if (enableRsi) {
    if (rsi >= 40 && rsi <= 60) rsiBalanceScore = 20;
    else if (rsi >= 35 && rsi <= 65) rsiBalanceScore = 14;
    else if (rsi >= 30 && rsi <= 70) rsiBalanceScore = 8;
    else rsiBalanceScore = 2; // Strong overbought/oversold weakens range confidence
  } else {
    // If disabled, award baseline neutral allocation
    rsiBalanceScore = 12;
  }

  // Factor D: Volume Consistency (0 - 15 pts)
  let volumeConsistencyScore = 0;
  if (enableVolume && volumes.length >= 10) {
    const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const maxVol = Math.max(...volumes);
    const volumeRatio = avgVol > 0 ? maxVol / avgVol : 1;
    if (volumeRatio < 2.5) volumeConsistencyScore = 15;
    else if (volumeRatio < 4.0) volumeConsistencyScore = 10;
    else volumeConsistencyScore = 4;
  } else {
    volumeConsistencyScore = 10;
  }

  const totalQualityScore = Math.min(
    100,
    priceStructureScore + emaAlignmentScore + rsiBalanceScore + volumeConsistencyScore
  );

  const quality: RangeQualityFactors = {
    priceStructureScore,
    emaAlignmentScore,
    rsiBalanceScore,
    volumeConsistencyScore,
    totalScore: totalQualityScore,
    factorsEvaluated: {
      rsiEnabled: enableRsi,
      emaEnabled: enableEma,
      volumeEnabled: enableVolume,
    },
  };

  // 7. Viability Classification
  let classification: RangeViabilityClassification;

  // If price has broken outside bounds or strong directional drift exists or lacks recurrent bounces
  const isBrokenOut = lastClose > resistancePrice * 1.01 || lastClose < supportPrice * 0.99;
  if (isBrokenOut || !isHorizontallyAligned || !hasSufficientBounces) {
    classification = 'NOT_IN_RANGE';
  } else if (netRealizableMarginPercent >= highThreshold && totalQualityScore >= 55) {
    classification = 'VIABLE_HIGH';
  } else if (netRealizableMarginPercent >= moderateThreshold && totalQualityScore >= 40) {
    classification = 'VIABLE_MODERATE';
  } else {
    classification = 'UNVIABLE_LOW_MARGIN';
  }

  let summaryExplanation = '';
  if (classification === 'VIABLE_HIGH') {
    summaryExplanation = `نطاق عرضي متماسك ذو جدوى ممتازة (صافي ${netRealizableMarginPercent}% بعد الرسوم والانزلاق، بجودة ${totalQualityScore}/100، مدعوم بارتدادات متكررة).`;
  } else if (classification === 'VIABLE_MODERATE') {
    summaryExplanation = `نطاق عرضي مقبول بحذر (صافي ${netRealizableMarginPercent}% بعد الرسوم والانزلاق، بجودة ${totalQualityScore}/100).`;
  } else if (classification === 'UNVIABLE_LOW_MARGIN') {
    summaryExplanation = `نطاق عرضي ضيق غير مجدٍ (صافي ${netRealizableMarginPercent}% لا يغطي المخاطرة بعد الرسوم والانزلاق).`;
  } else {
    if (!hasSufficientBounces) {
      summaryExplanation = 'العملة ليست في مسار عرضي مستقر (عدم وجود ارتدادات متكررة كافية حول مستويات الدعم والمقاومة).';
    } else if (isBrokenOut) {
      summaryExplanation = 'العملة ليست في مسار عرضي مستقر (حدوث كسر أو اختراق لمستويات النطاق).';
    } else {
      summaryExplanation = 'العملة ليست في مسار عرضي مستقر حالياً (اتجاه سعري نشط).';
    }
  }

  return {
    isValid: true,
    analyzedCandlesCount: klines.length,
    lastClosePrice: lastClose,
    bounds,
    realizable,
    costs,
    netRealizableMarginPercent,
    quality,
    classification,
    summaryExplanation,
  };
}
