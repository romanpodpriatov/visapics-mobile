/**
 * What one document requires. Layout follows the design reference
 * (lines 384–444).
 *
 * Two things in the reference are not reproduced. Its rule list is six lines of
 * hardcoded UK copy — head coverings, shoulders, children under six — that
 * nothing in the catalogue holds, so the list here is built from the
 * specification and is short when the specification is. And its source line
 * claims the government source was "verified 14 Jun 2026"; what we hold is when
 * the row last changed, which is what it now says.
 *
 * The disclaimer ships verbatim from config.legal — the app shows government
 * requirements and must not imply the government endorses it.
 */
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConfig, useSpecification } from '../src/api/hooks';
import { Button, Card } from '../src/components';
import { buildRules, buildSpecRows, formatSpecDate } from '../src/format';
import { useDraftStore } from '../src/store/draft';
import { display, eyebrow, hitSlopTo44, shadow, theme } from '../src/theme';

const compliant = require('../assets/examples/specimen-after.jpg');
const original = require('../assets/examples/specimen-before.jpg');

export default function Requirements() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const countryCode = useDraftStore((s) => s.countryCode);
  const documentType = useDraftStore((s) => s.documentType);

  const { data: config } = useConfig();
  const { data: spec, isError } = useSpecification(countryCode ?? '', documentType ?? '');

  const updated = formatSpecDate(spec?.spec_updated_at ?? null);

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

      <Text style={styles.eyebrow}>◆ Official spec</Text>
      <Text style={styles.title}>{documentType ?? 'Choose a document first'}</Text>

      {spec ? (
        <>
          <Card flush style={styles.specCard}>
            <View style={styles.specBody}>
              <View style={styles.diagram}>
                <Image source={compliant} style={styles.diagramImage} resizeMode="contain" />
                <View style={styles.headBar} />
                <Text style={styles.headLabel}>HEAD</Text>
              </View>
              <View style={styles.rows}>
                {buildSpecRows(spec).map((row) => (
                  <View key={row.label} style={styles.specRow}>
                    <Text style={styles.specLabel}>{row.label}</Text>
                    <Text style={styles.specValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.sourceRow}>
              <View style={styles.sourceDot} />
              <Text style={styles.sourceText}>
                Source: {spec.country_name} government spec
                {updated ? ` · last updated ${updated}` : ''}
              </Text>
            </View>
          </Card>

          <Text style={[styles.eyebrow, styles.sectionLabel]}>Rules that get photos rejected</Text>
          <Card flush style={styles.rulesCard}>
            {buildRules(spec).map((rule) => (
              <View key={rule.label} style={styles.ruleRow}>
                <Text style={[styles.ruleGlyph, rule.allowed ? styles.ruleOk : styles.ruleNo]}>
                  {rule.allowed ? '✓' : '✕'}
                </Text>
                <View style={styles.ruleText}>
                  <Text style={styles.ruleLabel}>{rule.label}</Text>
                  <Text style={styles.ruleBody}>{rule.body}</Text>
                </View>
              </View>
            ))}
          </Card>

          <Text style={[styles.eyebrow, styles.sectionLabel]}>Accepted vs rejected</Text>
          <View style={styles.examples}>
            <View style={[styles.example, styles.exampleOk]}>
              <Image source={compliant} style={styles.exampleImage} resizeMode="contain" />
              <Text style={[styles.exampleCaption, styles.captionOk]}>✓ Compliant example</Text>
            </View>
            <View style={[styles.example, styles.exampleBad]}>
              <Image source={original} style={styles.exampleImage} resizeMode="contain" />
              <Text style={[styles.exampleCaption, styles.captionBad]}>✕ Original snapshot</Text>
            </View>
          </View>

          <Button label="Take a photo for this spec" onPress={() => router.push('/permission')} />
        </>
      ) : (
        <Text style={styles.pending}>
          {!documentType
            ? 'Pick a country and a document, and its official measurements appear here.'
            : isError
              ? 'Could not load this specification. Check your connection and try again.'
              : 'Loading the official measurements…'}
        </Text>
      )}

      {config ? <Text style={styles.disclaimer}>{config.legal.disclaimer}</Text> : null}

      <View style={{ height: insets.bottom + theme.space.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.surface },
  content: { paddingHorizontal: theme.space.xl, paddingBottom: theme.space.xxl },

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
  sectionLabel: { fontSize: 9.5, letterSpacing: 1.33, marginTop: theme.space.lg, marginBottom: 9 },
  title: { ...display(26), lineHeight: 29, marginBottom: 14 },

  specCard: { ...shadow.subtle },
  specBody: { flexDirection: 'row', gap: theme.space.lg, padding: theme.space.lg },
  diagram: { width: 126, aspectRatio: 0.79 },
  diagramImage: {
    width: '100%',
    height: '100%',
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
    backgroundColor: theme.color.card,
  },
  // Inside the picture, not beside it. At left: -6 the bar and its label sat
  // outside the diagram and were clipped by the card, which read as the
  // measurement sliding off to the left.
  headBar: {
    position: 'absolute',
    left: 7,
    top: '14%',
    bottom: '8%',
    width: 1,
    backgroundColor: theme.color.accent,
  },
  headLabel: {
    position: 'absolute',
    left: 11,
    top: '44%',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(11,17,32,.66)',
    fontFamily: theme.type.mono,
    fontSize: 8,
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
  rows: { flex: 1, gap: 9 },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.hairline,
  },
  specLabel: { fontFamily: theme.type.body, fontSize: 12, color: theme.color.muted },
  specValue: {
    fontFamily: theme.type.mono,
    fontSize: 11,
    color: theme.color.text,
    textAlign: 'right',
    flexShrink: 1,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  sourceDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.color.success },
  sourceText: { flex: 1, fontFamily: theme.type.body, fontSize: 11.5, color: theme.color.muted },

  rulesCard: { borderRadius: 14 },
  ruleRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: theme.space.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.hairline,
  },
  ruleGlyph: {
    width: 16,
    height: 16,
    borderRadius: 9,
    textAlign: 'center',
    lineHeight: 16,
    fontSize: 9,
    color: '#FFFFFF',
    fontFamily: theme.type.bodySemiBold,
    marginTop: 1,
  },
  ruleOk: { backgroundColor: theme.color.success },
  ruleNo: { backgroundColor: theme.color.danger },
  ruleText: { flex: 1 },
  ruleLabel: { fontFamily: theme.type.bodyMedium, fontSize: 13.5, color: theme.color.text },
  ruleBody: {
    fontFamily: theme.type.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.color.muted,
    marginTop: 2,
  },

  examples: { flexDirection: 'row', gap: 10, marginBottom: theme.space.lg },
  example: { flex: 1, borderWidth: 1, borderRadius: theme.radius.md, overflow: 'hidden' },
  exampleOk: { borderColor: '#A7F3D0', backgroundColor: theme.color.card },
  exampleBad: { borderColor: theme.color.dangerBorder, backgroundColor: theme.color.card },
  exampleImage: { width: '100%', height: 118, backgroundColor: theme.color.card },
  exampleCaption: {
    paddingHorizontal: 10,
    paddingVertical: theme.space.sm,
    fontFamily: theme.type.mono,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  captionOk: { color: theme.color.success },
  captionBad: { color: theme.color.danger },

  pending: {
    fontFamily: theme.type.body,
    fontSize: 14,
    lineHeight: 21,
    color: theme.color.muted,
    marginBottom: theme.space.lg,
  },
  disclaimer: {
    marginTop: theme.space.md,
    fontFamily: theme.type.body,
    fontSize: 11,
    lineHeight: 16.5,
    color: theme.color.faint,
  },
});
