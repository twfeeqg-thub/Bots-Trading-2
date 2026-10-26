// Project Q — Persistence Layer: Types & Interfaces
// Clean decoupling between Bot Engine, In-Memory fallbacks, and Supabase Repository.

import {
  BotConfig,
  BotCycle,
  BotTrade,
  BotState,
} from '@/lib/bots/types';

/**
 * Audit log entry for bot state transitions, errors, and recoveries.
 */
export interface BotStateEvent {
  eventId: string;
  botId: string;
  cycleId?: string | null;
  previousState: BotState | null;
  newState: BotState;
  eventType: 'STATE_TRANSITION' | 'CYCLE_START' | 'CYCLE_END' | 'ERROR' | 'RECOVERY' | 'MANUAL_STOP';
  reason?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Bot record stored in persistence, pairing static config with dynamic state and enablement.
 */
export interface BotRecordWithState {
  bot: BotConfig;
  currentState: BotState;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Standard persistence error class
 */
export class PersistenceError extends Error {
  public readonly code: string;
  public readonly originalError?: unknown;

  constructor(message: string, code: string = 'PERSISTENCE_ERROR', originalError?: unknown) {
    super(message);
    this.name = 'PersistenceError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Repository interface contract.
 * All persistence adapters (In-Memory, Supabase, etc.) must implement this contract.
 */
export interface BotRepository {
  // --- Bot Operations ---
  createBot(bot: BotConfig, initialStatus?: BotState): Promise<BotConfig>;
  saveBot(bot: BotConfig, currentState: BotState, enabled?: boolean): Promise<void>;
  loadBot(id: string): Promise<BotRecordWithState | null>;
  loadAllBots(): Promise<BotRecordWithState[]>;
  loadActiveBots(): Promise<BotRecordWithState[]>;
  deleteBot(id: string): Promise<boolean>;

  // --- Cycle Operations ---
  saveCycle(cycle: BotCycle): Promise<void>;
  loadOpenCycle(botId: string): Promise<BotCycle | null>;
  loadLatestCycle(botId: string): Promise<BotCycle | null>;
  loadCycle(cycleId: string): Promise<BotCycle | null>;

  // --- Trade Operations ---
  saveTrade(trade: BotTrade): Promise<void>;
  loadTrade(tradeId: string): Promise<BotTrade | null>;
  loadOpenTrade(cycleId: string): Promise<BotTrade | null>;

  // --- State Events / Audit ---
  saveStateEvent(event: BotStateEvent): Promise<void>;
  loadRecentStateEvents(botId: string, limit?: number): Promise<BotStateEvent[]>;

  // --- Health & Diagnostic ---
  ping(): Promise<{ ok: boolean; type: 'in-memory' | 'supabase'; message?: string }>;
}
