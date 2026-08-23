import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import Photos from '../app/(tabs)/photos';
import { pickFromLibrary, sampleAsset } from '../src/photo/library';
import { prepareForUpload, validatePhoto } from '../src/photo/validate';
import { useDraftStore } from '../src/store/draft';
import { configFixture, renderScreen } from '../src/test-utils';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock('../src/photo/library', () => ({
  pickFromLibrary: jest.fn(),
  sampleAsset: jest.fn(),
}));

jest.mock('../src/photo/validate', () => ({
  validatePhoto: jest.fn(),
  prepareForUpload: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const ukPassport = {
  id: 1,
  document_type: 'UK Passport 35x45 mm',
  background_color: 'white',
  dpi: 300,
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

const HOUR = 60 * 60 * 1000;

const seeds = (extra: [string[], unknown][] = []): [string[], unknown][] => [
  [['config'], configFixture],
  [['specifications', 'gb'], [ukPassport]],
  ...extra,
];

const chooseUkPassport = () =>
  useDraftStore.setState({ countryCode: 'gb', documentType: 'UK Passport 35x45 mm' });

describe('home', () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.mocked(pickFromLibrary).mockReset();
    jest.mocked(sampleAsset).mockReset();
    jest.mocked(validatePhoto).mockReset();
    jest.mocked(prepareForUpload).mockReset();
    useDraftStore.setState({
      countryCode: null,
      documentType: null,
      removeBackground: true,
      enhance: true,
      taskId: null,
      taskStartedAt: null,
    });
  });

  it('reports the coverage the server reports', () => {
    renderScreen(<Photos />, seeds());

    expect(screen.getByText('164 countries')).toBeTruthy();
    expect(screen.getByText('951 types')).toBeTruthy();
    expect(screen.getByText('951 of 951 specs verified · 100%')).toBeTruthy();
  });

  it('carries none of the figures the design reference invented', () => {
    // "18,402 photos this week", "4.9 / 5" and "954 specs" are inventions, and
    // a fabricated statistic in a shipped binary is a 2.3.1 rejection that
    // cannot be corrected without a resubmission.
    renderScreen(<Photos />, seeds());

    expect(screen.queryByText(/18,402/)).toBeNull();
    expect(screen.queryByText(/4\.9/)).toBeNull();
    expect(screen.queryByText(/954/)).toBeNull();
    expect(screen.queryByText(/14 checks/)).toBeNull();
    expect(screen.queryByText(/14 RULES/i)).toBeNull();
  });

  it('says Guest until there is a balance', () => {
    renderScreen(<Photos />, seeds());
    expect(screen.getByText('Guest')).toBeTruthy();
  });

  it('shows the balance the server reports', () => {
    renderScreen(<Photos />, seeds([[['credits'], { credits_remaining: 3, grants: [] }]]));
    expect(screen.getByText('3 credits')).toBeTruthy();
  });

  it('asks for a document when none has been chosen', () => {
    renderScreen(<Photos />, seeds());
    expect(screen.getByText('Choose a document')).toBeTruthy();
  });

  it('shows the chosen document and the size it has to be', () => {
    chooseUkPassport();
    renderScreen(<Photos />, seeds());

    expect(screen.getByText('UK Passport 35x45 mm')).toBeTruthy();
    expect(screen.getByText('35×45 mm · white')).toBeTruthy();
  });

  it('opens the picker from the document row', () => {
    renderScreen(<Photos />, seeds());

    fireEvent.press(screen.getByText('Choose a document'));

    expect(mockPush).toHaveBeenCalledWith('/picker');
  });

  it('remembers a processing option that was switched off', () => {
    renderScreen(<Photos />, seeds());

    fireEvent.press(screen.getByLabelText('AI quality enhance'));

    expect(useDraftStore.getState().enhance).toBe(false);
    expect(useDraftStore.getState().removeBackground).toBe(true);
  });

  it('shows nothing to continue when no photo is in progress', () => {
    renderScreen(<Photos />, seeds());
    expect(screen.queryByText(/Deletes in/)).toBeNull();
  });

  it('counts the draft down using the retention the server reports', () => {
    chooseUkPassport();
    useDraftStore.setState({ taskId: 'task-1', taskStartedAt: Date.now() - 2 * HOUR });

    renderScreen(<Photos />, seeds());

    // 168 hours of retention, two of them spent.
    expect(screen.getByText('Deletes in 6 days')).toBeTruthy();
  });

  it('drops the draft once the server would have deleted the file', () => {
    chooseUkPassport();
    useDraftStore.setState({ taskId: 'task-1', taskStartedAt: Date.now() - 200 * HOUR });

    renderScreen(<Photos />, seeds());

    expect(screen.queryByText(/Deletes in/)).toBeNull();
  });

  it('asks for a document before it asks for a photo', () => {
    // Coaching cannot coach without a specification, and the server cannot
    // process without one either.
    renderScreen(<Photos />, seeds());

    fireEvent.press(screen.getByText('Take photo with coaching'));

    expect(mockPush).toHaveBeenCalledWith('/picker');
  });

  it('goes to the camera once a document is chosen', () => {
    chooseUkPassport();
    renderScreen(<Photos />, seeds());

    fireEvent.press(screen.getByText('Take photo with coaching'));

    expect(mockPush).toHaveBeenCalledWith('/permission');
  });

  it('sends a photo from the library on to be processed', async () => {
    chooseUkPassport();
    jest.mocked(pickFromLibrary).mockResolvedValue({
      status: 'picked',
      asset: { uri: 'file:///holiday.jpg' },
    });
    jest.mocked(validatePhoto).mockResolvedValue({ ok: true, uri: 'file:///holiday.jpg' });
    renderScreen(<Photos />, seeds());

    fireEvent.press(screen.getByText('Use a photo from library'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/processing',
        params: { photo: 'file:///holiday.jpg' },
      }),
    );
  });

  it('offers to convert a photo the server would refuse', async () => {
    chooseUkPassport();
    jest.mocked(pickFromLibrary).mockResolvedValue({
      status: 'picked',
      asset: { uri: 'file:///huge.heic' },
    });
    jest.mocked(validatePhoto).mockResolvedValue({
      ok: false,
      kind: 'too_large',
      bytes: 8_400_000,
    });
    renderScreen(<Photos />, seeds());

    fireEvent.press(screen.getByText('Use a photo from library'));

    expect(await screen.findByText('That file is 8.4 MB')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/processing' }),
    );
  });

  it('explains itself when the system will not share the library', async () => {
    chooseUkPassport();
    jest.mocked(pickFromLibrary).mockResolvedValue({ status: 'denied' });
    renderScreen(<Photos />, seeds());

    fireEvent.press(screen.getByText('Use a photo from library'));

    expect(await screen.findByText('We cannot see your library')).toBeTruthy();
  });

  it('runs the bundled specimen through the same path', async () => {
    // The control an App Review tester uses to see the whole product without
    // photographing themselves; a demo branch would defeat the point.
    chooseUkPassport();
    jest.mocked(sampleAsset).mockResolvedValue({ uri: 'file:///specimen.jpg' });
    jest.mocked(validatePhoto).mockResolvedValue({ ok: true, uri: 'file:///specimen.jpg' });
    renderScreen(<Photos />, seeds());

    fireEvent.press(screen.getByText('Try it with a sample photo'));

    await waitFor(() => expect(validatePhoto).toHaveBeenCalled());
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/processing',
      params: { photo: 'file:///specimen.jpg' },
    });
  });
});

