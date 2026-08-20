import {
  MAX_UPLOAD_BYTES,
  MIN_LONG_EDGE,
  failureFromServer,
  prepareForUpload,
  validatePhoto,
} from '../validate';

/** Sizes the fake filesystem reports, keyed by uri. */
const mockSizes: Record<string, number> = {};
jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get size() {
      return mockSizes[this.uri] ?? null;
    }
  },
}));

const mockSave = jest.fn();
const mockResize = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize: (size: { width?: number; height?: number }) => mockResize(size),
      renderAsync: async () => ({
        saveAsync: (options: { compress?: number }) => mockSave(options),
      }),
    }),
  },
}));

const jpeg = (over: Partial<Parameters<typeof validatePhoto>[0]> = {}) => ({
  uri: 'file:///photo.jpg',
  fileName: 'photo.jpg',
  mimeType: 'image/jpeg',
  fileSize: 1_200_000,
  width: 3000,
  height: 4000,
  ...over,
});

beforeEach(() => {
  Object.keys(mockSizes).forEach((k) => delete mockSizes[k]);
  mockSave.mockReset();
  mockResize.mockReset();
});

describe('validatePhoto', () => {
  it('passes a normal JPEG through untouched', async () => {
    await expect(validatePhoto(jpeg())).resolves.toEqual({ ok: true, uri: 'file:///photo.jpg' });
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('reports a file over the limit, with the size it actually is', async () => {
    const result = await validatePhoto(jpeg({ fileSize: 8_400_000 }));
    expect(result).toEqual({ ok: false, kind: 'too_large', bytes: 8_400_000 });
  });

  it('converts a HEIC even when it is small, because the server cannot read one', async () => {
    mockSave.mockResolvedValue({ uri: 'file:///converted.jpg', width: 3000, height: 4000 });

    const result = await validatePhoto(
      jpeg({ uri: 'file:///IMG_0912.HEIC', fileName: 'IMG_0912.HEIC', mimeType: 'image/heic' }),
    );

    expect(result).toEqual({ ok: true, uri: 'file:///converted.jpg' });
  });

  it('measures the file on disk when the picker does not say how big it is', async () => {
    mockSizes['file:///photo.jpg'] = 9_000_000;
    const result = await validatePhoto(jpeg({ fileSize: null }));
    expect(result).toEqual({ ok: false, kind: 'too_large', bytes: 9_000_000 });
  });
});

describe('prepareForUpload', () => {
  it('compresses an oversized photo under the limit', async () => {
    mockSizes['file:///small.jpg'] = 3_000_000;
    mockSave.mockResolvedValue({ uri: 'file:///small.jpg', width: 2400, height: 3200 });

    const result = await prepareForUpload(jpeg({ fileSize: 8_400_000 }));

    expect(result).toEqual({ ok: true, uri: 'file:///small.jpg' });
  });

  it('keeps the long edge big enough for a head to be measured', async () => {
    // The server measures head height in pixels; a thumbnail cannot be graded.
    mockSizes['file:///small.jpg'] = 3_000_000;
    mockSave.mockResolvedValue({ uri: 'file:///small.jpg', width: 2400, height: 3200 });

    await prepareForUpload(jpeg({ fileSize: 8_400_000, width: 6000, height: 8000 }));

    const resized = mockResize.mock.calls[0]?.[0] as { width?: number; height?: number };
    expect(Math.max(resized.width ?? 0, resized.height ?? 0)).toBeGreaterThanOrEqual(MIN_LONG_EDGE);
  });

  it('tries harder before it gives up', async () => {
    mockSizes['file:///still-big.jpg'] = MAX_UPLOAD_BYTES + 1;
    mockSave.mockResolvedValue({ uri: 'file:///still-big.jpg', width: 2400, height: 3200 });

    const result = await prepareForUpload(jpeg({ fileSize: 20_000_000 }));

    expect(result).toEqual({ ok: false, kind: 'too_large', bytes: MAX_UPLOAD_BYTES + 1 });
    expect(mockSave.mock.calls.length).toBeGreaterThan(1);
  });

  it('turns down the quality with each attempt', async () => {
    mockSizes['file:///still-big.jpg'] = MAX_UPLOAD_BYTES + 1;
    mockSave.mockResolvedValue({ uri: 'file:///still-big.jpg', width: 2400, height: 3200 });

    await prepareForUpload(jpeg({ fileSize: 20_000_000 }));

    const qualities = mockSave.mock.calls.map((call) => (call[0] as { compress: number }).compress);
    expect(qualities).toEqual([...qualities].sort((a, b) => b - a));
    expect(qualities[0]).toBeGreaterThan(qualities[qualities.length - 1]);
  });
});

describe('failureFromServer', () => {
  it('recognises the two failures worth their own sheet', () => {
    expect(failureFromServer('No face detected in the photo')).toBe('no_face');
    expect(failureFromServer('Multiple faces detected in the photo')).toBe('multi_face');
  });

  it('recognises a photo the pipeline is too small to measure', () => {
    // Production, against a 300×400 photo: "Image resolution too low. Your
    // image is 300x400 pixels, but we need at least 992x1275 pixels".
    expect(
      failureFromServer(
        'Image resolution too low. Your image is 300x400 pixels, but we need at least 992x1275 pixels.',
      ),
    ).toBe('too_small');
  });

  it('leaves anything else to the general error path', () => {
    expect(failureFromServer('Processing timed out')).toBeNull();
    expect(failureFromServer('')).toBeNull();
  });
});
