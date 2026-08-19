import { api } from '../../api/client';
import { useAuthStore } from '../auth';

/** Stands in for the keychain. Survives within a test, cleared between them. */
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

// randomUUID is native, so it is absent under jest. The stand-in honours the
// contract that matters here: a distinct RFC-4122 string every call.
let mockUuidCounter = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(
    () => `0000000${(mockUuidCounter += 1)}-0000-4000-8000-00000000000${mockUuidCounter}`,
  ),
}));

const DEVICE_TOKEN_KEY = 'visapics.device_token';

const deviceSession = (id = 11) => ({
  access_token: 'a',
  refresh_token: 'r',
  expires_in: 3600,
  refresh_expires_in: 2592000,
  user: { id, is_anonymous: true },
  created: true,
});

const mockRegistration = () => {
  const post = jest.fn().mockResolvedValue(deviceSession());
  jest.spyOn(api, 'post').mockImplementation(post as never);
  return post;
};

describe('auth store', () => {
  beforeEach(() => {
    Object.keys(mockKeychain).forEach((k) => delete mockKeychain[k]);
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      userId: null,
      isAnonymous: true,
      hydrated: false,
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('registers a device once and reuses the session afterwards', async () => {
    const post = mockRegistration();

    await useAuthStore.getState().ensureSession();
    await useAuthStore.getState().ensureSession();

    expect(post).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().userId).toBe(11);
  });

  it('registers once when two screens ask at the same time', async () => {
    // Both would otherwise mint their own device token and register it: the
    // guest ends up split across two accounts, and on a first launch the
    // second insert collides on the synthetic email and 500s.
    const post = jest.fn().mockResolvedValue(deviceSession());
    jest.spyOn(api, 'post').mockImplementation(post as never);

    await Promise.all([
      useAuthStore.getState().ensureSession(),
      useAuthStore.getState().ensureSession(),
    ]);

    expect(post).toHaveBeenCalledTimes(1);
  });

  it('reuses one device token across sessions', async () => {
    const post = mockRegistration();

    await useAuthStore.getState().ensureSession();
    useAuthStore.setState({ accessToken: null });
    await useAuthStore.getState().ensureSession();

    const first = post.mock.calls[0][1].device_token;
    const second = post.mock.calls[1][1].device_token;
    expect(second).toBe(first);
  });

  it('generates a device token long enough for the server to accept', async () => {
    // register_device rejects anything under 16 characters with a 400.
    const post = mockRegistration();
    await useAuthStore.getState().ensureSession();
    expect(post.mock.calls[0][1].device_token.length).toBeGreaterThanOrEqual(16);
  });

  it('signing out clears the session', async () => {
    mockRegistration();
    await useAuthStore.getState().ensureSession();

    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().isAnonymous).toBe(true);
  });

  it('signing out keeps the device token so guest credits survive', async () => {
    mockRegistration();
    await useAuthStore.getState().ensureSession();
    const token = mockKeychain[DEVICE_TOKEN_KEY];

    await useAuthStore.getState().signOut();

    expect(mockKeychain[DEVICE_TOKEN_KEY]).toBe(token);
  });

  it('forgetting the device drops the device token as well', async () => {
    mockRegistration();
    await useAuthStore.getState().ensureSession();

    await useAuthStore.getState().forgetDevice();

    expect(mockKeychain[DEVICE_TOKEN_KEY]).toBeUndefined();
  });

  it('marks the session as signed in after a real sign-in', () => {
    useAuthStore.getState().setSession(
      { access_token: 'a', refresh_token: 'r' },
      { id: 22, is_anonymous: false },
    );
    expect(useAuthStore.getState().isAnonymous).toBe(false);
  });

  it('restores the saved session on the next launch', async () => {
    mockRegistration();
    await useAuthStore.getState().ensureSession();

    useAuthStore.setState({ accessToken: null, refreshToken: null, userId: null });
    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().accessToken).toBe('a');
    expect(useAuthStore.getState().userId).toBe(11);
  });

  it('finishes hydrating even when nothing was saved', async () => {
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().hydrated).toBe(true);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
