/**
 * Where a cold start lands: the intro on a first launch, the app afterwards.
 *
 * The flag is already in memory by the time this renders — the root layout
 * holds the splash until it is — so there is no second loading state here.
 */
import { Redirect } from 'expo-router';

import { useOnboardingStore } from '../src/store/onboarding';

export default function Index() {
  const onboarded = useOnboardingStore((s) => s.onboarded);
  return <Redirect href={onboarded ? '/photos' : '/onboarding'} />;
}
