import { LIVE_CHECK_KEYS, evaluateGate } from '../gate';

/** Exactly what /api/v1/config serves. */
const LIMITS = {
  pose_roll_max_deg: 2,
  pose_yaw_max_deg: 5,
  pose_pitch_max_deg: 5,
  face_area_ratio_min: 0.05,
  head_margin_ratio_min: 0.03,
  exposure_median_min: 80,
  exposure_median_max: 180,
  shadow_diff_max: 25,
  background_std_max: 30,
};

const FRAME = { width: 1000, height: 1000 };

/** Centred, a third of the frame across, level. */
const GOOD_FACE = {
  bounds: { x: 350, y: 300, width: 300, height: 400 },
  yawAngle: 0,
  rollAngle: 0,
};

const GOOD_STATS = { luma: 130 / 255, lumaSpread: 5 / 255, backgroundVariance: 10 / 255 };

const run = (face = GOOD_FACE, stats = GOOD_STATS, frame = FRAME) =>
  evaluateGate(face, frame, stats, LIMITS);

const statusOf = (result: ReturnType<typeof evaluateGate>, key: string) =>
  result.checks.find((c) => c.key === key)?.status;

describe('the live gate', () => {
  it('arms the shutter when everything the server judges is satisfied', () => {
    const result = run();

    expect(result.ready).toBe(true);
    expect(result.checks.every((c) => c.status !== 'fail')).toBe(true);
  });

  it('runs the checks the server runs, under the server names', () => {
    // Not four inventions of our own. Every key here is a key the quality
    // gate reports, so a tile that passes means that check will pass.
    expect(LIVE_CHECK_KEYS).toEqual([
      'face_detection',
      'head_in_frame',
      'face_size',
      'pose',
      'exposure',
      'shadows',
      'background',
    ]);
  });

  it('refuses a head rolled past the gate, which is what refused the real photo', () => {
    // Production: roll -5.6 degrees, gate passes at 2, and the app was not
    // looking at roll at all — so it armed the shutter on a photo the server
    // was always going to reject.
    const result = run({ ...GOOD_FACE, rollAngle: -5.6 });

    expect(statusOf(result, 'pose')).toBe('fail');
    expect(result.ready).toBe(false);
    expect(result.hint).toMatch(/straight|tilt/i);
  });

  it('accepts a roll inside the gate', () => {
    expect(statusOf(run({ ...GOOD_FACE, rollAngle: 1.9 }), 'pose')).toBe('pass');
  });

  it('refuses a head turned past the yaw limit', () => {
    expect(statusOf(run({ ...GOOD_FACE, yawAngle: 6 }), 'pose')).toBe('fail');
  });

  it('refuses a face too small for the gate', () => {
    // 0.05 of the frame area is the gate's warning line.
    const small = { ...GOOD_FACE, bounds: { x: 480, y: 480, width: 100, height: 150 } };

    expect(statusOf(run(small), 'face_size')).toBe('fail');
    expect(run(small).hint).toMatch(/closer|nearer/i);
  });

  it('refuses a head against the edge of the frame', () => {
    const edge = { ...GOOD_FACE, bounds: { x: 10, y: 300, width: 300, height: 400 } };

    expect(statusOf(run(edge), 'head_in_frame')).toBe('fail');
  });

  it('says so plainly when there is no face at all', () => {
    const result = evaluateGate(null, FRAME, GOOD_STATS, LIMITS);

    expect(statusOf(result, 'face_detection')).toBe('fail');
    expect(result.ready).toBe(false);
    expect(result.hint).toMatch(/face/i);
  });

  it('refuses a frame too dark on the gate own scale', () => {
    const dark = { ...GOOD_STATS, luma: 50 / 255 };

    expect(statusOf(run(GOOD_FACE, dark), 'exposure')).toBe('fail');
  });

  it('refuses uneven light, which is the other half of what refused the real photo', () => {
    const shadowed = { ...GOOD_STATS, lumaSpread: 55 / 255 };

    expect(statusOf(run(GOOD_FACE, shadowed), 'shadows')).toBe('fail');
    expect(run(GOOD_FACE, shadowed).hint).toMatch(/light|shadow/i);
  });

  it('refuses a busy background', () => {
    const busy = { ...GOOD_STATS, backgroundVariance: 45 / 255 };

    expect(statusOf(run(GOOD_FACE, busy), 'background')).toBe('fail');
  });

  it('does not block the shutter on light it could not measure', () => {
    // A phone whose frame worklet does not run must still be able to take a
    // photo. Saying "not measured" is honest; refusing for ever is not.
    const result = evaluateGate(GOOD_FACE, FRAME, null, LIMITS);

    expect(statusOf(result, 'exposure')).toBe('unmeasured');
    expect(result.ready).toBe(true);
  });

  it('waits rather than guessing when the server has sent no limits yet', () => {
    const result = evaluateGate(GOOD_FACE, FRAME, GOOD_STATS, null);

    expect(result.ready).toBe(false);
    expect(result.hint).toMatch(/checking|loading|moment/i);
  });
});
