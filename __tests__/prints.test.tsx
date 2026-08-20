import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import Prints from '../app/(tabs)/prints';
import { api } from '../src/api/client';
import { saveToPhotos } from '../src/photo/download';
import { useDraftStore } from '../src/store/draft';
import { renderScreen } from '../src/test-utils';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('../src/photo/download', () => ({
  saveToPhotos: jest.fn(async () => 'saved'),
  saveToFiles: jest.fn(async () => undefined),
  downloadToCache: jest.fn(async () => 'file:///cache/sheet.jpg'),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const STATUS = {
  task_id: 'task-1',
  state: 'SUCCESS',
  progress: 100,
  status: 'Complete',
  mode: 'preview',
  unlock_required: true,
  specification: { country_code: 'gb', document_type: 'UK Passport 35x45 mm' },
  preview_url: '/previews/p.jpg',
  printable_preview_url: '/previews/sheet.jpg',
  compliance: { overall_success: true, photo_size: '', warnings: [], passed: 3, total: 3, checks: [] },
};

const serve = () =>
  jest.spyOn(api, 'get').mockImplementation(((path: string) =>
    path.startsWith('/photo/status') ? Promise.resolve(STATUS) : Promise.resolve([])) as never);

describe('prints', () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.mocked(saveToPhotos).mockClear().mockResolvedValue('saved');
    useDraftStore.setState({
      countryCode: 'gb',
      documentType: 'UK Passport 35x45 mm',
      taskId: 'task-1',
      unlockedAt: null,
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('sends you to pay rather than handing over a paid sheet', async () => {
    serve();
    renderScreen(<Prints />);

    expect(await screen.findByText('◆ Unlock first')).toBeTruthy();
    expect(screen.queryByText('Save sheet to Photos')).toBeNull();

    fireEvent.press(screen.getByText('Go to my photo'));
    expect(mockPush).toHaveBeenCalledWith('/result');
  });

  it('describes the sheet the pipeline really makes', async () => {
    // Four photos with cut lines on a 4×6 inch canvas. The reference says
    // "A4 · 4 UP", which this has never produced.
    serve();
    renderScreen(<Prints />);

    expect(await screen.findByText(/4 photos · cut lines/)).toBeTruthy();
    expect(screen.queryByText(/A4/)).toBeNull();
  });

  it('saves the sheet once the photo has been paid for', async () => {
    serve();
    jest.spyOn(api, 'post').mockResolvedValue({
      task_id: 'task-1',
      unlocked: true,
      credits_remaining: 1,
      digital_photo_url: '/api/v1/photo/download/dig',
      printable_photo_url: '/api/v1/photo/download/sheet',
      expires_in: 900,
    } as never);
    useDraftStore.setState({ unlockedAt: Date.now() });
    renderScreen(<Prints />);

    fireEvent.press(await screen.findByText('Save sheet to Photos'));

    // Unlocking again is free and idempotent; it is what issues a fresh token.
    await waitFor(() =>
      expect(saveToPhotos).toHaveBeenCalledWith(
        'https://visapics.org/api/v1/photo/download/sheet',
      ),
    );
  });

  it('says what to do first when there is no photo at all', () => {
    useDraftStore.setState({ taskId: null });
    renderScreen(<Prints />);

    expect(screen.getByText(/Make a photo first/)).toBeTruthy();
  });
});
