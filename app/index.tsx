import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const API_BASE = 'https://visapics.org/api/v1';

type Coverage = { countries: number; specifications: number };

/**
 * Placeholder home screen.
 *
 * It exists so the first build has something to render and something to prove:
 * that the app can reach the API and that the numbers it shows come from
 * `/api/v1/config` rather than from the binary. Both are replaced by the real
 * home screen, but the second is a rule the app keeps forever — a figure
 * compiled into an App Store build cannot be corrected without a release.
 */
export default function Home() {
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <Text style={styles.wordmark}>VisaPics</Text>

      {coverage ? (
        <Text style={styles.coverage}>
          {coverage.countries} countries · {coverage.specifications} document specs
        </Text>
      ) : error ? (
        <Text style={styles.error}>Could not reach the API: {error}</Text>
      ) : (
        <ActivityIndicator color="#1E3A8A" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAF5',
    padding: 24,
    gap: 12,
  },
  wordmark: { fontSize: 28, color: '#0F172A' },
  coverage: { fontSize: 15, color: '#475569', textAlign: 'center' },
  error: { fontSize: 14, color: '#B91C1C', textAlign: 'center' },
});
