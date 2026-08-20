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
