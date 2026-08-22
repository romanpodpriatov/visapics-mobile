import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import SignIn from '../app/signin';
import { ApiError } from '../src/api/client';
import { completeTwoFactor, signInWithEmail } from '../src/auth/signin';
import { configFixture, renderScreen } from '../src/test-utils';

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
}));

jest.mock('../src/auth/signin', () => ({
  signInWithEmail: jest.fn(),
  completeTwoFactor: jest.fn(),
}));

const seeds: [string[], unknown][] = [[['config'], configFixture]];

const type = (label: string, value: string) =>
  fireEvent.changeText(screen.getByLabelText(label), value);

describe('sign in', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
    jest.mocked(signInWithEmail).mockReset().mockResolvedValue({ status: 'signed-in' });
    jest.mocked(completeTwoFactor).mockReset().mockResolvedValue(undefined);
  });

  it('sends what was typed and leaves once it worked', async () => {
    renderScreen(<SignIn />, seeds);

    type('Email', 'someone@example.com');
    type('Password', 'hunter2');
    fireEvent.press(screen.getByText('Sign in'));

    await waitFor(() =>
      expect(signInWithEmail).toHaveBeenCalledWith('someone@example.com', 'hunter2'),
    );
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('will not send an empty form', () => {
    renderScreen(<SignIn />, seeds);

    fireEvent.press(screen.getByText('Sign in'));

    expect(signInWithEmail).not.toHaveBeenCalled();
  });

  it('shows the reason the server gave, not a generic failure', async () => {
    // Unverified, deactivated, locked out and wrong password each need a
    // different thing from the person reading them.
    jest
      .mocked(signInWithEmail)
      .mockRejectedValue(
        new ApiError('Confirm your email address before signing in', 403, 'E403_UNVERIFIED'),
      );
    renderScreen(<SignIn />, seeds);

    type('Email', 'someone@example.com');
    type('Password', 'hunter2');
    fireEvent.press(screen.getByText('Sign in'));

    expect(
      await screen.findByText('Confirm your email address before signing in'),
    ).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('asks for the code when the account has two-factor, then finishes', async () => {
    jest
      .mocked(signInWithEmail)
      .mockResolvedValue({ status: 'needs-2fa', challengeToken: 'challenge-1' });
    renderScreen(<SignIn />, seeds);

    type('Email', 'someone@example.com');
    type('Password', 'hunter2');
    fireEvent.press(screen.getByText('Sign in'));

    const code = await screen.findByLabelText('Six-digit code');
    fireEvent.changeText(code, '123456');
    fireEvent.press(screen.getByText('Verify'));

    await waitFor(() => expect(completeTwoFactor).toHaveBeenCalledWith('challenge-1', '123456'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('sends a person who forgot their password to the website', () => {
    // There is no in-app reset: the flow is an emailed link, and the site
    // already runs it. Linking out is only forbidden for payment.
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    renderScreen(<SignIn />, seeds);

    fireEvent.press(screen.getByText('Forgot your password?'));

    expect(open).toHaveBeenCalledWith('https://visapics.org/auth/forgot-password');
    open.mockRestore();
  });

  it('offers a way to create an account, for someone who has none', () => {
    renderScreen(<SignIn />, seeds);

    fireEvent.press(screen.getByText('Create an account'));

    expect(mockPush).toHaveBeenCalledWith('/register');
  });
});
