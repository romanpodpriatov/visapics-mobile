/**
 * The three consumables. Layout follows the design reference (lines 1081–1127).
 *
 * Every price is the one StoreKit formatted for this person's own store. The
 * reference's $3.99 / $14.99 / $24.99 are US display values; someone in Poland
 * sees zloty, and the store decides the number. When the store has not answered
 * yet the options show no price at all rather than a wrong one.
 *
 * The footer carries all four things Guideline 3.1.1 wants visible: what is
 * being bought, where the price comes from, how refunds work, and Restore
 * Purchases. There is no link out of the app to buy anything and no mention of
 * the website's prices — that is 3.1.3, and it is checked.
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useConfig } from '../api/hooks';
import { PRODUCT_COPY, PRODUCT_IDS, type ProductId, fetchIapProducts, purchase } from '../iap';
import { display, eyebrow, theme } from '../theme';
import { Button } from './Button';
import { Sheet } from './Sheet';

const HOUR = 60 * 60 * 1000;

export function useIapProducts() {
  return useQuery({
    queryKey: ['iap-products'],
    queryFn: fetchIapProducts,
    staleTime: HOUR,
  });
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called with the new balance once the server has granted the credits. */
  onPurchased: (creditsRemaining: number) => void;
  onRestore: () => void;
  restoring?: boolean;
};

export function Paywall({ visible, onClose, onPurchased, onRestore, restoring }: Props) {
  const { data: config } = useConfig();
  const { data: products, isPending, isFetching, refetch } = useIapProducts();
  const [selected, setSelected] = useState<ProductId>('org.visapics.app.photo.single');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const priceOf = (id: ProductId) =>
    products?.find((product) => product.id === id)?.displayPrice ?? null;
  const selectedPrice = priceOf(selected);

  // An empty answer is an answer. StoreKit returns nothing when the products
  // are not attached to the build, or when nobody is signed into a sandbox
  // account — and a button that says "loading" for ever is both a lie and a
  // dead end. Asking again is cheap and sometimes works.
  const storeAnsweredNothing = !isPending && !selectedPrice;

  const buy = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const result = await purchase(selected);
      // A cancellation is a choice, not a failure: nothing to report.
      if (!result.cancelled) onPurchased(result.creditsRemaining);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.eyebrow}>◆ Unlock</Text>
      <Text style={styles.title}>Pay once. Retake free.</Text>
      <Text style={styles.intro}>
        Every option includes the digital file, the printable sheet, and free reprocessing if an
        agency rejects the photo.
      </Text>

      <View style={styles.options}>
        {PRODUCT_IDS.map((id) => {
          const copy = PRODUCT_COPY[id];
          const active = id === selected;
          return (
            <Pressable
              key={id}
              onPress={() => setSelected(id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={copy.title}
              style={[styles.option, active && styles.optionActive]}
            >
              <View style={[styles.dot, active && styles.dotActive]}>
                {active ? <View style={styles.dotInner} /> : null}
              </View>
              <View style={styles.optionText}>
                <View style={styles.optionTitleRow}>
                  <Text style={[styles.optionTitle, active && styles.onDark]}>{copy.title}</Text>
                  {copy.best ? <Text style={styles.badge}>Best value</Text> : null}
                </View>
                <Text style={[styles.optionSub, active && styles.onDarkMuted]}>
                  {copy.subtitle}
                </Text>
              </View>
              <Text style={[styles.price, active && styles.onDark]}>{priceOf(id) ?? '—'}</Text>
            </Pressable>
          );
        })}
      </View>

      {storeAnsweredNothing ? (
        <>
          <Button label="Try again" onPress={() => void refetch()} busy={isFetching} />
          <Text style={styles.failed}>
            The App Store did not send prices back. Check your connection and try again — your
            existing credits still work, and Restore Purchases below does not need the store
            catalogue.
          </Text>
        </>
      ) : (
        <Button
          label={selectedPrice ? `Buy ${selectedPrice}` : 'Prices are loading from the App Store'}
          onPress={() => void buy()}
          disabled={!selectedPrice}
          busy={busy}
        />
      )}

      {failed ? (
        <Text style={styles.failed}>
          That did not go through, and nothing was charged. Try again in a moment.
        </Text>
      ) : null}

      <Text style={styles.legal}>
        One-time purchase, no subscription. Credits are held on your VisaPics account and do not
        expire while it is active.
      </Text>
      <Text style={styles.legal}>
        Prices are shown in your local currency by the App Store. Credits are tied to your
        account, so sign in to keep them.
      </Text>
      <Text style={styles.legalFaint}>
        Purchases are handled by Apple. If an agency rejects the photo we reprocess it free —
        refunds are requested through Apple.
      </Text>

      <View style={styles.footer}>
        <Pressable onPress={onRestore} accessibilityRole="button" hitSlop={10}>
          <Text style={styles.footerLink}>
            {restoring ? 'Checking your Apple ID…' : 'Restore purchases'}
          </Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          onPress={() => config && void Linking.openURL(config.legal.terms_url)}
          accessibilityRole="link"
          hitSlop={10}
        >
          <Text style={styles.footerLink}>Terms of use</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          onPress={() => config && void Linking.openURL(config.legal.privacy_url)}
          accessibilityRole="link"
          hitSlop={10}
        >
          <Text style={styles.footerLink}>Privacy</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...eyebrow, marginBottom: 6 },
  title: { ...display(25), lineHeight: 27.5, marginBottom: theme.space.xs },
  intro: {
    fontFamily: theme.type.body,
    fontSize: 13,
    lineHeight: 19.5,
    color: theme.color.muted,
    marginBottom: theme.space.lg,
  },

  options: { gap: 9, marginBottom: 15 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    padding: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.card,
  },
  optionActive: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  dot: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.color.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { borderColor: '#FFFFFF' },
  dotInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
  optionText: { flex: 1 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  optionTitle: { fontFamily: theme.type.bodyMedium, fontSize: 14.5, color: theme.color.text },
  optionSub: {
    fontFamily: theme.type.body,
    fontSize: 12,
    color: theme.color.muted,
    marginTop: 3,
  },
  onDark: { color: '#FFFFFF' },
  onDarkMuted: { color: 'rgba(255,255,255,.78)' },
  badge: {
    fontFamily: theme.type.mono,
    fontSize: 8.5,
    letterSpacing: 0.85,
    textTransform: 'uppercase',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,.22)',
    color: '#FFFFFF',
  },
  price: { fontFamily: theme.type.mono, fontSize: 14, color: theme.color.text },

  failed: {
    fontFamily: theme.type.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: theme.color.danger,
    marginTop: 11,
  },
  legal: {
    fontFamily: theme.type.body,
    fontSize: 11.5,
    lineHeight: 18,
    color: theme.color.muted,
    marginTop: 11,
  },
  legalFaint: {
    fontFamily: theme.type.body,
    fontSize: 11.5,
    lineHeight: 18,
    color: theme.color.faint,
    marginTop: theme.space.sm,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  footerLink: { fontFamily: theme.type.body, fontSize: 12, color: theme.color.brand },
  divider: { width: 1, height: 12, backgroundColor: theme.color.borderStrong },
});
