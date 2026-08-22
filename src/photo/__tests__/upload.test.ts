import { ApiError, api } from '../../api/client';
import {
  POLL_DEADLINE_MS,
  POLL_INTERVAL_MS,
  nextPoll,
  processingParts,
  PhotoUnreadableError,
  startProcessing,
  uploadErrorMessage,
} from '../upload';

/** What the fake filesystem reports for each uri. */
const mockFiles: Record<string, { exists: boolean; size: number | null }> = {};
jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get exists() {
      return mockFiles[this.uri]?.exists ?? false;
    }
    get size() {
      return mockFiles[this.uri]?.size ?? null;
    }
    get name() {
      return this.uri.split('/').pop() ?? '';
    }
    get type() {
      return 'image/jpeg';
    }
    async bytes() {
      return new Uint8Array(mockFiles[this.uri]?.size ?? 0);
    }
  },
}));

describe('startProcessing', () => {
  beforeEach(() => {
    mockFiles['file:///photo.jpg'] = { exists: true, size: 120_000 };
  });
  afterEach(() => jest.restoreAllMocks());

  const send = () => {
    const upload = jest
      .spyOn(api, 'upload')
      .mockResolvedValue({ task_id: 'task-9', mode: 'preview' } as never);
    return upload;
  };

  it('returns the task the server started', async () => {
    send();
    await expect(
      startProcessing('file:///photo.jpg', {
        countryCode: 'gb',
        documentType: 'UK Passport 35x45 mm',
        removeBackground: true,
        enhance: true,
      }),
    ).resolves.toBe('task-9');
  });

  it('posts to the asynchronous endpoint', async () => {
    const upload = send();

    await startProcessing('file:///photo.jpg', {
      countryCode: 'gb',
      documentType: 'UK Passport 35x45 mm',
      removeBackground: true,
      enhance: false,
    });

    expect(upload.mock.calls[0][0]).toBe('/photo/process/async');
  });

  it('sends the photo, the document and both options', () => {
    const sent = Object.fromEntries(
      processingParts('file:///photo.jpg', {
        countryCode: 'gb',
        documentType: 'UK Passport 35x45 mm',
        removeBackground: true,
        enhance: false,
      }),
    );

    expect(sent.country_code).toBe('gb');
    expect(sent.document_type).toBe('UK Passport 35x45 mm');
    expect(sent.remove_background).toBe('true');
    expect(sent.enhance_photo).toBe('false');
    expect(sent.photo).toMatchObject({ uri: 'file:///photo.jpg', type: 'image/jpeg' });
  });

  it('does not ask for a mode', () => {
    // The server pins JWT callers to preview. Asking for anything else is at
    // best ignored and at worst reads like an attempt to skip the paywall.
    const sent = Object.fromEntries(
      processingParts('file:///photo.jpg', {
        countryCode: 'gb',
        documentType: 'UK Passport 35x45 mm',
        removeBackground: true,
        enhance: true,
      }),
    );
    expect(sent.mode).toBeUndefined();
  });
});

describe('nextPoll', () => {
  it('keeps asking while the task is still running', () => {
    expect(nextPoll('PENDING', 3_000)).toBe(POLL_INTERVAL_MS);
    expect(nextPoll('PROCESSING', 30_000)).toBe(POLL_INTERVAL_MS);
  });

  it('stops the moment the task is done', () => {
    expect(nextPoll('SUCCESS', 3_000)).toBe(false);
  });

  it('gives up after three minutes rather than polling forever', () => {
    // A loop with no ceiling drains the battery of anyone who backgrounds the
    // app at the wrong moment.
    expect(nextPoll('PROCESSING', POLL_DEADLINE_MS)).toBe(false);
    expect(nextPoll('PROCESSING', POLL_DEADLINE_MS - 1)).toBe(POLL_INTERVAL_MS);
  });
});

describe('a photo the phone cannot read', () => {
  beforeEach(() => jest.restoreAllMocks());

  const upload = () =>
    startProcessing('file:///gone.jpg', {
      countryCode: 'gb',
      documentType: 'UK Passport 35x45 mm',
      removeBackground: true,
      enhance: true,
    });

  it('is refused before the request is built, not after it fails', async () => {
    // Production saw this: the device registered, read its credits and its
    // catalogue, then the upload never reached the server at all. React
    // Native cannot report why a multipart body failed to build — it rejects
    // with a bare network error — so the file is checked while there is still
    // something useful to say about it.
    mockFiles['file:///gone.jpg'] = { exists: false, size: null };
    const sent = jest.spyOn(api, 'upload');

    await expect(upload()).rejects.toThrow(PhotoUnreadableError);
    expect(sent).not.toHaveBeenCalled();
  });

  it('is refused when the file is there but empty', async () => {
    mockFiles['file:///gone.jpg'] = { exists: true, size: 0 };
    const sent = jest.spyOn(api, 'upload');

    await expect(upload()).rejects.toThrow(PhotoUnreadableError);
    expect(sent).not.toHaveBeenCalled();
  });

  it('says which photo it could not read, so the report is diagnosable', async () => {
    mockFiles['file:///gone.jpg'] = { exists: false, size: null };
    await expect(upload()).rejects.toThrow(/gone\.jpg/);
  });
});

describe('uploadErrorMessage', () => {
  it('repeats what the server said, when the server said anything', () => {
    expect(uploadErrorMessage(new ApiError('Image resolution too low', 400, 'E400'))).toBe(
      'Image resolution too low',
    );
  });

  it('blames the photo, not the server, when the file could not be read', () => {
    const message = uploadErrorMessage(new PhotoUnreadableError('file:///gone.jpg'));

    expect(message).toMatch(/photo/i);
    expect(message).not.toMatch(/server/i);
  });

  it('carries the underlying failure rather than guessing at one', () => {
    // "Could not reach the server" was wrong and undiagnosable: the request
    // never left the phone, so the server had nothing to do with it.
    expect(uploadErrorMessage(new Error('Network request failed'))).toMatch(
      /Network request failed/,
    );
  });

  it('still says something when the failure carries no message', () => {
    expect(uploadErrorMessage(undefined)).toBeTruthy();
  });
});

describe('the multipart part itself', () => {
  beforeEach(() => {
    mockFiles['file:///photo.jpg'] = { exists: true, size: 120_000 };
  });

  it('is something Expo\'s fetch can encode', () => {
    // This is the bug the device found. Expo's fetch builds the multipart
    // body in JavaScript and accepts a string, a Blob, or an object with
    // bytes(). React Native's {uri, name, type} part is none of those: its
    // converter throws "Unsupported FormDataPart implementation", so the
    // request never left the phone — which is exactly what production's
    // access log showed.
    const sent = Object.fromEntries(
      processingParts('file:///photo.jpg', {
        countryCode: 'gb',
        documentType: 'UK Passport 35x45 mm',
        removeBackground: true,
        enhance: false,
      }),
    );
    const photo = sent.photo as { bytes?: unknown; name?: unknown; type?: unknown };

    expect(typeof photo.bytes).toBe('function');
    // The server keeps the upload only if the part is named.
    expect(photo.name).toBeTruthy();
    expect(photo.type).toBe('image/jpeg');
  });
});
