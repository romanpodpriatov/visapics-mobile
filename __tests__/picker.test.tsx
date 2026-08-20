import { fireEvent, screen } from '@testing-library/react-native';

import Picker from '../app/picker';
import { useDraftStore } from '../src/store/draft';
import { renderScreen } from '../src/test-utils';

const mockBack = jest.fn();
const mockParams: { country?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const countries = [
  { code: 'gb', name: 'United Kingdom', document_count: 19 },
  { code: 'us', name: 'United States', document_count: 23 },
  { code: 'jp', name: 'Japan', document_count: 16 },
];

const ukDocuments = [
  {
    id: 1,
    document_type: 'UK Passport offline 35x45 mm',
    background_color: 'light_grey',
    dpi: 600,
    photo_width_mm: 35,
    photo_height_mm: 45,
    head_height_min_mm: 29,
    head_height_max_mm: 34,
    head_height_min_percent: 0.64,
    head_height_max_percent: 0.75,
    eyes_position_from_bottom_mm: null,
    eyes_position_max_from_bottom_mm: null,
    file_size_min_kb: null,
    file_size_max_kb: null,
    official_source: ['https://www.gov.uk/photos-for-passports'],
  },
  {
    id: 2,
    document_type: 'UK ID / residence card 45x35 mm',
    background_color: 'white',
    dpi: 300,
    photo_width_mm: 45,
    photo_height_mm: 35,
    head_height_min_mm: null,
    head_height_max_mm: null,
    head_height_min_percent: 0.6,
    head_height_max_percent: 0.7,
    eyes_position_from_bottom_mm: null,
    eyes_position_max_from_bottom_mm: null,
    file_size_min_kb: null,
    file_size_max_kb: null,
    official_source: [],
  },
];

const seeds: [string[], unknown][] = [
  [['countries'], countries],
  [['specifications', 'gb'], ukDocuments],
];

describe('picker', () => {
  beforeEach(() => {
    mockBack.mockClear();
    delete mockParams.country;
    useDraftStore.setState({ countryCode: null, documentType: null });
  });

  it('lists the countries the catalogue reports', () => {
    renderScreen(<Picker />, seeds);

    expect(screen.getByText('United Kingdom')).toBeTruthy();
    expect(screen.getByText('19 document types')).toBeTruthy();
  });

  it('filters the countries as you type', () => {
    renderScreen(<Picker />, seeds);

    fireEvent.changeText(screen.getByPlaceholderText('Search 3 countries'), 'japa');

    expect(screen.getByText('Japan')).toBeTruthy();
    expect(screen.queryByText('United Kingdom')).toBeNull();
  });

  it('opens a country and lists its documents', () => {
    renderScreen(<Picker />, seeds);

    fireEvent.press(screen.getByText('United Kingdom'));

    expect(screen.getByText('UK Passport offline 35x45 mm')).toBeTruthy();
    expect(screen.getByText('35×45 mm · head 29–34 mm · light grey')).toBeTruthy();
  });

  it('derives a head height for a document that states only a percentage', () => {
    renderScreen(<Picker />, seeds);

    fireEvent.press(screen.getByText('United Kingdom'));

    expect(screen.getByText('45×35 mm · head 21–25 mm · white')).toBeTruthy();
  });

  it('opens straight at the documents when a country came in with the link', () => {
    mockParams.country = 'gb';
    renderScreen(<Picker />, seeds);

    expect(screen.getByText('UK Passport offline 35x45 mm')).toBeTruthy();
  });

  it('says where the specs come from without inventing a date', () => {
    // The reference reads "last checked 14 Jun 2026", which is a fact about a
    // government source that nobody here holds.
    renderScreen(<Picker />, seeds);
    fireEvent.press(screen.getByText('United Kingdom'));

    expect(screen.queryByText(/14 Jun 2026/)).toBeNull();
    expect(screen.getByText(/United Kingdom government source/)).toBeTruthy();
  });

  it('choosing a document records it and goes back', () => {
    renderScreen(<Picker />, seeds);

    fireEvent.press(screen.getByText('United Kingdom'));
    fireEvent.press(screen.getByText('UK Passport offline 35x45 mm'));

    expect(useDraftStore.getState().countryCode).toBe('gb');
    expect(useDraftStore.getState().documentType).toBe('UK Passport offline 35x45 mm');
    expect(mockBack).toHaveBeenCalled();
  });

  it('steps back from the documents to the countries, not out of the screen', () => {
    renderScreen(<Picker />, seeds);
    fireEvent.press(screen.getByText('United Kingdom'));

    fireEvent.press(screen.getByLabelText('Back'));

    expect(screen.getByText('United States')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('leaves the screen when back is pressed on the country step', () => {
    renderScreen(<Picker />, seeds);

    fireEvent.press(screen.getByLabelText('Back'));

    expect(mockBack).toHaveBeenCalled();
  });
});
