/**
 * The three ways an imported photo can be unusable, each with the fix.
 *
 * Copy follows the design reference (lines 1230–1242 and 1383–1386), minus one
 * claim: the reference says faces under 200 px cannot be measured, and nothing
 * in the pipeline states that number.
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMegabytes } from '../format';
import type { UploadProblem } from '../photo/validate';
import { display, shadow, theme } from '../theme';
import { Button } from './Button';

export type UploadProblemDetail = { kind: UploadProblem; bytes?: number };

type Props = {
  problem: UploadProblemDetail | null;
  onResolve: () => void;
  onCancel: () => void;
};

function copyFor(problem: UploadProblemDetail) {
  switch (problem.kind) {
    case 'too_large':
      return {
        glyph: '⇣',
        title: `That file is ${formatMegabytes(problem.bytes ?? 0)}`,
        body: 'The limit is 5 MB. We can convert and compress it for you without losing compliance.',
        cta: 'Convert & continue',
      };
    case 'too_small':
      return {
        glyph: '⤢',
        title: 'That photo is too small',
        body: 'The server measures head height in pixels, and this one has too few to measure. Choose a photo straight from the camera rather than one that has been shared through a messaging app.',
        cta: 'Choose another photo',
      };
    case 'no_face':
      return {
        glyph: '?',
        title: 'No face detected',
        body: 'We could not find a clear face in this photo. Choose one where the face is large, lit from the front and looking at the camera.',
        cta: 'Choose another photo',
      };
    case 'multi_face':
      return {
        glyph: '2',
        title: 'More than one face',
        body: 'Passport photos must contain exactly one person. Crop to one face, or take a fresh photo with coaching.',
        cta: 'Take photo instead',
      };
  }
}

export function UploadErrorSheet({ problem, onResolve, onCancel }: Props) {
  if (!problem) return null;
  const copy = copyFor(problem);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={styles.card}>
          <Text style={styles.glyph}>{copy.glyph}</Text>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
          <Button label={copy.cta} onPress={onResolve} style={styles.cta} />
          <Button label="Cancel" variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', paddingHorizontal: 18 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,.5)',
  },
  card: {
    backgroundColor: theme.color.card,
    borderRadius: 18,
    padding: theme.space.xl,
    ...shadow.lifted,
  },
  glyph: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.warningWash,
    color: theme.color.warning,
    textAlign: 'center',
    lineHeight: 42,
    fontFamily: theme.type.monoMedium,
    fontSize: 18,
    marginBottom: 13,
    overflow: 'hidden',
  },
  title: { ...display(21), lineHeight: 24, marginBottom: 7 },
  body: {
    fontFamily: theme.type.body,
    fontSize: 13.5,
    lineHeight: 21,
    color: theme.color.muted,
    marginBottom: theme.space.lg,
  },
  cta: { marginBottom: theme.space.sm },
});
