/**
 * Waiting for the server. Layout follows the design reference (lines 473–509).
 *
 * The step list is not a local guess: each poll reports what the pipeline is
 * doing, and the steps accumulate as they are seen, so a slow stage looks slow
 * rather than looking stuck. The reference promises "20–30 seconds"; measured
 * against production with enhancement on, a 1600×2133 photo took 66, so the
 * screen says about a minute.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../src/api/client';
import { useSpecifications } from '../src/api/hooks';
import { Button, Card, UploadErrorSheet, type UploadProblemDetail } from '../src/components';
import { formatDimensions } from '../src/format';
import { startProcessing, uploadErrorMessage, usePhotoStatus } from '../src/photo/upload';
import { failureFromServer } from '../src/photo/validate';
import { useDraftStore } from '../src/store/draft';
import { display, eyebrow, shadow, theme } from '../src/theme';

export default function Processing() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { photo } = useLocalSearchParams<{ photo?: string }>();

  const countryCode = useDraftStore((s) => s.countryCode);
  const documentType = useDraftStore((s) => s.documentType);
  const removeBackground = useDraftStore((s) => s.removeBackground);
  const enhance = useDraftStore((s) => s.enhance);
  const taskId = useDraftStore((s) => s.taskId);
  const setTask = useDraftStore((s) => s.setTask);

  const { data: documents } = useSpecifications(countryCode ?? '');
  const spec = documents?.find((d) => d.document_type === documentType);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current || !photo || !countryCode || !documentType) return;
    submitted.current = true;

    startProcessing(photo, { countryCode, documentType, removeBackground, enhance })
      .then(setTask)
      .catch((error: unknown) => setUploadError(uploadErrorMessage(error)));
  }, [photo, countryCode, documentType, removeBackground, enhance, setTask]);

  const status = usePhotoStatus(taskId);
  const state = status.data?.state;
  const progress = status.data?.progress ?? 0;
  const stage = status.data?.status ?? 'Uploading photo';

  // The stages the server has reported so far, in the order it reported them.
  const [stages, setStages] = useState<string[]>([]);
  useEffect(() => {
    setStages((seen) => (seen[seen.length - 1] === stage ? seen : [...seen, stage]));
  }, [stage]);

  useEffect(() => {
    if (state === 'SUCCESS') router.replace('/result');
  }, [state, router]);

  const failure = status.error instanceof ApiError ? status.error : null;
  const failureDetail =
    failure && typeof failure.data === 'object' && failure.data !== null
      ? String((failure.data as { details?: unknown }).details ?? '')
      : '';
  const knownProblem = failureDetail ? failureFromServer(failureDetail) : null;
  const problem: UploadProblemDetail | null = knownProblem ? { kind: knownProblem } : null;

  const stalled = taskId !== null && !state && status.isFetched && !status.isFetching;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 22 }]}>
      <Text style={styles.eyebrow}>◆ Processing</Text>
      <Text style={styles.title}>Crafting your photo.</Text>
      <Text style={styles.subtitle}>
        {documentType ?? 'Your document'}
        {spec ? ` · ${formatDimensions(spec)}` : ''}
      </Text>

      {photo ? (
        <View style={styles.preview}>
          <Image source={{ uri: photo }} style={styles.previewImage} resizeMode="cover" />
          <View style={styles.previewTag}>
            <View style={styles.previewDot} />
            <Text style={styles.previewTagText}>Your photo</Text>
          </View>
        </View>
      ) : null}

      <Card style={[styles.card, shadow.subtle]}>
        <View style={styles.cardHead}>
          <Text style={styles.stage}>{stage.toUpperCase()}</Text>
          <Text style={styles.percent}>{progress}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(progress, 4)}%` }]} />
        </View>

        {uploadError || failure ? (
          <>
            <Text style={styles.error}>
              {uploadError ?? failureDetail ?? 'Processing failed.'}
            </Text>
            <Button
              label="Try a different photo"
              onPress={() => {
                setTask(null);
                router.back();
              }}
            />
          </>
        ) : (
          <>
            <Text style={styles.note}>
              This usually takes about a minute. Keep the app open.
            </Text>
            <View style={styles.steps}>
              {stages.map((seen, index) => (
                <View key={seen} style={styles.step}>
                  <Text
                    style={[
                      styles.stepGlyph,
                      index < stages.length - 1 ? styles.stepDone : styles.stepNow,
                    ]}
                  >
                    {index < stages.length - 1 ? '✓' : '›'}
                  </Text>
                  <Text style={styles.stepLabel}>{seen}</Text>
                </View>
              ))}
              {stalled ? null : <ActivityIndicator color={theme.color.brand} />}
            </View>
          </>
        )}
      </Card>

      <UploadErrorSheet
        problem={problem}
        onResolve={() => {
          setTask(null);
          router.back();
        }}
        onCancel={() => {
          setTask(null);
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.surface, paddingHorizontal: theme.space.xl },
  eyebrow: { ...eyebrow, marginBottom: theme.space.sm },
  title: { ...display(29), lineHeight: 31.3, marginBottom: theme.space.xs },
  subtitle: {
    fontFamily: theme.type.body,
    fontSize: 14,
    color: theme.color.muted,
    marginBottom: theme.space.xl,
  },

  preview: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    backgroundColor: theme.color.card,
    marginBottom: 18,
  },
  previewImage: { width: '100%', height: 236, opacity: 0.72 },
  previewTag: {
    position: 'absolute',
    left: 12,
    bottom: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  previewDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' },
  previewTagText: {
    fontFamily: theme.type.mono,
    fontSize: 9.5,
    letterSpacing: 1.33,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },

  card: { padding: 17 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  stage: {
    flex: 1,
    fontFamily: theme.type.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: theme.color.brand,
  },
  percent: { fontFamily: theme.type.mono, fontSize: 21, color: theme.color.text },
  track: {
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.color.surface,
    overflow: 'hidden',
    marginBottom: 11,
  },
  fill: { height: 7, borderRadius: 4, backgroundColor: theme.color.brand },
  note: {
    fontFamily: theme.type.body,
    fontSize: 12.5,
    color: theme.color.muted,
    marginBottom: 15,
  },
  error: {
    fontFamily: theme.type.body,
    fontSize: 13,
    lineHeight: 19.5,
    color: theme.color.danger,
    marginBottom: 15,
  },
  steps: { gap: 10 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepGlyph: {
    width: 16,
    height: 16,
    borderRadius: 9,
    textAlign: 'center',
    lineHeight: 16,
    fontSize: 9,
    color: '#FFFFFF',
    fontFamily: theme.type.bodySemiBold,
    overflow: 'hidden',
  },
  stepDone: { backgroundColor: theme.color.success },
  stepNow: { backgroundColor: theme.color.brand },
  stepLabel: { flex: 1, fontFamily: theme.type.body, fontSize: 13.5, color: theme.color.text },
});
