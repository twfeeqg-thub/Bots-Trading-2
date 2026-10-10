// Project Q — Bot Core: Central Bot Manager & Registry
// Manages the collection of bot instances in-memory, fully decoupled from persistence and trading SDKs.

import {
  BotConfig,
  BotType,
  CreateBotParams,
  BotState,
  BotCycle,
  BotTrade,
} from './types';
import { BotInstance } from './bot-instance';

export type BotRegistryListener = (bots: BotInstance[]) => void;

export class BotCoreManager {
  private static instance: BotCoreManager | null = null;
  private bots: Map<string, BotInstance> = new Map();
  private listeners: Set<BotRegistryListener> = new Set();

  private constructor() {
    // Seed with initial exemplar bots: one Range Bot and one Deal Bot
    this.seedDefaultBots();
  }

  public static getInstance(): BotCoreManager {
    if (!BotCoreManager.instance) {
      BotCoreManager.instance = new BotCoreManager();
    }
    return BotCoreManager.instance;
  }

  /**
   * Creates a new bot ensuring strict compliance with the two allowed types.
   */
  public createBot(params: CreateBotParams): BotInstance {
    // Type validation: strictly RANGE_BOT or DEAL_BOT
    if (params.type !== 'RANGE_BOT' && params.type !== 'DEAL_BOT') {
      throw new Error(`Invalid bot type "${params.type}". Only "RANGE_BOT" and "DEAL_BOT" are permitted.`);
    }

    const id = params.id || `bot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const config: BotConfig = {
      id,
      type: params.type,
      name: params.name.trim() || (params.type === 'RANGE_BOT' ? 'بوت المسار العرضي' : 'بوت الصفقة'),
      symbol: params.symbol.toUpperCase().trim(),
      entryAmount: params.entryAmount > 0 ? params.entryAmount : 100,
      entryMethod: params.entryMethod || 'SIGNAL',
      plannedEntryPrice: params.plannedEntryPrice ?? null,
      initialStopLoss: params.initialStopLoss || {
        type: 'PERCENT',
        value: 2.0, // Default 2%
      },
      tRuleConfig: params.tRuleConfig || {
        targetType: 'FIXED_PERCENT',
        targetValue: 3.0, // Default +3%
        t0Level: undefined,
        description: 'هدف ربح أولي V1',
      },
      xSettings:
        params.type === 'RANGE_BOT'
          ? params.xSettings || {
              enabled: true,
            }
          : undefined,
      alertSettings: {
        onEntry: params.alertSettings?.onEntry ?? true,
        onExit: params.alertSettings?.onExit ?? true,
        onError: params.alertSettings?.onError ?? true,
        onStateChange: params.alertSettings?.onStateChange ?? true,
      },
      extraConfig: params.extraConfig || {},
      createdAt: now,
      updatedAt: now,
    };

    const bot = new BotInstance(config);

    // Forward events to notify registry subscribers
    bot.onStateChange(() => this.notifyListeners());
    bot.onTradeUpdate(() => this.notifyListeners());

    this.bots.set(id, bot);
    this.notifyListeners();

    return bot;
  }

  public getBot(id: string): BotInstance | undefined {
    return this.bots.get(id);
  }

  public getAllBots(): BotInstance[] {
    return Array.from(this.bots.values());
  }

  /**
   * Registers an externally managed/restored BotInstance into the registry.
   */
  public registerBotInstance(bot: BotInstance): void {
    this.bots.set(bot.getId(), bot);
    bot.onStateChange(() => this.notifyListeners());
    bot.onTradeUpdate(() => this.notifyListeners());
    this.notifyListeners();
  }

  public deleteBot(id: string): boolean {
    const bot = this.bots.get(id);
    if (!bot) return false;

    // Do not allow deleting a bot if it has an open position
    if (bot.getState() === 'POSITION_OPEN') {
      throw new Error('لا يمكن حذف بوت لديه صفقة مفتوحة. يجب إغلاق الصفقة أولاً.');
    }

    const deleted = this.bots.delete(id);
    if (deleted) {
      this.notifyListeners();
    }
    return deleted;
  }

  public subscribe(listener: BotRegistryListener): () => void {
    this.listeners.add(listener);
    listener(this.getAllBots());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const list = this.getAllBots();
    this.listeners.forEach((fn) => {
      try {
        fn(list);
      } catch {
        // ignore errors in listeners
      }
    });
  }

  /**
   * Seed two reference bots (one of each supported type).
   */
  private seedDefaultBots(): void {
    // 1. Sideways Range Bot exemplar
    this.createBot({
      id: 'bot_range_eth_sample',
      type: 'RANGE_BOT',
      name: 'بوت المسار العرضي — ETH',
      symbol: 'ETHUSDT',
      entryAmount: 150,
      entryMethod: 'SIGNAL',
      initialStopLoss: { type: 'PERCENT', value: 2.5 },
      tRuleConfig: {
        targetType: 'FIXED_PERCENT',
        targetValue: 2.0,
        description: 'استهداف سقف القناة العرضية',
      },
      xSettings: {
        enabled: true,
        maxLevels: 3,
        stepPercent: 1.2,
        recoveryRatio: 1.2,
      },
      alertSettings: {
        onEntry: true,
        onExit: true,
        onError: true,
        onStateChange: true,
      },
    });

    // 2. Single Deal Bot exemplar
    this.createBot({
      id: 'bot_deal_sol_sample',
      type: 'DEAL_BOT',
      name: 'بوت صفقة الاختراق — SOL',
      symbol: 'SOLUSDT',
      entryAmount: 200,
      entryMethod: 'MARKET',
      initialStopLoss: { type: 'PERCENT', value: 3.0 },
      tRuleConfig: {
        targetType: 'FIXED_PERCENT',
        targetValue: 4.5,
        description: 'هدف فك الاختراق السعري',
      },
      alertSettings: {
        onEntry: true,
        onExit: true,
        onError: true,
        onStateChange: true,
      },
    });
  }
}

export const sharedBotManager = BotCoreManager.getInstance();
