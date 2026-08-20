/**
 * Privacy, and the two ways to be forgotten. Layout follows the design
 * reference (lines 888–943).
 *
 * The four commitments ship as written because each is true of this build and
 * each is a promise: adding an analytics or attribution SDK that sees a photo
 * makes one of them false and the App Privacy questionnaire a false
 * declaration.
 *
 * The reference's Active sessions and two-factor rows are not here. Both are
 * web-session features on this backend — /api/user/sessions says "NOT USED
 * WITH JWT" in as many words — and a row that cannot do what it says is worse
 * than no row.
 */
import { useQueryClient } from '@tanstack/react-query';

import { forgetCachedAccount } from '../src/api/cache';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConfig } from '../src/api/hooks';
import { deleteAccount, eraseDevice } from '../src/auth/account';
import { Button, Card, DeleteAccountSheet } from '../src/components';
import { deletionLabel } from '../src/format';
import { useAuthStore } from '../src/store/auth';
import { display, eyebrow, hitSlopTo44, theme } from '../src/theme';

export default function Privacy() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: config } = useConfig();
  const isGuest = useAuthStore((s) => s.isAnonymous);

  const [sheet, setSheet] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const rows = [
    {
      label: config
        ? `Photos clear after ${deletionLabel(config.retention_hours)}`
        : 'Photos clear automatically',
      body: 'Guest photos never persist beyond that. Saved photos stay only until you delete them.',
    },
    {
      label: 'No face recognition, ever',
      body: 'We measure geometry against the document spec. Faces are not identified, matched or profiled.',
    },
    {
      label: 'Nothing sold or shared',
      body: 'No advertising SDKs, no cross-app tracking, no third-party analytics on your photos.',
    },
    {
      label: 'Processing you control',
      body: 'Background removal and AI enhance only run when their toggles are on.',
    },
  ];

  const erase = () =>
    Alert.alert(
      'Erase everything on this device?',
      'The guest account, its credits and the consent you gave are removed from this device.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: () => void eraseDevice().then(() => forgetCachedAccount(queryClient)),
        },
      ],
    );

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      forgetCachedAccount(queryClient);
      setSheet(false);
      router.replace('/photos');
    } catch {
      Alert.alert('Could not delete the account', 'Check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  };

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

      <Text style={styles.eyebrow}>◆ Privacy</Text>
      <Text style={styles.title}>What we hold, and for how long.</Text>

      <Card flush style={styles.card}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowBody}>{row.body}</Text>
          </View>
        ))}
      </Card>

      <View style={styles.links}>
        <Pressable
          onPress={() => config && void Linking.openURL(config.legal.privacy_url)}
          accessibilityRole="link"
        >
          <Text style={styles.link}>Read the full privacy policy</Text>
        </Pressable>
        <Pressable
          onPress={() => config && void Linking.openURL(config.legal.terms_url)}
          accessibilityRole="link"
        >
          <Text style={styles.link}>Terms of use</Text>
        </Pressable>
      </View>

      <Text style={[styles.eyebrow, styles.sectionLabel]}>Being forgotten</Text>
      <View style={styles.destructive}>
        <Button label="Erase everything on this device" variant="secondary" onPress={erase} />
        {isGuest ? (
          <Text style={styles.note}>
            You have no account to delete — everything about you is on this device, and the
            button above removes it.
          </Text>
        ) : (
          <Button label="Delete my account" variant="danger" onPress={() => setSheet(true)} />
        )}
      </View>

      <DeleteAccountSheet
        visible={sheet}
        busy={deleting}
        onClose={() => setSheet(false)}
        onConfirm={() => void confirmDelete()}
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
  title: { ...display(26), lineHeight: 29, marginBottom: theme.space.lg },

  card: { marginBottom: theme.space.lg },
  row: {
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.hairline,
  },
  rowLabel: { fontFamily: theme.type.bodyMedium, fontSize: 13.5, color: theme.color.text },
  rowBody: {
    fontFamily: theme.type.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.color.muted,
    marginTop: 2,
  },

  links: { gap: theme.space.sm },
  link: { fontFamily: theme.type.body, fontSize: 13.5, color: theme.color.brand },

  destructive: { gap: 9 },
  note: {
    fontFamily: theme.type.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: theme.color.muted,
  },
});
