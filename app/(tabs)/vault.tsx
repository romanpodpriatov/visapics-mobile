/**
 * Saved photos. Layout follows the design reference (lines 637–691).
 *
 * The guest banner states the retention window /api/v1/config reports rather
 * than the reference's hardcoded "22 h", which is what makes the sign-in
 * prompt a service instead of a nag: it is only worth saying "create an
 * account to keep them" if the number beside it is true.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConfig } from '../../src/api/hooks';
import {
  type VaultPhoto,
  deleteVaultPhoto,
  thumbnailSource,
  useVaultPhotos,
} from '../../src/api/vault';
import { Button, Card } from '../../src/components';
import { deletionLabel, flagEmoji } from '../../src/format';
import { useAuthStore } from '../../src/store/auth';
import { display, eyebrow, theme } from '../../src/theme';

export default function Vault() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: config } = useConfig();
  const { data: photos, isLoading } = useVaultPhotos();
  const isGuest = useAuthStore((s) => s.isAnonymous);
  const [deleting, setDeleting] = useState<number | null>(null);

  const remove = (photo: VaultPhoto) => {
    Alert.alert('Delete this photo?', 'It is removed from the server, not only from this list.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDeleting(photo.id);
          void deleteVaultPhoto(photo.id)
            .then(() => queryClient.invalidateQueries({ queryKey: ['vault-photos'] }))
            .finally(() => setDeleting(null));
        },
      },
    ]);
  };

  const empty = !isLoading && (photos ?? []).length === 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}
    >
      <Text style={styles.eyebrow}>◆ My photos</Text>
      <Text style={styles.title}>The vault.</Text>

      {isGuest ? (
        <View style={styles.guest}>
          <Text style={styles.guestTitle}>
            Guest vault
            {config ? ` · photos clear after ${deletionLabel(config.retention_hours)}` : ''}
          </Text>
          <Pressable onPress={() => router.push('/account')} accessibilityRole="button">
            <Text style={styles.guestLink}>Create a free account to keep them</Text>
          </Pressable>
        </View>
      ) : null}

      {empty ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptyBody}>
            Photos you save appear here with the document they were made for.
          </Text>
          <Button label="Make a photo" onPress={() => router.push('/photos')} />
        </Card>
      ) : (
        <View style={styles.grid}>
          {(photos ?? []).map((photo) => (
            <Pressable
              key={photo.id}
              onLongPress={() => remove(photo)}
              accessibilityRole="button"
              accessibilityLabel={photo.document_type ?? photo.original_filename}
              accessibilityHint="Press and hold to delete"
              style={[styles.tile, deleting === photo.id && styles.tileBusy]}
            >
              <Image
                source={thumbnailSource(photo)}
                style={styles.thumb}
                // A passport photo has a shape the document dictates. Cropping
                // it to a square tile shows a picture that would be refused.
                resizeMode="contain"
              />
              <View style={styles.tileText}>
                <View style={styles.tileTitleRow}>
                  <Text style={styles.tileFlag}>{flagEmoji(photo.country_code ?? '')}</Text>
                  <Text style={styles.tileName} numberOfLines={1}>
                    {photo.document_type ?? photo.original_filename}
                  </Text>
                </View>
                <Text style={styles.tileMeta}>
                  {photo.is_expired
                    ? 'Expired'
                    : photo.days_until_expiry !== null
                      ? `${photo.days_until_expiry} days left`
                      : 'Saved'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ height: insets.bottom + theme.space.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.surface },
  content: { paddingHorizontal: theme.space.xl, paddingBottom: theme.space.xl },
  eyebrow: { ...eyebrow, marginBottom: 6 },
  title: { ...display(27), marginBottom: 14 },

  guest: {
    flexDirection: 'column',
    padding: 13,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.brandSoft,
    marginBottom: theme.space.lg,
  },
  guestTitle: { fontFamily: theme.type.bodyMedium, fontSize: 13, color: theme.color.brand },
  guestLink: {
    fontFamily: theme.type.body,
    fontSize: 12.5,
    color: theme.color.brand,
    textDecorationLine: 'underline',
    paddingTop: 4,
  },

  emptyCard: { padding: theme.space.xxl, alignItems: 'center', gap: 5 },
  emptyTitle: { ...display(19) },
  emptyBody: {
    fontFamily: theme.type.body,
    fontSize: 13,
    lineHeight: 20,
    color: theme.color.muted,
    textAlign: 'center',
    marginBottom: 11,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.md },
  tile: {
    width: '48%',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.card,
    overflow: 'hidden',
  },
  tileBusy: { opacity: 0.4 },
  thumb: { width: '100%', height: 150, backgroundColor: '#F1F5F9' },
  tileText: { paddingHorizontal: 10, paddingTop: 9, paddingBottom: 11 },
  tileTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tileFlag: { fontSize: 13 },
  tileName: { flex: 1, fontFamily: theme.type.bodyMedium, fontSize: 12.5, color: theme.color.text },
  tileMeta: {
    fontFamily: theme.type.mono,
    fontSize: 9,
    letterSpacing: 0.54,
    color: theme.color.faint,
    marginTop: 4,
  },
});
