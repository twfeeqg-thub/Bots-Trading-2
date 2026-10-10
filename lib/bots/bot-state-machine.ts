// Project Q — Bot Core: State Machine & Transition Rules
// Enforces strict deterministic transitions across the 11 V1 states.
// Prevents arbitrary or out-of-order state jumps, and supports safe error recovery.

import {
  BotState,
  BotErrorRecord,
  TransitionResult,
  ErrorRecoveryResult,
} from './types';

/**
 * Deterministic transition map for V1.
 * Maps each BotState to its allowed next states.
 */
export const ALLOWED_TRANSITIONS: Record<BotState, readonly BotState[]> = {
  // 10. STOPPED: Can start a new cycle to WAITING_FOR_ENTRY
  STOPPED: ['WAITING_FOR_ENTRY'],

  // 1. WAITING_FOR_ENTRY: Can begin monitoring, be stopped, or encounter an error
  WAITING_FOR_ENTRY: ['MONITORING_ENTRY', 'STOPPED', 'ERROR'],

  // 2. MONITORING_ENTRY: Can detect entry conditions, revert to wait, stop, or error
  MONITORING_ENTRY: ['ENTRY_TRIGGERED', 'WAITING_FOR_ENTRY', 'STOPPED', 'ERROR'],

  // 3. ENTRY_TRIGGERED: Can proceed to buy execution, cancel back to monitoring, stop, or error
  ENTRY_TRIGGERED: ['EXECUTING_BUY', 'MONITORING_ENTRY', 'STOPPED', 'ERROR'],

  // 4. EXECUTING_BUY: Can move to verification once sent, or error
  EXECUTING_BUY: ['VERIFYING_BUY', 'ERROR'],

  // 5. VERIFYING_BUY: Can confirm position open, retry buy execution, or error
  VERIFYING_BUY: ['POSITION_OPEN', 'EXECUTING_BUY', 'ERROR'],

  // 6. POSITION_OPEN: Can initiate sell execution (TP/SL/Rule), or error
  POSITION_OPEN: ['EXECUTING_SELL', 'ERROR'],

  // 7. EXECUTING_SELL: Can move to verification once sent, or error
  EXECUTING_SELL: ['VERIFYING_SELL', 'ERROR'],

  // 8. VERIFYING_SELL: Can confirm position closed, retry sell, or error
  VERIFYING_SELL: ['POSITION_CLOSED', 'EXECUTING_SELL', 'ERROR'],

  // 9. POSITION_CLOSED: Moves to STOPPED (V1 cycle completion; auto-restart deferred)
  POSITION_CLOSED: ['STOPPED'],

  // 11. ERROR: Allows controlled recovery to designated safe states based on context
  ERROR: [
    'STOPPED',
    'WAITING_FOR_ENTRY',
    'MONITORING_ENTRY',
    'EXECUTING_BUY',
    'POSITION_OPEN',
    'EXECUTING_SELL',
    'POSITION_CLOSED',
  ],
} as const;

/**
 * Safe recovery destinations based on the state where the error occurred.
 */
export const ALLOWED_ERROR_RECOVERIES: Record<BotState, readonly BotState[]> = {
  WAITING_FOR_ENTRY: ['STOPPED', 'WAITING_FOR_ENTRY'],
  MONITORING_ENTRY: ['STOPPED', 'WAITING_FOR_ENTRY', 'MONITORING_ENTRY'],
  ENTRY_TRIGGERED: ['STOPPED', 'MONITORING_ENTRY', 'WAITING_FOR_ENTRY'],
  EXECUTING_BUY: ['STOPPED', 'WAITING_FOR_ENTRY', 'EXECUTING_BUY'],
  VERIFYING_BUY: ['STOPPED', 'EXECUTING_BUY', 'POSITION_OPEN'],
  POSITION_OPEN: ['POSITION_OPEN', 'EXECUTING_SELL'],
  EXECUTING_SELL: ['EXECUTING_SELL', 'POSITION_OPEN'],
  VERIFYING_SELL: ['POSITION_CLOSED', 'EXECUTING_SELL'],
  POSITION_CLOSED: ['STOPPED'],
  STOPPED: ['STOPPED'],
  ERROR: ['STOPPED', 'WAITING_FOR_ENTRY'],
};

export class BotStateMachine {
  /**
   * Checks if a transition between two states is permitted.
   */
  public static canTransition(from: BotState, to: BotState): boolean {
    if (from === to) return false;
    const allowed = ALLOWED_TRANSITIONS[from];
    return Array.isArray(allowed) && allowed.includes(to);
  }

  /**
   * Validates a normal transition. Throws an error or returns validation failure if illegal.
   */
  public static validateTransition(from: BotState, to: BotState): TransitionResult {
    const timestamp = Date.now();
    if (from === to) {
      return {
        success: false,
        from,
        to,
        error: `Illegal transition: Target state (${to}) is identical to current state.`,
        timestamp,
      };
    }

    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      return {
        success: false,
        from,
        to,
        error: `Illegal state transition from "${from}" to "${to}". Allowed targets: [${(allowed || []).join(', ')}]`,
        timestamp,
      };
    }

    return {
      success: true,
      from,
      to,
      timestamp,
    };
  }

  /**
   * Validates recovery from an ERROR state to a designated safe state.
   */
  public static validateRecovery(
    errorRecord: BotErrorRecord | null,
    targetState: BotState
  ): ErrorRecoveryResult {
    const timestamp = Date.now();
    const stateAtError = errorRecord?.stateAtError || 'STOPPED';
    const allowedRecoveries = ALLOWED_ERROR_RECOVERIES[stateAtError] || ['STOPPED'];

    if (!allowedRecoveries.includes(targetState)) {
      return {
        success: false,
        recoveredState: targetState,
        previousError: errorRecord,
        timestamp,
        error: `Cannot recover to state "${targetState}" after error in "${stateAtError}". Allowed recoveries: [${allowedRecoveries.join(', ')}]`,
      };
    }

    return {
      success: true,
      recoveredState: targetState,
      previousError: errorRecord,
      timestamp,
    };
  }

  /**
   * Returns list of valid next states from a given state.
   */
  public static getNextAllowedStates(currentState: BotState): readonly BotState[] {
    return ALLOWED_TRANSITIONS[currentState] || [];
  }
}
