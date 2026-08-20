/**
 * Taking money, and the one rule the whole design turns on:
 * finishTransaction is called only after the server has granted the credits.
 *
 * An unfinished transaction is offered again by StoreKit on every launch, so a
 * crash, a dropped connection or a server error between payment and grant is
 * recoverable. Finishing early makes it permanent, and a customer who paid
 * without being credited has no route back but a refund request.
 *
 * NOT VERIFIED AGAINST STOREKIT. Every call here is written against
 * react-native-iap 16's type definitions and the server's own contract; a
 * sandbox account on a physical device is the only thing that proves it.
 */
import { Platform } from 'react-native';
import * as RNIap from 'react-native-iap';

import { api } from '../api/client';
import { PRODUCT_IDS, type ProductId } from './products';

export type PurchaseResult =
  | { cancelled: true }
  | { cancelled: false; creditsAdded: number; creditsRemaining: number };

type Grant = {
  credits_added: number;
  credits_remaining: number;
  already_processed: boolean;
  environment: string;
};

/**
 * The StoreKit 2 signed transaction, which is the only thing worth sending:
 * the server verifies its signature locally against Apple's root certificates.
 *
 * In react-native-iap 16 it arrives as the unified `purchaseToken` — "iOS JWS,
 * Android purchaseToken" in its own words. Older versions called it
 * `jwsRepresentationIos`, and reading the wrong key means every purchase fails
 * verification while looking fine on the device, so both are accepted.
 */
function signedPayload(purchase: RNIap.Purchase): string | null {
  const legacy = (purchase as { jwsRepresentationIos?: string | null }).jwsRepresentationIos;
  return purchase.purchaseToken ?? legacy ?? null;
}

async function verifyWithServer(purchase: RNIap.Purchase): Promise<Grant> {
  const signed = signedPayload(purchase);
  if (!signed) {
    // Never finish a transaction we cannot prove. StoreKit will offer it
    // again, and by then the app may know how to read it.
    throw new Error('purchase carried no signed transaction');
  }
  return api.post<Grant>('/credits/apple/verify', { signed_transaction: signed });
}

function isCancellation(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  return code === RNIap.ErrorCode.UserCancelled || code === 'E_USER_CANCELLED';
}

/** Connect, then hand over anything a previous run paid for but never claimed. */
export async function initIAP(): Promise<void> {
  // Play Billing is a later delta; the paywall is iOS-only for now.
  if (Platform.OS !== 'ios') return;
  await RNIap.initConnection();
  await replayUnfinished();
}

export async function purchase(productId: ProductId): Promise<PurchaseResult> {
  try {
    const result = await RNIap.requestPurchase({
      request: { apple: { sku: productId, quantity: 1 } },
      type: 'in-app',
    });
    const bought = Array.isArray(result) ? result[0] : result;
    if (!bought) throw new Error('no purchase returned');

    const grant = await verifyWithServer(bought);
    await RNIap.finishTransaction({ purchase: bought, isConsumable: true });

    return {
      cancelled: false,
      creditsAdded: grant.credits_added,
      creditsRemaining: grant.credits_remaining,
    };
  } catch (error: unknown) {
    if (isCancellation(error)) return { cancelled: true };
    throw error;
  }
}

/**
 * Purchases paid for but never credited — a crash, a lost connection or a
 * server error between payment and grant. StoreKit offers them again on every
 * launch precisely so this is recoverable.
 */
export async function replayUnfinished(): Promise<{ recovered: number }> {
  if (Platform.OS !== 'ios') return { recovered: 0 };

  let recovered = 0;
  for (const pending of await RNIap.getAvailablePurchases()) {
    try {
      await verifyWithServer(pending);
      await RNIap.finishTransaction({ purchase: pending, isConsumable: true });
      recovered += 1;
    } catch {
      // Left unfinished on purpose: next launch tries again, and finishing now
      // would discard a purchase the customer paid for.
    }
  }
  return { recovered };
}

/**
 * Restore Purchases, which Guideline 3.1.1 requires to be visible.
 *
 * Credits live on the account, so restoring re-syncs the balance rather than
 * re-granting. The server is idempotent per transaction id, which is what
 * makes pressing this twice harmless.
 */
export async function restorePurchases(): Promise<{ restored: number }> {
  if (Platform.OS !== 'ios') return { restored: 0 };

  let restored = 0;
  for (const owned of await RNIap.getAvailablePurchases()) {
    try {
      await verifyWithServer(owned);
      restored += 1;
    } catch {
      // A transaction the server will not accept is not restorable.
    }
  }
  return { restored };
}

/** The three consumables, with the price StoreKit formats for this user. */
export async function fetchIapProducts(): Promise<RNIap.Product[]> {
  if (Platform.OS !== 'ios') return [];
  const products = await RNIap.fetchProducts({ skus: [...PRODUCT_IDS], type: 'in-app' });
  return (products ?? []).filter((p): p is RNIap.Product => p !== null && 'displayPrice' in p);
}

export { PRODUCT_COPY, PRODUCT_IDS, type ProductId } from './products';