describe('the continue card', () => {
  it('shows the photo it is offering to continue with', () => {
    // It carried an empty grey box: the thumbnail was never wired up, so the
    // card offered to continue with a picture it would not show.
    useDraftStore.setState({
      countryCode: 'gb',
      documentType: 'UK Passport 35x45 mm',
      taskId: 'task-1',
      taskStartedAt: Date.now(),
    });

    renderScreen(
      <Photos />,
      seeds([
        [
          ['photo-status', 'task-1'],
          { task_id: 'task-1', state: 'SUCCESS', preview_url: '/previews/p.jpg' },
        ],
      ]),
    );

    expect(screen.getByLabelText('Your photo').props.source.uri).toBe(
      'https://visapics.org/previews/p.jpg',
    );
  });
});

describe('the continue card while the pipeline is still working', () => {
  it('says it is processing and goes back to the progress, not to a result', () => {
    // The card appears the moment a task exists, so tapping it during the
    // minute the work takes landed on a result screen with no result.
    useDraftStore.setState({
      countryCode: 'gb',
      documentType: 'UK Passport 35x45 mm',
      taskId: 'task-1',
      taskStartedAt: Date.now(),
    });

    renderScreen(
      <Photos />,
      seeds([[['photo-status', 'task-1'], { task_id: 'task-1', state: 'PROCESSING' }]]),
    );

    fireEvent.press(screen.getByText('Processing your photo'));

    expect(mockPush).toHaveBeenCalledWith('/processing');
  });
});
