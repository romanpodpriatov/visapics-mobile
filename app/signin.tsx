/**
 * Signing in with the account visapics.org already knows.
 *
 * Two steps rather than one, because two-factor accounts exist: the password
 * buys a five-minute challenge, and the code spends it. Nothing is signed in
 * between the two — the challenge is a signed handoff, not a session.
 *
 * Every refusal is shown in the server's own words. "Confirm your email",
 * "This account has been deactivated" and "Too many attempts" each ask
 * something different of the person reading them, and collapsing them into one
 * message would leave all three stuck.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, SITE_BASE } from '../src/api/client';
import { Button, Card } from '../src/components';
import { completeTwoFactor, signInWithEmail } from '../src/auth/signin';
import { display, eyebrow, shadow, theme } from '../src/theme';

export default function SignIn() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (thrown: unknown) =>
    setError(thrown instanceof ApiError ? thrown.message : 'Could not sign you in just now.');

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const result = await signInWithEmail(email, password);
      if (result.status === 'needs-2fa') setChallenge(result.challengeToken);
      else router.back();
    } catch (thrown: unknown) {
      fail(thrown);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!challenge || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await completeTwoFactor(challenge, code);
      router.back();
    } catch (thrown: unknown) {
      fail(thrown);
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
        <Text style={styles.title}>{challenge ? 'One more step.' : 'Sign in.'}</Text>
        <Text style={styles.subtitle}>
          {challenge
            ? 'Enter the code from your authenticator app, or one of your backup codes.'
            : 'Use the email and password from your VisaPics account. Credits you already have on this device come with you.'}
        </Text>

        <Card style={[styles.card, shadow.subtle]}>
          {challenge ? (
            <>
              <Text style={styles.label}>Code</Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                accessibilityLabel="Six-digit code"
                keyboardType="number-pad"
                autoCapitalize="characters"
                autoCorrect={false}
                textContentType="oneTimeCode"
                style={styles.input}
              />
              <Button label="Verify" onPress={() => void verify()} busy={busy} />
            </>
          ) : (
            <>
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
                autoComplete="current-password"
                textContentType="password"
                style={styles.input}
              />

              <Button label="Sign in" onPress={() => void submit()} busy={busy} />
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Card>

        {challenge ? null : (
          <Pressable
            onPress={() => void Linking.openURL(`${SITE_BASE}/auth/forgot-password`)}
            accessibilityRole="link"
            hitSlop={10}
          >
            <Text style={styles.link}>Forgot your password?</Text>
          </Pressable>
        )}

        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={10}>
          <Text style={styles.link}>Not now</Text>
        </Pressable>

        <Text style={styles.note}>
          No account yet? Create one at visapics.org and sign in here — or carry on as a guest;
          photos and credits stay on this device either way.
        </Text>
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
    marginBottom: theme.space.md,
  },
  error: {
    fontFamily: theme.type.body,
    fontSize: 13,
    lineHeight: 19.5,
    color: theme.color.danger,
    marginTop: theme.space.md,
  },

  link: {
    fontFamily: theme.type.body,
    fontSize: 13.5,
    color: theme.color.brand,
    marginBottom: theme.space.md,
  },
  note: {
    fontFamily: theme.type.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.color.faint,
    marginTop: theme.space.sm,
  },
});
