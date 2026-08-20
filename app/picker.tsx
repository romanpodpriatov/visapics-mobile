/**
 * Country, then document. Layout follows the design reference (lines 326–381).
 *
 * The reference's banner reads "verified against the government source, last
 * checked 14 Jun 2026". That date is invented, and a date on a screen about a
 * government document is not decoration — so the banner states only what the
 * catalogue holds: that every specification here cites an official source.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCountries, useSpecifications } from '../src/api/hooks';
import type { Country, SpecificationSummary } from '../src/api/types';
import { ChevronIcon, InfoIcon } from '../src/components/icons';
import { flagEmoji, formatDimensions, formatHeadHeight } from '../src/format';
import { useDraftStore } from '../src/store/draft';
import { display, eyebrow, hitSlopTo44, theme } from '../src/theme';

function BackChevron() {
  return (
    <View style={styles.backGlyph}>
      <Text style={styles.backGlyphText}>‹</Text>
    </View>
  );
}

export default function Picker() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ country?: string }>();
  const setSpec = useDraftStore((s) => s.setSpec);

  const [country, setCountry] = useState<string | null>(params.country ?? null);
  const [query, setQuery] = useState('');

  const { data: countries } = useCountries();
  const { data: documents } = useSpecifications(country ?? '');

  const onDocumentStep = country !== null;
  const needle = query.trim().toLowerCase();

  const shownCountries = (countries ?? [])
    .filter((c) => !needle || c.name.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name));

  const shownDocuments = (documents ?? []).filter(
    (d) => !needle || d.document_type.toLowerCase().includes(needle),
  );

  const countryName = countries?.find((c) => c.code === country)?.name ?? '';

  const goBack = () => {
    if (!onDocumentStep) return router.back();
    setCountry(null);
    setQuery('');
  };

  const choose = (document: SpecificationSummary) => {
    if (!country) return;
    setSpec(country, document.document_type);
    router.back();
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + theme.space.xs }]}>
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={hitSlopTo44(34)}
          style={styles.back}
        >
          <BackChevron />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.step}>◆ Step {onDocumentStep ? '2' : '1'} of 2</Text>
          <Text style={styles.heading} numberOfLines={1}>
            {onDocumentStep ? countryName : 'Where are you applying?'}
          </Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={
            onDocumentStep ? 'Search documents' : `Search ${countries?.length ?? 0} countries`
          }
          placeholderTextColor={theme.color.faint}
          autoCorrect={false}
          style={styles.search}
        />
      </View>

      {onDocumentStep ? (
        <FlatList
          data={shownDocuments}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={
            <View style={styles.banner}>
              <InfoIcon size={17} />
              <Text style={styles.bannerText}>
                Every document here is measured against the {countryName} government source.
              </Text>
            </View>
          }
          renderItem={({ item }) => <DocumentRow document={item} onPress={() => choose(item)} />}
        />
      ) : (
        <FlatList
          data={shownCountries}
          keyExtractor={(item) => item.code}
          ListHeaderComponent={
            <Text style={styles.groupLabel}>
              {needle ? `${shownCountries.length} matches` : 'All countries'}
            </Text>
          }
          renderItem={({ item }) => (
            <CountryRow country={item} onPress={() => setCountry(item.code)} />
          )}
        />
      )}
    </View>
  );
}

function CountryRow({ country, onPress }: { country: Country; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.row}>
      <Text style={styles.rowFlag}>{flagEmoji(country.code)}</Text>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{country.name}</Text>
        <Text style={styles.rowSub}>{country.document_count} document types</Text>
      </View>
      <ChevronIcon size={15} color={theme.color.borderStrong} />
    </Pressable>
  );
}

function DocumentRow({
  document,
  onPress,
}: {
  document: SpecificationSummary;
  onPress: () => void;
}) {
  const line = [
    formatDimensions(document),
    `head ${formatHeadHeight(document)}`,
    document.background_color?.replace(/_/g, ' '),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.documentRow}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{document.document_type}</Text>
        <Text style={styles.documentSpec}>{line}</Text>
      </View>
      {document.official_source?.length ? (
        <Text style={styles.badge}>Gov source</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingHorizontal: theme.space.xl,
    marginBottom: theme.space.lg,
  },
  back: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: { alignItems: 'center', justifyContent: 'center' },
  backGlyphText: { fontSize: 22, lineHeight: 24, color: theme.color.text },
  headerText: { flex: 1 },
  step: { ...eyebrow, fontSize: 9.5, letterSpacing: 1.33 },
  heading: { ...display(21), marginTop: 2 },

  searchWrap: { paddingHorizontal: theme.space.xl, marginBottom: 14 },
  search: {
    height: 44,
    paddingHorizontal: 13,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
    backgroundColor: theme.color.card,
    fontFamily: theme.type.body,
    fontSize: 14.5,
    color: theme.color.text,
  },

  groupLabel: {
    ...eyebrow,
    fontSize: 9.5,
    letterSpacing: 1.33,
    paddingHorizontal: theme.space.xl,
    marginBottom: 6,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: theme.space.xl,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  rowFlag: { fontSize: 22 },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: theme.type.bodyMedium, fontSize: 15, color: theme.color.text },
  rowSub: { fontFamily: theme.type.body, fontSize: 12, color: theme.color.muted, marginTop: 1 },

  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    marginHorizontal: theme.space.xl,
    marginBottom: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.brandSoft,
  },
  bannerText: {
    flex: 1,
    fontFamily: theme.type.body,
    fontSize: 12.5,
    lineHeight: 18.75,
    color: theme.color.brand,
  },

  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: theme.space.xl,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  documentSpec: {
    fontFamily: theme.type.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: theme.color.muted,
    marginTop: 3,
  },
  badge: {
    fontFamily: theme.type.mono,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: theme.color.success,
    borderWidth: 1,
    borderColor: theme.color.success,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
});
