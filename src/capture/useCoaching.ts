/**
 * The bridge between the camera and the gate.
 *
 * Faces arrive at the camera's frame rate. Re-rendering React that often would
 * spend the phone's battery on a label nobody can read changing, so the latest
 * frame is kept in refs and the gate is recomputed ten times a second — fast
 * enough to feel live, slow enough to stay out of the frame pipeline.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type FaceSample,
  type FrameSize,
  type FrameStats,
  type GateState,
  LIVE_CHECK_KEYS,
  LIVE_CHECK_LABELS,
  type QualityLimits,
  evaluateGate,
} from './gate';

const SAMPLE_INTERVAL_MS = 100;

const WAITING: GateState = {
  checks: LIVE_CHECK_KEYS.map((key) => ({
    key,
    label: LIVE_CHECK_LABELS[key],
    status: 'unmeasured' as const,
  })),
  hint: 'Show your face in the frame',
  ready: false,
};

export function useCoaching(limits: QualityLimits | null) {
  const faceRef = useRef<FaceSample | null>(null);
  const frameRef = useRef<FrameSize | null>(null);
  const statsRef = useRef<FrameStats | null>(null);
  const [state, setState] = useState<GateState>(WAITING);
  const onFaces = useCallback((faces: FaceSample[], frame: FrameSize | null) => {
    // The largest face is the one holding the phone. A bystander behind them
    // is smaller, and is the server's problem rather than the gate's.
    faceRef.current = faces.reduce<FaceSample | null>(
      (largest, face) =>
        largest === null || face.bounds.height > largest.bounds.height ? face : largest,
      null,
    );
    if (frame) frameRef.current = frame;
  }, []);

  const onStats = useCallback((stats: FrameStats | null) => {
    statsRef.current = stats;
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const frame = frameRef.current;
      if (!frame) return;
      setState(evaluateGate(faceRef.current, frame, statsRef.current, limits));
    }, SAMPLE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [limits]);

  return { state, onFaces, onStats };
}
