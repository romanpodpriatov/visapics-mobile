/**
 * Defaults every suite gets.
 *
 * react-native-iap reaches for NitroModules the moment it is imported, which
 * no test environment has. Without a default mock, adding the paywall to the
 * component barrel broke five suites that never mention purchasing — so the
 * stub lives here, and the tests that care about purchasing declare their own.
 */
jest.mock('react-native-iap', () => ({
  initConnection: jest.fn(async () => true),
  endConnection: jest.fn(async () => undefined),
  requestPurchase: jest.fn(),
  finishTransaction: jest.fn(async () => undefined),
  getAvailablePurchases: jest.fn(async () => []),
  fetchProducts: jest.fn(async () => []),
  ErrorCode: { UserCancelled: 'user-cancelled' },
}));

/**
 * No test talks to the network.
 *
 * A query that slips through — an invalidate that refetches, an `enabled` that
 * is truer than it looks — used to reach production and leave the run hanging
 * on an open socket. Failing loudly is easier to find than a suite that takes
 * two minutes to not exit.
 */
globalThis.fetch = jest.fn(() =>
  Promise.reject(
    new Error('Network request in a test. Seed the query cache or mock the api client.'),
  ),
);

// The stub above lives for the whole file, so its call list would carry over
// from one test to the next — and a test reading `mock.calls[0]` would read
// somebody else's request.
beforeEach(() => {
  if (jest.isMockFunction(globalThis.fetch)) globalThis.fetch.mockClear();
});
