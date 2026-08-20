import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import Vault from '../app/(tabs)/vault';
import { deleteVaultPhoto } from '../src/api/vault';
import { useAuthStore } from '../src/store/auth';
import { configFixture, renderScreen } from '../src/test-utils';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('../src/api/vault', () => ({
  ...jest.requireActual('../src/api/vault'),
  deleteVaultPhoto: jest.fn(async () => undefined),
}));

const photo = {
  id: 7,
  original_filename: 'photo.jpg',
  person_name: null,
  document_type: 'UK Passport 35x45 mm',
  country_code: 'gb',
  is_expired: false,
  is_expiring_soon: false,
  days_until_expiry: 170,
  created_at: '2026-08-20T10:00:00',
  thumbnail_url: '/api/photos/7/thumbnail',
};

const seeds = (photos: unknown[] = [photo]): [string[], unknown][] => [
  [['config'], configFixture],
  [['vault-photos'], photos],
];

describe('vault', () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.mocked(deleteVaultPhoto).mockClear().mockResolvedValue(undefined);
    useAuthStore.setState({ accessToken: 'tok', isAnonymous: true });
  });
  afterEach(() => jest.restoreAllMocks());

  it('tells a guest how long their photos last, from the server', () => {
    // configFixture reports 168 hours. The reference hardcodes "22 h".
    renderScreen(<Vault />, seeds());

    expect(screen.getByText(/photos clear after 7 days/)).toBeTruthy();
    expect(screen.queryByText(/22 h/)).toBeNull();
  });

  it('says nothing about guests once there is an account', () => {
    useAuthStore.setState({ isAnonymous: false });
    renderScreen(<Vault />, seeds());

    expect(screen.queryByText(/Guest vault/)).toBeNull();
  });

  it('shows what is saved, with the document it was made for', () => {
    renderScreen(<Vault />, seeds());

    expect(screen.getByText('UK Passport 35x45 mm')).toBeTruthy();
    expect(screen.getByText('170 days left')).toBeTruthy();
  });

  it('offers a way to start when nothing is saved', () => {
    renderScreen(<Vault />, seeds([]));

    expect(screen.getByText('Nothing saved yet')).toBeTruthy();
    fireEvent.press(screen.getByText('Make a photo'));
    expect(mockPush).toHaveBeenCalledWith('/photos');
  });

  it('deletes on the server, not only from the list', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Delete')?.onPress?.();
    });
    renderScreen(<Vault />, seeds());

    fireEvent(screen.getByLabelText('UK Passport 35x45 mm'), 'longPress');

    expect(alert).toHaveBeenCalled();
    await waitFor(() => expect(deleteVaultPhoto).toHaveBeenCalledWith(7));
  });
});
