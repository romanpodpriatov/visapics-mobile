import { useConsentStore } from '../consent';

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

describe('consent store', () => {
  beforeEach(() => {
    Object.keys(mockKeychain).forEach((k) => delete mockKeychain[k]);
    useConsentStore.setState({ accepted: false, hydrated: false });
  });

  it('starts unaccepted', () => {
    expect(useConsentStore.getState().accepted).toBe(false);
  });

  it('records acceptance and survives a restart', async () => {
    await useConsentStore.getState().accept();

    useConsentStore.setState({ accepted: false });
    await useConsentStore.getState().hydrate();

    expect(useConsentStore.getState().accepted).toBe(true);
  });

  it('can be revoked, so "erase everything" really resets it', async () => {
    await useConsentStore.getState().accept();

    await useConsentStore.getState().revoke();

    expect(useConsentStore.getState().accepted).toBe(false);
  });

  it('stays revoked across a restart', async () => {
    // Revoking in memory only would re-consent the user on the next launch
    // without them ever agreeing again.
    await useConsentStore.getState().accept();
    await useConsentStore.getState().revoke();

    useConsentStore.setState({ accepted: true });
    await useConsentStore.getState().hydrate();

    expect(useConsentStore.getState().accepted).toBe(false);
  });
});
