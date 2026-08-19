import { useOnboardingStore } from '../onboarding';

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

describe('onboarding flag', () => {
  beforeEach(() => {
    Object.keys(mockKeychain).forEach((k) => delete mockKeychain[k]);
    useOnboardingStore.setState({ onboarded: false, hydrated: false });
  });

  it('has not been onboarded on a first launch', async () => {
    await useOnboardingStore.getState().hydrate();
    expect(useOnboardingStore.getState().onboarded).toBe(false);
    expect(useOnboardingStore.getState().hydrated).toBe(true);
  });

  it('remembers that onboarding is done, across launches', async () => {
    await useOnboardingStore.getState().complete();
    expect(useOnboardingStore.getState().onboarded).toBe(true);

    useOnboardingStore.setState({ onboarded: false, hydrated: false });
    await useOnboardingStore.getState().hydrate();

    expect(useOnboardingStore.getState().onboarded).toBe(true);
  });
});
