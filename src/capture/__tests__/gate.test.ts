import { LIVE_CHECK_KEYS, evaluateGate, headRoll } from '../gate';

/** Exactly what /api/v1/config serves. */
const LIMITS = {
  pose_roll_max_deg: 3,
  pose_yaw_max_deg: 8,
  pose_pitch_max_deg: 8,
  face_area_ratio_min: 0.02,
  head_margin_ratio_min: 0.03,
  exposure_median_min: 80,
  exposure_median_max: 180,
  advisory: ['exposure', 'head_in_frame'],
};

const FRAME = { width: 1000, height: 1000 };

/** Centred, a third of the frame across, level. */
const GOOD_FACE = {
  bounds: { x: 350, y: 300, width: 300, height: 400 },
  yawAngle: 0,
  rollAngle: 0,
};

const GOOD_STATS = { luma: 130 / 255, lumaSpread: 5 / 255 };

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
    ]);
  });

  it('refuses a head rolled past the gate, which is what refused the real photo', () => {
    // Production: roll -5.6 degrees, and the gate blocks past 3.
    const result = run({ ...GOOD_FACE, rollAngle: -5.6 });

    expect(statusOf(result, 'pose')).toBe('fail');
    expect(result.ready).toBe(false);
    expect(result.hint).toMatch(/straight|tilt/i);
  });

  it('accepts a roll the gate would only warn about', () => {
    // Measured on a device: a level head reads about 3 degrees. Refusing that
    // means a shutter that never arms, for a photo the server processes
    // without complaint.
    expect(statusOf(run({ ...GOOD_FACE, rollAngle: 2.9 }), 'pose')).toBe('pass');
  });

  it('refuses a head turned past the yaw limit', () => {
    expect(statusOf(run({ ...GOOD_FACE, yawAngle: 9 }), 'pose')).toBe('fail');
  });

  it('shows a poor exposure without locking the shutter over it', () => {
    // Median brightness only ever raises TOO_DARK or UNDEREXPOSED on the
    // server, both of which let processing continue. What blocks is the share
    // of pure black pixels, which a preview cannot measure.
    const dim = { ...GOOD_STATS, luma: 50 / 255 };
    const result = run(GOOD_FACE, dim);

    expect(statusOf(result, 'exposure')).toBe('fail');
    expect(result.ready).toBe(true);
  });

  it('judges the exposure by the number it shows', () => {
    // "80 · 80–180" beside a red tile is an argument with itself.
    const borderline = { ...GOOD_STATS, luma: 79.6 / 255 };
    const result = run(GOOD_FACE, borderline);

    expect(result.checks.find((c) => c.key === 'exposure')?.detail).toBe('80 · 80–180');
    expect(statusOf(result, 'exposure')).toBe('pass');
  });

  it('refuses a face too small for the gate', () => {
    // Below 0.02 of the frame the gate raises FACE_TOO_SMALL, which blocks.
    const small = { ...GOOD_FACE, bounds: { x: 490, y: 490, width: 60, height: 80 } };

    expect(statusOf(run(small), 'face_size')).toBe('fail');
    expect(run(small).hint).toMatch(/closer|nearer/i);
  });

  it('shows a head against the edge without holding the shutter over it', () => {
    // The detector clamps its box to the frame, so a head cropped by the edge
    // reads as a head neatly inside it: the check cannot fail honestly, and
    // the server refuses a cropped head anyway.
    const edge = { ...GOOD_FACE, bounds: { x: 10, y: 300, width: 300, height: 400 } };

    expect(statusOf(run(edge), 'head_in_frame')).toBe('fail');
    expect(run(edge).ready).toBe(true);
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

  it('does not judge the background at all, because the pipeline replaces it', () => {
    // Every photo is processed with remove_background, so a live verdict on
    // the wall behind someone would refuse a shot the server was going to fix
    // anyway. The server still warns about it on the original.
    expect(run().checks.map((c) => String(c.key))).not.toContain('background');
  });

  it('does not judge the shadow on a face it cannot locate in the pixels', () => {
    // Shadow is measured across the face. The face's position is known in
    // JavaScript; the pixels exist only in the frame worklet. A fixed band of
    // the frame stood in for the face and failed evenly lit rooms, so the
    // claim is not made at all — the server makes it on the full photo.
    expect(run().checks.map((c) => String(c.key))).not.toContain('shadows');
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

describe('headRoll', () => {
  it('reads an upright head as upright, whatever way the buffer lies', () => {
    // Measured on a device: "Head straight" failed identically for a level
    // head and a tilted one, because the detector reports ML Kit's angle in
    // the buffer's own frame — and that frame is rotated from the phone's by
    // a multiple of 90°. What is left over is the tilt of the head.
    expect(headRoll(-89.14)).toBeCloseTo(0.86, 2);
    expect(headRoll(89.5)).toBeCloseTo(-0.5, 2);
    expect(headRoll(0.4)).toBeCloseTo(0.4, 2);
    expect(headRoll(179.2)).toBeCloseTo(-0.8, 2);
  });

  it('still sees a real tilt as a tilt', () => {
    // A head 20° over, on a buffer lying at -90°.
    expect(headRoll(-69.14)).toBeCloseTo(20.86, 2);
    expect(headRoll(20)).toBeCloseTo(20, 2);
  });

  it('judges the tilt by what is left over, not by the raw angle', () => {
    const level = { ...GOOD_FACE, rollAngle: -89.14 };
    const tilted = { ...GOOD_FACE, rollAngle: -69.14 };

    expect(statusOf(run(level), 'pose')).toBe('pass');
    expect(statusOf(run(tilted), 'pose')).toBe('fail');
  });
});


describe('what each check measured', () => {
  // A tile that only says "fix this" leaves the person guessing which way to
  // move, and left me guessing which number was wrong for three rounds.
  const detailOf = (result: ReturnType<typeof evaluateGate>, key: string) =>
    result.checks.find((c) => c.key === key)?.detail;

  it('shows the tilt it read, and the limit it read it against', () => {
    expect(detailOf(run({ ...GOOD_FACE, rollAngle: -69.14 }), 'pose')).toBe(
      'roll 21° yaw 0° · max 3°/8°',
    );
  });

  it('shows how much of the frame the face fills', () => {
    expect(detailOf(run(), 'face_size')).toBe('12% · min 2%');
  });

  it('shows the brightness it measured', () => {
    expect(detailOf(run(), 'exposure')).toBe('130 · 80–180');
  });

  it('shows the tightest margin around the head', () => {
    expect(detailOf(run(), 'head_in_frame')).toBe('margin 30% · min 3%');
  });

  it('says nothing it did not measure', () => {
    expect(detailOf(evaluateGate(null, FRAME, GOOD_STATS, LIMITS), 'pose')).toBeUndefined();
  });
});


describe('the tilt the screen can draw', () => {
  it('reports the tilt it measured, so the guide can show it', () => {
    // "Hold your head straight" says nothing about which way or how far. A
    // line drawn at the measured angle does, and aligning it to horizontal
    // converges on zero whichever way the sign runs.
    expect(run({ ...GOOD_FACE, rollAngle: -82 }).tilt).toBeCloseTo(8, 1);
  });

  it('reports no tilt when it has no face to measure', () => {
    expect(evaluateGate(null, FRAME, GOOD_STATS, LIMITS).tilt).toBeNull();
  });
});
