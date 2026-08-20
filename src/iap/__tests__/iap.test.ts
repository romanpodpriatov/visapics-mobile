import * as RNIap from 'react-native-iap';

import { api } from '../../api/client';
import { purchase, replayUnfinished, restorePurchases } from '../index';

jest.mock('react-native-iap', () => ({
  initConnection: jest.fn(async () => true),
  requestPurchase: jest.fn(),
  finishTransaction: jest.fn(async () => undefined),
  getAvailablePurchases: jest.fn(async () => []),
  fetchProducts: jest.fn(async () => []),
  ErrorCode: { UserCancelled: 'user-cancelled' },
}));

const iap = RNIap as unknown as {
  requestPurchase: jest.Mock;
  finishTransaction: jest.Mock;
  getAvailablePurchases: jest.Mock;
};

/** A StoreKit 2 purchase as version 16 hands it over. */
const bought = (id: string, token: string | null = 'ey.signed.jws') => ({
  id,
  productId: 'org.visapics.app.credits.family',
  purchaseToken: token,
  quantity: 1,
  isAutoRenewing: false,
  purchaseState: 'purchased',
  store: 'apple',
  transactionDate: 1_700_000_000_000,
});

const granted = (over: Record<string, unknown> = {}) => ({
  credits_added: 5,
  credits_remaining: 5,
  already_processed: false,
  environment: 'sandbox',
  ...over,
});

beforeEach(() => {
  iap.requestPurchase.mockReset();
  iap.finishTransaction.mockReset().mockResolvedValue(undefined);
  iap.getAvailablePurchases.mockReset().mockResolvedValue([]);
});
afterEach(() => jest.restoreAllMocks());

describe('purchase', () => {
  it('verifies with the server before finishing the transaction', async () => {
    // finishTransaction is irreversible: StoreKit forgets the purchase, and a
    // customer who paid but was never credited has no route back but a refund.
    const order: string[] = [];
    iap.requestPurchase.mockResolvedValue(bought('2000001'));
    jest.spyOn(api, 'post').mockImplementation(async () => {
      order.push('verify');
      return granted() as never;
    });
    iap.finishTransaction.mockImplementation(async () => {
      order.push('finish');
    });

    await purchase('org.visapics.app.credits.family');

    expect(order).toEqual(['verify', 'finish']);
  });

  it('sends the signed transaction the server asked for', async () => {
    iap.requestPurchase.mockResolvedValue(bought('2000001', 'ey.header.payload'));
    const post = jest.spyOn(api, 'post').mockResolvedValue(granted() as never);

    await purchase('org.visapics.app.credits.family');

    expect(post).toHaveBeenCalledWith('/credits/apple/verify', {
      signed_transaction: 'ey.header.payload',
    });
  });

  it('reports what the server granted', async () => {
    iap.requestPurchase.mockResolvedValue(bought('2000001'));
    jest.spyOn(api, 'post').mockResolvedValue(granted({ credits_remaining: 8 }) as never);

    await expect(purchase('org.visapics.app.credits.family')).resolves.toEqual({
      cancelled: false,
      creditsAdded: 5,
      creditsRemaining: 8,
    });
  });

  it('does NOT finish the transaction when the server rejects it', async () => {
    iap.requestPurchase.mockResolvedValue(bought('2000002'));
    jest.spyOn(api, 'post').mockRejectedValue(new Error('server down'));

    await expect(purchase('org.visapics.app.photo.single')).rejects.toThrow();
    expect(iap.finishTransaction).not.toHaveBeenCalled();
  });

  it('does not finish a transaction that carries no signed payload', async () => {
    iap.requestPurchase.mockResolvedValue(bought('2000003', null));

    await expect(purchase('org.visapics.app.photo.single')).rejects.toThrow(/signed/i);
    expect(iap.finishTransaction).not.toHaveBeenCalled();
  });

  it('treats a cancellation as a cancellation, not an error to report', async () => {
    iap.requestPurchase.mockRejectedValue({ code: 'user-cancelled' });
    await expect(purchase('org.visapics.app.photo.single')).resolves.toMatchObject({
      cancelled: true,
    });
  });
});

describe('replayUnfinished', () => {
  it('re-verifies and finishes purchases left over from a previous run', async () => {
    iap.getAvailablePurchases.mockResolvedValue([bought('2000004'), bought('2000005')]);
    jest
      .spyOn(api, 'post')
      .mockResolvedValue(granted({ credits_added: 0, already_processed: true }) as never);

    await expect(replayUnfinished()).resolves.toEqual({ recovered: 2 });
    expect(iap.finishTransaction).toHaveBeenCalledTimes(2);
  });

  it('leaves a purchase unfinished when the server cannot be reached', async () => {
    // On purpose: StoreKit offers it again next launch, and finishing now
    // would discard something the customer paid for.
    iap.getAvailablePurchases.mockResolvedValue([bought('2000006')]);
    jest.spyOn(api, 'post').mockRejectedValue(new Error('offline'));

    await expect(replayUnfinished()).resolves.toEqual({ recovered: 0 });
    expect(iap.finishTransaction).not.toHaveBeenCalled();
  });

  it('carries on past one purchase it cannot verify', async () => {
    iap.getAvailablePurchases.mockResolvedValue([bought('2000007', null), bought('2000008')]);
    jest.spyOn(api, 'post').mockResolvedValue(granted() as never);

    await expect(replayUnfinished()).resolves.toEqual({ recovered: 1 });
    expect(iap.finishTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('restorePurchases', () => {
  it('re-syncs the balance from the server rather than re-granting', async () => {
    iap.getAvailablePurchases.mockResolvedValue([bought('2000009')]);
    const post = jest
      .spyOn(api, 'post')
      .mockResolvedValue(granted({ credits_added: 0, already_processed: true }) as never);

    await expect(restorePurchases()).resolves.toEqual({ restored: 1 });
    expect(post).toHaveBeenCalledWith('/credits/apple/verify', expect.any(Object));
  });

  it('does not claim to have restored something the server refused', async () => {
    iap.getAvailablePurchases.mockResolvedValue([bought('2000010')]);
    jest.spyOn(api, 'post').mockRejectedValue(new Error('unknown transaction'));

    await expect(restorePurchases()).resolves.toEqual({ restored: 0 });
  });
});
