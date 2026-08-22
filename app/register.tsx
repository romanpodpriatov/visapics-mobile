/**
 * Creating an account from the app.
 *
 * It ends on "check your email" rather than in the app, because that is the
 * truth: the account is unverified until the emailed link is followed, and
 * signing in refuses an unverified account. Dropping someone into the app here
 * and letting them discover the refusal later would be the ruder version of
 * the same fact.
 *
 * Nothing is lost by waiting. Photos and credits stay on the device, and they
 * move onto the account at the first successful sign-in.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../src/api/client';
import { registerWithEmail } from '../src/auth/signin';
import { Button, Card } from '../src/components';
import { display, eyebrow, shadow, theme } from '../src/theme';

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const result = await registerWithEmail(email, password);
      setCreated(result.email);
    } catch (thrown: unknown) {
      setError(
        thrown instanceof ApiError ? thrown.message : 'Could not create the account just now.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 22 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>◆ Account</Text>
        <Text style={styles.title}>{created ? 'Check your email.' : 'Create an account.'}</Text>

        {created ? (
          <>
            <Text style={styles.subtitle}>
              We sent a confirmation link to {created}. Follow it, then come back and sign in —
              the credits on this device come with you.
            </Text>
            <Button label="Back to sign in" onPress={() => router.back()} />
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>
              An account keeps your photos and credits across devices. Photos and credits you
              already have on this phone move over the first time you sign in.
            </Text>

            <Card style={[styles.card, shadow.subtle]}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                accessibilityLabel="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                style={styles.input}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                accessibilityLabel="Password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                style={styles.input}
              />
              <Text style={styles.rule}>
                At least 8 characters, with a letter and a number.
              </Text>

              <Button label="Create account" onPress={() => void submit()} busy={busy} />

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </Card>

            <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={10}>
              <Text style={styles.link}>I already have an account</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.surface },
  content: { paddingHorizontal: theme.space.xl, paddingBottom: 40 },
  eyebrow: { ...eyebrow, marginBottom: theme.space.sm },
  title: { ...display(29), lineHeight: 31.3, marginBottom: theme.space.xs },
  subtitle: {
    fontFamily: theme.type.body,
    fontSize: 14,
    lineHeight: 21,
    color: theme.color.muted,
    marginBottom: theme.space.xl,
  },

  card: { padding: 17, marginBottom: theme.space.lg },
  label: {
    fontFamily: theme.type.mono,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: theme.color.muted,
    marginBottom: 6,
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
    marginBottom: theme.space.sm,
  },
  rule: {
    fontFamily: theme.type.body,
    fontSize: 11.5,
    color: theme.color.faint,
    marginBottom: theme.space.lg,
  },
  error: {
    fontFamily: theme.type.body,
    fontSize: 13,
    lineHeight: 19.5,
    color: theme.color.danger,
    marginTop: theme.space.md,
  },
  link: { fontFamily: theme.type.body, fontSize: 13.5, color: theme.color.brand },
});
