// Project Q — Persistence Layer: In-Memory Implementation
// Provides complete, reliable persistence emulation in memory.
// Used when Supabase credentials are not configured or for automated unit testing.

import {
  BotConfig,
  BotCycle,
  BotTrade,
  BotState,
} from '@/lib/bots/types';
import {
  BotRepository,
  BotRecordWithState,
  BotStateEvent,
} from './types';

export class InMemoryBotRepository implements BotRepository {
  private bots: Map<string, BotRecordWithState> = new Map();
  private cycles: Map<string, BotCycle> = new Map();
  private trades: Map<string, BotTrade> = new Map();
  private events: BotStateEvent[] = [];

  constructor(initialBots?: BotRecordWithState[]) {
    if (initialBots) {
      initialBots.forEach((b) => this.bots.set(b.bot.id, { ...b }));
    }
  }

  // --- Bot Operations ---

  public async createBot(bot: BotConfig, initialStatus: BotState = 'STOPPED'): Promise<BotConfig> {
    const now = Date.now();
    const record: BotRecordWithState = {
      bot: { ...bot, createdAt: bot.createdAt || now, updatedAt: now },
      currentState: initialStatus,
      enabled: true,
      createdAt: bot.createdAt || now,
      updatedAt: now,
    };
    this.bots.set(bot.id, record);
    return record.bot;
  }

  public async saveBot(bot: BotConfig, currentState: BotState, enabled: boolean = true): Promise<void> {
    const existing = this.bots.get(bot.id);
    const now = Date.now();
    this.bots.set(bot.id, {
      bot: { ...bot, updatedAt: now },
      currentState,
      enabled,
      createdAt: existing ? existing.createdAt : bot.createdAt || now,
      updatedAt: now,
    });
  }

  public async loadBot(id: string): Promise<BotRecordWithState | null> {
    const record = this.bots.get(id);
    if (!record) return null;
    return JSON.parse(JSON.stringify(record));
  }

  public async loadAllBots(): Promise<BotRecordWithState[]> {
    return Array.from(this.bots.values()).map((r) => JSON.parse(JSON.stringify(r)));
  }

  public async loadActiveBots(): Promise<BotRecordWithState[]> {
    return Array.from(this.bots.values())
      .filter((r) => r.enabled)
      .map((r) => JSON.parse(JSON.stringify(r)));
  }

  public async deleteBot(id: string): Promise<boolean> {
    const deleted = this.bots.delete(id);
    // Cleanup related cycles & trades
    Array.from(this.cycles.entries()).forEach(([cId, c]) => {
      if (c.botId === id) this.cycles.delete(cId);
    });
    Array.from(this.trades.entries()).forEach(([tId, t]) => {
      if (t.botId === id) this.trades.delete(tId);
    });
    this.events = this.events.filter((e) => e.botId !== id);
    return deleted;
  }

  // --- Cycle Operations ---

  public async saveCycle(cycle: BotCycle): Promise<void> {
    this.cycles.set(cycle.cycleId, JSON.parse(JSON.stringify(cycle)));
  }

  public async loadOpenCycle(botId: string): Promise<BotCycle | null> {
    const botCycles = Array.from(this.cycles.values())
      .filter((c) => c.botId === botId && c.endedAt === null);

    if (botCycles.length === 0) return null;
    // Return latest open cycle
    botCycles.sort((a, b) => b.startedAt - a.startedAt);
    return JSON.parse(JSON.stringify(botCycles[0]));
  }

  public async loadLatestCycle(botId: string): Promise<BotCycle | null> {
    const botCycles = Array.from(this.cycles.values())
      .filter((c) => c.botId === botId);

    if (botCycles.length === 0) return null;
    botCycles.sort((a, b) => b.startedAt - a.startedAt);
    return JSON.parse(JSON.stringify(botCycles[0]));
  }

  public async loadCycle(cycleId: string): Promise<BotCycle | null> {
    const cycle = this.cycles.get(cycleId);
    if (!cycle) return null;
    return JSON.parse(JSON.stringify(cycle));
  }

  // --- Trade Operations ---

  public async saveTrade(trade: BotTrade): Promise<void> {
    this.trades.set(trade.tradeId, JSON.parse(JSON.stringify(trade)));
  }

  public async loadTrade(tradeId: string): Promise<BotTrade | null> {
    const trade = this.trades.get(tradeId);
    if (!trade) return null;
    return JSON.parse(JSON.stringify(trade));
  }

  public async loadOpenTrade(cycleId: string): Promise<BotTrade | null> {
    const found = Array.from(this.trades.values())
      .find((t) => t.cycleId === cycleId && t.status !== 'CLOSED');

    if (!found) return null;
    return JSON.parse(JSON.stringify(found));
  }

  // --- State Events / Audit ---

  public async saveStateEvent(event: BotStateEvent): Promise<void> {
    this.events.push(JSON.parse(JSON.stringify(event)));
  }

  public async loadRecentStateEvents(botId: string, limit: number = 50): Promise<BotStateEvent[]> {
    return this.events
      .filter((e) => e.botId === botId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // --- Health ---

  public async ping(): Promise<{ ok: boolean; type: 'in-memory'; message: string }> {
    return {
      ok: true,
      type: 'in-memory',
      message: `InMemory repository operational with ${this.bots.size} bots, ${this.cycles.size} cycles.`,
    };
  }
}
