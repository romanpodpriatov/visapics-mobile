/**
 * The consumables, matching App Store Connect and PRODUCT_TO_BUNDLE in
 * services/apple_storekit.py on the server. Three places, one list — the
 * server rejects an identifier it does not know, which is the safety net.
 */
export const PRODUCT_IDS = [
  'org.visapics.app.photo.single',
  'org.visapics.app.credits.family',
  'org.visapics.app.credits.travel',
] as const;

export type ProductId = (typeof PRODUCT_IDS)[number];

/** Copy only. Prices come from StoreKit, never from here. */
export const PRODUCT_COPY: Record<ProductId, { title: string; subtitle: string; best?: boolean }> =
  {
    'org.visapics.app.photo.single': {
      title: 'This photo',
      subtitle: 'Unlock the digital file and the print sheet',
    },
    'org.visapics.app.credits.family': {
      title: 'Family pack · 5',
      subtitle: 'Five photos, any document, no expiry while your account is active',
    },
    'org.visapics.app.credits.travel': {
      title: 'Travel pack · 10',
      subtitle: 'Ten photos, any document, no expiry while your account is active',
      best: true,
    },
  };
