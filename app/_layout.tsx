/**
 * Root providers.
 *
 * The splash is held until the type and the stored state are ready, and no
 * longer: registering the guest session is started here but deliberately not
 * awaited. Onboarding and the catalogue both work unauthenticated, and a
 * launch that waits on a network call is a launch that hangs on a bad
 * connection — which is a Guideline 2.1 rejection.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { retryPolicy } from '../src/api/hooks';
import { initIAP } from '../src/iap';
import { useAuthStore } from '../src/store/auth';
import { useConsentStore } from '../src/store/consent';
import { useDraftStore } from '../src/store/draft';
import { useOnboardingStore } from '../src/store/onboarding';
import { theme } from '../src/theme';

// Hold the splash until the type is ready. Without this the first frame draws
// in the system font and then reflows, which reads as a broken launch.
void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: retryPolicy } },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Fraunces-Regular': require('../assets/fonts/Fraunces-Regular.ttf'),
    'Fraunces-SemiBold': require('../assets/fonts/Fraunces-SemiBold.ttf'),
    'Fraunces-Bold': require('../assets/fonts/Fraunces-Bold.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'JetBrainsMono-Regular': require('../assets/fonts/JetBrainsMono-Regular.ttf'),
    'JetBrainsMono-Medium': require('../assets/fonts/JetBrainsMono-Medium.ttf'),
  });

  const authHydrated = useAuthStore((s) => s.hydrated);
  const draftHydrated = useDraftStore((s) => s.hydrated);
  const onboardingHydrated = useOnboardingStore((s) => s.hydrated);
  const consentHydrated = useConsentStore((s) => s.hydrated);

  useEffect(() => {
    void useAuthStore.getState().hydrate();
    void useDraftStore.getState().hydrate();
    void useOnboardingStore.getState().hydrate();
    void useConsentStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (!authHydrated) return;
    // Not awaited, and failure is not fatal: without a session the catalogue
    // still reads, and the first call that needs one will say so.
    //
    // The purchase replay is chained behind the session rather than started
    // beside it: verification needs a bearer token, and replaying before there
    // is one would 401 every pending purchase and leave it unfinished forever.
    void useAuthStore
      .getState()
      .ensureSession()
      .then(() => initIAP())
      .catch(() => undefined);
  }, [authHydrated]);

  const ready =
    (fontsLoaded || fontError) &&
    authHydrated &&
    draftHydrated &&
    onboardingHydrated &&
    consentHydrated;

  useEffect(() => {
    // Proceed on a font error as well as on success: a font that failed to
    // load is a cosmetic problem, and a splash that never lifts is not.
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.color.surface },
        }}
      />
    </QueryClientProvider>
  );
}
