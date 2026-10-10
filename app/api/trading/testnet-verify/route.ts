import { NextResponse } from 'next/server';
import { BinanceSigner } from '@/lib/trading/binance-signer';
import { BinanceTradingClient } from '@/lib/trading/binance-trading-client';

/**
 * Project Q — Safe Post-Deployment Testnet Connection Verification Endpoint
 * 
 * STRICT SECURITY CONSTRAINTS:
 * 1. Read-only health and balance query only — ZERO buy/sell orders.
 * 2. Never accepts API keys or secrets from client requests.
 * 3. Never returns API keys, secrets, or raw cryptographic signatures in the response.
 * 4. Strictly validates that BINANCE_ENVIRONMENT=testnet and BINANCE_TESTNET_TRADING_ENABLED=true.
 * 5. Strictly blocks execution against production endpoints.
 */
export async function GET() {
  const signer = new BinanceSigner();
  const configStatus = signer.getConfigurationStatus();

  // If not configured for testnet, return safe non-exposing status
  if (!configStatus.valid || configStatus.mode !== 'testnet') {
    return NextResponse.json({
      success: false,
      connected: false,
      mode: configStatus.mode,
      environment: configStatus.environment || 'none',
      message: configStatus.error || 'Testnet trading is not enabled in environment.',
      safeGuidance: 'Ensure BINANCE_ENVIRONMENT=testnet and BINANCE_TESTNET_TRADING_ENABLED=true are set in Vercel.',
      timestamp: Date.now(),
    }, { status: 400 });
  }

  const client = new BinanceTradingClient(signer);

  try {
    // 1. Connectivity & Time Synchronization (GET /api/v3/time)
    const timeRes = await client.getServerTime();

    // 2. Account Information & Testnet Balances (GET /api/v3/account)
    const accountRes = await client.getAccountInformation();

    // 3. Extract non-zero test balances safely (USDT, BTC, etc.)
    const activeTestBalances = accountRes.balances
      .filter((b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map((b) => ({
        asset: b.asset,
        free: b.free,
        locked: b.locked,
      }));

    return NextResponse.json({
      success: true,
      connected: true,
      mode: 'testnet',
      baseUrl: signer.getBaseUrl(),
      serverTimeSync: {
        serverTime: timeRes.serverTime,
        offsetMs: timeRes.offsetMs || 0,
        synchronized: true,
      },
      account: {
        canTrade: accountRes.canTrade,
        accountType: accountRes.accountType,
        totalActiveBalancesCount: activeTestBalances.length,
        testBalances: activeTestBalances,
      },
      timestamp: Date.now(),
    }, { status: 200 });
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message || String(err);
    // Sanitize any potential secret leakage from third-party errors
    const sanitizedError = errorMsg.replace(/api[_-]?key|secret|sign/gi, '[REDACTED]');

    return NextResponse.json({
      success: false,
      connected: false,
      mode: 'testnet',
      baseUrl: signer.getBaseUrl(),
      error: sanitizedError,
      timestamp: Date.now(),
    }, { status: 502 });
  }
}
