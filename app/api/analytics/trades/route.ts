// Project Q — API: Detailed Trade Analytics Records
import { NextResponse } from 'next/server';
import { sharedAnalyticsService, sharedAnalyticsRepository } from '@/lib/analytics';
import { TradeManager } from '@/lib/trade-manager/trade-manager';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('botId') || undefined;
    const botType = searchParams.get('botType') || undefined;
    const symbol = searchParams.get('symbol') || undefined;
    const status = searchParams.get('status') || undefined;
    const outcome = searchParams.get('outcome') || undefined;

    // Synchronize latest open trades
    const trades = TradeManager.getInstance().listTrades();
    sharedAnalyticsService.processTradesUpdate(trades);

    const records = sharedAnalyticsRepository.queryTradeRecords({
      botId,
      botType,
      symbol,
      status,
      outcome,
    });

    return NextResponse.json({
      success: true,
      count: records.length,
      trades: records,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown trade analytics error',
      },
      { status: 500 }
    );
  }
}
