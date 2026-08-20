/**
 * The print sheet. Layout follows the design reference (lines 693–763), minus
 * everything the spec cut: no delivery options, no checkout, no order history
 * and no saved cards — so no payment surface other than the App Store enters
 * the binary.
 *
 * The sheet is four photos with cut lines on a 4×6 inch canvas, adaptive to
 * 5×7 for large formats. The reference labels it "A4 · 4 UP"; the pipeline has
 * never produced A4.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SITE_BASE } from '../../src/api/client';
import { useSpecifications } from '../../src/api/hooks';
import { Button, Card } from '../../src/components';
import { formatDimensions } from '../../src/format';
import { saveToFiles, saveToPhotos } from '../../src/photo/download';
import { completed, unlockPhoto, usePhotoStatus } from '../../src/photo/upload';
import { useDraftStore } from '../../src/store/draft';
import { display, eyebrow, shadow, theme } from '../../src/theme';

export default function Prints() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const taskId = useDraftStore((s) => s.taskId);
  const countryCode = useDraftStore((s) => s.countryCode);
  const documentType = useDraftStore((s) => s.documentType);
  const unlockedAt = useDraftStore((s) => s.unlockedAt);

  const status = usePhotoStatus(taskId);
  const result = completed(status.data);
  const { data: documents } = useSpecifications(countryCode ?? '');
  const spec = documents?.find((d) => d.document_type === documentType);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<'saved' | 'denied' | null>(null);

  const sheet = result?.printable_preview_url
    ? `${SITE_BASE}${result.printable_preview_url}`
    : null;

  const save = async (where: 'photos' | 'files') => {
    if (!taskId) return;
    setSaving(true);
    setSaved(null);
    try {
      // Unlocking again is free and idempotent per task on the server, and it
      // is what issues a fresh download token — the last one expired minutes
      // after it was made.
      const unlocked = await unlockPhoto(taskId);
      const url = unlocked.printable_photo_url ?? unlocked.digital_photo_url;
      if (where === 'files') await saveToFiles(`${SITE_BASE}${url}`);
      else setSaved(await saveToPhotos(`${SITE_BASE}${url}`));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}
    >
      <Text style={styles.eyebrow}>◆ Prints</Text>
      <Text style={styles.title}>Get it on paper.</Text>

      {!result ? (
        <Text style={styles.empty}>
          Make a photo first and its print sheet appears here, ready for any photo lab.
        </Text>
      ) : (
        <>
          {!unlockedAt ? (
            <Card style={styles.lockedCard}>
              <Text style={styles.lockedEyebrow}>◆ Unlock first</Text>
              <Text style={styles.lockedBody}>
                Prints are made from the finished photo, so unlock it before printing. Your
                unlock covers both the digital file and this sheet.
              </Text>
              <Button label="Go to my photo" onPress={() => router.push('/result')} />
            </Card>
          ) : null}

          <Card style={[styles.sheetCard, shadow.subtle]}>
            {sheet ? (
              <Image
                source={{ uri: sheet }}
                style={styles.sheetImage}
                resizeMode="contain"
                accessibilityLabel="Print sheet"
              />
            ) : null}
            <Text style={styles.sheetTitle}>{documentType}</Text>
            <Text style={styles.sheetMeta}>
              4 photos · cut lines{spec ? ` · ${formatDimensions(spec)} · ${spec.dpi} dpi` : ''}
            </Text>
          </Card>

          {unlockedAt ? (
            <View style={styles.actions}>
              <Button label="Save sheet to Photos" busy={saving} onPress={() => void save('photos')} />
              <Button
                label="Save sheet to Files"
                variant="secondary"
                onPress={() => void save('files')}
              />
              {saved === 'denied' ? (
                <Text style={styles.note}>
                  VisaPics needs permission to add to your photo library. Save to Files instead,
                  or turn it on in Settings.
                </Text>
              ) : saved === 'saved' ? (
                <Text style={styles.note}>Saved to your photo library.</Text>
              ) : (
                <Text style={styles.note}>
                  Print at any lab at 100% scale — the cut lines are part of the sheet.
                </Text>
              )}
            </View>
          ) : null}
        </>
      )}

      <View style={{ height: insets.bottom + theme.space.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.surface },
  content: { paddingHorizontal: theme.space.xl, paddingBottom: theme.space.xl },
  eyebrow: { ...eyebrow, marginBottom: 6 },
  title: { ...display(27), marginBottom: 15 },
  empty: {
    fontFamily: theme.type.body,
    fontSize: 14,
    lineHeight: 21,
    color: theme.color.muted,
  },

  lockedCard: { borderColor: theme.color.borderStrong, padding: theme.space.lg, marginBottom: theme.space.lg },
  lockedEyebrow: { ...eyebrow, fontSize: 9.5, letterSpacing: 1.33, marginBottom: theme.space.xs },
  lockedBody: {
    fontFamily: theme.type.body,
    fontSize: 13,
    lineHeight: 20,
    color: theme.color.muted,
    marginBottom: 13,
  },

  sheetCard: { padding: 14, marginBottom: theme.space.lg },
  sheetImage: {
    width: '100%',
    height: 260,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
  },
  sheetTitle: {
    fontFamily: theme.type.bodyMedium,
    fontSize: 13.5,
    color: theme.color.text,
    marginTop: theme.space.md,
  },
  sheetMeta: {
    fontFamily: theme.type.mono,
    fontSize: 9.5,
    letterSpacing: 0.76,
    textTransform: 'uppercase',
    color: theme.color.faint,
    marginTop: 2,
  },

  actions: { gap: 9 },
  note: {
    fontFamily: theme.type.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: theme.color.muted,
    textAlign: 'center',
  },
});
