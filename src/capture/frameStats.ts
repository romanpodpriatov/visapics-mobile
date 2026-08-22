/**
 * Brightness and background statistics, read off the camera frame.
 *
 * This is the only part of the coaching that needs pixels rather than face
 * geometry, and it runs in a worklet on the frame-processing thread, so it has
 * to be cheap: it samples a grid of a few hundred points out of the luma plane
 * rather than walking the buffer.
 *
 * UNVERIFIED ON HARDWARE. Everything here is written against VisionCamera 5's
 * types; whether the worklet runs, and how fast, needs a physical phone. The
 * caller treats missing statistics as "not measured" rather than as a failure,
 * so a frame this cannot read degrades the coaching instead of blocking it.
 */
import type { Frame } from 'react-native-vision-camera';

import type { FrameStats } from './gate';

/** Roughly this many samples per frame, spread over a grid. */
const SAMPLE_TARGET = 24;

export function readFrameStats(frame: Frame): FrameStats | null {
  'worklet';

  if (!frame.isValid || !frame.hasPixelBuffer) return null;

  const planes = frame.getPlanes();
  // Plane 0 of a YUV frame is luma already, which is what makes this cheap.
  // A non-planar (RGB) frame would need converting, and is not worth the cost
  // on the frame thread — the caller carries on without the statistic.
  if (planes.length === 0) return null;

  const plane = planes[0];
  if (!plane.isValid) return null;

  const buffer = new Uint8Array(plane.getPixelBuffer());
  const { width, height, bytesPerRow } = plane;
  if (width === 0 || height === 0) return null;

  const stepX = Math.max(1, Math.floor(width / SAMPLE_TARGET));
  const stepY = Math.max(1, Math.floor(height / SAMPLE_TARGET));

  let total = 0;
  let count = 0;
  let leftTotal = 0;
  let leftCount = 0;
  let rightTotal = 0;
  let rightCount = 0;
  // The band across the top, which is behind the head in a portrait frame.
  let backTotal = 0;
  let backCount = 0;
  let backSquares = 0;

  for (let y = 0; y < height; y += stepY) {
    const row = y * bytesPerRow;
    for (let x = 0; x < width; x += stepX) {
      const value = buffer[row + x] / 255;
      total += value;
      count += 1;

      if (x < width / 3) {
        leftTotal += value;
        leftCount += 1;
      } else if (x > (width * 2) / 3) {
        rightTotal += value;
        rightCount += 1;
      }

      if (y < height / 4) {
        backTotal += value;
        backSquares += value * value;
        backCount += 1;
      }
    }
  }

  if (count === 0) return null;

  const luma = total / count;
  const left = leftCount > 0 ? leftTotal / leftCount : luma;
  const right = rightCount > 0 ? rightTotal / rightCount : luma;

  let backgroundVariance: number | undefined;
  if (backCount > 1) {
    const mean = backTotal / backCount;
    // Standard deviation of the band, which rises with pattern and shadow.
    backgroundVariance = Math.sqrt(Math.max(0, backSquares / backCount - mean * mean));
  }

  return { luma, lumaSpread: Math.abs(left - right), backgroundVariance };
}
