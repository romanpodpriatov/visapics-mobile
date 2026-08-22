/**
 * The live gate — the server's quality gate, as far as a preview can see it.
 *
 * Every threshold here comes from /api/v1/config, which serves the pipeline's
 * own QualityThresholds. Nothing is invented locally, and that is the point:
 * the photo that prompted this was refused for a 5.6° head roll against a gate
 * that passes at 2°, while the app — checking four rules of its own devising —
 * had armed the shutter and never looked at roll at all. Two sets of numbers
 * mean two verdicts, and the one the person meets first is the wrong one.
 *
 * Seven of the gate's thirteen checks can be judged from a preview frame. The
 * other six — eyes, gaze, expression, glare, blur, colour cast — need the full
 * photo, so the server still has the last word; but nothing that fails here
 * can reach it.
 */

/** The limits the server judges by. Shape of config.quality. */
export type QualityLimits = {
  pose_roll_max_deg: number;
  pose_yaw_max_deg: number;
  pose_pitch_max_deg: number;
  face_area_ratio_min: number;
  head_margin_ratio_min: number;
  /** 0–255, the gate's own scale. */
  exposure_median_min: number;
  exposure_median_max: number;
  shadow_diff_max: number;
  background_std_max: number;
};

export const LIVE_CHECK_KEYS = [
  'face_detection',
  'head_in_frame',
  'face_size',
  'pose',
  'exposure',
  'shadows',
  'background',
] as const;

export type LiveCheckKey = (typeof LIVE_CHECK_KEYS)[number];

/** The server's own words, so the same check reads the same in both places. */
export const LIVE_CHECK_LABELS: Record<LiveCheckKey, string> = {
  face_detection: 'Face detected',
  head_in_frame: 'Head fully in frame',
  face_size: 'Face size',
  pose: 'Head straight',
  exposure: 'Exposure',
  shadows: 'Even lighting',
  background: 'Background',
};

/** What to say about the first thing standing in the way. */
const HINTS: Record<LiveCheckKey, string> = {
  face_detection: 'Show your face in the frame',
  head_in_frame: 'Move back — your head reaches the edge',
  face_size: 'Move closer to the camera',
  pose: 'Hold your head straight',
  exposure: 'Find brighter, even light',
  shadows: 'Even out the light on your face',
  background: 'Use a plainer, lighter background',
};

/**
 * The crop guide spans this share of the frame width and takes its height from
 * the document's proportions. It is a sight, not a rule: what decides is the
 * gate below, on the server's numbers.
 */
export const GUIDE_WIDTH_SHARE = 0.7;

export type CheckStatus = 'pass' | 'fail' | 'unmeasured';
export type LiveCheck = { key: LiveCheckKey; label: string; status: CheckStatus };
export type GateState = { checks: LiveCheck[]; ready: boolean; hint: string };

export type FaceSample = {
  bounds: { x: number; y: number; width: number; height: number };
  /** Degrees, straight from the detector. */
  yawAngle: number;
  rollAngle: number;
};

export type FrameSize = { width: number; height: number };

export type FrameStats = {
  /** Mean brightness, 0–1. Multiplied by 255 to meet the gate's scale. */
  luma: number;
  /** Left-to-right brightness difference, 0–1. */
  lumaSpread: number;
  /** Variation behind the head, 0–1. Absent when it was not measured. */
  backgroundVariance?: number;
};

const READY_HINT = 'Hold still';
const WAITING_HINT = 'Checking the requirements…';

function verdict(passed: boolean): CheckStatus {
  return passed ? 'pass' : 'fail';
}

function poseWithin(face: FaceSample, limits: QualityLimits): boolean {
  return (
    Math.abs(face.rollAngle) <= limits.pose_roll_max_deg &&
    Math.abs(face.yawAngle) <= limits.pose_yaw_max_deg
  );
}

function headInFrame(face: FaceSample, frame: FrameSize, limits: QualityLimits): boolean {
  const { x, y, width, height } = face.bounds;
  const margins = [
    x / frame.width,
    y / frame.height,
    (frame.width - (x + width)) / frame.width,
    (frame.height - (y + height)) / frame.height,
  ];
  return margins.every((margin) => margin >= limits.head_margin_ratio_min);
}

function faceShare(face: FaceSample, frame: FrameSize): number {
  const area = frame.width * frame.height;
  return area > 0 ? (face.bounds.width * face.bounds.height) / area : 0;
}

export function evaluateGate(
  face: FaceSample | null,
  frame: FrameSize,
  stats: FrameStats | null,
  limits: QualityLimits | null,
): GateState {
  const unmeasured = (key: LiveCheckKey): LiveCheck => ({
    key,
    label: LIVE_CHECK_LABELS[key],
    status: 'unmeasured',
  });

  // Without the server's numbers there is nothing to judge against, and
  // guessing is the whole mistake this file exists to undo.
  if (!limits) {
    return { checks: LIVE_CHECK_KEYS.map(unmeasured), ready: false, hint: WAITING_HINT };
  }

  const check = (key: LiveCheckKey, status: CheckStatus): LiveCheck => ({
    key,
    label: LIVE_CHECK_LABELS[key],
    status,
  });

  const checks: LiveCheck[] = face
    ? [
        check('face_detection', 'pass'),
        check('head_in_frame', verdict(headInFrame(face, frame, limits))),
        check('face_size', verdict(faceShare(face, frame) >= limits.face_area_ratio_min)),
        check('pose', verdict(poseWithin(face, limits))),
      ]
    : [
        check('face_detection', 'fail'),
        unmeasured('head_in_frame'),
        unmeasured('face_size'),
        unmeasured('pose'),
      ];

  if (stats) {
    const median = stats.luma * 255;
    checks.push(
      check(
        'exposure',
        verdict(median >= limits.exposure_median_min && median <= limits.exposure_median_max),
      ),
      check('shadows', verdict(stats.lumaSpread * 255 <= limits.shadow_diff_max)),
      check(
        'background',
        stats.backgroundVariance === undefined
          ? 'unmeasured'
          : verdict(stats.backgroundVariance * 255 <= limits.background_std_max),
      ),
    );
  } else {
    // A phone whose frame worklet does not run must still be able to take a
    // photo. Saying "not measured" is honest; refusing for ever is not, and
    // the server checks all three again anyway.
    checks.push(unmeasured('exposure'), unmeasured('shadows'), unmeasured('background'));
  }

  const ordered = LIVE_CHECK_KEYS.map((key) => checks.find((c) => c.key === key)!);
  const failing = ordered.find((c) => c.status === 'fail');

  return {
    checks: ordered,
    ready: !failing,
    hint: failing ? HINTS[failing.key] : READY_HINT,
  };
}
