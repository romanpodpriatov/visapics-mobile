/**
 * The three intro slides.
 *
 * Layout follows the design reference (lines 155–209); the copy follows it too,
 * apart from the figures. The reference invents "954 document specs",
 * "952 of 954 · 99.8%" and a one-in-eight rejection rate, and captions a US
 * passport specimen as UK. Every count here comes from /api/v1/config, and
 * when it has not arrived the slide says less rather than guessing — a number
 * compiled into a shipped binary cannot be corrected without a resubmission.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConfig } from '../src/api/hooks';
import type { Coverage } from '../src/api/types';
import { Button } from '../src/components';
import { ArrowRightIcon } from '../src/components/icons';
import { verifiedLine } from '../src/format';
import { useOnboardingStore } from '../src/store/onboarding';
import { display, eyebrow, shadow, theme } from '../src/theme';

const specimenBefore = require('../assets/examples/specimen-before.jpg');
const specimenAfter = require('../assets/examples/specimen-after.jpg');

type Slide = {
  eyebrow: string;
  title: string;
  body: string;
  caption: string;
  image: number;
  points: string[];
  footLeft: string;
  footRight: string;
  cta: string;
};

export function buildSlides(coverage?: Coverage): Slide[] {
  return [
    {
      eyebrow: 'Why it matters',
      title: 'One rejected photo costs three weeks.',
      body: 'Consulates turn photos back over small things — head too small, a shadow on the wall, a hint of a smile. VisaPics checks for them before you press the shutter.',
      caption: 'Before',
      image: specimenBefore,
      points: [
        'Head height measured to the millimetre',
        'Shadows and glare flagged live',
        'Background replaced with the official colour',
      ],
      footLeft: 'Typical rejection',
      footRight: 'Caught in advance',
      cta: 'How it works',
    },
    {
      eyebrow: 'The camera coaches',
      title: 'It tells you what to fix, then shoots.',
      body: 'Line up inside the oval. VisaPics reads head size, centring, lighting and background in real time, and only arms the shutter when every rule passes.',
      caption: 'After',
      image: specimenAfter,
      points: [
        'Shutter stays locked until 4/4 checks pass',
        'Plain-language hints, not error codes',
        'Works on any background, any room',
      ],
      footLeft: '4 live checks',
      footRight: 'Then the full spec on the server',
      cta: 'Continue',
    },
    {
      eyebrow: 'Coverage',
      title: coverage
        ? `${coverage.countries} countries. ${coverage.specifications} document specs.`
        : 'Every document, measured against its own rules.',
      body: 'Passports, visas, ID cards and residence permits, each measured against the official government source. The watermarked preview is free — unlock only when you are happy with it.',
      caption: 'US · 51×51 mm',
      image: specimenAfter,
      points: [
        ...(coverage ? [verifiedLine(coverage)] : []),
        'Digital file plus a printable sheet',
        'Rejected? We reprocess it free',
      ],
      footLeft: 'Free preview',
      footRight: 'Pay only to download',
      cta: 'Make my photo',
    },
  ];
}

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: config } = useConfig();
  const complete = useOnboardingStore((s) => s.complete);
  const [index, setIndex] = useState(0);

  const slides = buildSlides(config?.coverage);
  const slide = slides[index];

  const finish = () => {
    void complete();
    router.replace('/photos');
  };

  const next = () => (index < slides.length - 1 ? setIndex(index + 1) : finish());

  return (
    <View style={[styles.screen, { paddingTop: insets.top + theme.space.sm }]}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>VisaPics</Text>
        <Pressable onPress={finish} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.middle}>
        <Text style={styles.eyebrow}>◆ {slide.eyebrow}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>

        <View style={styles.specimen}>
          <View style={styles.specimenRow}>
            <View style={styles.thumb}>
              <Image source={slide.image} style={styles.thumbImage} resizeMode="cover" />
              <Text style={styles.caption}>{slide.caption}</Text>
            </View>
            <View style={styles.points}>
              {slide.points.map((point) => (
                <View key={point} style={styles.point}>
                  <Text style={styles.tick}>✓</Text>
                  <Text style={styles.pointText}>{point}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.specimenFoot}>
            <Text style={styles.footLeft}>{slide.footLeft}</Text>
            <Text style={styles.footRight}>{slide.footRight}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + theme.space.xxl }]}>
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <View key={s.eyebrow} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Button
          label={slide.cta}
          onPress={next}
          style={styles.cta}
          trailingIcon={<ArrowRightIcon size={16} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.surface,
    paddingHorizontal: 22,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontFamily: theme.type.display, fontSize: 17, letterSpacing: -0.17 },
  skip: { fontFamily: theme.type.body, fontSize: 13, color: theme.color.muted, padding: 6 },

  middle: { flex: 1, justifyContent: 'center', paddingVertical: theme.space.xxl },
  eyebrow: { ...eyebrow, marginBottom: theme.space.md },
  title: { ...display(34), lineHeight: 36, marginBottom: 14 },
  body: {
    fontFamily: theme.type.body,
    fontSize: 15,
    lineHeight: 24,
    color: theme.color.muted,
    marginBottom: 24,
  },

  specimen: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.color.card,
    overflow: 'hidden',
    ...shadow.card,
  },
  specimenRow: { flexDirection: 'row', gap: 14, padding: theme.space.lg },
  thumb: {
    width: 88,
    height: 112,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: theme.color.brandSoft,
  },
  thumbImage: { width: '100%', height: '100%' },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'rgba(15,23,42,.72)',
    fontFamily: theme.type.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  points: { flex: 1, justifyContent: 'center', gap: 9 },
  point: { flexDirection: 'row', gap: theme.space.sm, alignItems: 'flex-start' },
  tick: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: theme.color.brandSoft,
    color: theme.color.success,
    textAlign: 'center',
    fontSize: 9,
    lineHeight: 15,
    fontFamily: theme.type.bodySemiBold,
    marginTop: 1,
  },
  pointText: {
    flex: 1,
    fontFamily: theme.type.body,
    fontSize: 12.5,
    lineHeight: 17.5,
    color: theme.color.text,
  },
  specimenFoot: {
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    backgroundColor: theme.color.surface,
    paddingHorizontal: theme.space.lg,
    paddingVertical: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
  footLeft: { ...eyebrow, fontSize: 9.5, letterSpacing: 1.14 },
  footRight: { ...eyebrow, fontSize: 9.5, letterSpacing: 1.14, color: theme.color.success },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.color.borderStrong },
  dotActive: { width: 20, backgroundColor: theme.color.brand },
  cta: { flex: 1 },
});
