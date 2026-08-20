/**
 * The bridge between the camera and the checks.
 *
 * Faces arrive at the camera's frame rate. Re-rendering React that often would
 * spend the phone's battery on a label that a person cannot read changing
 * anyway, so the latest frame is kept in refs and the checks are recomputed ten
 * times a second — fast enough to feel live, slow enough to stay out of the
 * frame pipeline.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type CaptureSpec,
  type CoachingState,
  type FaceSample,
  type FrameSize,
  type FrameStats,
  evaluateFrame,
} from './checks';

const SAMPLE_INTERVAL_MS = 100;

const WAITING: CoachingState = {
  checks: { centre: false, head: false, light: false, background: false },
  hint: 'Centre your face in the oval',
  ready: false,
};

/** The camera is not perfectly lit until proven otherwise, but it is not dark either. */
const UNMEASURED: FrameStats = { luma: 0.5, lumaSpread: 0 };

export function useCoaching(spec: CaptureSpec | null) {
  const faceRef = useRef<FaceSample | null>(null);
  const frameRef = useRef<FrameSize | null>(null);
  const statsRef = useRef<FrameStats>(UNMEASURED);
  const [state, setState] = useState<CoachingState>(WAITING);
  // Whether the frame statistics have ever arrived. Lighting and background
  // read as passing until they do — otherwise the shutter could never arm on a
  // phone whose frame worklet does not run — so the screen needs to know not to
  // claim they were checked.
  const [measured, setMeasured] = useState(false);

  const onFaces = useCallback((faces: FaceSample[], frame: FrameSize) => {
    // The largest face is the one holding the phone. A bystander in the
    // background is smaller, and is the server's problem, not the coach's.
    faceRef.current = faces.reduce<FaceSample | null>(
      (largest, face) =>
        largest === null || face.bounds.height > largest.bounds.height ? face : largest,
      null,
    );
    frameRef.current = frame;
  }, []);

  const onStats = useCallback((stats: FrameStats | null) => {
    statsRef.current = stats ?? UNMEASURED;
    if (stats) setMeasured(true);
  }, []);

  useEffect(() => {
    if (!spec) return undefined;

    const id = setInterval(() => {
      const frame = frameRef.current;
      if (!frame) return;
      setState(evaluateFrame(faceRef.current, frame, spec, statsRef.current));
    }, SAMPLE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [spec]);

  return { state, measured, onFaces, onStats };
}
