import * as AppleAuthentication from 'expo-apple-authentication';

import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { signInWithApple } from '../signin';

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  isAvailableAsync: jest.fn(async () => true),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

const mockKeychain: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockKeychain[k] ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockKeychain[k] = v;
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    delete mockKeychain[k];
  }),
}));

let mockUuid = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `0000000${(mockUuid += 1)}-0000-4000-8000-00000000000${mockUuid}`,
}));

const apple = AppleAuthentication as unknown as { signInAsync: jest.Mock };

const session = {
  access_token: 'a',
  refresh_token: 'r',
  user: { id: 22, email: 'someone@privaterelay.appleid.com', is_anonymous: false },
  created: true,
};

beforeEach(() => {
  Object.keys(mockKeychain).forEach((k) => delete mockKeychain[k]);
  apple.signInAsync.mockReset();
  useAuthStore.setState({ accessToken: null, userId: null, isAnonymous: true });
});
afterEach(() => jest.restoreAllMocks());

describe('signInWithApple', () => {
  it('carries the device token, so the guest keeps their credits', async () => {
    // Omitting it is the bug where someone signs in and their credits vanish,
    // which from their side is indistinguishable from theft.
    apple.signInAsync.mockResolvedValue({ identityToken: 'apple.id.token' });
    const post = jest.spyOn(api, 'post').mockResolvedValue(session as never);

    await signInWithApple();

    const body = post.mock.calls[0][1] as { identity_token: string; device_token: string };
    expect(body.identity_token).toBe('apple.id.token');
    expect(body.device_token.length).toBeGreaterThanOrEqual(16);
  });

  it('sends the device token the guest session already registered', async () => {
    const { getOrCreateDeviceToken } = require('../../store/auth');
    const existing: string = await getOrCreateDeviceToken();
    apple.signInAsync.mockResolvedValue({ identityToken: 'apple.id.token' });
    const post = jest.spyOn(api, 'post').mockResolvedValue(session as never);

    await signInWithApple();

    const body = post.mock.calls[0][1] as { device_token: string };
    expect(body.device_token).toBe(existing);
  });

  it('is signed in afterwards, not still a guest', async () => {
    apple.signInAsync.mockResolvedValue({ identityToken: 'apple.id.token' });
    jest.spyOn(api, 'post').mockResolvedValue(session as never);

    await signInWithApple();

    expect(useAuthStore.getState().isAnonymous).toBe(false);
    expect(useAuthStore.getState().userId).toBe(22);
  });

  it('refuses to send an authorization Apple did not sign', async () => {
    apple.signInAsync.mockResolvedValue({ identityToken: null });
    const post = jest.spyOn(api, 'post');

    await expect(signInWithApple()).rejects.toThrow(/identity token/i);
    expect(post).not.toHaveBeenCalled();
  });

  it('treats a cancelled sheet as a cancellation, not a failure', async () => {
    apple.signInAsync.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
    await expect(signInWithApple()).resolves.toBe(false);
  });
});
