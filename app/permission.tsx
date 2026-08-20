/**
 * Consent, then purpose, then the system prompt — in that order.
 *
 * The order is the point. A system permission dialog that appears before any
 * explanation is a Guideline 5.1.1(i) rejection, and it is also the version
 * people deny most. The whole sequence lives in this one route so that every
 * way into the camera goes through it.
 *
 * Refusing has to leave a working product: the library route makes a compliant
 * photo without the camera, and this screen says so at the moment of refusal.
 */
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraPermission } from 'react-native-vision-camera';

import { useConfig } from '../src/api/hooks';
import { Button, ConsentSheet } from '../src/components';
import { CameraIcon } from '../src/components/icons';
import { useConsentStore } from '../src/store/consent';
import { display, eyebrow, theme } from '../src/theme';

export default function Permission() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: config } = useConfig();

  const accepted = useConsentStore((s) => s.accepted);
  const accept = useConsentStore((s) => s.accept);

  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();

  const refused = accepted && !hasPermission && !canRequestPermission;

  useEffect(() => {
    // Nothing left to ask: this screen has no reason to be on screen.
    if (accepted && hasPermission) router.replace('/capture');
  }, [accepted, hasPermission, router]);

  const ask = async () => {
    const granted = await requestPermission();
    if (granted) router.replace('/capture');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + 30 }]}>
      {accepted ? (
        <>
          <View style={styles.badge}>
            <CameraIcon size={30} color={theme.color.brand} strokeWidth={1.6} />
          </View>

          <Text style={styles.eyebrow}>◆ Camera access</Text>
          <Text style={styles.title}>Coaching needs to see the frame.</Text>
          <Text style={styles.body}>
            The camera runs on your device to measure head size, centring, lighting and background.
            Frames are not uploaded until you take the photo, and nothing is stored without your
            action.
          </Text>

          {refused ? (
            <View style={styles.refused}>
              <Text style={styles.refusedText}>
                Access is off. You can still make a compliant photo from your library — or turn the
                camera on in Settings.
              </Text>
              <View style={styles.refusedActions}>
                <Button
                  label="Open Settings"
                  variant="secondary"
                  onPress={() => void Linking.openSettings()}
                  style={styles.refusedButton}
                />
                {/* Task 7 points this at the library import; until then it returns
                    to the screen the library button lives on. */}
                <Button label="Use library" onPress={() => router.back()} style={styles.refusedButton} />
              </View>
            </View>
          ) : null}

          {refused ? null : (
            <Button label="Allow camera access" onPress={() => void ask()} style={styles.allow} />
          )}
          <Button label="Not now" variant="secondary" onPress={() => router.back()} />
          {refused ? null : <Text style={styles.footnote}>The system will ask next</Text>}
        </>
      ) : null}

      <ConsentSheet
        visible={!accepted}
        retentionHours={config?.retention_hours}
        onAccept={() => void accept()}
        onDecline={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
    paddingHorizontal: 24,
  },
  badge: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: theme.color.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.space.xl,
  },
  eyebrow: { ...eyebrow, marginBottom: theme.space.sm },
  title: { ...display(28), lineHeight: 30.8, marginBottom: theme.space.md },
  body: {
    fontFamily: theme.type.body,
    fontSize: 14.5,
    lineHeight: 23.2,
    color: theme.color.muted,
    marginBottom: 18,
  },

  refused: {
    borderWidth: 1,
    borderColor: theme.color.warningBorder,
    backgroundColor: theme.color.warningWash,
    borderRadius: theme.radius.md,
    padding: 13,
    marginBottom: theme.space.lg,
  },
  refusedText: {
    fontFamily: theme.type.body,
    fontSize: 13,
    lineHeight: 19.5,
    color: '#78350F',
    marginBottom: theme.space.sm,
  },
  refusedActions: { flexDirection: 'row', gap: theme.space.sm },
  refusedButton: { flex: 1 },

  allow: { marginBottom: 9 },
  footnote: {
    ...eyebrow,
    fontSize: 9,
    letterSpacing: 0.9,
    textAlign: 'center',
    marginTop: 14,
  },
});
