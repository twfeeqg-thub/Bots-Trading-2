import { NextRequest, NextResponse } from 'next/server';
import { getSharedBotEngine } from '@/lib/engine';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const engine = await getSharedBotEngine();
    const bot = engine.getBot(id);

    if (!bot) {
      return NextResponse.json({ success: false, error: `Bot ${id} not found.` }, { status: 404 });
    }

    const summary = engine.listBots().find((b) => b.id === id);
    return NextResponse.json({
      success: true,
      bot: summary,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const engine = await getSharedBotEngine();
    const success = await engine.deleteBot(id);

    return NextResponse.json({
      success,
      message: `Bot ${id} deleted successfully.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
