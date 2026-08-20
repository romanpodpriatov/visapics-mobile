import { STATS_INTERVAL_MS, shouldSample } from '../throttle';

describe('shouldSample', () => {
  it('samples the first frame it ever sees', () => {
    expect(shouldSample(0, null)).toBe(true);
  });

  it('skips a frame that arrives before the interval is up', () => {
    // At 30fps frames arrive every 33ms. Reading pixels and hopping to the JS
    // thread on each one is what stalls the camera pipeline; the coaching
    // recomputes ten times a second and cannot use more than that.
    expect(shouldSample(1030, 1000)).toBe(false);
  });

  it('samples again once the interval has passed', () => {
    expect(shouldSample(1000 + STATS_INTERVAL_MS, 1000)).toBe(true);
  });

  it('samples when the clock jumps backwards, rather than going silent', () => {
    // Frame timestamps restart when the camera session does. A monotonic-only
    // comparison would leave the coaching without statistics forever.
    expect(shouldSample(5, 900_000)).toBe(true);
  });
});
