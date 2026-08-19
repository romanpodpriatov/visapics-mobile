/**
 * Whether the intro has been seen.
 *
 * Kept beside the session in the keychain rather than in AsyncStorage so that
 * the whole of "what this install knows about its owner" lives in one place
 * and is cleared by one uninstall.
 */
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const ONBOARDED_KEY = 'visapics.onboarded';

type OnboardingState = {
  onboarded: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  complete: () => Promise<void>;
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  onboarded: false,
  hydrated: false,

  hydrate: async () => {
    const saved = await SecureStore.getItemAsync(ONBOARDED_KEY);
    set({ onboarded: saved === 'true', hydrated: true });
  },

  complete: async () => {
    set({ onboarded: true });
    await SecureStore.setItemAsync(ONBOARDED_KEY, 'true');
  },
}));
