import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import Privacy from '../app/privacy';
import { api } from '../src/api/client';
import { useAuthStore } from '../src/store/auth';
import { configFixture, renderScreen } from '../src/test-utils';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const seeds: [string[], unknown][] = [[['config'], configFixture]];

describe('privacy', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    useAuthStore.setState({ accessToken: 'tok', isAnonymous: false, userId: 22 });
  });
  afterEach(() => jest.restoreAllMocks());

  it('states the retention the server reports, not a number of its own', () => {
    renderScreen(<Privacy />, seeds);
    expect(screen.getByText('Photos clear after 7 days')).toBeTruthy();
    expect(screen.queryByText(/24 hours/)).toBeNull();
  });

  it('makes the four commitments the app has to keep', () => {
    renderScreen(<Privacy />, seeds);
    expect(screen.getByText('No face recognition, ever')).toBeTruthy();
    expect(screen.getByText('Nothing sold or shared')).toBeTruthy();
    expect(screen.getByText('Processing you control')).toBeTruthy();
  });

  it('deletes the account in the app, with a typed confirmation', async () => {
    // 5.1.1(v): an email, a web page or "contact support" is a rejection.
    const del = jest.spyOn(api, 'del').mockResolvedValue(undefined as never);
    renderScreen(<Privacy />, seeds);

    fireEvent.press(screen.getByText('Delete my account'));
    expect(await screen.findByText('Delete your account?')).toBeTruthy();

    // Not armed until the word is typed.
    fireEvent.press(screen.getByText('Delete everything'));
    expect(del).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    fireEvent.press(screen.getByText('Delete everything'));

    await waitFor(() => expect(del).toHaveBeenCalledWith('/account'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/photos'));
  });

  it('offers a guest no account to delete, only the device', () => {
    useAuthStore.setState({ isAnonymous: true });
    renderScreen(<Privacy />, seeds);

    expect(screen.queryByText('Delete my account')).toBeNull();
    expect(screen.getByText('Erase everything on this device')).toBeTruthy();
  });

  it('asks before erasing the device', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderScreen(<Privacy />, seeds);

    fireEvent.press(screen.getByText('Erase everything on this device'));

    expect(alert).toHaveBeenCalled();
  });
});
