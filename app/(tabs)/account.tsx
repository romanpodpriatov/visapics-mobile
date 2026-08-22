/**
 * Account. Layout follows the design reference (lines 945–1052).
 *
 * Only Sign in with Apple is offered, and the reference's Google, Facebook and
 * email form are not drawn: none of those paths can carry a guest's credits
 * onto an account, and a sign-in that silently empties someone's balance is
 * worse than one fewer button. See src/auth/signin.ts.
 *
 * The Language row is gone — v1 is English only — and so is the measurement
 * unit row, which would have been a switch that switches nothing.
 */
import { useQueryClient } from '@tanstack/react-query';

import { forgetCachedAccount } from '../../src/api/cache';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConfig, useCredits } from '../../src/api/hooks';
import { appleSignInAvailable, signInWithApple } from '../../src/auth/signin';
import { Button, Card, Paywall } from '../../src/components';
import { ChevronIcon } from '../../src/components/icons';
import { creditLabel, deletionLabel } from '../../src/format';
import { restorePurchases } from '../../src/iap';
import { useAuthStore } from '../../src/store/auth';
import { useConsentStore } from '../../src/store/consent';
import { display, eyebrow, shadow, theme } from '../../src/theme';

export default function Account() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: config } = useConfig();
  const { data: credits } = useCredits();
  const isGuest = useAuthStore((s) => s.isAnonymous);
  const userId = useAuthStore((s) => s.userId);

  const [appleReady, setAppleReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restored, setRestored] = useState<number | null>(null);
  const [paywall, setPaywall] = useState(false);

  useEffect(() => {
    void appleSignInAvailable().then(setAppleReady);
  }, []);

  const refreshBalance = () => queryClient.invalidateQueries({ queryKey: ['credits'] });

  const signIn = async () => {
    setBusy(true);
    try {
      if (await signInWithApple()) await refreshBalance();
    } catch {
      Alert.alert('Could not sign in', 'Apple did not complete the sign-in. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setRestoring(true);
    try {
      const { restored: count } = await restorePurchases();
      setRestored(count);
      await refreshBalance();
    } finally {
      setRestoring(false);
    }
  };

  const signOut = () => {
    // The device token stays, so signing out drops back to the same guest
    // rather than to a stranger with an empty balance.
    void useAuthStore.getState().signOut().then(refreshBalance);
  };

  const eraseDevice = () => {
    Alert.alert(
      'Erase everything on this device?',
      'The guest account, its credits and the consent you gave are removed from this device. This cannot be undone.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: () => {
            void useConsentStore.getState().revoke();
            void useAuthStore
              .getState()
              .forgetDevice()
              .then(() => forgetCachedAccount(queryClient));
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}
    >
      <Text style={styles.eyebrow}>◆ Account</Text>
      <Text style={styles.title}>{isGuest ? 'Guest.' : 'Your account.'}</Text>

      {isGuest ? (
        <Card style={[styles.card, shadow.subtle]}>
          <Text style={styles.body}>
            You are using VisaPics as a guest. Photos and credits live on this device
            {config ? ` for ${deletionLabel(config.retention_hours)}` : ''}. An account keeps them
            and syncs credits across your devices.
          </Text>
          {Platform.OS === 'ios' && appleReady ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={styles.appleButton}
              onPress={() => void signIn()}
            />
          ) : (
            <Text style={styles.note}>
              Signing in needs iOS 13 or later. Your photos and credits stay on this device
              meanwhile.
            </Text>
          )}
          <Pressable
            onPress={() => router.push('/signin')}
            accessibilityRole="button"
            style={styles.emailButton}
          >
            <Text style={styles.emailButtonText}>Sign in with email</Text>
          </Pressable>
          {busy ? <Text style={styles.note}>Signing you in…</Text> : null}
        </Card>
      ) : (
        <Card flush style={[styles.card, shadow.subtle]}>
          <View style={styles.identity}>
            <Text style={styles.avatar}>{String(userId ?? '·').slice(-2)}</Text>
            <View>
              <Text style={styles.identityName}>Signed in</Text>
              <Text style={styles.identityMeta}>Credits sync across your devices</Text>
            </View>
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Credits</Text>
              <Text style={styles.statValue}>{credits?.credits_remaining ?? 0}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Status</Text>
              <Text style={styles.statText}>{creditLabel(credits?.credits_remaining)}</Text>
            </View>
          </View>
          {Platform.OS === 'ios' ? (
            <Pressable
              onPress={() => setPaywall(true)}
              accessibilityRole="button"
              style={styles.buyMore}
            >
              <Text style={styles.buyMoreLabel}>Buy more credits</Text>
            </Pressable>
          ) : null}
        </Card>
      )}

      <Card flush style={styles.rows}>
        <Row label="Credits and purchases" onPress={() => router.push('/billing')} />
        <Row label="Privacy and your data" onPress={() => router.push('/privacy')} />
        <Row label="Support" onPress={() => router.push('/support')} />
        {Platform.OS === 'ios' ? (
          <Row
            label={restoring ? 'Checking your Apple ID…' : 'Restore purchases'}
            detail={restored === null ? undefined : `${restored} found`}
            onPress={() => void restore()}
          />
        ) : null}
      </Card>

      <View style={styles.destructive}>
        {isGuest ? null : (
          <Button label="Sign out" variant="secondary" onPress={signOut} />
        )}
        <Button label="Erase everything on this device" variant="danger" onPress={eraseDevice} />
      </View>

      <Paywall
        visible={paywall}
        onClose={() => setPaywall(false)}
        onPurchased={() => {
          setPaywall(false);
          void refreshBalance();
        }}
        onRestore={() => void restore()}
        restoring={restoring}
      />

      <View style={{ height: insets.bottom + theme.space.xl }} />
    </ScrollView>
  );
}

