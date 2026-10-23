// Project Q — Bot Core: Bot Instance
// Encapsulates a single bot entity, managing its configuration, distinct execution cycles,
// and resulting trades with strict separation of concerns.

import {
  BotConfig,
  BotCycle,
  BotTrade,
  BotState,
  BotErrorRecord,
  TransitionResult,
  ErrorRecoveryResult,
  TradeEntryExecution,
  TradeExitExecution,
  BotStateChangeListener,
  BotTradeUpdateListener,
  BotErrorListener,
} from './types';
import { BotStateMachine } from './bot-state-machine';

export class BotInstance {
  private config: BotConfig;
  private currentCycle: BotCycle | null = null;
  private currentTrade: BotTrade | null = null;
  private cycleCounter: number = 0;

  // Listeners for decoupled events
  private stateChangeListeners: Set<BotStateChangeListener> = new Set();
  private tradeUpdateListeners: Set<BotTradeUpdateListener> = new Set();
  private errorListeners: Set<BotErrorListener> = new Set();

  constructor(config: BotConfig) {
    this.config = { ...config };
  }

  // --- Getters ---

  public getConfig(): Readonly<BotConfig> {
    return this.config;
  }

  public getId(): string {
    return this.config.id;
  }

  public getType() {
    return this.config.type;
  }

  public getName(): string {
    return this.config.name;
  }

  public getSymbol(): string {
    return this.config.symbol;
  }

  public getState(): BotState {
    return this.currentCycle ? this.currentCycle.currentState : 'STOPPED';
  }

  public getCurrentCycle(): Readonly<BotCycle> | null {
    return this.currentCycle;
  }

  public getCurrentTrade(): Readonly<BotTrade> | null {
    return this.currentTrade;
  }

  public getCycleCount(): number {
    return this.cycleCounter;
  }

  /**
   * Restores an existing cycle and trade from persistence without creating a new cycle.
   * Crucial for engine recovery after restart.
   */
  public restoreState(cycle: BotCycle | null, trade?: BotTrade | null): void {
    if (cycle) {
      this.currentCycle = { ...cycle };
      this.cycleCounter = Math.max(this.cycleCounter, cycle.cycleNumber);
    }
    if (trade) {
      this.currentTrade = { ...trade };
    }
  }

  // --- Listeners Subscriptions ---

  public onStateChange(listener: BotStateChangeListener): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  public onTradeUpdate(listener: BotTradeUpdateListener): () => void {
    this.tradeUpdateListeners.add(listener);
    return () => this.tradeUpdateListeners.delete(listener);
  }

