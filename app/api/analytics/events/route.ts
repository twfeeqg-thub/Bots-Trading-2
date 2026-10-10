// Project Q — API: Raw Historical Events Log & Export
import { NextResponse } from 'next/server';
import { sharedAnalyticsRepository } from '@/lib/analytics';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tradeId = searchParams.get('tradeId') || undefined;
    const botId = searchParams.get('botId') || undefined;
    const isExport = searchParams.get('export') === 'true';

    if (isExport) {
      const rawJson = sharedAnalyticsRepository.exportRawHistoryJSON();
      return new Response(rawJson, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="project-q-raw-history-${Date.now()}.json"`,
        },
      });
    }

    const events = sharedAnalyticsRepository.getEvents({ tradeId, botId });

    return NextResponse.json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown events error',
      },
      { status: 500 }
    );
  }
}
