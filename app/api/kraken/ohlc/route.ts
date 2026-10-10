import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pair = searchParams.get('pair');
  const interval = searchParams.get('interval') || '1';
  const since = searchParams.get('since');

  if (!pair) {
    return NextResponse.json({ error: 'Missing pair parameter' }, { status: 400 });
  }

  const queryParams = new URLSearchParams({
    pair,
    interval,
  });
  if (since) queryParams.append('since', since);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const targetUrl = `https://api.kraken.com/0/public/OHLC?${queryParams.toString()}`;
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

    return NextResponse.json({ error: 'Kraken returned error status' }, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to reach Kraken API' }, { status: 502 });
  }
}
