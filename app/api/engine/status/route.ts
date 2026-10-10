import { NextResponse } from 'next/server';
import { getSharedBotEngine } from '@/lib/engine';

export async function GET() {
  try {
    const engine = await getSharedBotEngine();
    const status = await engine.getStatus();
    return NextResponse.json({
      success: true,
      status,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
