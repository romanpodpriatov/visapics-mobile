/**
 * How the photo did. Layout follows the design reference (lines 511–635).
 *
 * The reference reports "Passed all 14 official checks" over fourteen invented
 * rows. The server reports five checks and counts only the ones the document
 * actually states — against a UK passport spec on production that is three, and
 * the other two come back as not_applicable. Those are hidden rather than shown
 * as passing: a specification with no file-size limit has not been satisfied on
 * file size, it simply had nothing to satisfy.
 *
 * The print sheet is a 4×6 inch sheet of four photos, not the mock's "A4 · 4 UP".
 */
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, SITE_BASE } from '../src/api/client';
import { useConfig } from '../src/api/hooks';
import { saveToVault } from '../src/api/vault';
import type { UnlockResult } from '../src/api/types';
import { Button, Card, ComplianceRow, Paywall } from '../src/components';
import { restorePurchases } from '../src/iap';
import { downloadToCache, saveToFiles, saveToPhotos } from '../src/photo/download';
import { completed, unlockPhoto, usePhotoStatus } from '../src/photo/upload';
import { useDraftStore } from '../src/store/draft';
import { display, eyebrow, hitSlopTo44, shadow, theme } from '../src/theme';

const absolute = (path: string) => (path.startsWith('http') ? path : `${SITE_BASE}${path}`);

