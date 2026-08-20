import { evaluateFrame } from '../checks';

const FRAME = { width: 1080, height: 1920 };

const SPEC = {
  photo_width_mm: 35,
  photo_height_mm: 45,
  head_height_min_mm: 29,
  head_height_max_mm: 34,
  head_height_min_percent: null,
  head_height_max_percent: null,
};

/** A face centred in frame, filling the guide the way a good photo does. */
const goodFace = () => ({
  bounds: { x: 340, y: 480, width: 400, height: 520 },
  yawAngle: 0.5,
  rollAngle: 0.4,
});

const GOOD_LIGHT = { luma: 0.55, lumaSpread: 0.1 };

describe('evaluateFrame', () => {
  it('reports every check passing for a well-framed face', () => {
    const state = evaluateFrame(goodFace(), FRAME, SPEC, GOOD_LIGHT);
    expect(state.checks).toEqual({ centre: true, head: true, light: true, background: true });
    expect(state.ready).toBe(true);
  });

  it('is not ready when no face is present', () => {
    const state = evaluateFrame(null, FRAME, SPEC, GOOD_LIGHT);
    expect(state.ready).toBe(false);
    expect(state.hint).toMatch(/centre your face/i);
  });

  it('fails centring when the face sits off to one side', () => {
    const face = { ...goodFace(), bounds: { x: 60, y: 480, width: 400, height: 520 } };
    const state = evaluateFrame(face, FRAME, SPEC, GOOD_LIGHT);
    expect(state.checks.centre).toBe(false);
    expect(state.ready).toBe(false);
  });

  it('fails centring when the phone is held at an angle', () => {
    const state = evaluateFrame({ ...goodFace(), rollAngle: 21 }, FRAME, SPEC, GOOD_LIGHT);
    expect(state.checks.centre).toBe(false);
  });

  it('asks the user to come closer when the head is too small', () => {
    const face = { ...goodFace(), bounds: { x: 470, y: 800, width: 140, height: 180 } };
    const state = evaluateFrame(face, FRAME, SPEC, GOOD_LIGHT);
    expect(state.checks.head).toBe(false);
    expect(state.hint).toMatch(/closer/i);
  });

  it('asks the user to back off when the head fills the frame', () => {
    const face = { ...goodFace(), bounds: { x: 140, y: 100, width: 800, height: 1040 } };
    const state = evaluateFrame(face, FRAME, SPEC, GOOD_LIGHT);
    expect(state.checks.head).toBe(false);
    expect(state.hint).toMatch(/further|back/i);
  });

  it('measures the head against the shape of this document, not a fixed box', () => {
    // The same face, framed identically, is right for a 35×45 passport photo
    // and too close for a square 2×2 inch one.
    const square = {
      photo_width_mm: 50.8,
      photo_height_mm: 50.8,
      head_height_min_mm: 25.4,
      head_height_max_mm: 34.9,
      head_height_min_percent: null,
      head_height_max_percent: null,
    };
    expect(evaluateFrame(goodFace(), FRAME, SPEC, GOOD_LIGHT).checks.head).toBe(true);
    expect(evaluateFrame(goodFace(), FRAME, square, GOOD_LIGHT).checks.head).toBe(false);
  });

  it('falls back to the percentage band for a document with no millimetres', () => {
    // 425 of the 951 specifications state only a share of the photo height.
    const shareOnly = {
      photo_width_mm: 35,
      photo_height_mm: 45,
      head_height_min_mm: null,
      head_height_max_mm: null,
      head_height_min_percent: 0.64,
      head_height_max_percent: 0.76,
    };
    expect(evaluateFrame(goodFace(), FRAME, shareOnly, GOOD_LIGHT).checks.head).toBe(true);
  });

  it('does not fail a document that states no head height at all', () => {
    // One specification of the 951 states none. The server still measures the
    // photo; there is simply nothing here to coach against.
    const noBand = {
      photo_width_mm: 35,
      photo_height_mm: 45,
      head_height_min_mm: null,
      head_height_max_mm: null,
      head_height_min_percent: null,
      head_height_max_percent: null,
    };
    const face = { ...goodFace(), bounds: { x: 470, y: 800, width: 140, height: 180 } };
    expect(evaluateFrame(face, FRAME, noBand, GOOD_LIGHT).checks.head).toBe(true);
  });

  it('fails lighting when the frame is too dark', () => {
    const state = evaluateFrame(goodFace(), FRAME, SPEC, { luma: 0.12, lumaSpread: 0.1 });
    expect(state.checks.light).toBe(false);
    expect(state.hint).toMatch(/light/i);
  });

  it('fails lighting when one side is much brighter than the other', () => {
    const state = evaluateFrame(goodFace(), FRAME, SPEC, { luma: 0.55, lumaSpread: 0.42 });
    expect(state.checks.light).toBe(false);
  });

  it('fails background when the area behind the head is busy', () => {
    const state = evaluateFrame(goodFace(), FRAME, SPEC, {
      ...GOOD_LIGHT,
      backgroundVariance: 0.4,
    });
    expect(state.checks.background).toBe(false);
  });

  it('does not claim the background is wrong when it has not been measured', () => {
    // These four checks are advisory; the server's verdict is the real one.
    // Reporting a failure we have not measured would be coaching a lie.
    const state = evaluateFrame(goodFace(), FRAME, SPEC, GOOD_LIGHT);
    expect(state.checks.background).toBe(true);
  });

  it('gives one hint at a time, in a fixed order', () => {
    // Two failures at once must not produce a hint that flickers between them.
    const face = { ...goodFace(), bounds: { x: 60, y: 800, width: 140, height: 180 } };
    const a = evaluateFrame(face, FRAME, SPEC, { luma: 0.12, lumaSpread: 0.1 });
    const b = evaluateFrame(face, FRAME, SPEC, { luma: 0.12, lumaSpread: 0.1 });
    expect(a.hint).toBe(b.hint);
    expect(a.hint).toMatch(/centre your face/i);
  });

  it('says to hold still once nothing is left to fix', () => {
    expect(evaluateFrame(goodFace(), FRAME, SPEC, GOOD_LIGHT).hint).toMatch(/hold still/i);
  });
});
