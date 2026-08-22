/**
 * What the camera actually negotiated, in one line.
 *
 * A physical iPhone showed a preview that was dark enough to need direct light
 * on the face, and slow with it — while the stock Camera app was fine. Both
 * follow from a non-binned session: VisionCamera's own note on `isBinned` says
 * binning "improves low-light sensitivity" and that binned formats "use
 * significantly less bandwidth". Which format the session settled on is
 * therefore the fact worth having, and it is not otherwise visible on a device
 * with no debugger attached.
 */
export type SessionFacts = {
  isBinned: boolean;
  selectedFPS?: number;
  nativePixelFormat: string;
};

export function describeSession(config: SessionFacts, dropped = 0): string {
  const parts = [
    config.isBinned ? 'binned' : 'full-res',
    config.selectedFPS ? `${config.selectedFPS}fps` : 'default fps',
    config.nativePixelFormat,
  ];
  // Drops are the number that decides whether the frame processor is at fault:
  // a stalling pipeline drops frames, a healthy one does not.
  if (dropped > 0) parts.push(`${dropped} dropped`);
  return parts.join(' · ');
}


/**
 * What the detector actually reported, in one line.
 *
 * Written because every reading of this library's coordinate convention has
 * been wrong so far: it transposes x and y for both bounds and landmarks
 * (ios/HybridFace.swift: `x: boundingBox.minY`), and hands back ML Kit's Euler
 * angles untouched. Rather than guess a fifth time, the device says.
 */
export function describeFace(
  face: {
    bounds: { x: number; y: number; width: number; height: number };
    rollAngle: number;
    yawAngle: number;
  } | null,
  frame: { width: number; height: number },
): string {
  if (!face) return `no face · frame ${frame.width}×${frame.height}`;

  const { x, y, width, height } = face.bounds;
  const round = (value: number) => Math.round(value);
  return (
    `face ${round(x)},${round(y)} ${round(width)}×${round(height)} ` +
    `of ${frame.width}×${frame.height} · ` +
    `roll ${round(face.rollAngle)} yaw ${round(face.yawAngle)}`
  );
}