  public onError(listener: BotErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  // --- V1 Lifecycle Actions ---

  /**
   * Starts a new cycle. Transitions from STOPPED to WAITING_FOR_ENTRY.
   */
  public start(): TransitionResult {
    const currentState = this.getState();
    const validation = BotStateMachine.validateTransition(currentState, 'WAITING_FOR_ENTRY');
    if (!validation.success) {
      return validation;
    }

    this.cycleCounter += 1;
    const now = Date.now();
    const newCycle: BotCycle = {
      cycleId: `cycle_${this.config.id}_${this.cycleCounter}_${now}`,
      botId: this.config.id,
      cycleNumber: this.cycleCounter,
      currentState: 'WAITING_FOR_ENTRY',
      previousState: currentState,
      startedAt: now,
      endedAt: null,
      stateHistory: [
        {
          from: currentState,
          to: 'WAITING_FOR_ENTRY',
          timestamp: now,
          reason: 'بدء دورة تشغيل جديدة للبوت (Start new cycle)',
        },
      ],
      activeTradeId: null,
      lastError: null,
    };

    this.currentCycle = newCycle;
    this.currentTrade = null;
    this.emitStateChange(currentState, 'WAITING_FOR_ENTRY');

    return {
      success: true,
      from: currentState,
      to: 'WAITING_FOR_ENTRY',
      timestamp: now,
    };
  }

  /**
   * Step 2: Transitions from WAITING_FOR_ENTRY to MONITORING_ENTRY.
   */
  public startMonitoring(): TransitionResult {
    return this.transitionTo('MONITORING_ENTRY', 'بدء مراقبة شروط الدخول (Start monitoring entry)');
  }

  /**
   * Step 3: Transitions from MONITORING_ENTRY to ENTRY_TRIGGERED.
   */
  public triggerEntry(reason: string = 'تحقق شروط الدخول (Entry condition triggered)'): TransitionResult {
    return this.transitionTo('ENTRY_TRIGGERED', reason);
  }

  /**
   * Step 4: Transitions from ENTRY_TRIGGERED to EXECUTING_BUY.
   * Instantiates a new BotTrade record decoupled from the cycle.
   */
  public startBuyExecution(entryDetails?: Partial<TradeEntryExecution>): TransitionResult {
    const res = this.transitionTo('EXECUTING_BUY', 'إرسال أمر الشراء (Dispatch buy execution)');
    if (!res.success) return res;

    const now = Date.now();
    const tradeId = `trade_${this.config.id}_${this.cycleCounter}_${now}`;
    const newTrade: BotTrade = {
      tradeId,
      cycleId: this.currentCycle!.cycleId,
      botId: this.config.id,
      symbol: this.config.symbol,
      status: 'PENDING_ENTRY',
      entry: {
        requestedAmount: this.config.entryAmount,
        plannedPrice: this.config.plannedEntryPrice,
        executionPrice: entryDetails?.executionPrice ?? null,
        filledQuantity: entryDetails?.filledQuantity ?? null,
        executedAt: entryDetails?.executedAt ?? null,
        orderId: entryDetails?.orderId ?? null,
      },
      exit: {},
      openedAt: null,
      closedAt: null,
      notes: 'تم البدء في تنفيذ الشراء',
    };

    this.currentTrade = newTrade;
    this.currentCycle!.activeTradeId = tradeId;
    this.emitTradeUpdate();

    return res;
  }

  /**
   * Step 5: Transitions from EXECUTING_BUY to VERIFYING_BUY.
   */
  public confirmBuyVerification(details?: Partial<TradeEntryExecution>): TransitionResult {
    const res = this.transitionTo('VERIFYING_BUY', 'التحقق من تنفيذ أمر الشراء (Verifying buy fill)');
    if (res.success && this.currentTrade && details) {
      if (details.executionPrice !== undefined) this.currentTrade.entry.executionPrice = details.executionPrice;
      if (details.filledQuantity !== undefined) this.currentTrade.entry.filledQuantity = details.filledQuantity;
      if (details.executedAt !== undefined) this.currentTrade.entry.executedAt = details.executedAt;
      if (details.orderId !== undefined) this.currentTrade.entry.orderId = details.orderId;
      this.emitTradeUpdate();
    }
    return res;
  }

  /**
   * Step 6: Transitions from VERIFYING_BUY to POSITION_OPEN.
   * Confirms position is open.
   */
  public openPosition(params?: {
    executionPrice?: number;
    filledQuantity?: number;
    orderId?: string;
  }): TransitionResult {
    const res = this.transitionTo('POSITION_OPEN', 'تأكيد فتح الصفقة بنجاح (Position opened successfully)');
    if (res.success && this.currentTrade) {
      const now = Date.now();
      this.currentTrade.status = 'OPEN';
      this.currentTrade.openedAt = now;
      if (params?.executionPrice !== undefined) this.currentTrade.entry.executionPrice = params.executionPrice;
      if (params?.filledQuantity !== undefined) this.currentTrade.entry.filledQuantity = params.filledQuantity;
      if (params?.orderId !== undefined) this.currentTrade.entry.orderId = params.orderId;
      this.currentTrade.notes = 'الصفقة مفتوحة وتخضع للمراقبة';
      this.emitTradeUpdate();
    }
    return res;
  }

  /**
   * Records additional recovery volume and updates weighted average entry execution price
   * for a RANGE_BOT during an active POSITION_OPEN state.
   */
  public recordRecoveryEntry(params: {
    executionPrice: number;
    filledQuantity: number;
    notes?: string;
  }): void {
    if (this.currentTrade) {
      this.currentTrade.entry.executionPrice = params.executionPrice;
      this.currentTrade.entry.filledQuantity = params.filledQuantity;
      if (params.notes) {
        this.currentTrade.notes = params.notes;
      }
      this.emitTradeUpdate();
    }
  }

  /**
   * Step 7: Transitions from POSITION_OPEN to EXECUTING_SELL.
   */
  public startSellExecution(params?: {
    reason?: string;
    plannedPrice?: number;
  }): TransitionResult {
    const reasonText = params?.reason || 'تحقق شرط الخروج / الهدف / وقف الخسارة (Exit condition met)';
    const res = this.transitionTo('EXECUTING_SELL', reasonText);
    if (res.success && this.currentTrade) {
      this.currentTrade.status = 'PENDING_EXIT';
      this.currentTrade.exit.reason = reasonText;
      if (params?.plannedPrice !== undefined) this.currentTrade.exit.plannedPrice = params.plannedPrice;
      this.emitTradeUpdate();
    }
    return res;
  }

  /**
   * Reverts bot from EXECUTING_SELL or VERIFYING_SELL back to POSITION_OPEN if sell order failed.
   */
  public revertSellToPositionOpen(reason?: string): TransitionResult {
    const reasonText = reason || 'فشل إرسال أمر البيع؛ عودة المركز للمراقبة بمستويات T';
    const res = this.transitionTo('POSITION_OPEN', reasonText);
    if (res.success && this.currentTrade) {
      this.currentTrade.status = 'OPEN';
      this.currentTrade.notes = reasonText;
      this.emitTradeUpdate();
    }
    return res;
  }

  /**
   * Step 8: Transitions from EXECUTING_SELL to VERIFYING_SELL.
   */
  public confirmSellVerification(details?: Partial<TradeExitExecution>): TransitionResult {
    const res = this.transitionTo('VERIFYING_SELL', 'التحقق من تنفيذ أمر البيع (Verifying sell fill)');
    if (res.success && this.currentTrade && details) {
      if (details.executionPrice !== undefined) this.currentTrade.exit.executionPrice = details.executionPrice;
      if (details.filledQuantity !== undefined) this.currentTrade.exit.filledQuantity = details.filledQuantity;
      if (details.executedAt !== undefined) this.currentTrade.exit.executedAt = details.executedAt;
      if (details.orderId !== undefined) this.currentTrade.exit.orderId = details.orderId;
      this.emitTradeUpdate();
    }
    return res;
  }

  /**
   * Confirms a partial sale execution: updates remaining open quantity and returns bot to POSITION_OPEN.
   */
  public recordPartialSell(params: {
    executionPrice?: number;
    soldQuantity: number;
    remainingQuantity: number;
    orderId?: string;
  }): TransitionResult {
    const currentState = this.getState();
    if (currentState === 'EXECUTING_SELL') {
      this.transitionTo('VERIFYING_SELL', 'التحقق من تنفيذ البيع الجزئي');
    }
    const res = this.transitionTo(
      'POSITION_OPEN',
      `تأكيد بيع جزئي (${params.soldQuantity}) وبقاء الكمية المتبقية (${params.remainingQuantity}) مفتوحة`
    );

    if (this.currentTrade) {
      this.currentTrade.status = 'OPEN';
      this.currentTrade.entry.filledQuantity = params.remainingQuantity;
      this.currentTrade.notes = `تم تنفيذ بيع جزئي: ${params.soldQuantity}، الكمية المتبقية: ${params.remainingQuantity} مفتوحة وتحت المراقبة`;
      this.emitTradeUpdate();
    }
    return res;
  }

  /**
   * Step 9: Transitions from VERIFYING_SELL to POSITION_CLOSED.
   * Confirms position liquidation.
   */
  public closePosition(params?: {
    executionPrice?: number;
    filledQuantity?: number;
    orderId?: string;
  }): TransitionResult {
    const res = this.transitionTo('POSITION_CLOSED', 'تم إغلاق الصفقة بنجاح وتأكيد الخروج (Position closed)');
    if (res.success && this.currentTrade) {
      const now = Date.now();
      this.currentTrade.status = 'CLOSED';
      this.currentTrade.closedAt = now;
      if (params?.executionPrice !== undefined) this.currentTrade.exit.executionPrice = params.executionPrice;
      if (params?.filledQuantity !== undefined) this.currentTrade.exit.filledQuantity = params.filledQuantity;
      if (params?.orderId !== undefined) this.currentTrade.exit.orderId = params.orderId;
      this.currentTrade.notes = 'تم إغلاق الصفقة وتوثيق نتيجتها';
      this.emitTradeUpdate();
    }
    return res;
  }

  /**
   * Step 10: Transitions from POSITION_CLOSED to STOPPED.
   * Ends the V1 cycle. (Auto-restart of a new cycle is deferred).
   */
  public finishCycle(): TransitionResult {
    const currentState = this.getState();
    const validation = BotStateMachine.validateTransition(currentState, 'STOPPED');
    if (!validation.success) {
      return validation;
    }

    const now = Date.now();
    if (this.currentCycle) {
      this.currentCycle.endedAt = now;
      this.currentCycle.previousState = currentState;
      this.currentCycle.currentState = 'STOPPED';
      this.currentCycle.stateHistory.push({
        from: currentState,
        to: 'STOPPED',
        timestamp: now,
        reason: 'اكتمال دورة V1 وتوقف البوت بنجاح (Cycle completed, bot stopped)',
      });
    }

    this.emitStateChange(currentState, 'STOPPED');

    return {
      success: true,
      from: currentState,
      to: 'STOPPED',
      timestamp: now,
    };
  }

  /**
   * Manual stop: can be invoked from early pre-trade states to safely halt.
   */
  public stop(reason: string = 'إيقاف يدوي للبوت (Manual stop)'): TransitionResult {
    const currentState = this.getState();
    const validation = BotStateMachine.validateTransition(currentState, 'STOPPED');
    if (!validation.success) {
      return validation;
    }

    const now = Date.now();
    if (this.currentCycle) {
      this.currentCycle.endedAt = now;
      this.currentCycle.previousState = currentState;
      this.currentCycle.currentState = 'STOPPED';
      this.currentCycle.stateHistory.push({
        from: currentState,
        to: 'STOPPED',
        timestamp: now,
        reason,
      });
    }

    this.emitStateChange(currentState, 'STOPPED');

    return {
      success: true,
      from: currentState,
      to: 'STOPPED',
      timestamp: now,
    };
  }

  /**
   * Transitions from current state to ERROR.
   * Records error details in the cycle without losing cycle or trade context.
   */
  public fail(errorCode: string, errorMessage: string, recoverable: boolean = true): TransitionResult {
    const currentState = this.getState();
    const now = Date.now();

    const errorRecord: BotErrorRecord = {
      code: errorCode,
      message: errorMessage,
      timestamp: now,
      stateAtError: currentState,
      recoverable,
    };

    if (this.currentCycle) {
      this.currentCycle.lastError = errorRecord;
      this.currentCycle.previousState = currentState;
      this.currentCycle.currentState = 'ERROR';
      this.currentCycle.stateHistory.push({
        from: currentState,
        to: 'ERROR',
        timestamp: now,
        reason: `[${errorCode}] ${errorMessage}`,
      });
    }

    this.emitStateChange(currentState, 'ERROR');
    this.emitError(errorRecord);

    return {
      success: true,
      from: currentState,
      to: 'ERROR',
      error: `[${errorCode}] ${errorMessage}`,
      timestamp: now,
    };
  }

  /**
   * Recovers from ERROR state to a designated safe state.
   */
  public recover(targetState: BotState, reason: string = 'استرداد آمن بعد معالجة الخطأ (Error recovery)'): ErrorRecoveryResult {
    if (this.getState() !== 'ERROR') {
      return {
        success: false,
        recoveredState: this.getState(),
        previousError: this.currentCycle?.lastError ?? null,
        timestamp: Date.now(),
        error: `Bot is not in ERROR state (Current: ${this.getState()}).`,
      };
    }

    const lastError = this.currentCycle?.lastError || null;
    const recoveryValidation = BotStateMachine.validateRecovery(lastError, targetState);
    if (!recoveryValidation.success) {
      return recoveryValidation;
    }

    const now = Date.now();
    if (this.currentCycle) {
      this.currentCycle.previousState = 'ERROR';
      this.currentCycle.currentState = targetState;
      this.currentCycle.stateHistory.push({
        from: 'ERROR',
        to: targetState,
        timestamp: now,
        reason,
      });

      if (targetState === 'STOPPED') {
        this.currentCycle.endedAt = now;
      }
    }

    this.emitStateChange('ERROR', targetState);

    return {
      success: true,
      recoveredState: targetState,
      previousError: lastError,
      timestamp: now,
    };
  }

  // --- Internal Helpers ---

  private transitionTo(to: BotState, reason?: string): TransitionResult {
    const currentState = this.getState();
    const validation = BotStateMachine.validateTransition(currentState, to);
    if (!validation.success) {
      return validation;
    }

    const now = Date.now();
    if (this.currentCycle) {
      this.currentCycle.previousState = currentState;
      this.currentCycle.currentState = to;
      this.currentCycle.stateHistory.push({
        from: currentState,
        to,
        timestamp: now,
        reason,
      });
    }

    this.emitStateChange(currentState, to);

    return {
      success: true,
      from: currentState,
      to,
      timestamp: now,
    };
  }

  private emitStateChange(from: BotState, to: BotState): void {
    if (!this.currentCycle) return;
    this.stateChangeListeners.forEach((listener) => {
      try {
        listener(this.config.id, from, to, this.currentCycle!);
      } catch {
        // ignore listener errors
      }
    });
  }

  private emitTradeUpdate(): void {
    if (!this.currentTrade) return;
    this.tradeUpdateListeners.forEach((listener) => {
      try {
        listener(this.config.id, this.currentTrade!);
      } catch {
        // ignore listener errors
      }
    });
  }

  private emitError(error: BotErrorRecord): void {
    this.errorListeners.forEach((listener) => {
      try {
        listener(this.config.id, error);
      } catch {
        // ignore listener errors
      }
    });
  }
}
