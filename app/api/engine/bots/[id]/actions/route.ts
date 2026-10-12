import { NextRequest, NextResponse } from 'next/server';
import { getSharedBotEngine } from '@/lib/engine';
import { BotState } from '@/lib/bots/types';
import { sharedTradeManager } from '@/lib/trade-manager';

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
      // Synchronize trade with TradeManager
      try {
        await sharedTradeManager.adoptBotAsManagedTrade(id);
      } catch {
        // Non-fatal sync
      }
    } else if (action === 'sell') {
      // Check if TradeManager has a managed trade for this bot to execute the exit with full PnL calculations
      const managedTrade = sharedTradeManager.getTradeByBotId(id);
      if (managedTrade && managedTrade.status === 'OPEN') {
        const updatedTrade = await sharedTradeManager.executeTradeExit(
          managedTrade.tradeId,
          body.options?.reason || 'إغلاق بيع من واجهة البوت'
        );
        result = {
          outcome: updatedTrade.status === 'CLOSED' ? 'SUCCESS' : 'PENDING',
          avgPrice: updatedTrade.exit?.executionPrice,
          executedQty: updatedTrade.exit?.filledQuantity,
          orderId: updatedTrade.exit?.orderId,
          timestamp: updatedTrade.exit?.executedAt || Date.now(),
        };
      } else {
        result = await engine.executeBotSell(id, body.options);
        try {
          await sharedTradeManager.adoptBotAsManagedTrade(id);
        } catch {
          // Non-fatal
        }
      }
    } else if (action === 'verify') {
      const managedTrade = sharedTradeManager.getTradeByBotId(id);
      if (managedTrade && (managedTrade.status === 'PENDING_ENTRY' || managedTrade.status === 'PENDING_EXIT')) {
        const verifiedTrade = await sharedTradeManager.verifyTrade(managedTrade.tradeId);
        result = {
          outcome: 'SUCCESS',
          status: verifiedTrade.status === 'OPEN' || verifiedTrade.status === 'CLOSED' ? 'FILLED' : 'PENDING',
          found: true,
          avgPrice: verifiedTrade.exit?.executionPrice || verifiedTrade.entry.executionPrice,
          executedQty: verifiedTrade.exit?.filledQuantity || verifiedTrade.entry.filledQuantity,
          orderId: verifiedTrade.exit?.orderId || verifiedTrade.entry.orderId,
          timestamp: Date.now(),
        };
      } else {
        result = await engine.verifyBotOrder(id, body.orderId, body.clientOrderId);
        try {
          await sharedTradeManager.adoptBotAsManagedTrade(id);
        } catch {
          // Non-fatal
        }
      }
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
