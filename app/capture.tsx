/**
 * Live capture. Layout follows the design reference (lines 76–145).
 *
 * This is the app's answer to Guideline 4.2 — capability a website cannot
 * provide — and the shutter is gated on it: it cannot fire below 4/4, and a
 * countdown already running cancels the moment a check stops passing.
 *
 * NOT VERIFIED ON HARDWARE. Every camera call here is written against
 * VisionCamera 5's type definitions, which is not the API this plan was drawn
 * against: frame processors moved to react-native-vision-camera-worklets, and
 * the face detector is a Nitro camera output rather than a frame-processor
 * plugin. The check logic underneath is pure and unit-tested; the wiring above
 * it needs a physical phone, and so does the 1.25 head multiplier in checks.ts.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  CommonResolutions,
  type Frame,
  useCameraDevice,
  useFrameOutput,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { type Face, useFaceDetectorOutput } from 'react-native-vision-camera-face-detector';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';

import { useSpecifications } from '../src/api/hooks';
import { GUIDE_WIDTH_SHARE, type CaptureSpec, type FrameStats } from '../src/capture/checks';
import { readFrameStats } from '../src/capture/frameStats';
import { type SessionFacts, describeSession } from '../src/capture/session';
import { shouldSample } from '../src/capture/throttle';
import { useCoaching } from '../src/capture/useCoaching';
import { useDraftStore } from '../src/store/draft';
import { theme } from '../src/theme';

const CHECK_LABELS = {
  centre: 'Centring',
  head: 'Head size',
  light: 'Lighting',
  background: 'Background',
} as const;

const CHECK_VALUES = {
  centre: { pass: 'Centred', pending: 'Off centre' },
  head: { pass: 'In range', pending: 'Not yet' },
  light: { pass: 'Even', pending: 'Uneven' },
  background: { pass: 'Uniform', pending: 'Busy' },
} as const;

type CheckKey = keyof typeof CHECK_LABELS;

export default function Capture() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const countryCode = useDraftStore((s) => s.countryCode);
  const documentType = useDraftStore((s) => s.documentType);
  const { data: documents } = useSpecifications(countryCode ?? '');
  const summary = documents?.find((d) => d.document_type === documentType);

  const spec: CaptureSpec | null = summary
    ? {
        photo_width_mm: summary.photo_width_mm,
        photo_height_mm: summary.photo_height_mm,
        head_height_min_mm: summary.head_height_min_mm,
        head_height_max_mm: summary.head_height_max_mm,
        head_height_min_percent: summary.head_height_min_percent,
        head_height_max_percent: summary.head_height_max_percent,
      }
    : null;

  const { state, measured, onFaces, onStats } = useCoaching(spec);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const device = useCameraDevice(facing);

  /**
   * Bounded on purpose. Asking for the sensor's largest photo makes the
   * session negotiate a full-resolution, non-binned readout — and VisionCamera
   * says what that costs: binning "improves low-light sensitivity" and binned
   * formats "use significantly less bandwidth". A physical iPhone showed both
   * halves of that bill, a preview dark enough to need direct light and slow
   * with it. The server needs 992×1275 px at minimum; this is well past it.
   */
  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.FHD_4_3,
    qualityPrioritization: 'balanced',
  });

  /** What the session settled on, and anything it refused to do. */
  const [session, setSession] = useState<SessionFacts | null>(null);
  const [dropped, setDropped] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const noteDrop = useCallback(() => setDropped((seen) => seen + 1), []);

  const handleFaces = useCallback(
    (faces: Face[]) => {
      const frame = faces[0]
        ? { width: faces[0].frameWidth, height: faces[0].frameHeight }
        : { width, height: width * 2 };
      onFaces(
        faces.map((face) => ({
          bounds: face.bounds,
          yawAngle: face.yawAngle,
          rollAngle: face.rollAngle,
        })),
        frame,
      );
    },
    [onFaces, width],
  );

  const faceOutput = useFaceDetectorOutput({
    performanceMode: 'fast',
    onFacesDetected: handleFaces,
    onError: () => undefined,
  });

  const handleStats = useCallback((stats: FrameStats | null) => onStats(stats), [onStats]);

  /**
   * When the pixels were last read. A frame's own timestamp is a CMTime on iOS
   * and nanoseconds on Android, so the throttle uses performance.now() instead:
   * monotonic milliseconds, and provably present in the worklet runtime — the
   * worklets initializer calls it there itself.
   */
  const lastSampledAt = useMemo(() => createSynchronizable<number | null>(null), []);

  const frameOutput = useFrameOutput({
    // Small preview-sized YUV buffers rather than full-resolution ones.
    // Measured on a physical iPhone: at full resolution, downloading every
    // frame to the CPU stalled the camera pipeline — the preview stuttered,
    // and starved of frames its auto-exposure never converged, so it stayed
    // dark. VisionCamera documents all three of these as the remedy.
    targetResolution: CommonResolutions.VGA_4_3,
    enablePreviewSizedOutputBuffers: true,
    // readFrameStats reads plane 0 as 8-bit luma, which is what YUV gives it.
    pixelFormat: 'yuv',
    // Let the preview come up first; statistics can start a moment later.
    allowDeferredStart: true,
    onFrame: (frame: Frame) => {
      'worklet';
      const now = performance.now();
      if (!shouldSample(now, lastSampledAt.getDirty())) {
        // Nothing downstream can use this frame: release it and wait.
        frame.dispose();
        return;
      }
      lastSampledAt.setBlocking(now);

      const stats = readFrameStats(frame);
      // The Frame has to be released immediately or the camera pipeline stalls.
      frame.dispose();
      scheduleOnRN(handleStats, stats);
    },
    onFrameDropped: noteDrop,
  });

  const wasReady = useRef(false);
  useEffect(() => {
    // The person is looking at their own face, not at the screen, so readiness
    // has to be felt rather than read.
    if (state.ready && !wasReady.current) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    wasReady.current = state.ready;
  }, [state.ready]);

  const capture = useCallback(async () => {
    setFlash(true);
    try {
      const photo = await photoOutput.capturePhoto({}, {});
      const image = await photo.toImageAsync();
      photo.dispose();
      const path = await image.saveToTemporaryFileAsync('jpg', 92);
      image.dispose();
      router.replace({ pathname: '/processing', params: { photo: path } });
    } finally {
      setFlash(false);
    }
  }, [photoOutput, router]);

  useEffect(() => {
    if (countdown === null) return undefined;
    // Losing a check mid-countdown cancels it. The gate is the whole point of
    // the screen; a countdown that fires anyway would quietly defeat it.
    if (!state.ready) {
      setCountdown(null);
      return undefined;
    }
    if (countdown === 0) {
      setCountdown(null);
      void capture();
      return undefined;
    }
    const id = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown, state.ready, capture]);

  const guideWidth = width * GUIDE_WIDTH_SHARE;
  const guideHeight = spec
    ? guideWidth * (spec.photo_height_mm / spec.photo_width_mm)
    : guideWidth * 1.29;

  const passing = (Object.keys(CHECK_LABELS) as CheckKey[]).filter((key) => state.checks[key]);

  return (
    <View style={styles.screen}>
      {device ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive
          outputs={[photoOutput, faceOutput, frameOutput]}
          /**
           * Said where the session negotiates it, rather than hoped for from
           * the outputs' side. Binning is VisionCamera's own answer to both
           * complaints at once — it "improves low-light sensitivity" and uses
           * "significantly less bandwidth" — and the frame rate is capped
           * because a 60fps session allows no exposure longer than 1/60s,
           * which is half the light of a 30fps one. That is the ordinary
           * reason a preview looks dark indoors while the stock camera does
           * not. Order matters: constraints are negotiated in turn, so light
           * comes before frame rate.
           */
          constraints={[{ binned: true }, { fps: 30 }]}
          onSessionConfigSelected={setSession}
          // Nothing was listening here, so a session that refused to
          // reconfigure looked like a frozen preview with nothing to say.
          onError={(error: Error) => setCameraError(error.message)}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noDevice]}>
          <Text style={styles.noDeviceText}>No camera on this device.</Text>
        </View>
      )}

      <View style={[styles.guide, { width: guideWidth, height: guideHeight }]}>
        <View style={styles.oval} />
        <View style={[styles.eyeLine, { top: guideHeight * 0.42 }]} />
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + theme.space.sm }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.roundButton}
        >
          <Text style={styles.roundButtonGlyph}>✕</Text>
        </Pressable>
        <View style={styles.topTitle}>
          <Text style={styles.topEyebrow}>◆ Live compliance check</Text>
          <Text style={styles.topDocument} numberOfLines={1}>
            {documentType ?? 'No document chosen'}
          </Text>
        </View>
        <Pressable
          onPress={() => setFacing(facing === 'front' ? 'back' : 'front')}
          accessibilityRole="button"
          accessibilityLabel="Flip camera"
          style={styles.roundButton}
        >
          <Text style={styles.roundButtonGlyph}>⟳</Text>
        </Pressable>
      </View>

      {cameraError ? (
        <View style={styles.cameraError} pointerEvents="none">
          <Text style={styles.cameraErrorText}>{cameraError}</Text>
        </View>
      ) : null}

      <View style={styles.hintRow} pointerEvents="none">
        <View style={styles.hintPill}>
          <View style={[styles.hintDot, state.ready && styles.hintDotReady]} />
          <Text style={styles.hintText}>{state.hint}</Text>
        </View>
      </View>

      <View style={[styles.checks, { bottom: insets.bottom + 150 }]} pointerEvents="none">
        {(Object.keys(CHECK_LABELS) as CheckKey[]).map((key) => {
          const passed = state.checks[key];
          const unmeasured = !measured && (key === 'light' || key === 'background');
          return (
            <View key={key} style={[styles.check, passed && styles.checkPassed]}>
              <Text style={[styles.checkGlyph, passed ? styles.glyphPassed : styles.glyphPending]}>
                {passed ? '✓' : '!'}
              </Text>
              <View style={styles.checkText}>
                <Text style={styles.checkLabel}>{CHECK_LABELS[key]}</Text>
                <Text style={[styles.checkValue, passed && styles.checkValuePassed]}>
                  {unmeasured
                    ? 'Not measured'
                    : passed
                      ? CHECK_VALUES[key].pass
                      : CHECK_VALUES[key].pending}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {session ? (
        <Text style={[styles.sessionFacts, { bottom: insets.bottom + 130 }]} pointerEvents="none">
          {describeSession(session, dropped)}
        </Text>
      ) : null}

      <View style={[styles.bottomBar, { bottom: insets.bottom + 44 }]}>
        <View style={styles.bottomSlot} />
        <Pressable
          onPress={() => setCountdown(3)}
          disabled={!state.ready || countdown !== null}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          accessibilityState={{ disabled: !state.ready || countdown !== null }}
          style={styles.shutter}
        >
          <View style={[styles.shutterRing, state.ready && styles.shutterRingReady]} />
          <View style={styles.shutterCore}>
            <Text style={styles.shutterLabel}>
              {countdown !== null ? String(countdown) : state.ready ? '' : '···'}
            </Text>
          </View>
        </Pressable>
        <View style={styles.bottomSlot}>
          <Text style={styles.counter}>{passing.length}/4</Text>
          <Text style={styles.counterCaption}>checks</Text>
        </View>
      </View>

      {flash ? <View style={styles.flash} pointerEvents="none" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.night },
  noDevice: { alignItems: 'center', justifyContent: 'center' },
  noDeviceText: { fontFamily: theme.type.body, fontSize: 15, color: 'rgba(255,255,255,.7)' },

  guide: {
    position: 'absolute',
    alignSelf: 'center',
    top: '14%',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.16)',
  },
  oval: {
    position: 'absolute',
    left: '9%',
    right: '9%',
    top: '2%',
    bottom: '3%',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,.6)',
    borderRadius: 9999,
  },
  eyeLine: {
    position: 'absolute',
    left: -14,
    width: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,.55)',
  },

  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 18,
  },
  roundButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(11,17,32,.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonGlyph: { color: '#FFFFFF', fontSize: 17 },
  topTitle: { flex: 1, alignItems: 'center' },
  topEyebrow: {
    fontFamily: theme.type.mono,
    fontSize: 9.5,
    letterSpacing: 1.52,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.62)',
  },
  topDocument: {
    fontFamily: theme.type.bodyMedium,
    fontSize: 13.5,
    color: '#FFFFFF',
    marginTop: 3,
  },

  cameraError: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '46%',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: 'rgba(153,27,27,.92)',
  },
  cameraErrorText: { fontFamily: theme.type.bodyMedium, fontSize: 13, color: '#FFFFFF' },

  /** Diagnostic, while the capture stack is being proven on hardware. */
  sessionFacts: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: theme.type.mono,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,.45)',
  },

  hintRow: { position: 'absolute', left: 0, right: 0, top: '58%', alignItems: 'center' },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: 'rgba(11,17,32,.62)',
  },
  hintDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FBBF24' },
  hintDotReady: { backgroundColor: '#34D399' },
  hintText: { fontFamily: theme.type.bodyMedium, fontSize: 13.5, color: '#FFFFFF' },

  checks: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  check: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(11,17,32,.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.16)',
  },
  checkPassed: { borderColor: 'rgba(4,120,87,.85)' },
  checkGlyph: {
    width: 17,
    height: 17,
    borderRadius: 9,
    textAlign: 'center',
    lineHeight: 17,
    fontSize: 10.5,
    color: '#FFFFFF',
    fontFamily: theme.type.bodySemiBold,
    overflow: 'hidden',
  },
  glyphPassed: { backgroundColor: theme.color.success },
  glyphPending: { backgroundColor: theme.color.warning },
  checkText: { flex: 1 },
  checkLabel: { fontFamily: theme.type.bodyMedium, fontSize: 11.5, color: '#FFFFFF' },
  checkValue: {
    fontFamily: theme.type.mono,
    fontSize: 8.5,
    letterSpacing: 0.68,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.6)',
    marginTop: 1,
  },
  checkValuePassed: { color: '#6EE7B7' },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 34,
  },
  bottomSlot: { width: 46, alignItems: 'center' },
  shutter: { width: 82, height: 82, alignItems: 'center', justifyContent: 'center' },
  shutterRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 41,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,.4)',
  },
  shutterRingReady: { borderColor: theme.color.success },
  shutterCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterLabel: { fontFamily: theme.type.monoMedium, fontSize: 20, color: theme.color.text },
  counter: {
    fontFamily: theme.type.mono,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.7)',
  },
  counterCaption: { fontFamily: theme.type.body, fontSize: 9.5, color: 'rgba(255,255,255,.5)' },

  flash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF' },
});