export default function Result() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: config } = useConfig();

  const taskId = useDraftStore((s) => s.taskId);
  const countryCode = useDraftStore((s) => s.countryCode);
  const documentType = useDraftStore((s) => s.documentType);
  const markUnlocked = useDraftStore((s) => s.markUnlocked);
  const status = usePhotoStatus(taskId);

  const [tab, setTab] = useState<'digital' | 'print'>('digital');
  const [unlocked, setUnlocked] = useState<UnlockResult | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [needsCredits, setNeedsCredits] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [expired, setExpired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<'saved' | 'denied' | null>(null);
  const [savedToVault, setSavedToVault] = useState(false);
  const queryClient = useQueryClient();

  const result = completed(status.data);
  const compliance = result?.compliance;
  const checks = (compliance?.checks ?? []).filter((c) => c.verdict !== 'not_applicable');
  const failing = checks.filter((c) => c.verdict === 'fail');
  const failed = failing.length > 0;

  const unlock = async () => {
    if (!taskId) return;
    setUnlocking(true);
    try {
      setUnlocked(await unlockPhoto(taskId));
      markUnlocked();
      setNeedsCredits(false);
    } catch (error: unknown) {
      // 402 carries the product catalogue, and is the only place the paywall
      // opens: nobody is asked to pay until there is something to pay for.
      // 410 is not a fault: processed files are deleted after the retention
      // window, and saying so plainly beats a generic error.
      if (error instanceof ApiError && (error.status === 410 || error.status === 409)) {
        setExpired(true);
      } else if (error instanceof ApiError && error.status === 402) {
        // Play Billing is a later delta, so on Android there is nothing to
        // open — saying so is better than a sheet that cannot sell anything.
        if (Platform.OS === 'ios') setPaywall(true);
        else setNeedsCredits(true);
      }
    } finally {
      setUnlocking(false);
    }
  };

  const afterCredits = async () => {
    setPaywall(false);
    await queryClient.invalidateQueries({ queryKey: ['credits'] });
    await unlock();
  };

  const save = async (where: 'photos' | 'files' | 'vault') => {
    if (!unlocked) return;
    const url = absolute(unlocked.digital_photo_url);
    setSaving(true);
    setSaved(null);
    try {
      if (where === 'files') {
        await saveToFiles(url);
      } else if (where === 'vault') {
        // The vault takes a file, not a URL, and the URL expires shortly.
        const local = await downloadToCache(url);
        await saveToVault(local, {
          countryCode: countryCode ?? '',
          documentType: documentType ?? '',
        });
        await queryClient.invalidateQueries({ queryKey: ['vault-photos'] });
        setSavedToVault(true);
      } else {
        setSaved(await saveToPhotos(url));
      }
    } finally {
      setSaving(false);
    }
  };

  const restore = async () => {
    setRestoring(true);
    try {
      const { restored } = await restorePurchases();
      if (restored > 0) await afterCredits();
    } finally {
      setRestoring(false);
    }
  };

  const digitalImage = unlocked?.digital_photo_url
    ? absolute(unlocked.digital_photo_url)
    : result?.preview_url
      ? absolute(result.preview_url)
      : null;
  const printImage = result?.printable_preview_url
    ? absolute(result.printable_preview_url)
    : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 14 }]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/photos')}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={hitSlopTo44(34)}
          style={styles.back}
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={[styles.verdict, failed ? styles.verdictFail : styles.verdictPass]}>
          {failed
            ? `⚠ ${failing.length} ${failing.length === 1 ? 'rule' : 'rules'} to fix`
            : unlocked
              ? '✓ Purchased'
              : '✓ Preview · free'}
        </Text>
      </View>

      <Text style={styles.eyebrow}>◆ {failed ? 'Not compliant yet' : 'Your result'}</Text>
      <Text style={styles.headline}>
        {failed
          ? failing.length === 1
            ? 'One rule needs fixing.'
            : `${failing.length} rules need fixing.`
          : compliance
            ? `Passed all ${compliance.total} checks.`
            : 'Your photo is ready.'}
      </Text>

      {!failed && printImage ? (
        <View style={styles.tabs}>
          <Pressable
            onPress={() => setTab('digital')}
            accessibilityRole="button"
            style={[styles.tab, tab === 'digital' && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, tab === 'digital' && styles.tabLabelActive]}>
              Digital
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('print')}
            accessibilityRole="button"
            style={[styles.tab, tab === 'print' && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, tab === 'print' && styles.tabLabelActive]}>
              Print sheet
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Card style={[styles.photoCard, shadow.subtle]}>
        {tab === 'digital' || failed ? (
          digitalImage ? (
            <Image
              source={{ uri: digitalImage }}
              style={styles.photo}
              resizeMode="contain"
              accessibilityLabel="Your photo"
            />
          ) : (
            <Text style={styles.pending}>Preparing your photo…</Text>
          )
        ) : (
          <>
            {printImage ? (
              <Image
                source={{ uri: printImage }}
                style={styles.sheet}
                resizeMode="contain"
                accessibilityLabel="Print sheet"
              />
            ) : null}
            <Text style={styles.sheetNote}>
              Four photos on one sheet with cut lines, ready for any photo lab.
            </Text>
          </>
        )}
      </Card>

      {checks.length ? (
        <Card flush style={styles.reportCard}>
          <View style={styles.reportHead}>
            <Text style={styles.reportTitle}>◆ Compliance report</Text>
            <Text style={styles.reportCount}>
              {compliance?.passed ?? 0} / {compliance?.total ?? checks.length} pass
            </Text>
          </View>
          {checks.map((check) => (
            <ComplianceRow key={check.key} check={check} />
          ))}
        </Card>
      ) : null}

      {failed ? (
        <View style={styles.failCard}>
          <Text style={styles.failEyebrow}>◆ Nothing was charged</Text>
          <Text style={styles.failBody}>
            You only pay for a photo that passes. Coaching fixes head size and background
            automatically — it is the fastest route from here.
          </Text>
          <Button
            label="Retake with coaching"
            onPress={() => router.replace('/permission')}
            style={styles.failAction}
          />
          <Button
            label="Try a different photo"
            variant="secondary"
            onPress={() => router.replace('/photos')}
          />
        </View>
      ) : unlocked ? (
        <View style={styles.unlockedActions}>
          <Button
            label="Save to Photos"
            busy={saving}
            onPress={() => void save('photos')}
          />
          <Button
            label="Save to Files"
            variant="secondary"
            onPress={() => void save('files')}
          />
          <Button
            label={savedToVault ? 'Saved to your vault' : 'Save to vault'}
            variant="secondary"
            disabled={savedToVault}
            onPress={() => void save('vault')}
          />
          {saved === 'denied' ? (
            <Text style={styles.expiry}>
              VisaPics needs permission to add to your photo library. Save to Files instead, or
              turn it on in Settings.
            </Text>
          ) : saved === 'saved' ? (
            <Text style={styles.expiry}>Saved to your photo library.</Text>
          ) : (
            <Text style={styles.expiry}>
              Your download links stay valid for{' '}
              {Math.round((unlocked.expires_in ?? 900) / 60)} minutes.
            </Text>
          )}
        </View>
      ) : expired ? (
        <View style={styles.failCard}>
          <Text style={styles.failEyebrow}>◆ This photo has expired</Text>
          <Text style={styles.failBody}>
            Photos are deleted from the server after the retention window, and this one is gone.
            Nothing was charged for it.
          </Text>
          <Button label="Take a new photo" onPress={() => router.replace('/permission')} />
        </View>
      ) : result?.unlock_required ? (
        <Card style={styles.unlockCard}>
          <Text style={styles.unlockTitle}>Unlock this photo</Text>
          <Text style={styles.unlockBody}>
            Removes the watermark and unlocks the digital file plus the printable sheet. Retakes
            stay free.
          </Text>
          {needsCredits ? (
            <Text style={styles.unlockNote}>
              You have no photo credits left on this device.
            </Text>
          ) : null}
          <Button label="Unlock & download" onPress={() => void unlock()} busy={unlocking} />
          <Text style={styles.unlockFootnote}>
            In-app purchase · rejected photos reprocessed free
          </Text>
        </Card>
      ) : null}

      <Paywall
        visible={paywall}
        onClose={() => setPaywall(false)}
        onPurchased={() => void afterCredits()}
        onRestore={() => void restore()}
        restoring={restoring}
      />

      {config ? <Text style={styles.disclaimer}>{config.legal.disclaimer}</Text> : null}
      <View style={{ height: insets.bottom + theme.space.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.surface },
  content: { paddingHorizontal: theme.space.xl, paddingBottom: theme.space.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  back: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: { fontSize: 22, lineHeight: 24, color: theme.color.text },
  verdict: {
    height: 28,
    lineHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    overflow: 'hidden',
    fontFamily: theme.type.mono,
    fontSize: 9.5,
    letterSpacing: 1.14,
    textTransform: 'uppercase',
  },
  verdictPass: { backgroundColor: theme.color.successWash, color: theme.color.success },
  verdictFail: { backgroundColor: theme.color.warningWash, color: theme.color.warning },

  eyebrow: { ...eyebrow, marginBottom: 7 },
  headline: { ...display(28), lineHeight: 30.8, marginBottom: theme.space.lg },

  tabs: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 3,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.card,
    marginBottom: 14,
  },
  tab: { height: 32, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center' },
  tabActive: { backgroundColor: theme.color.text },
  tabLabel: { fontFamily: theme.type.bodyMedium, fontSize: 13, color: theme.color.muted },
  tabLabelActive: { color: '#FFFFFF' },

  photoCard: { padding: theme.space.lg, alignItems: 'center', marginBottom: 14 },
  photo: { width: 214, height: 275, backgroundColor: '#F8FAFC' },
  sheet: { width: '100%', height: 240, backgroundColor: '#F8FAFC' },
  sheetNote: {
    fontFamily: theme.type.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: theme.color.muted,
    marginTop: 11,
  },
  pending: { fontFamily: theme.type.body, fontSize: 14, color: theme.color.muted },

  reportCard: { marginBottom: 14 },
  reportHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: theme.space.md,
    backgroundColor: theme.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  reportTitle: { ...eyebrow, fontSize: 9.5, letterSpacing: 1.33 },
  reportCount: {
    fontFamily: theme.type.mono,
    fontSize: 9.5,
    letterSpacing: 0.57,
    color: theme.color.success,
  },

  failCard: {
    borderWidth: 1,
    borderColor: theme.color.warningBorder,
    borderRadius: theme.radius.card,
    backgroundColor: theme.color.warningWash,
    padding: theme.space.lg,
    marginBottom: 10,
  },
  failEyebrow: { ...eyebrow, fontSize: 9.5, letterSpacing: 1.33, color: theme.color.warning },
  failBody: {
    fontFamily: theme.type.body,
    fontSize: 13,
    lineHeight: 20,
    color: '#78350F',
    marginTop: 4,
    marginBottom: 13,
  },
  failAction: { marginBottom: 9 },

  unlockCard: {
    borderColor: theme.color.borderStrong,
    padding: theme.space.lg,
    marginBottom: theme.space.sm,
  },
  unlockTitle: { fontFamily: theme.type.bodyMedium, fontSize: 14.5, color: theme.color.text },
  unlockBody: {
    fontFamily: theme.type.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: theme.color.muted,
    marginTop: 5,
    marginBottom: 13,
  },
  unlockNote: {
    fontFamily: theme.type.body,
    fontSize: 12.5,
    color: theme.color.warning,
    marginBottom: 10,
  },
  unlockFootnote: {
    ...eyebrow,
    fontSize: 9.5,
    letterSpacing: 0.95,
    textAlign: 'center',
    marginTop: 10,
  },

  unlockedActions: { gap: 9 },
  expiry: {
    fontFamily: theme.type.body,
    fontSize: 12,
    color: theme.color.muted,
    textAlign: 'center',
  },

  disclaimer: {
    marginTop: 14,
    fontFamily: theme.type.body,
    fontSize: 11,
    lineHeight: 16.5,
    color: theme.color.faint,
  },
});
