import { api } from '../../api/client';
import {
  POLL_DEADLINE_MS,
  POLL_INTERVAL_MS,
  nextPoll,
  processingParts,
  startProcessing,
} from '../upload';

describe('startProcessing', () => {
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
