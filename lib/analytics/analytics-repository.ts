// Project Q — Analytics Repository: Raw Facts & Historical Store
// Stores immutable atomic events and historical trade analytical snapshots.
// Pure passive persistence layer with zero side effects on the trading engine.

import { RawAnalyticsEvent, TradeAnalyticsRecord } from './types';

export class AnalyticsRepository {
  private static instance: AnalyticsRepository | null = null;
  private events: RawAnalyticsEvent[] = [];
  private tradeRecords: Map<string, TradeAnalyticsRecord> = new Map();
  private maxEventsCapacity: number = 10000;

  private constructor() {}

  public static getInstance(): AnalyticsRepository {
    if (!AnalyticsRepository.instance) {
      AnalyticsRepository.instance = new AnalyticsRepository();
    }
    return AnalyticsRepository.instance;
  }

  /**
   * Records an immutable raw event in chronological order.
   */
  public logEvent(event: Omit<RawAnalyticsEvent, 'eventId'>): RawAnalyticsEvent {
    const fullEvent: RawAnalyticsEvent = {
      ...event,
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };

    this.events.push(fullEvent);
    if (this.events.length > this.maxEventsCapacity) {
      this.events.shift(); // rolling buffer
    }

    return fullEvent;
  }

  /**
   * Upserts a compiled trade analytics record.
   */
  public saveTradeRecord(record: TradeAnalyticsRecord): void {
    this.tradeRecords.set(record.tradeId, { ...record });
  }

  /**
   * Retrieves a specific trade record.
   */
  public getTradeRecord(tradeId: string): TradeAnalyticsRecord | undefined {
    return this.tradeRecords.get(tradeId);
  }

  /**
   * Lists all historical trade records.
   */
  public listTradeRecords(): TradeAnalyticsRecord[] {
    return Array.from(this.tradeRecords.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );
  }

  /**
   * Queries trade records by specific filter criteria.
   */
  public queryTradeRecords(filter: {
    botId?: string;
    botType?: string;
    symbol?: string;
    status?: string;
    outcome?: string;
    fromTimestamp?: number;
    toTimestamp?: number;
  }): TradeAnalyticsRecord[] {
    return this.listTradeRecords().filter((record) => {
      if (filter.botId && record.botId !== filter.botId) return false;
      if (filter.botType && record.botType !== filter.botType) return false;
      if (filter.symbol && record.symbol !== filter.symbol.toUpperCase()) return false;
      if (filter.status && record.status !== filter.status) return false;
      if (filter.outcome && record.outcome !== filter.outcome) return false;
      if (filter.fromTimestamp && record.createdAt < filter.fromTimestamp) return false;
      if (filter.toTimestamp && record.createdAt > filter.toTimestamp) return false;
      return true;
    });
  }

  /**
   * Retrieves raw events for a trade or bot.
   */
  public getEvents(filter?: { tradeId?: string; botId?: string; limit?: number }): RawAnalyticsEvent[] {
    let result = this.events;
    if (filter?.tradeId) {
      result = result.filter((e) => e.tradeId === filter.tradeId);
    }
    if (filter?.botId) {
      result = result.filter((e) => e.botId === filter.botId);
    }
    const limit = filter?.limit || 200;
    return result.slice(-limit).reverse();
  }

  /**
   * Exports entire historical database as a pure raw JSON string.
   */
  public exportRawHistoryJSON(): string {
    return JSON.stringify(
      {
        exportedAt: Date.now(),
        totalEvents: this.events.length,
        totalTrades: this.tradeRecords.size,
        events: this.events,
        trades: this.listTradeRecords(),
      },
      null,
      2
    );
  }

  /**
   * Clears repository for clean test execution.
   */
  public clear(): void {
    this.events = [];
    this.tradeRecords.clear();
  }
}

export const sharedAnalyticsRepository = AnalyticsRepository.getInstance();
