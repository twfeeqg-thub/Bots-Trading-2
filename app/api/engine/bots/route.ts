import { NextRequest, NextResponse } from 'next/server';
import { getSharedBotEngine } from '@/lib/engine';
import { CreateBotParams } from '@/lib/bots/types';

export async function GET() {
  try {
    const engine = await getSharedBotEngine();
    let bots = engine.listBots();

    if (bots.length === 0) {
      try {
        await engine.createBot({
          id: 'bot_btc_sample',
          type: 'RANGE_BOT',
          name: 'بوت المسار العرضي — BTC',
          symbol: 'BTCUSDT',
          entryAmount: 150,
        });
        await engine.createBot({
          id: 'bot_eth_sample',
          type: 'DEAL_BOT',
          name: 'بوت صفقة الاختراق — ETH',
          symbol: 'ETHUSDT',
          entryAmount: 100,
        });
        bots = engine.listBots();
      } catch {
        // Non-fatal if already existing
      }
    }

    return NextResponse.json({
      success: true,
      count: bots.length,
      bots,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateBotParams = await req.json();
    if (!body.type || !body.symbol) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type and symbol.' },
        { status: 400 }
      );
    }

    const engine = await getSharedBotEngine();
    const bot = await engine.createBot(body);
    const summary = engine.listBots().find((b) => b.id === bot.getId());

    return NextResponse.json({
      success: true,
      bot: summary,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
