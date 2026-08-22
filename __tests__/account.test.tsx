import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import Account from '../app/(tabs)/account';
import { signInWithApple } from '../src/auth/signin';
import { restorePurchases } from '../src/iap';
import { useAuthStore } from '../src/store/auth';
import { configFixture, renderScreen } from '../src/test-utils';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationButton: 'AppleAuthenticationButton',
  AppleAuthenticationButtonType: { SIGN_IN: 0 },
  AppleAuthenticationButtonStyle: { BLACK: 0 },
  isAvailableAsync: jest.fn(async () => true),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('../src/auth/signin', () => ({
  signInWithApple: jest.fn(async () => true),
  appleSignInAvailable: jest.fn(async () => true),
}));

jest.mock('../src/iap', () => ({
  ...jest.requireActual('../src/iap/products'),
  restorePurchases: jest.fn(async () => ({ restored: 2 })),
  purchase: jest.fn(),
  fetchIapProducts: jest.fn(async () => []),
}));

const seeds = (credits = 0): [string[], unknown][] => [
  [['config'], configFixture],
  [['credits'], { credits_remaining: credits, grants: [] }],
];

describe('account', () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.mocked(signInWithApple).mockClear().mockResolvedValue(true);
    jest.mocked(restorePurchases).mockClear().mockResolvedValue({ restored: 2 });
    useAuthStore.setState({ accessToken: 'tok', isAnonymous: true, userId: 11 });
  });
  afterEach(() => jest.restoreAllMocks());

  it('offers Apple and email, and nothing that would empty the balance', async () => {
    // Google and Facebook are still absent: neither can carry a guest's
    // credits onto the account, and 4.8 would then require Apple anyway.
    // Email can, now that /api/v1/auth/email takes the device token.
    renderScreen(<Account />, seeds());

    await waitFor(() => expect(screen.UNSAFE_getAllByType('AppleAuthenticationButton' as never)));
    expect(screen.getByText('Sign in with email')).toBeTruthy();
    expect(screen.queryByText(/Continue with Google/)).toBeNull();
    expect(screen.queryByText(/Continue with Facebook/)).toBeNull();
  });

  it('tells a guest how long this device keeps things, from the server', () => {
    renderScreen(<Account />, seeds());
    expect(screen.getByText(/live on this device for 7 days/)).toBeTruthy();
  });

  it('shows the balance once there is an account', () => {
    useAuthStore.setState({ isAnonymous: false });
    renderScreen(<Account />, seeds(5));

    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('Buy more credits')).toBeTruthy();
  });

  it('offers Restore Purchases without buying anything first', async () => {
    // 3.1.1 wants it visible; a control only reachable from the paywall is not.
    renderScreen(<Account />, seeds());

    fireEvent.press(screen.getByText('Restore purchases'));

    await waitFor(() => expect(restorePurchases).toHaveBeenCalled());
    expect(await screen.findByText('2 found')).toBeTruthy();
  });

  it('leads to privacy and support without an account', () => {
    renderScreen(<Account />, seeds());

    fireEvent.press(screen.getByText('Privacy and your data'));
    expect(mockPush).toHaveBeenCalledWith('/privacy');

    fireEvent.press(screen.getByText('Support'));
    expect(mockPush).toHaveBeenCalledWith('/support');
  });

  it('asks before erasing the device, and then really erases it', async () => {
    const forget = jest.spyOn(useAuthStore.getState(), 'forgetDevice');
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Erase')?.onPress?.();
    });
    renderScreen(<Account />, seeds());

    fireEvent.press(screen.getByText('Erase everything on this device'));

    await waitFor(() => expect(forget).toHaveBeenCalled());
  });

  it('offers no sign-out to someone who never signed in', () => {
    renderScreen(<Account />, seeds());
    expect(screen.queryByText('Sign out')).toBeNull();
  });
});

describe('a guest with an account on the website', () => {
  beforeEach(() => {
    mockPush.mockClear();
    useAuthStore.setState({ userId: 1, isAnonymous: true, accessToken: 'a', refreshToken: 'r' });
  });
  afterEach(() => jest.restoreAllMocks());

  it('is offered the email sign-in, not only Apple', () => {
    // Anyone holding a visapics.org account — and the credits on it — had no
    // way to reach either from the phone.
    renderScreen(<Account />, seeds());

    fireEvent.press(screen.getByText('Sign in with email'));

    expect(mockPush).toHaveBeenCalledWith('/signin');
  });
});
