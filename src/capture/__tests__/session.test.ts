import { describeSession } from '../session';

describe('describeSession', () => {
  it('says plainly when the sensor is not binning', () => {
    // The reason this exists: on a physical iPhone the preview was dark and
    // slow. VisionCamera's own note on isBinned says a binned format is both
    // better in low light and far cheaper in bandwidth — so which one the
    // session picked is the first thing worth knowing.
    expect(describeSession({ isBinned: false, selectedFPS: 30, nativePixelFormat: 'yuv' })).toBe(
      'full-res · 30fps · yuv',
    );
  });

  it('says when it is binning', () => {
    expect(describeSession({ isBinned: true, selectedFPS: 30, nativePixelFormat: 'yuv' })).toBe(
      'binned · 30fps · yuv',
    );
  });

  it('copes with a session that named no frame rate', () => {
    expect(describeSession({ isBinned: true, nativePixelFormat: 'rgb' })).toBe(
      'binned · default fps · rgb',
    );
  });
});
