/**
 * Credits and purchases. Layout follows the design reference (lines 812–848).
 *
 * The reference's "Cards for printed orders" section is not here. There is no
 * Stripe in this binary, so a saved-card list would be both non-functional and
 * a payment surface Apple would ask about.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCredits } from '../src/api/hooks';
import type { CreditGrant } from '../src/api/types';
import { Button, Card, Paywall } from '../src/components';
import { formatSpecDate } from '../src/format';
import { restorePurchases } from '../src/iap';
import { display, eyebrow, hitSlopTo44, shadow, theme } from '../src/theme';

export default function Billing() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: credits } = useCredits();
  const [paywall, setPaywall] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restored, setRestored] = useState<number | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['credits'] });

  const restore = async () => {
    setRestoring(true);
    try {
      const { restored: count } = await restorePurchases();
      setRestored(count);
      await refresh();
    } finally {
      setRestoring(false);
    }
  };

  const grants = credits?.grants ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.space.md }]}
    >
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={hitSlopTo44(34)}
        style={styles.back}
      >
        <Text style={styles.backGlyph}>‹</Text>
      </Pressable>

      <Text style={styles.eyebrow}>◆ Credits</Text>
      <Text style={styles.title}>What you have left.</Text>

      <Card style={[styles.balanceCard, shadow.subtle]}>
        <Text style={styles.balanceLabel}>Photo credits</Text>
        <Text style={styles.balance}>{credits?.credits_remaining ?? 0}</Text>
        <Text style={styles.balanceNote}>
          One credit unlocks one photo — the digital file and the print sheet. Retakes of the same
          photo are free.
        </Text>
        {Platform.OS === 'ios' ? (
          <Button label="Buy credits" onPress={() => setPaywall(true)} style={styles.buy} />
        ) : null}
        {Platform.OS === 'ios' ? (
          <Button
            label={restoring ? 'Checking your Apple ID…' : 'Restore purchases'}
            variant="secondary"
            onPress={() => void restore()}
          />
        ) : null}
        {restored !== null ? (
          <Text style={styles.restored}>
            {restored === 0
              ? 'Nothing to restore on this Apple ID.'
              : `${restored} purchase${restored === 1 ? '' : 's'} checked with the server.`}
          </Text>
        ) : null}
      </Card>

      <Text style={[styles.eyebrow, styles.sectionLabel]}>Purchases</Text>
      {grants.length === 0 ? (
        <Text style={styles.empty}>Nothing bought yet on this account.</Text>
      ) : (
        <Card flush>
          {grants.map((grant: CreditGrant) => (
            <View key={grant.id} style={styles.grant}>
              <View style={styles.grantText}>
                <Text style={styles.grantName}>{grant.bundle_name || grant.bundle_type}</Text>
                <Text style={styles.grantMeta}>
                  {formatSpecDate(grant.purchased_at) ?? 'Recently'} ·{' '}
                  {grant.source === 'apple_iap' ? 'App Store' : grant.source}
                  {grant.environment === 'sandbox' ? ' · sandbox' : ''}
                </Text>
              </View>
              <Text style={styles.grantCount}>
                {grant.remaining_credits}/{grant.total_credits}
              </Text>
            </View>
          ))}
        </Card>
      )}

      <Paywall
        visible={paywall}
        onClose={() => setPaywall(false)}
        onPurchased={() => {
          setPaywall(false);
          void refresh();
        }}
        onRestore={() => void restore()}
        restoring={restoring}
      />

      <View style={{ height: insets.bottom + theme.space.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.surface },
  content: { paddingHorizontal: theme.space.xl, paddingBottom: theme.space.xl },
  back: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  backGlyph: { fontSize: 22, lineHeight: 24, color: theme.color.text },
  eyebrow: { ...eyebrow, marginBottom: 6 },
  sectionLabel: { fontSize: 9.5, letterSpacing: 1.33, marginTop: theme.space.xl, marginBottom: 9 },
  title: { ...display(26), marginBottom: theme.space.lg },

  balanceCard: { padding: theme.space.lg, gap: 9 },
  balanceLabel: {
    fontFamily: theme.type.mono,
    fontSize: 9,
    letterSpacing: 1.26,
    textTransform: 'uppercase',
    color: theme.color.faint,
  },
  balance: { ...display(34) },
  balanceNote: {
    fontFamily: theme.type.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: theme.color.muted,
  },
  buy: { marginTop: theme.space.xs },
  restored: { fontFamily: theme.type.body, fontSize: 12.5, color: theme.color.muted },

  empty: { fontFamily: theme.type.body, fontSize: 13.5, color: theme.color.muted },
  grant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.hairline,
  },
  grantText: { flex: 1 },
  grantName: { fontFamily: theme.type.bodyMedium, fontSize: 13.5, color: theme.color.text },
  grantMeta: {
    fontFamily: theme.type.mono,
    fontSize: 9.5,
    letterSpacing: 0.57,
    color: theme.color.faint,
    marginTop: 2,
  },
  grantCount: { fontFamily: theme.type.mono, fontSize: 12, color: theme.color.text },
});
