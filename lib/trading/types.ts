// Project Q — Binance Trading Layer (V1): Types & Interfaces
// Server-side only: Strictly no secrets in client or UI.
// Supports Buy, Sell (full & partial), Verify, Ambiguous states, and duplicate prevention.

/**
 * 1. Binance Spot Raw Order Statuses
 */
export type BinanceRawOrderStatus =
  | 'NEW'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'PENDING_CANCEL'
  | 'REJECTED'
  | 'EXPIRED'
  | 'EXPIRED_IN_MATCH';

export type BinanceOrderType = 'MARKET' | 'LIMIT';
export type BinanceOrderSide = 'BUY' | 'SELL';
export type BinanceTimeInForce = 'GTC' | 'IOC' | 'FOK';

/**
 * Raw Binance Fill structure from /api/v3/order
 */
export interface BinanceRawFill {
  price: string;
  qty: string;
  commission: string;
  commissionAsset: string;
  tradeId: number;
}

/**
 * Raw Binance POST /api/v3/order Response
 */
export interface BinanceRawOrderResponse {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: BinanceRawOrderStatus;
  timeInForce: BinanceTimeInForce;
  type: BinanceOrderType;
  side: BinanceOrderSide;
  workingTime?: number;
  fills?: BinanceRawFill[];
  code?: number;
  msg?: string;
}

/**
 * Raw Binance GET /api/v3/order Response (Query Order)
 */
export interface BinanceRawQueryOrderResponse {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: BinanceRawOrderStatus;
  timeInForce: BinanceTimeInForce;
  type: BinanceOrderType;
  side: BinanceOrderSide;
  stopPrice?: string;
  icebergQty?: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
  origQuoteOrderQty?: string;
  code?: number;
  msg?: string;
}

/**
 * 2. Trading Layer Execution Outcome
 * Clear explicit representation of deterministic results:
 * - SUCCESS: Order sent and fully confirmed executed on Binance.
 * - PARTIAL: Order partially executed on Binance.
 * - FAILED: Order was definitely rejected, canceled, or does not exist on Binance.
 * - AMBIGUOUS: Outcome is uncertain (network drop, timeout, 5xx). SENDING A SECOND ORDER IS FORBIDDEN. VERIFY FIRST.
 */
export type ExecutionOutcome = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'AMBIGUOUS';

/**
 * 3. Lock State for Preventing Duplicate Orders
 */
export type OperationLockState = 'IDLE' | 'IN_FLIGHT' | 'AMBIGUOUS_NEEDS_VERIFY';

export interface OperationLockRecord {
  lockKey: string;
  botId: string;
  cycleId?: string;
  symbol: string;
  side: BinanceOrderSide;
  clientOrderId: string;
  state: OperationLockState;
  orderId?: string | null;
  lockedAt: number;
  reason?: string;
}

/**
 * 4. Parameters for Buy Order
 */
export interface BuyOrderParams {
  botId: string;
  cycleId: string;
  symbol: string;
  /** Quote amount in USDT to buy with (e.g. 100 USDT) */
  quoteOrderQty?: number;
  /** Base asset quantity to buy (if known) */
  quantity?: number;
  orderType?: BinanceOrderType;
  price?: number;
  clientOrderId?: string;
}

/**
 * 5. Parameters for Sell Order
 */
export interface SellOrderParams {
  botId: string;
  cycleId: string;
  tradeId: string;
  symbol: string;
  /** Quantity of base asset to sell */
  quantity: number;
  orderType?: BinanceOrderType;
  price?: number;
  clientOrderId?: string;
  isPartial?: boolean;
}

/**
 * 6. Parameters for Order Verification
 */
export interface VerifyOrderParams {
  botId: string;
  symbol: string;
  orderId?: string | number | null;
  clientOrderId?: string | null;
}

/**
 * 7. Unified Result of Buy Execution
 */
export interface BuyExecutionResult {
  sent: boolean;
  orderId: string | null;
  clientOrderId: string;
  status: BinanceRawOrderStatus | 'UNKNOWN';
  outcome: ExecutionOutcome;
  isFinal: boolean;
  needsVerification: boolean;
  requestedAmount: number;
  executedQty: number;
  cummulativeQuoteQty: number;
  avgPrice: number | null;
  commission: {
    asset: string;
    amount: number;
  } | null;
  error?: string | null;
  raw?: BinanceRawOrderResponse | Record<string, unknown> | null;
  timestamp: number;
}

/**
 * 8. Unified Result of Sell Execution
 */
export interface SellExecutionResult {
  sent: boolean;
  orderId: string | null;
  clientOrderId: string;
  status: BinanceRawOrderStatus | 'UNKNOWN';
  outcome: ExecutionOutcome;
  isFinal: boolean;
  needsVerification: boolean;
  isPartial: boolean;
  requestedQty: number;
  executedQty: number;
  cummulativeQuoteQty: number;
  avgPrice: number | null;
  commission: {
    asset: string;
    amount: number;
  } | null;
  error?: string | null;
  raw?: BinanceRawOrderResponse | Record<string, unknown> | null;
  timestamp: number;
}

/**
 * 9. Unified Result of Order Verification Query
 */
export interface OrderVerificationResult {
  found: boolean;
  orderId: string | null;
  clientOrderId: string;
  status: BinanceRawOrderStatus | 'NOT_FOUND' | 'UNKNOWN';
  outcome: ExecutionOutcome;
  isFinal: boolean;
  needsVerification: boolean;
  origQty: number;
  executedQty: number;
  cummulativeQuoteQty: number;
  avgPrice: number | null;
  side: BinanceOrderSide | 'UNKNOWN';
  error?: string | null;
  raw?: BinanceRawQueryOrderResponse | Record<string, unknown> | null;
  timestamp: number;
}

/**
 * 10. Low-level Transport Interface (allows real HTTP or mock testing without secrets)
 */
export interface IBinanceTransport {
  sendOrder(params: {
    symbol: string;
    side: BinanceOrderSide;
    type: BinanceOrderType;
    quantity?: number;
    quoteOrderQty?: number;
    price?: number;
    timeInForce?: BinanceTimeInForce;
    newClientOrderId: string;
  }): Promise<BinanceRawOrderResponse>;

  queryOrder(params: {
    symbol: string;
    orderId?: number;
    origClientOrderId?: string;
  }): Promise<BinanceRawQueryOrderResponse>;

  cancelOrder(params: {
    symbol: string;
    orderId?: number;
    origClientOrderId?: string;
  }): Promise<BinanceRawOrderResponse>;
}
