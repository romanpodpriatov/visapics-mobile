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
