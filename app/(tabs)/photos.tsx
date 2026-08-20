/**
 * Home. Layout follows the design reference (lines 212–323).
 *
 * Four figures in the reference are not reproduced: "30 seconds · 14 checks",
 * the "14 RULES" badge, "This week 18,402 photos" and "Rating 4.9 / 5". The
 * first two are wrong — the server reports a per-document count of the rules
 * that applied, which is not a fixed 14 — and the last two are inventions. The
 * counts that remain all come from /api/v1/config.
 */
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConfig, useCredits, useSpecifications } from '../../src/api/hooks';
import { Button, Card, Toggle } from '../../src/components';
import { CameraIcon, ChevronIcon, ImageIcon, InfoIcon } from '../../src/components/icons';
import { creditLabel, flagEmoji, formatDimensions, verifiedLine } from '../../src/format';
import { deletionLabel, hoursLeft, useDraftStore } from '../../src/store/draft';
import { display, eyebrow, shadow, theme } from '../../src/theme';

/** The countries people arrive looking for. Every code exists in the catalogue. */
const POPULAR: [string, string][] = [
  ['us', 'US'],
  ['gb', 'UK'],
  ['in', 'India'],
  ['eu', 'Schengen'],
  ['ca', 'Canada'],
  ['jp', 'Japan'],
];

