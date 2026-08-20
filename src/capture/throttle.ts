/**
 * How often the frame worklet hands statistics to the JS thread.
 *
 * VisionCamera's own guidance is that a Frame must be released immediately or
 * the camera pipeline stalls, and that reading pixels back to the CPU on every
 * frame is what makes a frame processor too slow. The coaching recomputes ten
 * times a second (see useCoaching), so anything faster than this is bandwidth
 * spent on a number nobody reads.
 */
export const STATS_INTERVAL_MS = 100;

/**
 * Whether a frame arriving at `now` should be measured.
 *
 * Timestamps rather than a frame counter: the interval then holds at 30fps and
 * at 60fps alike, and it is what the frame carries anyway.
 */
export function shouldSample(
  now: number,
  lastSampledAt: number | null,
  intervalMs: number = STATS_INTERVAL_MS,
): boolean {
  'worklet';

  if (lastSampledAt === null) return true;

  const since = now - lastSampledAt;
  // Frame timestamps restart when the camera session does. Treating a
  // backwards jump as "not yet" would leave the coaching unmeasured forever.
  if (since < 0) return true;

  return since >= intervalMs;
}
