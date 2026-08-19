import { fireEvent, screen } from '@testing-library/react-native';

import Photos from '../app/(tabs)/photos';
import { useDraftStore } from '../src/store/draft';
import { configFixture, renderScreen } from '../src/test-utils';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
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
});
