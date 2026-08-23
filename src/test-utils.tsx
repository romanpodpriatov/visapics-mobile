/**
 * Test-only helpers. Not imported by anything the app ships.
 *
 * Screens read the server through TanStack Query, so a screen test needs a
 * query cache. It also needs that cache torn down: a mounted QueryClient keeps
 * the jest process alive after the run, which turns a two-second suite into a
 * CI job that has to be killed.
 */
import { QueryClient, QueryClientProvider, type QueryKey } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

/** An iPhone with a notch and a home indicator, so inset padding is exercised. */
const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const teardowns: (() => void)[] = [];

afterEach(() => {
  while (teardowns.length) teardowns.pop()?.();
});

/**
 * Render a screen against a fresh query cache, optionally pre-seeded so the
 * screen sees server data without a network call.
 *
 * Seeding uses the real query keys, so a key that drifts breaks the test —
 * which is the point.
 */
export function renderScreen(ui: ReactElement, seed: [QueryKey, unknown][] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seed.forEach(([key, data]) => client.setQueryData(key, data));

  const view = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </SafeAreaProvider>,
  );

  teardowns.push(() => {
    view.unmount();
    client.clear();
    client.unmount();
  });

  return view;
}

/** A believable /api/v1/config, with the numbers production actually serves. */
export const configFixture = {
  products: [
    {
      product_id: 'org.visapics.app.photo.single',
      bundle_type: 'single' as const,
      credits: 1,
      price_cents: 399,
    },
  ],
  coverage: { countries: 164, specifications: 951, with_official_source: 951 },
  retention_hours: 168,
  // Exactly what /api/v1/config serves, which is the pipeline's own
  // QualityThresholds — the app holds no numbers of its own.
  quality: {
    pose_roll_max_deg: 3,
    pose_yaw_max_deg: 8,
    pose_pitch_max_deg: 8,
    face_area_ratio_min: 0.02,
    head_margin_ratio_min: 0.03,
    exposure_median_min: 80,
    exposure_median_max: 180,
    advisory: ['exposure'],
  },
  legal: {
    disclaimer:
      'VisaPics is an independent service. It is not affiliated with, endorsed by, or acting on behalf of any government agency.',
    privacy_url: 'https://visapics.org/privacy',
    terms_url: 'https://visapics.org/terms',
    support_url: 'https://visapics.org/help',
  },
};
