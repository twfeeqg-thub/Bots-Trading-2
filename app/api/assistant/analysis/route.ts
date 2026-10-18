import { NextRequest, NextResponse } from 'next/server';

const BINANCE_HOSTS = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
];

interface KlineItem {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

// Calculate EMA for an array of prices
function calculateEMA(prices: number[], period: number): number | undefined {
  if (prices.length < period) return undefined;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((acc, p) => acc + p, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// Calculate RSI for standard period (14)
function calculateRSI(closes: number[], period = 14): number {
  if (closes.length <= period) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const currentGain = change > 0 ? change : 0;
    const currentLoss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return Number(rsi.toFixed(2));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || 'BTCUSDT').toUpperCase().trim();
  const interval = searchParams.get('interval') || '1h';

  const queryParams = new URLSearchParams({
    symbol,
    interval,
    limit: '100',
  });

  let rawKlines: any[] = [];
  for (const host of BINANCE_HOSTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${host}/api/v3/klines?${queryParams.toString()}`, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; CryptoAnalysisAssistant/1.0)',
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        rawKlines = await res.json();
        break;
      }
    } catch {
      continue;
    }
  }

  if (!Array.isArray(rawKlines) || rawKlines.length === 0) {
    return NextResponse.json(
      { error: `تعذر جلب بيانات الشموع لرمز ${symbol}` },
      { status: 502 }
    );
  }

  const klines: KlineItem[] = rawKlines.map((k) => ({
    openTime: Number(k[0]),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: Number(k[6]),
  }));

  const closes = klines.map((k) => k.close);
  const highs = klines.map((k) => k.high);
  const lows = klines.map((k) => k.low);
  const volumes = klines.map((k) => k.volume);

  const lastCandle = klines[klines.length - 1];
  const lastPrice = lastCandle.close;

  // Fetch true 24hr ticker data from Binance API (independent of klines interval)
  let ticker24h: { high24h: number; low24h: number; change24h: number; volume24h: number } | null = null;
  for (const host of BINANCE_HOSTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${host}/api/v3/ticker/24hr?symbol=${symbol}`, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; CryptoAnalysisAssistant/1.0)',
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const rawTicker = await res.json();
        ticker24h = {
          high24h: parseFloat(rawTicker.highPrice),
          low24h: parseFloat(rawTicker.lowPrice),
          change24h: parseFloat(rawTicker.priceChangePercent),
          volume24h: parseFloat(rawTicker.volume),
        };
        break;
      }
    } catch {
      continue;
    }
  }

  // Fallback if 24hr ticker endpoint is unavailable: calculate true 24h window by timestamp
  const nowMs = Date.now();
  const past24hMs = nowMs - 24 * 60 * 60 * 1000;
  const true24hKlines = klines.filter((k) => k.closeTime >= past24hMs || k.openTime >= past24hMs);
  const active24hList = true24hKlines.length > 0 ? true24hKlines : klines;

  const high24h = ticker24h?.high24h ?? Math.max(...active24hList.map((k) => k.high));
  const low24h = ticker24h?.low24h ?? Math.min(...active24hList.map((k) => k.low));
  const volume24h = ticker24h?.volume24h ?? active24hList.reduce((acc, k) => acc + k.volume, 0);
  const change24h = ticker24h?.change24h ?? Number((((lastPrice - active24hList[0].open) / active24hList[0].open) * 100).toFixed(2));

  // Indicators
  const rsi = calculateRSI(closes, 14);
  const ema9 = calculateEMA(closes, 9) || lastPrice;
  const ema20 = calculateEMA(closes, 20) || lastPrice;
  const ema50 = calculateEMA(closes, 50) || lastPrice;
  const ema200 = calculateEMA(closes, 200);

  // Pivot Points calculation based on previous closed candle
  const prevCandle = klines.length > 1 ? klines[klines.length - 2] : lastCandle;
  const pivotPoint = (prevCandle.high + prevCandle.low + prevCandle.close) / 3;
  const r1 = 2 * pivotPoint - prevCandle.low;
  const s1 = 2 * pivotPoint - prevCandle.high;

  // Volume analysis
  const avgVolume20 =
    volumes.slice(-20).reduce((acc, v) => acc + v, 0) / Math.min(20, volumes.length);
  const currentVolume = lastCandle.volume;
  let volumeStatus: 'أعلى من المتوسط' | 'طبيعي' | 'منخفض' = 'طبيعي';
  if (currentVolume > avgVolume20 * 1.3) volumeStatus = 'أعلى من المتوسط';
  else if (currentVolume < avgVolume20 * 0.7) volumeStatus = 'منخفض';

  // Trend determination
  let trend: 'صاعد' | 'هابط' | 'عرضي' = 'عرضي';
  if (lastPrice > ema20 && ema20 > ema50) {
    trend = 'صاعد';
  } else if (lastPrice < ema20 && ema20 < ema50) {
    trend = 'هابط';
  }

  // RSI condition
  let rsiCondition: 'تشبع شرائي' | 'تشبع بيعي' | 'منطقة محايدة' = 'منطقة محايدة';
  if (rsi >= 70) rsiCondition = 'تشبع شرائي';
  else if (rsi <= 30) rsiCondition = 'تشبع بيعي';

  const analysisResult = {
    symbol,
    interval,
    lastPrice: Number(lastPrice.toFixed(4)),
    high24h: Number(high24h.toFixed(4)),
    low24h: Number(low24h.toFixed(4)),
    change24h: Number(change24h.toFixed(2)),
    volume24h: Number(volume24h.toFixed(2)),
    rsi,
    ema9: Number(ema9.toFixed(4)),
    ema20: Number(ema20.toFixed(4)),
    ema50: Number(ema50.toFixed(4)),
    ema200: ema200 ? Number(ema200.toFixed(4)) : undefined,
    trend,
    rsiCondition,
    pivotPoint: Number(pivotPoint.toFixed(4)),
    supportLevels: [Number(s1.toFixed(4))],
    resistanceLevels: [Number(r1.toFixed(4))],
    volumeStatus,
    source: 'Binance Spot Live API',
    updatedAt: new Date().toLocaleTimeString('ar-SA', { hour12: false }),
  };

  return NextResponse.json(analysisResult, {
    headers: {
      'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
    },
  });
}