function Row({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      <ChevronIcon size={15} color={theme.color.borderStrong} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.surface },
  content: { paddingHorizontal: theme.space.xl, paddingBottom: theme.space.xl },
  eyebrow: { ...eyebrow, marginBottom: 6 },
  title: { ...display(27), marginBottom: 15 },

  card: { marginBottom: theme.space.lg },
  body: {
    fontFamily: theme.type.body,
    fontSize: 13.5,
    lineHeight: 21,
    color: theme.color.muted,
    padding: theme.space.lg,
    paddingBottom: 14,
  },
  emailButton: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.space.sm,
  },
  emailButtonText: { fontFamily: theme.type.bodyMedium, fontSize: 15, color: theme.color.text },

  appleButton: { height: 48, marginHorizontal: theme.space.lg, marginBottom: theme.space.lg },
  note: {
    fontFamily: theme.type.body,
    fontSize: 12.5,
    color: theme.color.muted,
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.lg,
  },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.color.brand,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 42,
    fontFamily: theme.type.monoMedium,
    fontSize: 14,
    overflow: 'hidden',
  },
  identityName: { fontFamily: theme.type.bodyMedium, fontSize: 14.5, color: theme.color.text },
  identityMeta: {
    fontFamily: theme.type.mono,
    fontSize: 9.5,
    letterSpacing: 0.95,
    textTransform: 'uppercase',
    color: theme.color.faint,
    marginTop: 2,
  },
  stats: { flexDirection: 'row' },
  stat: {
    flex: 1,
    paddingHorizontal: theme.space.lg,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: theme.color.border,
  },
  statLabel: {
    fontFamily: theme.type.mono,
    fontSize: 9,
    letterSpacing: 1.26,
    textTransform: 'uppercase',
    color: theme.color.faint,
  },
  statValue: { ...display(26), marginTop: 3 },
  statText: { fontFamily: theme.type.body, fontSize: 14, color: theme.color.text, marginTop: 6 },
  buyMore: {
    padding: 13,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    backgroundColor: theme.color.brandSoft,
  },
  buyMoreLabel: { fontFamily: theme.type.bodyMedium, fontSize: 14, color: theme.color.brand },

  rows: { marginBottom: theme.space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.hairline,
    minHeight: theme.minTouchTarget,
  },
  rowLabel: { flex: 1, fontFamily: theme.type.body, fontSize: 14.5, color: theme.color.text },
  rowDetail: { fontFamily: theme.type.mono, fontSize: 11, color: theme.color.faint },

  destructive: { gap: 9 },
});
