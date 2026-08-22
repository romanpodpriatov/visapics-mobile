/**
 * The face detector output, built once and kept.
 *
 * react-native-vision-camera-face-detector's own `useFaceDetectorOutput`
 * memoizes on `[options]`, where `options` is the rest object its own
 * destructuring rebuilds on every render — so the memo never hits and the
 * output is a new object every time the screen renders. VisionCamera's note on
 * the matter is not ambiguous: "The outputs have to be explicitly memoized."
 *
 * An output that changes identity reconfigures the camera session, and a
 * session that reconfigures on every render never gets round to reporting a
 * face. That is what left all four gates at 0/4 no matter how the person moved.
 *
 * So the factory is called directly, once, and the callbacks are reached
 * through refs — which is also what lets the coaching hold the latest closure
 * without the output ever changing.
 */
import { useMemo, useRef } from 'react';
import { type Face, createFaceDetectorOutput } from 'react-native-vision-camera-face-detector';
import type { CameraOutput } from 'react-native-vision-camera';

export function useStableFaceOutput(
  onFacesDetected: (faces: Face[]) => void,
  onError?: (error: Error) => void,
): CameraOutput {
  const faces = useRef(onFacesDetected);
  faces.current = onFacesDetected;
  const failed = useRef(onError);
  failed.current = onError;

  return useMemo(
    () =>
      createFaceDetectorOutput({
        performanceMode: 'fast',
        outputResolution: 'preview',
        onFacesDetected: (detected: Face[]) => faces.current(detected),
        onError: (error: Error) => failed.current?.(error),
      }),
    [],
  );
}
