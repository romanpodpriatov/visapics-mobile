import { fireEvent, screen } from '@testing-library/react-native';

import Requirements from '../app/requirements';
import { useDraftStore } from '../src/store/draft';
import { configFixture, renderScreen } from '../src/test-utils';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const DOC = 'UK Passport offline 35x45 mm';

const specification = {
  id: 1,
  country_code: 'gb',
  country_name: 'United Kingdom',
  document_type: DOC,
  dimensions: { width_mm: 35, height_mm: 45, dpi: 600 },
  requirements: {
    background_color: 'light_grey',
    head_height_min_percent: 0.64,
    head_height_max_percent: 0.75,
    head_height_min_mm: 29,
    head_height_max_mm: 34,
    eyes_position_from_bottom_mm: null,
    eyes_position_max_from_bottom_mm: null,
    file_size_min_kb: null,
    file_size_max_kb: null,
    neutral_expression_required: true,
    glasses_allowed: 'no',
  },
  official_source: ['https://www.gov.uk/photos-for-passports'],
  spec_updated_at: '2025-07-07T03:36:24.318790',
  is_reviewed: true,
  notes: null,
};

const seeds: [string[], unknown][] = [
  [['config'], configFixture],
  [['specification', 'gb', DOC], specification],
];

describe('requirements', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
    useDraftStore.setState({ countryCode: 'gb', documentType: DOC });
  });

  it('shows the document and what it measures to', () => {
    renderScreen(<Requirements />, seeds);

    expect(screen.getByText(DOC)).toBeTruthy();
    expect(screen.getByText('35×45 mm')).toBeTruthy();
    expect(screen.getByText('29–34 mm')).toBeTruthy();
    expect(screen.getByText('600 dpi')).toBeTruthy();
  });

  it('names the source and when the row last changed', () => {
    // The reference reads "verified 14 Jun 2026" — a claim about checking a
    // government source. What we hold is when the row last changed.
    renderScreen(<Requirements />, seeds);

    expect(screen.queryByText(/verified 14 Jun 2026/)).toBeNull();
    expect(screen.getByText(/United Kingdom government spec · last updated 7 Jul 2025/)).toBeTruthy();
  });

  it('states only the rules this document carries', () => {
    renderScreen(<Requirements />, seeds);

    expect(screen.getByText('Glasses')).toBeTruthy();
    expect(screen.getByText('Expression')).toBeTruthy();
    expect(screen.queryByText('Head covering')).toBeNull();
    expect(screen.queryByText('Children under 6')).toBeNull();
  });

  it('carries the disclaimer the server sends, word for word', () => {
    renderScreen(<Requirements />, seeds);
    expect(screen.getByText(configFixture.legal.disclaimer)).toBeTruthy();
  });

  it('starts the capture for this document', () => {
    renderScreen(<Requirements />, seeds);

    fireEvent.press(screen.getByText('Take a photo for this spec'));

    expect(mockPush).toHaveBeenCalledWith('/permission');
  });

  it('renders no empty measurement while the spec is still loading', () => {
    renderScreen(<Requirements />, [[['config'], configFixture]]);

    expect(screen.queryByText(/undefined|NaN/)).toBeNull();
  });

  it('asks for a document when none has been chosen', () => {
    useDraftStore.setState({ countryCode: null, documentType: null });
    renderScreen(<Requirements />, seeds);

    expect(screen.getByText('Choose a document first')).toBeTruthy();
  });
});
