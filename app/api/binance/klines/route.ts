import { NextRequest, NextResponse } from 'next/server';

const BINANCE_HOSTS = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol');
  const interval = searchParams.get('interval') || '1m';
  const limit = searchParams.get('limit') || '200';
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  const queryParams = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    interval,
    limit,
  });

  if (startTime) queryParams.append('startTime', startTime);
  if (endTime) queryParams.append('endTime', endTime);

  // Try Binance hosts sequentially with a short timeout
  for (const host of BINANCE_HOSTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const targetUrl = `${host}/api/v3/klines?${queryParams.toString()}`;
      const res = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; CryptoScanner/1.0)',
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data, {
          headers: {
            'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
          },
        });
      }
    } catch {
      // Try next host
      continue;
    }
  }

  return NextResponse.json([], { status: 200 });
}
