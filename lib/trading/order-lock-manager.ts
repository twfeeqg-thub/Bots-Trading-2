// Project Q — Binance Trading Layer: Order Lock & Duplicate Prevention Manager
// Enforces that NO second order can be dispatched while an order is in flight or ambiguous.
// In ambiguous states (network drops, timeouts, 5xx), caller must VERIFY first before any subsequent send.

import { BinanceOrderSide, OperationLockRecord, OperationLockState } from './types';

export class OrderLockManager {
  private static instance: OrderLockManager | null = null;
  // Key: `botId:${side}` or `botId`
  private locks: Map<string, OperationLockRecord> = new Map();

  public static getInstance(): OrderLockManager {
    if (!OrderLockManager.instance) {
      OrderLockManager.instance = new OrderLockManager();
    }
    return OrderLockManager.instance;
  }

  private makeKey(botId: string, side?: BinanceOrderSide): string {
    return side ? `${botId}:${side}` : botId;
  }

  /**
   * Checks whether a new order can be dispatched for this bot and operation.
   * If locked or ambiguous, disallowing is strictly enforced.
   */
  public canSend(botId: string, side: BinanceOrderSide): { allowed: boolean; reason?: string; lock?: OperationLockRecord } {
    const key = this.makeKey(botId, side);
    const existing = this.locks.get(key);

    if (!existing || existing.state === 'IDLE') {
      return { allowed: true };
    }

    if (existing.state === 'IN_FLIGHT') {
      return {
        allowed: false,
        reason: `يوجد أمر ${side} قيد التنفيذ حاليًا للرمز ${existing.symbol} (clientOrderId: ${existing.clientOrderId}). يمنع إرسال أمر ثانٍ قبل حسم الأول.`,
        lock: existing,
      };
    }

    if (existing.state === 'AMBIGUOUS_NEEDS_VERIFY') {
      return {
        allowed: false,
        reason: `أمر ${side} السابق للرمز ${existing.symbol} في حالة غامضة تحتاج إلى تحقق (VERIFY). يمنع إرسال أمر جديد قبل التحقق من Binance واستبيان مصير الأمر (clientOrderId: ${existing.clientOrderId}).`,
        lock: existing,
      };
    }

    return { allowed: true };
  }

  /**
   * Acquires the lock before dispatching an order to Binance.
   */
  public acquireLock(
    botId: string,
    side: BinanceOrderSide,
    symbol: string,
    clientOrderId: string,
    cycleId?: string
  ): { acquired: boolean; reason?: string } {
    const check = this.canSend(botId, side);
    if (!check.allowed) {
      return { acquired: false, reason: check.reason };
    }

    const key = this.makeKey(botId, side);
    const record: OperationLockRecord = {
      lockKey: key,
      botId,
      cycleId,
      symbol,
      side,
      clientOrderId,
      state: 'IN_FLIGHT',
      lockedAt: Date.now(),
    };

    this.locks.set(key, record);
    return { acquired: true };
  }

  /**
   * Sets the lock state to AMBIGUOUS_NEEDS_VERIFY upon network error, timeout, or unclear response.
   */
  public markAmbiguous(botId: string, side: BinanceOrderSide, clientOrderId: string, reason: string): void {
    const key = this.makeKey(botId, side);
    const record = this.locks.get(key);
    if (record && record.clientOrderId === clientOrderId) {
      record.state = 'AMBIGUOUS_NEEDS_VERIFY';
      record.reason = reason;
    } else {
      this.locks.set(key, {
        lockKey: key,
        botId,
        symbol: '',
        side,
        clientOrderId,
        state: 'AMBIGUOUS_NEEDS_VERIFY',
        lockedAt: Date.now(),
        reason,
      });
    }
  }

  /**
   * Releases the lock once the order outcome is definitively determined (e.g. FILLED, CANCELED, REJECTED, NOT_FOUND).
   */
  public releaseLock(botId: string, side: BinanceOrderSide, clientOrderId?: string): void {
    const key = this.makeKey(botId, side);
    const record = this.locks.get(key);
    if (!record) return;

    if (!clientOrderId || record.clientOrderId === clientOrderId) {
      this.locks.delete(key);
    }
  }

  /**
   * Returns current active lock record if any.
   */
  public getLock(botId: string, side: BinanceOrderSide): OperationLockRecord | undefined {
    return this.locks.get(this.makeKey(botId, side));
  }

  /**
   * Clears all locks (for testing or emergency manual reset).
   */
  public clearAll(): void {
    this.locks.clear();
  }
}

export const sharedOrderLockManager = OrderLockManager.getInstance();
