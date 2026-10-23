// Project Q — Standalone Bot Engine Runner
// Entrypoint for running the Bot Engine as an independent Node.js/TypeScript daemon.
// Can be executed via: tsx scripts/run-bot-engine.ts OR bun scripts/run-bot-engine.ts

import http from 'http';
import { BotEngine } from '../lib/engine/bot-engine';
import { createBotRepository } from '../lib/persistence';

async function main() {
  console.log('================================================================');
  console.log('  Starting Project Q Standalone Bot Engine (V1)');
  console.log('  Mode: Independent Node.js Process');
  console.log('================================================================');

  // Initialize persistence repository (Supabase if credentials exist, else in-memory fallback)
  const repository = createBotRepository();
  const engine = new BotEngine({ repository });

  // Initialize engine and run state recovery
  await engine.initialize();

  const status = await engine.getStatus();
  console.log(`[Runner] Engine Status: ${status.running ? 'RUNNING' : 'STOPPED'}`);
  console.log(`[Runner] Persistence Backend: ${status.storageType.toUpperCase()}`);
  console.log(`[Runner] Total Bots Loaded: ${status.totalBots}`);
  console.log(`[Runner] Active Cycles Restored: ${status.activeCyclesCount}`);

  // Optional HTTP health-check server for monitoring / Render health checks
  const port = Number(process.env.BOT_ENGINE_PORT || 4000);
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health' || req.url === '/status') {
      const currentStatus = await engine.getStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, status: currentStatus }));
      return;
    }

    if (req.url === '/bots' && req.method === 'GET') {
      const bots = engine.listBots();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, count: bots.length, bots }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, () => {
    console.log(`[Runner] Engine Health Server listening on port ${port}`);
    console.log('[Runner] Engine is operational. Ready for execution events.');
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n[Runner] Received ${signal}. Initiating graceful shutdown...`);
    server.close();
    await engine.shutdown();
    console.log('[Runner] Engine shutdown complete. Exiting.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[Runner] Fatal exception while starting Bot Engine:', err);
  process.exit(1);
});
