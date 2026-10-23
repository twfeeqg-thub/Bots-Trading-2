// Project Q — Persistence Layer: Supabase Repository Implementation
// Connects to Supabase PostgreSQL database tables when credentials are provided in the environment.
// Cleanly maps domain models to PostgreSQL tables (bots, bot_cycles, trades, bot_state_events).

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  BotConfig,
  BotCycle,
  BotTrade,
  BotState,
  BotType,
  EntryMethod,
} from '@/lib/bots/types';
import {
  BotRepository,
  BotRecordWithState,
  BotStateEvent,
  PersistenceError,
} from './types';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseKey: string; // Service Role key (preferred for backend) or Anon key
}

export class SupabaseBotRepository implements BotRepository {
  private client: SupabaseClient;

  constructor(config: SupabaseConfig) {
    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new PersistenceError('Supabase URL and API Key must be provided.', 'INVALID_CREDENTIALS');
    }
    this.client = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: false },
    });
  }

  // --- Bot Operations ---

  public async createBot(bot: BotConfig, initialStatus: BotState = 'STOPPED'): Promise<BotConfig> {
    const nowIso = new Date().toISOString();
    const row = {
      id: bot.id,
      type: bot.type,
      name: bot.name,
      symbol: bot.symbol,
      entry_amount: bot.entryAmount,
      entry_method: bot.entryMethod,
      planned_entry_price: bot.plannedEntryPrice,
      initial_stop_loss: bot.initialStopLoss,
      t_rule_config: bot.tRuleConfig,
      x_settings: bot.xSettings ?? null,
      alert_settings: bot.alertSettings,
      current_state: initialStatus,
      enabled: true,
      extra_config: bot.extraConfig ?? {},
      created_at: bot.createdAt ? new Date(bot.createdAt).toISOString() : nowIso,
      updated_at: nowIso,
    };

    const { error } = await this.client.from('bots').insert(row);
    if (error) {
      throw new PersistenceError(`Failed to insert bot into Supabase: ${error.message}`, error.code, error);
    }
    return bot;
  }

  public async saveBot(bot: BotConfig, currentState: BotState, enabled: boolean = true): Promise<void> {
    const row = {
      type: bot.type,
      name: bot.name,
      symbol: bot.symbol,
      entry_amount: bot.entryAmount,
      entry_method: bot.entryMethod,
      planned_entry_price: bot.plannedEntryPrice,
      initial_stop_loss: bot.initialStopLoss,
      t_rule_config: bot.tRuleConfig,
      x_settings: bot.xSettings ?? null,
      alert_settings: bot.alertSettings,
      current_state: currentState,
      enabled,
      extra_config: bot.extraConfig ?? {},
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.client
      .from('bots')
      .update(row)
      .eq('id', bot.id);

    if (error) {
      throw new PersistenceError(`Failed to update bot in Supabase: ${error.message}`, error.code, error);
    }
  }

  public async loadBot(id: string): Promise<BotRecordWithState | null> {
    const { data, error } = await this.client
      .from('bots')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new PersistenceError(`Failed to load bot from Supabase: ${error.message}`, error.code, error);
    }
    if (!data) return null;

    return this.mapBotRowToRecord(data);
  }

  public async loadAllBots(): Promise<BotRecordWithState[]> {
    const { data, error } = await this.client
      .from('bots')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new PersistenceError(`Failed to load bots from Supabase: ${error.message}`, error.code, error);
    }
    if (!data) return [];

    return data.map((row) => this.mapBotRowToRecord(row));
  }

  public async loadActiveBots(): Promise<BotRecordWithState[]> {
    const { data, error } = await this.client
      .from('bots')
      .select('*')
      .eq('enabled', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new PersistenceError(`Failed to load active bots from Supabase: ${error.message}`, error.code, error);
    }
    if (!data) return [];

    return data.map((row) => this.mapBotRowToRecord(row));
  }

  public async deleteBot(id: string): Promise<boolean> {
    const { error } = await this.client.from('bots').delete().eq('id', id);
    if (error) {
      throw new PersistenceError(`Failed to delete bot from Supabase: ${error.message}`, error.code, error);
    }
    return true;
  }

  // --- Cycle Operations ---

  public async saveCycle(cycle: BotCycle): Promise<void> {
    const row = {
      cycle_id: cycle.cycleId,
      bot_id: cycle.botId,
      cycle_number: cycle.cycleNumber,
      current_state: cycle.currentState,
      previous_state: cycle.previousState,
      started_at: new Date(cycle.startedAt).toISOString(),
      ended_at: cycle.endedAt ? new Date(cycle.endedAt).toISOString() : null,
      active_trade_id: cycle.activeTradeId,
      last_error: cycle.lastError,
      state_history: cycle.stateHistory,
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.client.from('bot_cycles').upsert(row, { onConflict: 'cycle_id' });
    if (error) {
      throw new PersistenceError(`Failed to save cycle to Supabase: ${error.message}`, error.code, error);
    }
  }

  public async loadOpenCycle(botId: string): Promise<BotCycle | null> {
    const { data, error } = await this.client
      .from('bot_cycles')
      .select('*')
      .eq('bot_id', botId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .maybeSingle();

    if (error) {
      throw new PersistenceError(`Failed to load open cycle from Supabase: ${error.message}`, error.code, error);
    }
    if (!data) return null;

    return this.mapCycleRowToDomain(data);
  }

  public async loadLatestCycle(botId: string): Promise<BotCycle | null> {
    const { data, error } = await this.client
      .from('bot_cycles')
      .select('*')
      .eq('bot_id', botId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new PersistenceError(`Failed to load latest cycle from Supabase: ${error.message}`, error.code, error);
    }
    if (!data) return null;

    return this.mapCycleRowToDomain(data);
  }

  public async loadCycle(cycleId: string): Promise<BotCycle | null> {
    const { data, error } = await this.client
      .from('bot_cycles')
      .select('*')
      .eq('cycle_id', cycleId)
      .maybeSingle();

    if (error) {
      throw new PersistenceError(`Failed to load cycle by id from Supabase: ${error.message}`, error.code, error);
    }
    if (!data) return null;

    return this.mapCycleRowToDomain(data);
  }

  // --- Trade Operations ---

  public async saveTrade(trade: BotTrade): Promise<void> {
    const row = {
      trade_id: trade.tradeId,
      cycle_id: trade.cycleId,
      bot_id: trade.botId,
      symbol: trade.symbol,
      status: trade.status,
      entry_data: trade.entry,
      exit_data: trade.exit,
      opened_at: trade.openedAt ? new Date(trade.openedAt).toISOString() : null,
      closed_at: trade.closedAt ? new Date(trade.closedAt).toISOString() : null,
      notes: trade.notes ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.client.from('trades').upsert(row, { onConflict: 'trade_id' });
    if (error) {
      throw new PersistenceError(`Failed to save trade to Supabase: ${error.message}`, error.code, error);
    }
  }

  public async loadTrade(tradeId: string): Promise<BotTrade | null> {
    const { data, error } = await this.client
      .from('trades')
      .select('*')
      .eq('trade_id', tradeId)
      .maybeSingle();

    if (error) {
      throw new PersistenceError(`Failed to load trade from Supabase: ${error.message}`, error.code, error);
    }
    if (!data) return null;

    return this.mapTradeRowToDomain(data);
  }

  public async loadOpenTrade(cycleId: string): Promise<BotTrade | null> {
    const { data, error } = await this.client
      .from('trades')
      .select('*')
      .eq('cycle_id', cycleId)
      .neq('status', 'CLOSED')
      .maybeSingle();

    if (error) {
      throw new PersistenceError(`Failed to load open trade from Supabase: ${error.message}`, error.code, error);
    }
    if (!data) return null;

    return this.mapTradeRowToDomain(data);
  }

  // --- State Events / Audit ---

  public async saveStateEvent(event: BotStateEvent): Promise<void> {
    const row = {
      event_id: event.eventId,
      bot_id: event.botId,
      cycle_id: event.cycleId ?? null,
      previous_state: event.previousState ?? null,
      new_state: event.newState,
      event_type: event.eventType,
      reason: event.reason ?? null,
      metadata: event.metadata ?? {},
      created_at: new Date(event.timestamp).toISOString(),
    };

    const { error } = await this.client.from('bot_state_events').insert(row);
    if (error) {
      // Non-fatal warning for event logging failure to prevent blocking execution
      console.warn(`[SupabaseRepository] Warning saving event ${event.eventId}: ${error.message}`);
    }
  }

  public async loadRecentStateEvents(botId: string, limit: number = 50): Promise<BotStateEvent[]> {
    const { data, error } = await this.client
      .from('bot_state_events')
      .select('*')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new PersistenceError(`Failed to load state events from Supabase: ${error.message}`, error.code, error);
    }
    if (!data) return [];

    return data.map((row) => ({
      eventId: row.event_id,
      botId: row.bot_id,
      cycleId: row.cycle_id,
      previousState: row.previous_state as BotState | null,
      newState: row.new_state as BotState,
      eventType: row.event_type as BotStateEvent['eventType'],
      reason: row.reason,
      metadata: row.metadata,
      timestamp: new Date(row.created_at).getTime(),
    }));
  }

  // --- Health ---

  public async ping(): Promise<{ ok: boolean; type: 'supabase'; message?: string }> {
    try {
      const { error } = await this.client.from('bots').select('id').limit(1);
      if (error) {
        return { ok: false, type: 'supabase', message: `Supabase ping failed: ${error.message}` };
      }
      return { ok: true, type: 'supabase', message: 'Supabase connection established and responsive.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, type: 'supabase', message: `Supabase ping exception: ${msg}` };
    }
  }

  // --- Mappers ---

  private mapBotRowToRecord(row: Record<string, unknown>): BotRecordWithState {
    const botConfig: BotConfig = {
      id: String(row.id),
      type: row.type as BotType,
      name: String(row.name),
      symbol: String(row.symbol),
      entryAmount: Number(row.entry_amount),
      entryMethod: row.entry_method as EntryMethod,
      plannedEntryPrice: row.planned_entry_price ? Number(row.planned_entry_price) : null,
      initialStopLoss: row.initial_stop_loss as BotConfig['initialStopLoss'],
      tRuleConfig: row.t_rule_config as BotConfig['tRuleConfig'],
      xSettings: row.x_settings as BotConfig['xSettings'],
      alertSettings: row.alert_settings as BotConfig['alertSettings'],
      extraConfig: (row.extra_config as Record<string, unknown>) || {},
      createdAt: new Date(String(row.created_at)).getTime(),
      updatedAt: new Date(String(row.updated_at)).getTime(),
    };

    return {
      bot: botConfig,
      currentState: row.current_state as BotState,
      enabled: Boolean(row.enabled),
      createdAt: botConfig.createdAt,
      updatedAt: botConfig.updatedAt,
    };
  }

  private mapCycleRowToDomain(row: Record<string, unknown>): BotCycle {
    return {
      cycleId: String(row.cycle_id),
      botId: String(row.bot_id),
      cycleNumber: Number(row.cycle_number),
      currentState: row.current_state as BotState,
      previousState: (row.previous_state as BotState) || null,
      startedAt: new Date(String(row.started_at)).getTime(),
      endedAt: row.ended_at ? new Date(String(row.ended_at)).getTime() : null,
      activeTradeId: row.active_trade_id ? String(row.active_trade_id) : null,
      lastError: row.last_error as BotCycle['lastError'],
      stateHistory: (row.state_history as BotCycle['stateHistory']) || [],
    };
  }

  private mapTradeRowToDomain(row: Record<string, unknown>): BotTrade {
    return {
      tradeId: String(row.trade_id),
      cycleId: String(row.cycle_id),
      botId: String(row.bot_id),
      symbol: String(row.symbol),
      status: row.status as BotTrade['status'],
      entry: (row.entry_data as BotTrade['entry']) || { requestedAmount: 0 },
      exit: (row.exit_data as BotTrade['exit']) || {},
      openedAt: row.opened_at ? new Date(String(row.opened_at)).getTime() : null,
      closedAt: row.closed_at ? new Date(String(row.closed_at)).getTime() : null,
      notes: row.notes ? String(row.notes) : undefined,
    };
  }
}
