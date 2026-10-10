// Project Q — API: Analytics Global Overview & Bot Performance
import { NextResponse } from 'next/server';
import { sharedAnalyticsService, sharedAnalyticsRepository } from '@/lib/analytics';
import { TradeManager } from '@/lib/trade-manager/trade-manager';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('botId');

    // Force synchronization with active trades in TradeManager
    const trades = TradeManager.getInstance().listTrades();
    sharedAnalyticsService.processTradesUpdate(trades);

    const globalSummary = sharedAnalyticsService.getGlobalSummary();

    let botPerformance = null;
    if (botId) {
      botPerformance = sharedAnalyticsService.getBotPerformance(botId);
    }

    // List all bots that have trade records
    const allRecords = sharedAnalyticsRepository.listTradeRecords();
    const uniqueBotIds = Array.from(new Set(allRecords.map((t) => t.botId)));
    const allBotsMetrics = uniqueBotIds
      .map((id) => sharedAnalyticsService.getBotPerformance(id))
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      summary: globalSummary,
      bots: allBotsMetrics,
      selectedBot: botPerformance,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown analytics error',
      },
      { status: 500 }
    );
  }
}
