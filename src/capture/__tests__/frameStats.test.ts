import { readFrameStats } from '../frameStats';

/**
 * A fake luma plane. `at(x, y)` returns 0–255 for each pixel, so a test can
 * describe a lighting situation rather than a byte array.
 */
const frameOf = (width: number, height: number, at: (x: number, y: number) => number) => {
  const buffer = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) buffer[y * width + x] = at(x, y);
  }
  return {
    isValid: true,
    hasPixelBuffer: true,
    isPlanar: true,
    getPlanes: () => [
      {
        isValid: true,
        width,
        height,
        bytesPerRow: width,
        getPixelBuffer: () => buffer.buffer,
      },
    ],
  } as never;
};

describe('readFrameStats', () => {
  it('reports the frame brightness', () => {
    const stats = readFrameStats(frameOf(200, 200, () => 128));

    expect(stats?.luma).toBeCloseTo(128 / 255, 2);
  });

  it('measures light across the face, not across the room', () => {
    // The server judges shadow over the face region. A bright window on one
    // edge of the frame is not a shadow on anybody's cheek, and treating it as
    // one was failing "Even lighting" in evenly lit rooms.
    const windowOnTheLeft = frameOf(200, 200, (x) => (x < 20 ? 255 : 120));
    const stats = readFrameStats(windowOnTheLeft);

    expect((stats?.lumaSpread ?? 1) * 255).toBeLessThan(5);
  });

  it('still catches a shadow across the face itself', () => {
    const litFromTheRight = frameOf(200, 200, (x) => (x < 100 ? 60 : 200));
    const stats = readFrameStats(litFromTheRight);

    expect((stats?.lumaSpread ?? 0) * 255).toBeGreaterThan(100);
  });

  it('refuses a frame it cannot read rather than inventing numbers', () => {
    expect(readFrameStats({ isValid: false } as never)).toBeNull();
  });
});
