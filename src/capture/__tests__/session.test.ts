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

describe('describeSession with dropped frames', () => {
  it('counts the frames the pipeline could not keep up with', () => {
    // The number that decides whether the frame processor is the problem. A
    // stalling pipeline drops frames; a healthy one does not.
    expect(
      describeSession({ isBinned: true, selectedFPS: 30, nativePixelFormat: 'yuv' }, 12),
    ).toBe('binned · 30fps · yuv · 12 dropped');
  });

  it('says nothing about drops when there have been none', () => {
    expect(
      describeSession({ isBinned: true, selectedFPS: 30, nativePixelFormat: 'yuv' }, 0),
    ).toBe('binned · 30fps · yuv');
  });
});
