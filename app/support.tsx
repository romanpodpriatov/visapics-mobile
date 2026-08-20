/**
 * Support and legal. Layout follows the design reference (lines 850–886).
 *
 * "Request a refund" opens reportaproblem.apple.com. Refunds for an in-app
 * purchase are Apple's to make, and an app that offers to refund one itself is
 * wrong about who is holding the money.
 *
 * The version comes from expo-constants rather than a literal, so it cannot
 * drift from the build it is printed in.
 */
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConfig } from '../src/api/hooks';
import { Card } from '../src/components';
import { ChevronIcon } from '../src/components/icons';
import { display, eyebrow, hitSlopTo44, theme } from '../src/theme';

const SUPPORT_EMAIL = 'support@visapics.org';
const APPLE_REFUNDS = 'https://reportaproblem.apple.com';

export default function Support() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: config } = useConfig();

  const open = (url: string) => () => void Linking.openURL(url);

  const version = `${Constants.expoConfig?.version ?? '1.0.0'} (${
    Constants.expoConfig?.ios?.buildNumber ?? '1'
  })`;

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

      <Text style={styles.eyebrow}>◆ Support</Text>
      <Text style={styles.title}>Ask a person.</Text>

      <Card flush style={styles.card}>
        <Row
          label="Message support"
          detail={SUPPORT_EMAIL}
          onPress={open(`mailto:${SUPPORT_EMAIL}`)}
        />
        <Row label="Frequently asked questions" onPress={open('https://visapics.org/faq')} />
        <Row
          label="Why was my photo rejected?"
          onPress={open('https://visapics.org/faq')}
        />
        <Row label="Request a refund" detail="Apple" onPress={open(APPLE_REFUNDS)} />
      </Card>

      <Text style={[styles.eyebrow, styles.sectionLabel]}>Legal</Text>
      <Card flush style={styles.card}>
        <Row
          label="Terms of use"
          onPress={() => config && void Linking.openURL(config.legal.terms_url)}
        />
        <Row
          label="Privacy policy"
          onPress={() => config && void Linking.openURL(config.legal.privacy_url)}
        />
        <Row label="Open-source licences" onPress={() => router.push('/licences')} />
      </Card>

      {config ? <Text style={styles.disclaimer}>{config.legal.disclaimer}</Text> : null}
      <Text style={styles.version}>Version {version}</Text>

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
  sectionLabel: { fontSize: 9.5, letterSpacing: 1.33, marginBottom: 9 },
  title: { ...display(26), marginBottom: theme.space.lg },

  card: { marginBottom: theme.space.lg },
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
  rowDetail: { fontFamily: theme.type.mono, fontSize: 10.5, color: theme.color.faint },

  disclaimer: {
    fontFamily: theme.type.body,
    fontSize: 11,
    lineHeight: 16.5,
    color: theme.color.faint,
  },
  version: {
    ...eyebrow,
    fontSize: 9,
    letterSpacing: 0.9,
    marginTop: theme.space.md,
  },
});
