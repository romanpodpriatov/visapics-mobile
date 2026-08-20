import { act, renderHook } from '@testing-library/react-native';

import type { CaptureSpec } from '../checks';
import { useCoaching } from '../useCoaching';

const SPEC: CaptureSpec = {
  photo_width_mm: 35,
  photo_height_mm: 45,
  head_height_min_mm: 29,
  head_height_max_mm: 34,
  head_height_min_percent: null,
  head_height_max_percent: null,
};

const FRAME = { width: 1080, height: 1920 };
const goodFace = { bounds: { x: 340, y: 480, width: 400, height: 520 }, yawAngle: 0, rollAngle: 0 };

describe('useCoaching', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('is not ready before a frame has arrived', () => {
    const { result } = renderHook(() => useCoaching(SPEC));
    expect(result.current.state.ready).toBe(false);
  });

  it('grades what the camera reports', () => {
    const { result } = renderHook(() => useCoaching(SPEC));

    act(() => {
      result.current.onFaces([goodFace], FRAME);
      result.current.onStats({ luma: 0.55, lumaSpread: 0.05 });
      jest.advanceTimersByTime(200);
    });

    expect(result.current.state.ready).toBe(true);
    expect(result.current.state.checks.head).toBe(true);
  });

  it('takes the largest face when several are in shot', () => {
    const { result } = renderHook(() => useCoaching(SPEC));
    const bystander = {
      bounds: { x: 20, y: 40, width: 90, height: 110 },
      yawAngle: 0,
      rollAngle: 0,
    };

    act(() => {
      result.current.onFaces([bystander, goodFace], FRAME);
      result.current.onStats({ luma: 0.55, lumaSpread: 0.05 });
      jest.advanceTimersByTime(200);
    });

    expect(result.current.state.checks.head).toBe(true);
  });

  it('reports no face once the detector stops seeing one', () => {
    const { result } = renderHook(() => useCoaching(SPEC));

    act(() => {
      result.current.onFaces([goodFace], FRAME);
      jest.advanceTimersByTime(200);
    });
    act(() => {
      result.current.onFaces([], FRAME);
      jest.advanceTimersByTime(200);
    });

    expect(result.current.state.ready).toBe(false);
    expect(result.current.state.hint).toMatch(/centre your face/i);
  });

  it('grades nothing until a document has been chosen', () => {
    const { result } = renderHook(() => useCoaching(null));

    act(() => {
      result.current.onFaces([goodFace], FRAME);
      jest.advanceTimersByTime(400);
    });

    expect(result.current.state.ready).toBe(false);
  });

  it('knows whether the light was ever actually measured', () => {
    // Lighting reads as passing before any statistic arrives, so that a phone
    // whose frame worklet never runs is still usable. The screen has to be
    // able to say "not measured" instead of "even".
    const { result } = renderHook(() => useCoaching(SPEC));
    expect(result.current.measured).toBe(false);

    act(() => {
      result.current.onStats({ luma: 0.55, lumaSpread: 0.05 });
    });

    expect(result.current.measured).toBe(true);
  });

  it('stops sampling when the screen goes away', () => {
    const { unmount } = renderHook(() => useCoaching(SPEC));
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
