import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Eyebrow, Toast, Toggle } from '../src/components';
import { display, theme } from '../src/theme';

const API_BASE = 'https://visapics.org/api/v1';

type Coverage = { countries: number; specifications: number };

/**
 * Placeholder home screen.
 *
 * It exists so the first builds have something to render and something to
 * prove: that the app reaches the API, and that every figure on screen comes
 * from /api/v1/config rather than the binary. The real home screen replaces
 * it, but that second rule the app keeps forever — a number compiled into an
 * App Store build cannot be corrected without a release.
 */
export default function Home() {
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/config`)
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) setCoverage(body?.data?.coverage ?? null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Request failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.screen}>
      <Eyebrow>Groundwork</Eyebrow>
      <Text style={styles.wordmark}>VisaPics</Text>

      <Card>
        {coverage ? (
          <Text style={styles.coverage}>
            {coverage.countries} countries · {coverage.specifications} document specs
          </Text>
        ) : error ? (
          <Text style={styles.error}>Could not reach the API: {error}</Text>
        ) : (
          <ActivityIndicator color={theme.color.brand} />
        )}
      </Card>

      <Card>
        <Toggle
          value={removeBackground}
          onChange={setRemoveBackground}
          label="Remove background"
          hint="Replaces it with the official colour for this spec"
        />
      </Card>

      <Button label="Take photo with coaching" onPress={() => setToast('Not built yet')} />

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
    padding: theme.space.xl,
    gap: theme.space.lg,
  },
  wordmark: { ...display(31), marginBottom: theme.space.sm },
  coverage: { fontFamily: theme.type.body, fontSize: 15, color: theme.color.muted },
  error: { fontFamily: theme.type.body, fontSize: 14, color: theme.color.danger },
});
