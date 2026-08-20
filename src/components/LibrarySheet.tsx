/**
 * Shown when the system has no photo access to give us.
 *
 * There is no picker of our own here: the system one is what makes limited
 * access work, and drawing our own grid would mean asking for the whole
 * library in order to render it. What is left is the part a person cannot do
 * from inside the app — changing what they shared.
 */
import { Linking, StyleSheet, Text } from 'react-native';

import { display, eyebrow, theme } from '../theme';
import { Button } from './Button';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function LibrarySheet({ visible, onClose }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.eyebrow}>◆ Photo access</Text>
      <Text style={styles.title}>We cannot see your library</Text>
      <Text style={styles.body}>
        Limited access is fine — we only read the photo you pick. Turn access on, or take a photo
        with coaching instead. JPG, PNG or HEIC up to 5 MB.
      </Text>
      <Button
        label="Manage which photos we can see"
        onPress={() => void Linking.openSettings()}
        style={styles.action}
      />
      <Button label="Cancel" variant="secondary" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...eyebrow, marginBottom: 5 },
  title: { ...display(23), lineHeight: 26.5, marginBottom: theme.space.xs },
  body: {
    fontFamily: theme.type.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: theme.color.muted,
    marginBottom: 14,
  },
  action: { marginBottom: theme.space.sm },
});
