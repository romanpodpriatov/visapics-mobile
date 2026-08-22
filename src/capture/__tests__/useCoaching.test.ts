import { act, renderHook } from '@testing-library/react-native';

import { useCoaching } from '../useCoaching';

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
const LEVEL = { bounds: { x: 350, y: 300, width: 300, height: 400 }, yawAngle: 0, rollAngle: 0 };

describe('useCoaching', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const tick = () => act(() => jest.advanceTimersByTime(120));

  it('says nothing has been seen until a frame arrives', () => {
    const { result } = renderHook(() => useCoaching(LIMITS));

    tick();
    expect(result.current.state.ready).toBe(false);
  });

  it('arms once the gate is satisfied', () => {
    const { result } = renderHook(() => useCoaching(LIMITS));

    act(() => result.current.onFaces([LEVEL], FRAME));
    act(() => result.current.onStats({ luma: 130 / 255, lumaSpread: 0.01 }));
    tick();

    expect(result.current.state.ready).toBe(true);
  });

  it('keeps the largest face, not the bystander behind it', () => {
    const { result } = renderHook(() => useCoaching(LIMITS));
    const bystander = {
      bounds: { x: 100, y: 100, width: 60, height: 80 },
      yawAngle: 30,
      rollAngle: 30,
    };

    act(() => result.current.onFaces([bystander, LEVEL], FRAME));
    act(() => result.current.onStats({ luma: 130 / 255, lumaSpread: 0.01 }));
    tick();

    // Judged on the near face: the far one would have failed pose outright.
    expect(result.current.state.ready).toBe(true);
  });

  it('recomputes ten times a second rather than on every frame', () => {
    const { result } = renderHook(() => useCoaching(LIMITS));

    act(() => result.current.onFaces([LEVEL], FRAME));
    const before = result.current.state;
    act(() => jest.advanceTimersByTime(10));

    expect(result.current.state).toBe(before);
  });
});