export default function Photos() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: config } = useConfig();
  const { data: credits } = useCredits();

  const countryCode = useDraftStore((s) => s.countryCode);
  const documentType = useDraftStore((s) => s.documentType);
  const removeBackground = useDraftStore((s) => s.removeBackground);
  const enhance = useDraftStore((s) => s.enhance);
  const taskId = useDraftStore((s) => s.taskId);
  const taskStartedAt = useDraftStore((s) => s.taskStartedAt);
  const setOption = useDraftStore((s) => s.setOption);

  // The country's document list, not the single-document endpoint: it is the
  // same list the picker loads, and it holds every document whose name
  // contains a slash — which the per-document route cannot address.
  const { data: documents } = useSpecifications(countryCode ?? '');
  const spec = documents?.find((d) => d.document_type === documentType);
  const specLine = spec
    ? [formatDimensions(spec), spec.background_color?.replace(/_/g, ' ')].filter(Boolean).join(' · ')
    : 'Country and document type';

  const retentionHours = config?.retention_hours;
  const remaining =
    taskStartedAt && retentionHours ? hoursLeft(taskStartedAt, retentionHours, Date.now()) : 0;
  const showDraft = Boolean(taskId) && remaining > 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.space.xs }]}
    >
      <View style={styles.header}>
        <Text style={styles.wordmark}>VisaPics</Text>
        <Pressable
          onPress={() => router.push('/account')}
          accessibilityRole="button"
          accessibilityLabel="Account"
          style={styles.creditPill}
        >
          <View style={styles.creditDot} />
          <Text style={styles.creditText}>{creditLabel(credits?.credits_remaining)}</Text>
        </Pressable>
      </View>

      <Text style={styles.eyebrow}>◆ 30 seconds · free preview</Text>
      <Text style={styles.title}>Make a photo they{'\n'}cannot reject.</Text>

      <Card flush style={styles.mainCard}>
        <Pressable
          onPress={() => router.push('/picker')}
          accessibilityRole="button"
          style={styles.documentRow}
        >
          <Text style={styles.flag}>{countryCode ? flagEmoji(countryCode) : '◇'}</Text>
          <View style={styles.documentText}>
            <Text style={styles.rowLabel}>Document</Text>
            <Text style={styles.documentTitle}>{documentType ?? 'Choose a document'}</Text>
            <Text style={styles.documentSpec}>{specLine}</Text>
          </View>
          <ChevronIcon />
        </Pressable>

        <Pressable
          onPress={() => router.push('/requirements')}
          accessibilityRole="button"
          disabled={!documentType}
          style={[styles.rulesRow, !documentType && styles.rulesRowInert]}
        >
          <InfoIcon />
          <Text style={styles.rulesText}>See the official rules for this document</Text>
        </Pressable>

        <View style={styles.toggles}>
          <Toggle
            value={removeBackground}
            onChange={(next) => setOption('removeBackground', next)}
            label="Remove background"
            hint="Replaces it with the official colour for this spec"
          />
          <Toggle
            value={enhance}
            onChange={(next) => setOption('enhance', next)}
            label="AI quality enhance"
            hint="Sharpens face detail and lighting · adds ~10 s"
          />
        </View>

        <View style={styles.actions}>
          <Button
            label="Take photo with coaching"
            onPress={() => router.push('/permission')}
            icon={<CameraIcon size={19} color="#FFFFFF" />}
          />
          {/* Wired in Task 7, with the library and the bundled specimen. */}
          <Button
            label="Use a photo from library"
            variant="secondary"
            disabled
            onPress={() => undefined}
            icon={<ImageIcon size={17} color={theme.color.text} />}
          />
          <Button
            label="Try it with a sample photo"
            variant="ghost"
            disabled
            onPress={() => undefined}
          />
        </View>
      </Card>

      <Text style={[styles.eyebrow, styles.sectionLabel]}>Popular</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {POPULAR.map(([code, label]) => (
          <Pressable
            key={code}
            onPress={() => router.push(`/picker?country=${code}`)}
            accessibilityRole="button"
            style={styles.chip}
          >
            <Text style={styles.chipFlag}>{flagEmoji(code)}</Text>
            <Text style={styles.chipLabel}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {showDraft ? (
        <Card flush style={styles.draftCard}>
          <View style={styles.draftHead}>
            <Text style={styles.draftEyebrow}>◆ Continue</Text>
            <Text style={styles.draftExpiry}>Deletes in {deletionLabel(remaining)}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/result')}
            accessibilityRole="button"
            style={styles.draftBody}
          >
            <View style={styles.draftThumb} />
            <View style={styles.documentText}>
              <Text style={styles.draftTitle}>{documentType}</Text>
              <Text style={styles.documentSpec}>{specLine}</Text>
            </View>
            <ChevronIcon />
          </Pressable>
        </Card>
      ) : null}

      <View style={styles.trust}>
        <TrustRow
          glyph="✓"
          title="Free reprocessing if rejected"
          sub="Send us the rejection notice and we redo it at no cost"
        />
        <TrustRow
          glyph="⌧"
          title={
            retentionHours
              ? `Photos clear after ${deletionLabel(retentionHours)}`
              : 'Photos clear automatically'
          }
          sub="Nothing is kept unless you save it to the vault"
        />
        <TrustRow
          glyph="§"
          title="Official government sources"
          sub={config ? verifiedLine(config.coverage) : 'Every specification cites its source'}
        />
      </View>

      {config ? (
        <View style={styles.stats}>
          <Stat label="Coverage" value={String(config.coverage.countries)} unit="countries" />
          <Stat
            label="Document specs"
            value={String(config.coverage.specifications)}
            unit="types"
          />
        </View>
      ) : null}

      <View style={{ height: insets.bottom + theme.space.xl }} />
    </ScrollView>
  );
}

function TrustRow({ glyph, title, sub }: { glyph: string; title: string; sub: string }) {
  return (
    <View style={styles.trustRow}>
      <Text style={styles.trustGlyph}>{glyph}</Text>
      <View style={styles.trustText}>
        <Text style={styles.trustTitle}>{title}</Text>
        <Text style={styles.trustSub}>{sub}</Text>
      </View>
    </View>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value}
        <Text style={styles.statUnit}> {unit}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.surface },
  content: { paddingHorizontal: theme.space.xl, paddingBottom: theme.space.xxl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  wordmark: { fontFamily: theme.type.display, fontSize: 18, letterSpacing: -0.18 },
  creditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 34,
    paddingHorizontal: 11,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.card,
  },
  creditDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.color.success },
  creditText: {
    fontFamily: theme.type.mono,
    fontSize: 10.5,
    letterSpacing: 0.84,
    color: theme.color.text,
  },

  eyebrow: { ...eyebrow, marginBottom: theme.space.sm },
  sectionLabel: { fontSize: 9.5, letterSpacing: 1.33, marginBottom: 9 },
  title: { ...display(31), lineHeight: 33.5, marginBottom: 18 },

  mainCard: { marginBottom: theme.space.lg, ...shadow.card },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  flag: { fontSize: 24 },
  documentText: { flex: 1 },
  rowLabel: {
    fontFamily: theme.type.mono,
    fontSize: 9.5,
    letterSpacing: 1.33,
    textTransform: 'uppercase',
    color: theme.color.faint,
    marginBottom: 3,
  },
  documentTitle: { fontFamily: theme.type.bodyMedium, fontSize: 15, color: theme.color.text },
  documentSpec: { fontFamily: theme.type.body, fontSize: 12, color: theme.color.muted, marginTop: 2 },

  rulesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    paddingVertical: 10,
    backgroundColor: theme.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    minHeight: theme.minTouchTarget,
  },
  rulesRowInert: { opacity: 0.45 },
  rulesText: { flex: 1, fontFamily: theme.type.body, fontSize: 12.5, color: theme.color.brand },

  toggles: {
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  actions: { padding: theme.space.lg, paddingTop: 14, gap: 9 },

  chips: { gap: 7, paddingBottom: theme.space.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.card,
  },
  chipFlag: { fontSize: 15 },
  chipLabel: { fontFamily: theme.type.body, fontSize: 13, color: theme.color.text },

  draftCard: { marginTop: 18 },
  draftHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: theme.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  draftEyebrow: { ...eyebrow, fontSize: 9.5, letterSpacing: 1.33 },
  draftExpiry: {
    fontFamily: theme.type.mono,
    fontSize: 9.5,
    letterSpacing: 0.57,
    color: theme.color.warning,
  },
  draftBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingHorizontal: 14,
    paddingVertical: theme.space.md,
  },
  draftThumb: {
    width: 40,
    height: 52,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.brandSoft,
  },
  draftTitle: { fontFamily: theme.type.bodyMedium, fontSize: 14, color: theme.color.text },

  trust: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingTop: theme.space.lg,
    gap: 13,
  },
  trustRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  trustGlyph: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: theme.color.brandSoft,
    color: theme.color.brand,
    textAlign: 'center',
    lineHeight: 26,
    fontSize: 12,
    fontFamily: theme.type.bodySemiBold,
  },
  trustText: { flex: 1 },
  trustTitle: { fontFamily: theme.type.bodyMedium, fontSize: 13.5, color: theme.color.text },
  trustSub: { fontFamily: theme.type.body, fontSize: 12, color: theme.color.muted, marginTop: 2 },

  stats: {
    marginTop: 18,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.card,
    overflow: 'hidden',
  },
  stat: { flex: 1, paddingHorizontal: 14, paddingVertical: theme.space.md },
  statLabel: {
    fontFamily: theme.type.mono,
    fontSize: 9,
    letterSpacing: 1.26,
    textTransform: 'uppercase',
    color: theme.color.faint,
  },
  statValue: { ...display(20), marginTop: 3 },
  statUnit: { fontFamily: theme.type.body, fontSize: 11, color: theme.color.faint },
});
