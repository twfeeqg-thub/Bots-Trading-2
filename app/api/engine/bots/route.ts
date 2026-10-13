import { NextRequest, NextResponse } from 'next/server';
import { getSharedBotEngine } from '@/lib/engine';
import { CreateBotParams } from '@/lib/bots/types';

export async function GET() {
  try {
    const engine = await getSharedBotEngine();
    const bots = engine.listBots();

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
    const body = await req.json();
    const engine = await getSharedBotEngine();

    // Phase 5: Manually seed demo bots for testing upon explicit user request
    if (body.action === 'seed_demo') {
      const bots = await engine.seedDemoBots();
      return NextResponse.json({
        success: true,
        message: 'تم إنشاء بوتات تجريبية يدويًا للاختبار بنجاح.',
        count: bots.length,
        bots,
      });
    }

    const botParams: CreateBotParams = body;
    if (!botParams.type || !botParams.symbol) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type and symbol.' },
        { status: 400 }
      );
    }

    const bot = await engine.createBot(botParams);
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
