import { NextRequest, NextResponse } from 'next/server';
import { sharedTradeManager } from '@/lib/trade-manager';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trade = sharedTradeManager.getTrade(id);

    if (!trade) {
      return NextResponse.json({ success: false, error: `Trade ${id} not found.` }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      trade,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const action = body.action;

    const trade = sharedTradeManager.getTrade(id);
    if (!trade) {
      return NextResponse.json({ success: false, error: `Trade ${id} not found.` }, { status: 404 });
    }

    if (action === 'close') {
      const closed = await sharedTradeManager.executeTradeExit(id, body.reason || 'إغلاق يدوي من المستخدم');
      return NextResponse.json({ success: true, trade: closed });
    }

    if (action === 'tick') {
      const price = Number(body.price);
      if (price > 0) {
        await sharedTradeManager.onMarketPriceTick(trade.symbol, price);
      }
      return NextResponse.json({ success: true, trade: sharedTradeManager.getTrade(id) });
    }

    if (action === 'applyRealCost') {
      const updated = sharedTradeManager.applyRealConfirmedCost(id, {
        entryCostAmount: body.entryCostAmount !== undefined ? Number(body.entryCostAmount) : undefined,
        entryCostRate: body.entryCostRate !== undefined ? Number(body.entryCostRate) : undefined,
        exitCostRate: body.exitCostRate !== undefined ? Number(body.exitCostRate) : undefined,
      });
      return NextResponse.json({ success: true, trade: updated });
    }

    if (action === 'recovery') {
      const levelIndex = Number(body.levelIndex || 1);
      const updated = await sharedTradeManager.executeRecoveryBuy(id, levelIndex);
      return NextResponse.json({ success: true, trade: updated });
    }

    if (action === 'updateXSettings') {
      const updated = sharedTradeManager.updateTradeXSettings(id, {
        stepPercent: body.stepPercent !== undefined ? Number(body.stepPercent) : undefined,
        recoveryRatio: body.recoveryRatio !== undefined ? Number(body.recoveryRatio) : undefined,
        customAllocationQuote:
          body.customAllocationQuote !== undefined && body.customAllocationQuote !== ''
            ? Number(body.customAllocationQuote)
            : undefined,
        maxLevels:
          body.maxLevels !== undefined
            ? body.maxLevels === null || body.maxLevels === ''
              ? null
              : Number(body.maxLevels)
            : undefined,
      });
      return NextResponse.json({ success: true, trade: updated });
    }

    if (action === 'generateNextRecoveryLevel') {
      const nextLevel = sharedTradeManager.generateNextRecoveryLevel(id);
      return NextResponse.json({ success: true, trade: sharedTradeManager.getTrade(id), nextLevel });
    }

    if (action === 'verify') {
      const verified = await sharedTradeManager.verifyTrade(id);
      return NextResponse.json({ success: true, trade: verified });
    }

    return NextResponse.json(
      { success: false, error: `Unknown trade action: "${action}". Supported: close, tick, applyRealCost, recovery, updateXSettings, verify.` },
      { status: 400 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
