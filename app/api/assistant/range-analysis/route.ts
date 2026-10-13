import { NextRequest, NextResponse } from 'next/server';
import { detectRangePattern, KlineData, RangeAnalysisResult } from '@/lib/analysis/range-detector';
import { DEFAULT_EXECUTABLE_UNIVERSE } from '@/lib/scanner/universe';

const BINANCE_HOSTS = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
];

// In-Memory cache to prevent redundant Binance calls
interface CacheEntry {
  timestamp: number;
  results: RangeCoinScanItem[];
}
const scanCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 45 * 1000; // 45 seconds cache

export interface RangeCoinScanItem {
  symbol: string;
  currentPrice: number;
  supportPrice: number;
  resistancePrice: number;
  grossRangePercent: number;
  realizableRangePercent: number;
  totalFrictionPercent: number;
  confirmedFeePercent: number;
  assumedSlippagePercent: number;
  netRealizableMarginPercent: number;
  qualityScore: number;
  classification: string;
  summaryExplanation: string;
  swingCount: number;
  analyzedCandlesCount: number;
  hasClusteredBounds: boolean;
  timestamp: number;
}

// Fetch candles with mirror failover and short timeout
async function fetchCandles(symbol: string, interval: string, limit = 50): Promise<KlineData[]> {
  const queryParams = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    interval,
    limit: String(limit),
  });

  for (const host of BINANCE_HOSTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const targetUrl = `${host}/api/v3/klines?${queryParams.toString()}`;
      const res = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; RangeAssistantScanner/1.0)',
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const raw = await res.json();
        if (Array.isArray(raw) && raw.length > 0) {
          return raw.map((k: any) => ({
            openTime: Number(k[0]),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            closeTime: Number(k[6]),
          }));
        }
      }
    } catch {
      continue;
    }
  }

  return [];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const interval = searchParams.get('interval') || '1h';
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Check cache
    const cacheKey = `range_scan_${interval}`;
    const now = Date.now();
    const cached = scanCache.get(cacheKey);

    if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        cached: true,
        cacheAgeSeconds: Math.floor((now - cached.timestamp) / 1000),
        interval,
        totalAnalyzed: cached.results.length,
        results: cached.results,
      });
    }

    // Select top tradable spot universe pairs (top 18 executable pairs)
    const targetSymbols = DEFAULT_EXECUTABLE_UNIVERSE
      .filter((u) => u.quoteAsset === 'USDT' && u.status === 'TRADING')
      .slice(0, 18)
      .map((u) => u.symbol);

    // Batch process in chunks of 5 concurrent requests to respect rate limits
    const chunkSize = 5;
    const scanItems: RangeCoinScanItem[] = [];

    for (let i = 0; i < targetSymbols.length; i += chunkSize) {
      const chunk = targetSymbols.slice(i, i + chunkSize);
      const promises = chunk.map(async (symbol) => {
        try {
          const klines = await fetchCandles(symbol, interval, 45);
          if (klines.length < 20) return null;

          const analysis: RangeAnalysisResult = detectRangePattern(klines, {
            windowSize: 40,
            trimRatio: 0.15,
          });

          if (!analysis.isValid || !analysis.bounds || !analysis.realizable || !analysis.costs) {
            return null;
          }

          const lastPrice = analysis.lastClosePrice || klines[klines.length - 1].close;

          const item: RangeCoinScanItem = {
            symbol,
            currentPrice: lastPrice,
            supportPrice: analysis.bounds.supportPrice,
            resistancePrice: analysis.bounds.resistancePrice,
            grossRangePercent: analysis.bounds.grossRangePercent,
            realizableRangePercent: analysis.realizable.realizableRangePercent,
            totalFrictionPercent: analysis.costs.totalFrictionPercent,
            confirmedFeePercent: analysis.costs.confirmedFeePercent,
            assumedSlippagePercent: analysis.costs.assumedSlippagePercent,
            netRealizableMarginPercent: analysis.netRealizableMarginPercent ?? 0,
            qualityScore: analysis.quality?.totalScore ?? 0,
            classification: analysis.classification || 'NOT_IN_RANGE',
            summaryExplanation: analysis.summaryExplanation || '',
            swingCount: analysis.bounds.swingCount,
            analyzedCandlesCount: analysis.analyzedCandlesCount ?? klines.length,
            hasClusteredBounds: Boolean((analysis.bounds as any).hasClusteredBounds ?? (analysis.bounds.swingCount >= 4)),
            timestamp: now,
          };

          return item;
        } catch {
          return null;
        }
      });

      const chunkResults = await Promise.all(promises);
      for (const res of chunkResults) {
        if (res) scanItems.push(res);
      }
    }

    // Sort descending by net realizable margin %
    scanItems.sort((a, b) => b.netRealizableMarginPercent - a.netRealizableMarginPercent);

    // Update cache
    scanCache.set(cacheKey, {
      timestamp: now,
      results: scanItems,
    });

    return NextResponse.json({
      success: true,
      cached: false,
      interval,
      totalAnalyzed: scanItems.length,
      results: scanItems,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'فشل تشغيل فحص العملات العرضية' },
      { status: 500 }
    );
  }
}
