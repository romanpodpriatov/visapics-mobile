/**
 * Deleting an account, in the app, in one flow.
 *
 * Guideline 5.1.1(v) has required this since iOS 17, and every alternative —
 * an email, a web page, "contact support" — is a documented rejection. The
 * typed confirmation is here because the sheet is destructive and one stray
 * tap should not be enough.
 */
import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { display, eyebrow, theme } from '../theme';
import { Button } from './Button';
import { Sheet } from './Sheet';

const CONFIRMATION = 'DELETE';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
};

export function DeleteAccountSheet({ visible, onClose, onConfirm, busy }: Props) {
  const [typed, setTyped] = useState('');
  const armed = typed.trim().toUpperCase() === CONFIRMATION;

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.eyebrow}>◆ This cannot be undone</Text>
      <Text style={styles.title}>Delete your account?</Text>
      <Text style={styles.body}>
        Your saved photos, your credits and everything identifying about you are destroyed.
        Purchases you have already made cannot be restored to a new account afterwards, and
        anything left unspent goes with it.
      </Text>

      <Text style={styles.label}>Type {CONFIRMATION} to confirm</Text>
      <TextInput
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="characters"
        autoCorrect={false}
        accessibilityLabel={`Type ${CONFIRMATION} to confirm`}
        style={styles.input}
      />

      <Button
        label="Delete everything"
        variant="danger"
        disabled={!armed}
        busy={busy}
        onPress={onConfirm}
        style={styles.confirm}
      />
      <Button label="Keep my account" variant="secondary" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...eyebrow, marginBottom: 5, color: theme.color.danger },
  title: { ...display(23), lineHeight: 26.5, marginBottom: theme.space.sm },
  body: {
    fontFamily: theme.type.body,
    fontSize: 13,
    lineHeight: 20,
    color: theme.color.muted,
    marginBottom: theme.space.lg,
  },
  label: {
    ...eyebrow,
    fontSize: 9.5,
    letterSpacing: 1.33,
    marginBottom: 5,
  },
  input: {
    height: 46,
    paddingHorizontal: 13,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
    backgroundColor: theme.color.card,
    fontFamily: theme.type.body,
    fontSize: 15,
    color: theme.color.text,
    marginBottom: theme.space.lg,
  },
  confirm: { marginBottom: theme.space.sm },
});
