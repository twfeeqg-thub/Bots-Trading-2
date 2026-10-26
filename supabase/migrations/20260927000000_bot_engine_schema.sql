-- ==============================================================================
-- Project Q — Bot Engine: Supabase Database Schema (V1)
-- Migration: 20260927000000_bot_engine_schema.sql
-- Description: Creates persistent storage tables for Bot Engine:
--              1. bots: Master bot configurations and states
--              2. bot_cycles: Discrete operational cycles per bot
--              3. trades: Execution and trade status records
--              4. bot_state_events: Audit log for deterministic state transitions
-- Note: Strictly NO real trading execution logic, API keys, or financial accounting.
-- ==============================================================================

-- 1. Table: bots (Master Bot Configuration & Identity)
CREATE TABLE IF NOT EXISTS bots (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('RANGE_BOT', 'DEAL_BOT')),
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    entry_amount NUMERIC NOT NULL CHECK (entry_amount > 0),
    entry_method TEXT NOT NULL CHECK (entry_method IN ('MARKET', 'LIMIT', 'SIGNAL')),
    planned_entry_price NUMERIC NULL,
    initial_stop_loss JSONB NOT NULL,
    t_rule_config JSONB NOT NULL,
    x_settings JSONB NULL,
    alert_settings JSONB NOT NULL,
    current_state TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    extra_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for bots
CREATE INDEX IF NOT EXISTS idx_bots_type ON bots(type);
CREATE INDEX IF NOT EXISTS idx_bots_symbol ON bots(symbol);
CREATE INDEX IF NOT EXISTS idx_bots_current_state ON bots(current_state);
CREATE INDEX IF NOT EXISTS idx_bots_enabled ON bots(enabled);

-- 2. Table: bot_cycles (Individual Execution Cycles for a Bot)
CREATE TABLE IF NOT EXISTS bot_cycles (
    cycle_id TEXT PRIMARY KEY,
    bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    cycle_number INTEGER NOT NULL CHECK (cycle_number > 0),
    current_state TEXT NOT NULL,
    previous_state TEXT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NULL,
    active_trade_id TEXT NULL,
    last_error JSONB NULL,
    state_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for bot_cycles
CREATE INDEX IF NOT EXISTS idx_bot_cycles_bot_id ON bot_cycles(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_cycles_current_state ON bot_cycles(current_state);
CREATE INDEX IF NOT EXISTS idx_bot_cycles_ended_at ON bot_cycles(ended_at);

-- 3. Table: trades (Trade Record Associated with a Cycle)
CREATE TABLE IF NOT EXISTS trades (
    trade_id TEXT PRIMARY KEY,
    cycle_id TEXT NOT NULL REFERENCES bot_cycles(cycle_id) ON DELETE CASCADE,
    bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING_ENTRY', 'OPEN', 'PENDING_EXIT', 'CLOSED')),
    entry_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    exit_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    opened_at TIMESTAMPTZ NULL,
    closed_at TIMESTAMPTZ NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for trades
CREATE INDEX IF NOT EXISTS idx_trades_cycle_id ON trades(cycle_id);
CREATE INDEX IF NOT EXISTS idx_trades_bot_id ON trades(bot_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);

-- 4. Table: bot_state_events (Audit Log of All State Transitions and Recoveries)
CREATE TABLE IF NOT EXISTS bot_state_events (
    event_id TEXT PRIMARY KEY,
    bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    cycle_id TEXT NULL,
    previous_state TEXT NULL,
    new_state TEXT NOT NULL,
    event_type TEXT NOT NULL,
    reason TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for bot_state_events
CREATE INDEX IF NOT EXISTS idx_bot_state_events_bot_id ON bot_state_events(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_state_events_cycle_id ON bot_state_events(cycle_id);
CREATE INDEX IF NOT EXISTS idx_bot_state_events_created_at ON bot_state_events(created_at DESC);

-- Trigger to automatically update updated_at timestamp on row modification
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_bots_updated_at ON bots;
CREATE TRIGGER trg_bots_updated_at
    BEFORE UPDATE ON bots
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_bot_cycles_updated_at ON bot_cycles;
CREATE TRIGGER trg_bot_cycles_updated_at
    BEFORE UPDATE ON bot_cycles
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_trades_updated_at ON trades;
CREATE TRIGGER trg_trades_updated_at
    BEFORE UPDATE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();
