import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import Result from '../app/result';
import { ApiError, api } from '../src/api/client';
import { saveToFiles, saveToPhotos } from '../src/photo/download';
import { useDraftStore } from '../src/store/draft';
import { configFixture, renderScreen } from '../src/test-utils';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}));

jest.mock('../src/photo/download', () => ({
  saveToPhotos: jest.fn(async () => 'saved'),
  saveToFiles: jest.fn(async () => undefined),
  downloadToCache: jest.fn(async () => 'file:///cache/photo.jpg'),
}));

jest.mock('../src/iap', () => ({
  ...jest.requireActual('../src/iap/products'),
  purchase: jest.fn(),
  fetchIapProducts: jest.fn(async () => []),
  restorePurchases: jest.fn(async () => ({ restored: 0 })),
  initIAP: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

/**
 * A real response from production, for a UK passport photo run through
 * /api/v1/photo/process/async as a guest. Two of the five checks come back
 * not_applicable, so the server counts three.
 */
const PRODUCTION_STATUS = {
  task_id: '3b61cefa-4e78-4a18-b447-5742e054e6f5',
  state: 'SUCCESS',
  progress: 100,
  status: 'Complete',
  mode: 'preview',
  unlock_required: true,
  specification: { country_code: 'gb', document_type: 'UK Passport offline 35x45 mm' },
  preview_url: '/previews/preview_processed_12083e1f.jpg',
  printable_preview_url: '/previews/preview_printable_12083e1f.jpg',
  compliance: {
    overall_success: true,
    photo_size: 'Width: 35mm, Height: 45mm',
    warnings: [],
    passed: 3,
    total: 3,
    checks: [
      {
        key: 'head_height',
        label: 'Head height',
        measured: 31.496,
        measured_display: '31.5 mm',
        requirement_display: '29–34 mm',
        verdict: 'pass',
      },
      {
        key: 'eye_line',
        label: 'Eye line from bottom',
        measured: 24.3,
        measured_display: '24.3 mm',
        requirement_display: 'not specified',
        verdict: 'not_applicable',
      },
      {
        key: 'background',
        label: 'Background colour',
        measured: 'Light Grey',
        measured_display: 'Light Grey',
        requirement_display: 'Light Grey',
        verdict: 'pass',
      },
      {
        key: 'resolution',
        label: 'Resolution',
        measured: [827, 1063],
        measured_display: '827×1063 px',
        requirement_display: '827×1063 px',
        verdict: 'pass',
      },
      {
        key: 'file_size',
        label: 'File size',
        measured: 125.07,
        measured_display: '125 KB',
        requirement_display: 'not specified',
        verdict: 'not_applicable',
      },
    ],
  },
};

const failingStatus = () => ({
  ...PRODUCTION_STATUS,
  compliance: {
    ...PRODUCTION_STATUS.compliance,
    overall_success: false,
    passed: 2,
    total: 3,
    checks: PRODUCTION_STATUS.compliance.checks.map((check) =>
      check.key === 'head_height'
        ? { ...check, measured_display: '26.4 mm', verdict: 'fail' }
        : check,
    ),
  },
});

const serve = (status: unknown) =>
  jest.spyOn(api, 'get').mockImplementation(((path: string) =>
    path.startsWith('/photo/status') ? Promise.resolve(status) : Promise.resolve({})) as never);

const seeds: [string[], unknown][] = [[['config'], configFixture]];

describe('result', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    useDraftStore.setState({
      countryCode: 'gb',
      documentType: 'UK Passport offline 35x45 mm',
      taskId: 'task-1',
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('counts the checks the server counted, not a number of its own', async () => {
    // The reference says "Passed all 14 official checks". The server said 3.
    serve(PRODUCTION_STATUS);
    renderScreen(<Result />, seeds);

    expect(await screen.findByText('Passed all 3 checks.')).toBeTruthy();
    expect(screen.queryByText(/14/)).toBeNull();
  });

  it('hides a check the document does not state', async () => {
    // Not applicable is not the same as passed: there was nothing to satisfy.
    serve(PRODUCTION_STATUS);
    renderScreen(<Result />, seeds);

    expect(await screen.findByText('Head height')).toBeTruthy();
    expect(screen.queryByText('File size')).toBeNull();
    expect(screen.queryByText('Eye line from bottom')).toBeNull();
  });

  it('shows every check that did apply, with no "show more"', async () => {
    serve(PRODUCTION_STATUS);
    renderScreen(<Result />, seeds);

    expect(await screen.findByText('Head height')).toBeTruthy();
    expect(screen.getByText('Background colour')).toBeTruthy();
    expect(screen.getByText('Resolution')).toBeTruthy();
    expect(screen.queryByText(/more checks/i)).toBeNull();
  });

  it('puts no price on the unlock card', async () => {
    // The price comes from StoreKit, localized, in Task 9. A hardcoded $3.99
    // would be wrong in every other currency.
    serve(PRODUCTION_STATUS);
    renderScreen(<Result />, seeds);

    expect(await screen.findByText('Unlock this photo')).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('carries the disclaimer the server sends', async () => {
    serve(PRODUCTION_STATUS);
    renderScreen(<Result />, seeds);
    expect(await screen.findByText(configFixture.legal.disclaimer)).toBeTruthy();
  });

  it('says nothing was charged when the photo did not pass', async () => {
    serve(failingStatus());
    renderScreen(<Result />, seeds);

    expect(await screen.findByText('One rule needs fixing.')).toBeTruthy();
    expect(screen.getByText('◆ Nothing was charged')).toBeTruthy();
    expect(screen.queryByText('Unlock this photo')).toBeNull();
  });

  it('shows the measurement against the tolerance on a failing check', async () => {
    serve(failingStatus());
    renderScreen(<Result />, seeds);

    expect(await screen.findByText('26.4 mm / 29–34 mm')).toBeTruthy();
  });

  const unlockGrants = () =>
    jest.spyOn(api, 'post').mockResolvedValue({
      task_id: 'task-1',
      unlocked: true,
      credits_remaining: 2,
      digital_photo_url: '/api/v1/photo/download/tok',
      expires_in: 900,
    } as never);

  it('unlocks with a credit and offers to save', async () => {
    serve(PRODUCTION_STATUS);
    unlockGrants();
    renderScreen(<Result />, seeds);

    fireEvent.press(await screen.findByText('Unlock & download'));

    expect(await screen.findByText('Save to Photos')).toBeTruthy();
    expect(screen.getByText('Save to Files')).toBeTruthy();
    expect(screen.getByText(/links stay valid for 15 minutes/)).toBeTruthy();
  });

  it('saves the unlocked photo, by its absolute URL', async () => {
    serve(PRODUCTION_STATUS);
    unlockGrants();
    renderScreen(<Result />, seeds);

    fireEvent.press(await screen.findByText('Unlock & download'));
    fireEvent.press(await screen.findByText('Save to Photos'));

    await waitFor(() =>
      expect(saveToPhotos).toHaveBeenCalledWith(
        'https://visapics.org/api/v1/photo/download/tok',
      ),
    );
    expect(await screen.findByText('Saved to your photo library.')).toBeTruthy();
  });

  it('offers Files when the photo library was refused', async () => {
    serve(PRODUCTION_STATUS);
    unlockGrants();
    jest.mocked(saveToPhotos).mockResolvedValue('denied');
    renderScreen(<Result />, seeds);

    fireEvent.press(await screen.findByText('Unlock & download'));
    fireEvent.press(await screen.findByText('Save to Photos'));

    expect(await screen.findByText(/Save to Files instead/)).toBeTruthy();
    expect(saveToFiles).not.toHaveBeenCalled();
  });

  it('says plainly when the photo has been deleted rather than showing an error', async () => {
    // 410 is not a fault: processed files go after the retention window.
    serve(PRODUCTION_STATUS);
    jest
      .spyOn(api, 'post')
      .mockRejectedValue(new ApiError('Processed file is no longer available', 410, 'E410_EXPIRED'));
    renderScreen(<Result />, seeds);

    fireEvent.press(await screen.findByText('Unlock & download'));

    expect(await screen.findByText('◆ This photo has expired')).toBeTruthy();
    expect(screen.getByText('Take a new photo')).toBeTruthy();
  });

  it('opens the paywall when there are no credits left', async () => {
    // The 402 is the only thing that opens it: nobody is asked to pay until
    // there is something to pay for.
    serve(PRODUCTION_STATUS);
    jest
      .spyOn(api, 'post')
      .mockRejectedValue(new ApiError('No photo credits available', 402, 'E402_NO_CREDITS'));
    renderScreen(<Result />, seeds);

    fireEvent.press(await screen.findByText('Unlock & download'));

    expect(await screen.findByText('Pay once. Retake free.')).toBeTruthy();
  });

  it('does not open the paywall before anything has been refused', async () => {
    serve(PRODUCTION_STATUS);
    renderScreen(<Result />, seeds);

    expect(await screen.findByText('Unlock this photo')).toBeTruthy();
    expect(screen.queryByText('Pay once. Retake free.')).toBeNull();
  });
});
