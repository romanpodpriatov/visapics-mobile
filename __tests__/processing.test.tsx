import { screen, waitFor } from '@testing-library/react-native';

import Processing from '../app/processing';
import { ApiError, api } from '../src/api/client';
import { useDraftStore } from '../src/store/draft';
import { renderScreen } from '../src/test-utils';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => ({ photo: 'file:///photo.jpg' }),
}));

/** The photo the screen was handed, as the filesystem reports it. */
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
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const running = {
  task_id: 'task-1',
  state: 'PROCESSING',
  progress: 70,
  status: 'Removing background',
};

const done = { ...running, state: 'SUCCESS', progress: 100, status: 'Complete' };

const ukPassport = {
  id: 1,
  document_type: 'UK Passport offline 35x45 mm',
  background_color: 'light_grey',
  dpi: 600,
  photo_width_mm: 35,
  photo_height_mm: 45,
  head_height_min_mm: 29,
  head_height_max_mm: 34,
  head_height_min_percent: null,
  head_height_max_percent: null,
  eyes_position_from_bottom_mm: null,
  eyes_position_max_from_bottom_mm: null,
  file_size_min_kb: null,
  file_size_max_kb: null,
};

const seeds: [string[], unknown][] = [[['specifications', 'gb'], [ukPassport]]];

const serve = (status: unknown) =>
  jest.spyOn(api, 'get').mockImplementation(((path: string) =>
    path.startsWith('/photo/status') ? Promise.resolve(status) : Promise.resolve({})) as never);

let upload: jest.SpyInstance;

describe('processing', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockBack.mockClear();
    mockFiles['file:///photo.jpg'] = { exists: true, size: 240_000 };
    upload = jest.spyOn(api, 'upload').mockResolvedValue({ task_id: 'task-1' } as never);
    useDraftStore.setState({
      countryCode: 'gb',
      documentType: 'UK Passport offline 35x45 mm',
      removeBackground: true,
      enhance: true,
      taskId: null,
      taskStartedAt: null,
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('sends the photo once, whatever the screen does after that', async () => {
    serve(running);
    const view = renderScreen(<Processing />, seeds);

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(upload.mock.calls[0][0]).toBe('/photo/process/async');
  });

  it('says what the server says it is doing', async () => {
    // A local guess at the steps makes a slow stage look stuck.
    serve(running);
    const view = renderScreen(<Processing />, seeds);

    expect(await view.findByText('REMOVING BACKGROUND')).toBeTruthy();
    expect(view.getByText('70%')).toBeTruthy();
  });

  it('promises a minute rather than the mock’s half one', async () => {
    // Measured on production: 66 seconds for a 1600×2133 photo with
    // enhancement on. The reference says 20–30.
    serve(running);
    const view = renderScreen(<Processing />, seeds);

    expect(await view.findByText(/about a minute/)).toBeTruthy();
    expect(view.queryByText(/20.30 seconds/)).toBeNull();
  });

  it('moves on once the task is done', async () => {
    serve(done);
    const view = renderScreen(<Processing />, seeds);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/result'));
  });

  it('leaves a way out when the upload itself fails', async () => {
    serve(running);
    upload.mockRejectedValue(new ApiError('File too large', 413, 'E413'));
    const view = renderScreen(<Processing />, seeds);

    expect(await view.findByText('File too large')).toBeTruthy();
    expect(view.getByText('Try a different photo')).toBeTruthy();
  });

  it('explains a photo the pipeline could not measure', async () => {
    jest.spyOn(api, 'get').mockRejectedValue(
      new ApiError('Photo processing failed', 400, 'E400_PROCESSING', {
        code: 'E400_PROCESSING',
        message: 'Photo processing failed',
        details:
          'Image resolution too low. Your image is 300x400 pixels, but we need at least 992x1275 pixels.',
      }),
    );
    useDraftStore.setState({ taskId: 'task-1' });
    const view = renderScreen(<Processing />, seeds);

    expect(await view.findByText('That photo is too small')).toBeTruthy();
  });
});

describe('a photo that is no longer there', () => {
  beforeEach(() => {
    mockFiles['file:///photo.jpg'] = { exists: false, size: null };
    useDraftStore.setState({
      countryCode: 'gb',
      documentType: 'UK Passport offline 35x45 mm',
      removeBackground: true,
      enhance: true,
      taskId: null,
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('says so, instead of blaming a server it never contacted', async () => {
    const sent = jest.spyOn(api, 'upload');
    renderScreen(<Processing />, seeds);

    expect(await screen.findByText('That photo could not be opened. Choose it again.')).toBeTruthy();
    expect(sent).not.toHaveBeenCalled();
  });
});

describe('the photo being processed', () => {
  beforeEach(() => {
    mockFiles['file:///photo.jpg'] = { exists: true, size: 240_000 };
    jest.spyOn(api, 'upload').mockResolvedValue({ task_id: 'task-1' } as never);
    useDraftStore.setState({
      countryCode: 'gb',
      documentType: 'UK Passport offline 35x45 mm',
      removeBackground: true,
      enhance: true,
      taskId: null,
    });
  });

  it('is shown whole, not cropped to fit the card', () => {
    // "cover" filled a fixed-height box by cutting the top and bottom off a
    // portrait photo — so the person watched a zoomed-in crop of their own
    // head while the pipeline worked on the whole thing.
    renderScreen(<Processing />, seeds);

    expect(screen.getByLabelText('Your photo').props.resizeMode).toBe('contain');
  });

  it('lists each stage once, in the order the server first reported it', async () => {
    // The server repeats a stage name after moving on and coming back, and the
    // list only skipped a repeat when it was the immediately previous one —
    // so "Detecting face" appeared twice with "Uploading photo" between.
    const reported = ['Detecting face', 'Uploading photo', 'Detecting face'];
    let poll = 0;
    jest.spyOn(api, 'get').mockImplementation(((path: string) => {
      if (!path.startsWith('/photo/status')) return Promise.resolve({});
      const status = reported[Math.min(poll, reported.length - 1)];
      poll += 1;
      return Promise.resolve({ ...running, status });
    }) as never);
    renderScreen(<Processing />, seeds);

    await waitFor(() => expect(screen.getAllByText('Detecting face').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getAllByText('Uploading photo').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Detecting face')).toHaveLength(1);
  });
});
