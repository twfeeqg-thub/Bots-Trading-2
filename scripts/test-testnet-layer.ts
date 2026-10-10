// Project Q — Binance Spot Testnet Preparation Test Suite
// Verifies configuration safety, HMAC-SHA256 signing with synthetic data,
// Testnet/Production strict isolation, precision filters, and zero secret leakage.

import {
  BinanceSigner,
  BinanceTradingClient,
  BinanceTradingService,
  MockBinanceTransport,
  OrderLockManager,
} from '../lib/trading';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string): void {
  totalTests++;
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✓ Test #${passedTests} PASS: ${message}`);
}

async function runTestnetTestSuite() {
  console.log('================================================================');
  console.log('  Executing Binance Spot Testnet Layer Safety Test Suite');
  console.log('================================================================\n');

  // --- 1. Synthetic HMAC-SHA256 Signing Verification ---
  console.log('--- Suite 1: Synthetic HMAC-SHA256 Signature Accuracy ---');
  const syntheticKey = 'synthetic_testnet_api_key_sample_32chars_long';
  const syntheticSecret = 'synthetic_testnet_secret_key_sample_32chars';

  const syntheticSigner = new BinanceSigner({
    apiKey: syntheticKey,
    apiSecret: syntheticSecret,
    environment: 'testnet',
    testnetTradingEnabled: true,
    baseUrl: 'https://testnet.binance.vision',
  });

  const signedQuery = syntheticSigner.signParams({
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'MARKET',
    quoteOrderQty: '100',
  });

  assert(signedQuery.includes('symbol=BTCUSDT'), 'Query string contains symbol');
  assert(signedQuery.includes('side=BUY'), 'Query string contains side');
  assert(signedQuery.includes('quoteOrderQty=100'), 'Query string contains quoteOrderQty');
  assert(signedQuery.includes('timestamp='), 'Query string contains timestamp');
  assert(signedQuery.includes('recvWindow=5000'), 'Query string contains default recvWindow 5000');
  assert(signedQuery.includes('&signature='), 'Query string contains HMAC signature parameter');
  assert(!signedQuery.includes(syntheticSecret), 'Query string strictly does NOT leak the secret key');

  // --- 2. Server Time Synchronization & Offset Calculation ---
  console.log('\n--- Suite 2: Server Time Offset Handling ---');
  const originalTime = Date.now();
  syntheticSigner.setTimeOffset(4500); // 4.5 seconds server lead offset
  assert(syntheticSigner.getTimeOffset() === 4500, 'Time offset is correctly recorded');

  const offsetSignedQuery = syntheticSigner.signParams({ symbol: 'ETHUSDT' });
  const params = new URLSearchParams(offsetSignedQuery);
  const queryTs = Number(params.get('timestamp'));
  assert(queryTs >= originalTime + 4400, 'Signed timestamp includes the synchronized server time offset');
  syntheticSigner.setTimeOffset(0); // reset

  // --- 3. Configuration Safety & Rejection of Conflicting / Incomplete Settings ---
  console.log('\n--- Suite 3: Configuration Safety Gates ---');

  // 3.1 Rejection of Missing Credentials
  const missingCredsSigner = new BinanceSigner({
    environment: 'testnet',
    testnetTradingEnabled: true,
    apiKey: '',
    apiSecret: '',
  });
  const missingStatus = missingCredsSigner.getConfigurationStatus();
  assert(missingStatus.valid === false, 'Missing credentials evaluate to valid === false');
  assert(Boolean(missingStatus.error?.includes('Missing required credentials')), 'Error explicitly identifies missing credentials');

  // 3.2 Rejection of Conflicting Flags (Both LIVE and TESTNET enabled)
  const conflictingFlagsSigner = new BinanceSigner({
    environment: 'testnet',
    testnetTradingEnabled: true,
    liveTradingEnabled: true,
    apiKey: syntheticKey,
    apiSecret: syntheticSecret,
  });
  const conflictStatus = conflictingFlagsSigner.getConfigurationStatus();
  assert(conflictStatus.valid === false, 'Both LIVE and TESTNET flags active evaluates to valid === false');
  assert(Boolean(conflictStatus.error?.includes('Conflicting configuration')), 'Error explicitly identifies conflicting flags');

  // 3.3 Rejection of Production URL in Testnet Mode
  const prodUrlInTestnetSigner = new BinanceSigner({
    environment: 'testnet',
    testnetTradingEnabled: true,
    baseUrl: 'https://api.binance.com',
    apiKey: syntheticKey,
    apiSecret: syntheticSecret,
  });
  const prodUrlStatus = prodUrlInTestnetSigner.getConfigurationStatus();
  assert(prodUrlStatus.valid === false, 'Production URL in Testnet mode evaluates to valid === false');
  assert(Boolean(prodUrlStatus.error?.includes('Production URL')), 'Error strictly forbids Production URL in Testnet mode');

  // 3.4 Default Testnet URL Safety (never defaults to api.binance.com)
  const defaultTestnetUrlSigner = new BinanceSigner({
    environment: 'testnet',
    testnetTradingEnabled: true,
    apiKey: syntheticKey,
    apiSecret: syntheticSecret,
  });
  assert(defaultTestnetUrlSigner.getBaseUrl() === 'https://testnet.binance.vision', 'Testnet mode automatically defaults to https://testnet.binance.vision');

  // 3.5 Rejection when Testnet Trading Flag is false
  const disabledTestnetSigner = new BinanceSigner({
    environment: 'testnet',
    testnetTradingEnabled: false,
    apiKey: syntheticKey,
    apiSecret: syntheticSecret,
  });
  assert(disabledTestnetSigner.hasCredentials() === false, 'hasCredentials is false when BINANCE_TESTNET_TRADING_ENABLED is false');

  // 3.6 Testnet Keys containing "test" are NOT blocked
  const testSubkeySigner = new BinanceSigner({
    environment: 'testnet',
    testnetTradingEnabled: true,
    apiKey: 'binance_testnet_key_with_test_in_name_123',
    apiSecret: 'binance_testnet_secret_with_test_in_name_123',
  });
  assert(testSubkeySigner.hasCredentials() === true, 'Testnet credentials containing the substring "test" are accepted in Testnet mode');

  // --- 4. Outbound Request Blocking Guards ---
  console.log('\n--- Suite 4: Outbound Network Call Blocking Guards ---');
  const clientWithDisabledConfig = new BinanceTradingClient(disabledTestnetSigner);
  let blockedSendCaught = false;
  try {
    await clientWithDisabledConfig.sendOrder({
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'MARKET',
      quoteOrderQty: 10,
      newClientOrderId: 'TEST_SAFETY_GUARD',
    });
  } catch (err: unknown) {
    if ((err as Error).message.includes('Outbound call blocked')) {
      blockedSendCaught = true;
    }
  }
  assert(blockedSendCaught === true, 'BinanceTradingClient strictly blocks outbound sendOrder when testnet trading is disabled');

  const clientWithProdUrlInTestnet = new BinanceTradingClient(prodUrlInTestnetSigner);
  let blockedProdUrlCaught = false;
  try {
    await clientWithProdUrlInTestnet.queryOrder({
      symbol: 'BTCUSDT',
      origClientOrderId: 'TEST_PROD_URL_BLOCKED',
    });
  } catch (err: unknown) {
    if ((err as Error).message.includes('Outbound call blocked')) {
      blockedProdUrlCaught = true;
    }
  }
  assert(blockedProdUrlCaught === true, 'BinanceTradingClient strictly blocks outbound queryOrder when URL points to production in testnet mode');

  // --- 5. Lot Size and Price Filter Precision Helpers ---
  console.log('\n--- Suite 5: Symbol Filter Precision & Quantization ---');
  // stepSize: 0.0001
  const rawQuantity = 0.123456789;
  const roundedQty = BinanceTradingClient.roundStepSize(rawQuantity, '0.0001');
  assert(roundedQty === 0.1234, 'roundStepSize accurately rounds 0.123456789 with stepSize 0.0001 to 0.1234');

  // stepSize: 1 (e.g. whole units)
  const roundedWholeQty = BinanceTradingClient.roundStepSize(15.89, 1);
  assert(roundedWholeQty === 15, 'roundStepSize accurately rounds 15.89 with stepSize 1 to 15');

  // tickSize: 0.01 (cents)
  const rawPrice = 64321.98765;
  const roundedPrice = BinanceTradingClient.roundTickSize(rawPrice, '0.01');
  assert(roundedPrice === 64321.98, 'roundTickSize accurately rounds 64321.98765 with tickSize 0.01 to 64321.98');

  // tickSize: 0.00001 (high-precision tokens)
  const rawMicroPrice = 0.0003456789;
  const roundedMicroPrice = BinanceTradingClient.roundTickSize(rawMicroPrice, '0.00001');
  assert(roundedMicroPrice === 0.00034, 'roundTickSize accurately rounds 0.0003456789 with tickSize 0.00001 to 0.00034');

  // --- 6. Mock Transport Extensions ---
  console.log('\n--- Suite 6: Mock Transport Spot Extensions ---');
  const mockTransport = new MockBinanceTransport();
  const mockTime = await mockTransport.getServerTime();
  assert(typeof mockTime.serverTime === 'number' && mockTime.serverTime > 0, 'MockTransport provides getServerTime');

  const mockAccount = await mockTransport.getAccountInformation();
  assert(mockAccount.canTrade === true, 'MockTransport provides getAccountInformation with canTrade === true');
  assert(mockAccount.balances.some(b => b.asset === 'USDT'), 'MockTransport provides test USDT balance');

  const mockFilters = await mockTransport.getSymbolFilters('BTCUSDT');
  assert(mockFilters?.symbol === 'BTCUSDT', 'MockTransport provides symbol filters for BTCUSDT');
  assert(mockFilters?.stepSize === 0.00001, 'MockTransport provides valid stepSize');

  // --- 7. BinanceTradingService Explicit Error on Misconfiguration ---
  console.log('\n--- Suite 7: BinanceTradingService Explicit Error vs Mock Fallback ---');
  // When no environment variables are present, should safely default to Mock
  const originalEnv = process.env.BINANCE_ENVIRONMENT;
  const originalTestnet = process.env.BINANCE_TESTNET_TRADING_ENABLED;

  delete process.env.BINANCE_ENVIRONMENT;
  delete process.env.BINANCE_TESTNET_TRADING_ENABLED;

  const defaultService = new BinanceTradingService();
  assert(defaultService.isUsingMock() === true, 'When no trading environment is configured, defaults safely to MockBinanceTransport');

  // When testnet IS requested via environment, but configuration is broken, MUST throw Error (never silent mock)
  process.env.BINANCE_ENVIRONMENT = 'testnet';
  process.env.BINANCE_TESTNET_TRADING_ENABLED = 'true';
  process.env.BINANCE_API_KEY = 'short';
  process.env.BINANCE_API_SECRET = 'short';

  let configErrorThrown = false;
  try {
    new BinanceTradingService();
  } catch (err: unknown) {
    if ((err as Error).message.includes('[BinanceTradingService] Configuration Error')) {
      configErrorThrown = true;
    }
  }
  assert(configErrorThrown === true, 'BinanceTradingService throws explicit Configuration Error when testnet is intended but config is invalid (NO SILENT MOCK)');

  // Clean up env
  if (originalEnv) process.env.BINANCE_ENVIRONMENT = originalEnv;
  else delete process.env.BINANCE_ENVIRONMENT;
  if (originalTestnet) process.env.BINANCE_TESTNET_TRADING_ENABLED = originalTestnet;
  else delete process.env.BINANCE_TESTNET_TRADING_ENABLED;
  delete process.env.BINANCE_API_KEY;
  delete process.env.BINANCE_API_SECRET;

  // --- 8. Zero Secrets in API Responses and Logs ---
  console.log('\n--- Suite 8: Zero Secrets Leakage Check ---');
  const safeStatus = syntheticSigner.getConfigurationStatus();
  const serializedStatus = JSON.stringify(safeStatus);
  assert(!serializedStatus.includes(syntheticKey), 'ConfigurationStatus does NOT include the API key value');
  assert(!serializedStatus.includes(syntheticSecret), 'ConfigurationStatus does NOT include the secret value');
  assert(safeStatus.hasKey === true && safeStatus.hasSecret === true, 'ConfigurationStatus reports boolean presence flags only');

  console.log('\n================================================================');
  console.log(`  ALL ${totalTests} TESTNET SAFETY TESTS PASSED!`);
  console.log('================================================================');
}

runTestnetTestSuite().catch((err) => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
