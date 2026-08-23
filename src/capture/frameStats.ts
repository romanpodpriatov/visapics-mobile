/**
 * Brightness statistics, read off the camera frame.
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

  // The band a framed face occupies. The server measures shadow across the
  // face; measuring across the whole frame let a window behind someone read as
  // a shadow on their cheek, which failed "Even lighting" in evenly lit rooms.
  const faceLeft = width * 0.25;
  const faceRight = width * 0.75;
  const faceTop = height * 0.15;
  const faceBottom = height * 0.75;
  const faceMiddle = (faceLeft + faceRight) / 2;

  let total = 0;
  let count = 0;
  let leftTotal = 0;
  let leftCount = 0;
  let rightTotal = 0;
  let rightCount = 0;

  for (let y = 0; y < height; y += stepY) {
    const row = y * bytesPerRow;
    const withinFaceRows = y >= faceTop && y <= faceBottom;

    for (let x = 0; x < width; x += stepX) {
      const value = buffer[row + x] / 255;
      total += value;
      count += 1;

      if (!withinFaceRows || x < faceLeft || x > faceRight) continue;

      if (x < faceMiddle) {
        leftTotal += value;
        leftCount += 1;
      } else {
        rightTotal += value;
        rightCount += 1;
      }
    }
  }

  if (count === 0) return null;

  const luma = total / count;
  const left = leftCount > 0 ? leftTotal / leftCount : luma;
  const right = rightCount > 0 ? rightTotal / rightCount : luma;

  return { luma, lumaSpread: Math.abs(left - right) };
}
