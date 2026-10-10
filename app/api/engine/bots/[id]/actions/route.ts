import { NextRequest, NextResponse } from 'next/server';
import { getSharedBotEngine } from '@/lib/engine';
import { BotState } from '@/lib/bots/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const action = body.action;

    const engine = await getSharedBotEngine();
    const bot = engine.getBot(id);

    if (!bot) {
      return NextResponse.json({ success: false, error: `Bot ${id} not found.` }, { status: 404 });
    }

    let result;

    if (action === 'start') {
      result = await engine.startBot(id);
    } else if (action === 'stop') {
      result = await engine.stopBot(id, body.reason);
    } else if (action === 'advance') {
      if (!body.targetState) {
        return NextResponse.json(
          { success: false, error: 'Missing targetState parameter for advance action.' },
          { status: 400 }
        );
      }
      result = await engine.advanceBotState(id, body.targetState as BotState, body.details);
    } else if (action === 'recover') {
      if (!body.targetState) {
        return NextResponse.json(
          { success: false, error: 'Missing targetState parameter for recover action.' },
          { status: 400 }
        );
      }
      result = await engine.recoverBot(id, body.targetState as BotState, body.reason);
    } else if (action === 'buy') {
      result = await engine.executeBotBuy(id, body.options);
    } else if (action === 'sell') {
      result = await engine.executeBotSell(id, body.options);
    } else if (action === 'verify') {
      result = await engine.verifyBotOrder(id, body.orderId, body.clientOrderId);
    } else {
      return NextResponse.json(
        { success: false, error: `Unknown action: "${action}". Supported: start, stop, advance, recover, buy, sell, verify.` },
        { status: 400 }
      );
    }

    const summary = engine.listBots().find((b) => b.id === id);

    const isSuccess = 'success' in result ? result.success : (result as { outcome?: string }).outcome === 'SUCCESS';

    return NextResponse.json({
      success: isSuccess,
      result,
      bot: summary,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
