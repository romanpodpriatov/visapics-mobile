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
  /** 0–255, the gate's own scale. Advisory — see `advisory`. */
  exposure_median_min: number;
  exposure_median_max: number;
  /**
   * The checks worth showing that must never gate the shutter, because the
   * server only ever warns about them. Median brightness raises TOO_DARK or
   * UNDEREXPOSED, both WARN_ONLY; what blocks is the share of pure black
   * pixels, which a preview cannot measure.
   */
  advisory: string[];
};

/**
 * Five, not the server's thirteen, and deliberately without `background` or
 * `shadows`.
 *
 * The background is replaced by the pipeline, so refusing a shot over the wall
 * behind someone would block a picture that was about to be fixed. Shadow is a
 * measurement across the *face*, and the face's position is known in
 * JavaScript while the pixels exist only inside the frame worklet — the bridge
 * between them was the shared value that stopped the worklet running at all.
 * A fixed band of the frame stood in for the face and failed evenly lit rooms,
 * so it is better not to claim the measurement: the server makes it properly
 * on the full photo and now says, in words, what is wrong.
 */
export const LIVE_CHECK_KEYS = [
  'face_detection',
  'head_in_frame',
  'face_size',
  'pose',
  'exposure',
] as const;

export type LiveCheckKey = (typeof LIVE_CHECK_KEYS)[number];

/** The server's own words, so the same check reads the same in both places. */
export const LIVE_CHECK_LABELS: Record<LiveCheckKey, string> = {
  face_detection: 'Face detected',
  head_in_frame: 'Head fully in frame',
  face_size: 'Face size',
  pose: 'Head straight',
  exposure: 'Exposure',
};

/** What to say about the first thing standing in the way. */
const HINTS: Record<LiveCheckKey, string> = {
  face_detection: 'Show your face in the frame',
  head_in_frame: 'Move back — your head reaches the edge',
  face_size: 'Move closer to the camera',
  pose: 'Hold your head straight',
  exposure: 'Find brighter, even light',
};

/**
 * The crop guide spans this share of the frame width and takes its height from
 * the document's proportions. It is a sight, not a rule: what decides is the
 * gate below, on the server's numbers.
 */
export const GUIDE_WIDTH_SHARE = 0.7;

export type CheckStatus = 'pass' | 'fail' | 'unmeasured';
export type LiveCheck = {
  key: LiveCheckKey;
  label: string;
  status: CheckStatus;
  /**
   * What was measured, against what. A tile that only says "fix this" leaves
   * the person guessing which way to move — and left three rounds of debugging
   * guessing which number was wrong.
   */
  detail?: string;
};
export type GateState = {
  checks: LiveCheck[];
  ready: boolean;
  hint: string;
  /**
   * How far the head is off level, in degrees, or null when there is no face.
   * The screen draws a line at this angle: "hold your head straight" says
   * nothing about which way or how far, and a line the person levels against
   * the horizon converges on zero whichever way the sign runs.
   */
  tilt: number | null;
};

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
  /** Left-to-right brightness difference across the face band, 0–1. */
  lumaSpread: number;
};

const READY_HINT = 'Hold still';
const WAITING_HINT = 'Checking the requirements…';

function verdict(passed: boolean): CheckStatus {
  return passed ? 'pass' : 'fail';
}

/**
 * How far the head is tilted from upright, in degrees.
 *
 * The detector hands back ML Kit's headEulerAngleZ untouched, measured in the
 * buffer's own frame — and that frame is rotated from the phone's by a
 * multiple of 90°. On a device this showed as "Head straight" failing
 * identically for a level head and a tilted one, the reported angle sitting
 * near -89 either way. The quarter turns belong to the buffer; what is left
 * over belongs to the head.
 */
export function headRoll(reportedDegrees: number): number {
  return reportedDegrees - 90 * Math.round(reportedDegrees / 90);
}

/** The tightest of the four gaps between the head and the edge of the frame. */
function smallestMargin(face: FaceSample, frame: FrameSize): number {
  const { x, y, width, height } = face.bounds;
  return Math.min(
    x / frame.width,
    y / frame.height,
    (frame.width - (x + width)) / frame.width,
    (frame.height - (y + height)) / frame.height,
  );
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
    return {
      checks: LIVE_CHECK_KEYS.map(unmeasured),
      ready: false,
      hint: WAITING_HINT,
      tilt: null,
    };
  }

  const check = (key: LiveCheckKey, status: CheckStatus, detail?: string): LiveCheck => ({
    key,
    label: LIVE_CHECK_LABELS[key],
    status,
    ...(detail === undefined ? {} : { detail }),
  });

  const percent = (share: number) => `${Math.round(share * 100)}%`;
  const degrees = (value: number) => `${Math.round(value)}°`;

  const checks: LiveCheck[] = [];

  if (face) {
    const margin = smallestMargin(face, frame);
    const share = faceShare(face, frame);
    const roll = Math.abs(headRoll(face.rollAngle));
    const yaw = Math.abs(face.yawAngle);

    checks.push(
      check('face_detection', 'pass'),
      check(
        'head_in_frame',
        verdict(margin >= limits.head_margin_ratio_min),
        `margin ${percent(margin)} · min ${percent(limits.head_margin_ratio_min)}`,
      ),
      check(
        'face_size',
        verdict(share >= limits.face_area_ratio_min),
        `${percent(share)} · min ${percent(limits.face_area_ratio_min)}`,
      ),
      check(
        'pose',
        verdict(roll <= limits.pose_roll_max_deg && yaw <= limits.pose_yaw_max_deg),
        `roll ${degrees(roll)} yaw ${degrees(yaw)} · max ` +
          `${degrees(limits.pose_roll_max_deg)}/${degrees(limits.pose_yaw_max_deg)}`,
      ),
    );
  } else {
    checks.push(
      check('face_detection', 'fail'),
      unmeasured('head_in_frame'),
      unmeasured('face_size'),
      unmeasured('pose'),
    );
  }

  if (stats) {
    // Judged on the number that is shown. "80 · 80–180" beside a red tile is
    // an argument with itself.
    const median = Math.round(stats.luma * 255);
    checks.push(
      check(
        'exposure',
        verdict(
          median >= limits.exposure_median_min && median <= limits.exposure_median_max,
        ),
        `${median} · ${Math.round(limits.exposure_median_min)}–` +
          `${Math.round(limits.exposure_median_max)}`,
      ),
    );
  } else {
    // A phone whose frame worklet does not run must still be able to take a
    // photo, and the server checks the light again regardless.
    checks.push(unmeasured('exposure'));
  }

  const ordered = LIVE_CHECK_KEYS.map((key) => checks.find((c) => c.key === key)!);
  // Only a check the server would actually refuse over holds the shutter.
  const blocking = ordered.find(
    (c) => c.status === 'fail' && !limits.advisory.includes(c.key),
  );

  return {
    checks: ordered,
    ready: !blocking,
    hint: blocking ? HINTS[blocking.key] : READY_HINT,
    tilt: face ? headRoll(face.rollAngle) : null,
  };
}
