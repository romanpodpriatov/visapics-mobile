/**
 * The four live checks, as a pure function.
 *
 * Pure because that is what makes them testable without a camera, and because
 * every "how close is close enough" threshold in the product lives here rather
 * than being scattered through a screen.
 *
 * All four are advisory. The server holds the specification and produces the
 * file, so its verdict is the one that counts — this is a nudge toward a photo
 * that will pass, not a promise that it has.
 */

export type FaceSample = {
  bounds: { x: number; y: number; width: number; height: number };
  /** Degrees. Both come straight from the detector. */
  yawAngle: number;
  rollAngle: number;
};

export type FrameSize = { width: number; height: number };

export type CaptureSpec = {
  photo_width_mm: number;
  photo_height_mm: number;
  head_height_min_mm: number | null;
  head_height_max_mm: number | null;
  head_height_min_percent: number | null;
  head_height_max_percent: number | null;
};

export type FrameStats = {
  /** Mean brightness of the frame, 0–1. */
  luma: number;
  /** How unevenly that brightness is spread across the frame, 0–1. */
  lumaSpread: number;
  /** Variation behind the head, 0–1. Absent when it has not been measured. */
  backgroundVariance?: number;
};

export type CoachingChecks = {
  centre: boolean;
  head: boolean;
  light: boolean;
  background: boolean;
};

export type CoachingState = {
  checks: CoachingChecks;
  hint: string;
  ready: boolean;
};

/**
 * The crop guide spans this share of the frame width, and takes its height
 * from the document's own proportions. The capture screen draws the same box,
 * so what the coaching measures is what the person sees.
 */
export const GUIDE_WIDTH_SHARE = 0.7;

/**
 * A face detector reports the face, not the head: no forehead above the brow
 * line and no hair. This lifts the box to something head-shaped.
 *
 * It is an approximation, and it is the number most likely to be wrong on real
 * faces. The server measures the head properly; if photos taken at 4/4 keep
 * failing the server's head-height check, this is the constant to correct.
 */
const HAIR_MULTIPLIER = 1.25;

/** Off-centre by more than this share of the frame width is off-centre. */
const CENTRE_TOLERANCE = 0.08;

/** Degrees of roll or yaw before the head stops being square to the camera. */
const TILT_TOLERANCE = 12;

const LUMA_MIN = 0.25;
const LUMA_MAX = 0.9;
const LUMA_SPREAD_MAX = 0.3;
const BACKGROUND_VARIANCE_MAX = 0.25;

/** The head height band the document asks for, as a share of the photo height. */
function headBand(spec: CaptureSpec): { low: number | null; high: number | null } {
  const { head_height_min_mm: minMm, head_height_max_mm: maxMm } = spec;
  if (minMm !== null || maxMm !== null) {
    return {
      low: minMm !== null ? minMm / spec.photo_height_mm : null,
      high: maxMm !== null ? maxMm / spec.photo_height_mm : null,
    };
  }
  // 425 of the 951 specifications state only a share. Same fallback the
  // requirements screen uses, and the same one the server measures against.
  return { low: spec.head_height_min_percent, high: spec.head_height_max_percent };
}

type HeadVerdict = 'ok' | 'too-small' | 'too-large';

function headVerdict(face: FaceSample, frame: FrameSize, spec: CaptureSpec): HeadVerdict {
  const { low, high } = headBand(spec);
  if (low === null && high === null) return 'ok';

  const cropHeightPx = Math.min(
    frame.height,
    frame.width * GUIDE_WIDTH_SHARE * (spec.photo_height_mm / spec.photo_width_mm),
  );
  const share = (face.bounds.height * HAIR_MULTIPLIER) / cropHeightPx;

  if (low !== null && share < low) return 'too-small';
  if (high !== null && share > high) return 'too-large';
  return 'ok';
}

function isCentred(face: FaceSample, frame: FrameSize): boolean {
  const faceCentre = face.bounds.x + face.bounds.width / 2;
  const drift = Math.abs(faceCentre - frame.width / 2) / frame.width;
  if (drift > CENTRE_TOLERANCE) return false;
  return Math.abs(face.rollAngle) <= TILT_TOLERANCE && Math.abs(face.yawAngle) <= TILT_TOLERANCE;
}

/**
 * Grade one frame.
 *
 * Hints come out one at a time in a fixed order — centring, head size,
 * lighting, background — so the label does not flicker between two problems
 * while someone is trying to fix one of them.
 */
export function evaluateFrame(
  face: FaceSample | null,
  frame: FrameSize,
  spec: CaptureSpec,
  stats: FrameStats,
): CoachingState {
  if (!face) {
    return {
      checks: { centre: false, head: false, light: false, background: false },
      hint: 'Centre your face in the oval',
      ready: false,
    };
  }

  const centre = isCentred(face, frame);
  const head = headVerdict(face, frame, spec);
  const dark = stats.luma < LUMA_MIN;
  const bright = stats.luma > LUMA_MAX;
  const uneven = stats.lumaSpread > LUMA_SPREAD_MAX;
  // Not measured is not the same as wrong: claiming a failure we have not
  // measured would be coaching a lie.
  const background =
    stats.backgroundVariance === undefined
      ? true
      : stats.backgroundVariance <= BACKGROUND_VARIANCE_MAX;

  const checks: CoachingChecks = {
    centre,
    head: head === 'ok',
    light: !dark && !bright && !uneven,
    background,
  };

  return { checks, hint: hintFor(checks, face, head, { dark, bright, uneven }), ready: allPass(checks) };
}

function allPass(checks: CoachingChecks): boolean {
  return checks.centre && checks.head && checks.light && checks.background;
}

function hintFor(
  checks: CoachingChecks,
  face: FaceSample,
  head: HeadVerdict,
  light: { dark: boolean; bright: boolean; uneven: boolean },
): string {
  if (!checks.centre) {
    const tilted =
      Math.abs(face.rollAngle) > TILT_TOLERANCE || Math.abs(face.yawAngle) > TILT_TOLERANCE;
    const drifted = !tilted;
    return drifted ? 'Centre your face in the oval' : 'Hold the phone level and look straight on';
  }
  if (!checks.head) return head === 'too-small' ? 'Come closer' : 'Move further back';
  if (!checks.light) {
    if (light.dark) return 'Find more light';
    if (light.bright) return 'Too bright — move out of direct light';
    return 'Even out the light on your face';
  }
  if (!checks.background) return 'Find a plainer background';
  return 'Hold still';
}
