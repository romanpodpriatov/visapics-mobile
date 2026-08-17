import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/**
 * Root layout.
 *
 * Kept deliberately thin for now: the query client, auth bootstrap, font
 * loading and the StoreKit replay listener all land here in later tasks. What
 * matters at this stage is that a cold start reaches a rendered screen, since
 * that is the first thing an App Review tester sees.
 */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
