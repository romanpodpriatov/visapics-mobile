import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import Register from '../app/register';
import { ApiError } from '../src/api/client';
import { registerWithEmail } from '../src/auth/signin';
import { configFixture, renderScreen } from '../src/test-utils';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}));

jest.mock('../src/auth/signin', () => ({
  registerWithEmail: jest.fn(),
}));

const seeds: [string[], unknown][] = [[['config'], configFixture]];

const type = (label: string, value: string) =>
  fireEvent.changeText(screen.getByLabelText(label), value);

describe('register', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    jest
      .mocked(registerWithEmail)
      .mockReset()
      .mockResolvedValue({ email: 'someone@example.com' });
  });

  it('creates the account with what was typed', async () => {
    renderScreen(<Register />, seeds);

    type('Email', 'someone@example.com');
    type('Password', 'Corr3ct-Horse');
    fireEvent.press(screen.getByText('Create account'));

    await waitFor(() =>
      expect(registerWithEmail).toHaveBeenCalledWith('someone@example.com', 'Corr3ct-Horse'),
    );
  });

  it('sends nobody to the app: the address has to be confirmed first', async () => {
    renderScreen(<Register />, seeds);

    type('Email', 'someone@example.com');
    type('Password', 'Corr3ct-Horse');
    fireEvent.press(screen.getByText('Create account'));

    // The account is unverified until the emailed link is followed, so the
    // screen says so rather than pretending the sign-up is finished.
    expect(await screen.findByText(/Check your email/)).toBeTruthy();
    expect(screen.getByText(/someone@example.com/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('states the password rule before it is broken', () => {
    // The server refuses fewer than eight characters without a letter and a
    // number. Finding that out by being refused is a worse way to learn it.
    renderScreen(<Register />, seeds);

    expect(screen.getByText(/8 characters/)).toBeTruthy();
  });

  it('shows the server refusal in its own words', async () => {
    jest
      .mocked(registerWithEmail)
      .mockRejectedValue(new ApiError('That email is already registered', 409, 'E409_EXISTS'));
    renderScreen(<Register />, seeds);

    type('Email', 'someone@example.com');
    type('Password', 'Corr3ct-Horse');
    fireEvent.press(screen.getByText('Create account'));

    expect(await screen.findByText('That email is already registered')).toBeTruthy();
  });

  it('will not send an empty form', () => {
    renderScreen(<Register />, seeds);

    fireEvent.press(screen.getByText('Create account'));

    expect(registerWithEmail).not.toHaveBeenCalled();
  });
});
