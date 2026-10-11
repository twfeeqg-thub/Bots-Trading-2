import { NextResponse } from 'next/server';
import { sharedBinanceTradingService } from '@/lib/trading';
import { sharedMarketDataStore } from '@/lib/market-data';

export async function GET() {
  try {
    const isMock = sharedBinanceTradingService.isUsingMock();
    const transport = sharedBinanceTradingService.getTransport();
    const accountInfo = transport.getAccountInformation
      ? await transport.getAccountInformation()
      : null;
    const serverTime = transport.getServerTime
      ? await transport.getServerTime()
      : { serverTime: Date.now() };

    // Collect latest market prices for major symbols
    const trackedSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
    const marketPrices: Record<string, { price: number | null; status: string; lastKnown: number | null }> = {};

    for (const sym of trackedSymbols) {
      marketPrices[sym] = {
        price: sharedMarketDataStore.getFreshPrice(sym),
        status: sharedMarketDataStore.getStatus(sym),
        lastKnown: sharedMarketDataStore.getLastKnownPrice(sym),
      };
    }

    return NextResponse.json({
      success: true,
      simulationMode: isMock ? 'MOCK_WITH_REAL_MARKET_PRICES' : 'LIVE_OR_TESTNET',
      isUsingMock: isMock,
      serverTime: serverTime.serverTime,
      balances: accountInfo ? accountInfo.balances : [],
      canTrade: accountInfo ? accountInfo.canTrade : false,
      marketPrices,
      timestamp: Date.now(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
