/**
 * Whether the person has been told how their photo is handled.
 *
 * Guideline 5.1.1(i) wants the explanation before the collection, and this is
 * the flag that enforces the order: no camera screen, and no system prompt,
 * until this is true. It is revocable because "erase everything on this
 * device" has to mean everything.
 */
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const CONSENT_KEY = 'visapics.face_consent';

type ConsentState = {
  accepted: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  accept: () => Promise<void>;
  revoke: () => Promise<void>;
};

export const useConsentStore = create<ConsentState>((set) => ({
  accepted: false,
  hydrated: false,

  hydrate: async () => {
    const saved = await SecureStore.getItemAsync(CONSENT_KEY);
    set({ accepted: saved === 'true', hydrated: true });
  },

  accept: async () => {
    set({ accepted: true });
    await SecureStore.setItemAsync(CONSENT_KEY, 'true');
  },

  revoke: async () => {
    set({ accepted: false });
    // Deleted rather than set to 'false': the next launch should find nothing
    // and ask again, which is what revoking consent means.
    await SecureStore.deleteItemAsync(CONSENT_KEY);
  },
}));
