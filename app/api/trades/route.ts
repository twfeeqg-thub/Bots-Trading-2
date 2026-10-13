import { NextRequest, NextResponse } from 'next/server';
import { sharedTradeManager, sharedSymbolCostStore } from '@/lib/trade-manager';
import { getSharedBotEngine } from '@/lib/engine';

export async function GET() {
  try {
    // Synchronize any standalone bots into TradeManager to maintain a unified trading cycle
    try {
      const engine = await getSharedBotEngine();
      const bots = engine.listBots();
      for (const bot of bots) {
        if (!sharedTradeManager.getTradeByBotId(bot.id)) {
          await sharedTradeManager.adoptBotAsManagedTrade(bot.id);
        }
      }
    } catch {
      // Non-fatal if engine synchronization experiences transient issues
    }

    const trades = sharedTradeManager.listTrades();
    const activeTrades = sharedTradeManager.getActiveTrades();
    const closedTrades = sharedTradeManager.getClosedTrades();
    const symbolCosts = sharedSymbolCostStore.getAll();

    return NextResponse.json({
      success: true,
      count: trades.length,
      activeCount: activeTrades.length,
      closedCount: closedTrades.length,
      symbolCosts,
      trades,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Phase 5: Manually seed demo trade for testing upon explicit user request
    if (body.action === 'seed_demo') {
      const demoTrade = await sharedTradeManager.createTradeFromManual({
        symbol: body.symbol || 'BTCUSDT',
        entryAmount: body.entryAmount ? Number(body.entryAmount) : 100,
        entryPrice: body.entryPrice ? Number(body.entryPrice) : 65000,
        stepPercent: body.stepPercent ? Number(body.stepPercent) : 2.0,
        manualEntryCost: 0.1,
        manualExitCostRate: 0.0015,
        botType: body.botType || 'DEAL_BOT',
        immediateEntry: true,
      });
      return NextResponse.json({
        success: true,
        trade: demoTrade,
        message: 'تم إنشاء صفقة تجريبية يدويًا للاختبار بنجاح.',
      });
    }

    const source = body.source || 'MANUAL';
    const symbol = body.symbol;
    const entryAmount =
      body.entryAmount !== undefined && Number(body.entryAmount) > 0
        ? Number(body.entryAmount)
        : 100;
    const manualEntryCost = body.manualEntryCost !== undefined ? Number(body.manualEntryCost) : undefined;
    const manualExitCostRate = body.manualExitCostRate !== undefined ? Number(body.manualExitCostRate) : undefined;
    const manualEntryFeePercent = body.manualEntryFeePercent !== undefined ? Number(body.manualEntryFeePercent) : undefined;
    const manualEntryFeeAmount = body.manualEntryFeeAmount !== undefined ? Number(body.manualEntryFeeAmount) : undefined;
    const manualExitFeePercent = body.manualExitFeePercent !== undefined ? Number(body.manualExitFeePercent) : undefined;
    const manualExitFeeAmount = body.manualExitFeeAmount !== undefined ? Number(body.manualExitFeeAmount) : undefined;
    const stepPercent = body.stepPercent !== undefined && Number(body.stepPercent) > 0 ? Number(body.stepPercent) : undefined;
    const botType = body.botType || (body.xSettings?.enabled ? 'RANGE_BOT' : 'DEAL_BOT');
    const xSettings = body.xSettings;
    const initialStopLossPercent = body.initialStopLossPercent !== undefined ? Number(body.initialStopLossPercent) : undefined;
    const immediateEntry = body.immediateEntry !== undefined ? Boolean(body.immediateEntry) : undefined;
    const isPreEntryRecovery = body.isPreEntryRecovery !== undefined ? Boolean(body.isPreEntryRecovery) : undefined;

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'Trading pair symbol is required.' },
        { status: 400 }
      );
    }

    let trade;
    if (source === 'SCANNER') {
      trade = await sharedTradeManager.createTradeFromScanner({
        symbol,
        scannerPrice: Number(body.scannerPrice || body.entryPrice || 0),
        entryAmount,
        stepPercent,
        manualEntryCost,
        manualExitCostRate,
        manualEntryFeePercent,
        manualEntryFeeAmount,
        manualExitFeePercent,
        manualExitFeeAmount,
        botType,
        xSettings,
        initialStopLossPercent,
        immediateEntry,
        isPreEntryRecovery,
      });
    } else {
      trade = await sharedTradeManager.createTradeFromManual({
        symbol,
        entryAmount,
        entryPrice: body.entryPrice ? Number(body.entryPrice) : undefined,
        stepPercent,
        manualEntryCost,
        manualExitCostRate,
        manualEntryFeePercent,
        manualEntryFeeAmount,
        manualExitFeePercent,
        manualExitFeeAmount,
        botType,
        xSettings,
        initialStopLossPercent,
        immediateEntry,
        isPreEntryRecovery,
      });
    }

    return NextResponse.json({
      success: true,
      trade,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
