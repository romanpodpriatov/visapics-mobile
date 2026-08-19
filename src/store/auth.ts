import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { api } from '../api/client';
import type { DeviceRegistration, SessionTokens, UserSummary } from '../api/types';

const DEVICE_TOKEN_KEY = 'visapics.device_token';
const SESSION_KEY = 'visapics.session';

/**
 * The device token is the guest's identity. Losing it loses their credits,
 * which is why it is written once and never regenerated, and why signOut
 * deliberately leaves it alone.
 */
async function getOrCreateDeviceToken(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_TOKEN_KEY);
  if (existing) return existing;
  const token = Crypto.randomUUID() + Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, token);
  return token;
}

/** In flight while a device is registering. See ensureSession. */
let sessionInFlight: Promise<void> | null = null;

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  userId: number | null;
  isAnonymous: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  ensureSession: () => Promise<void>;
  setSession: (tokens: SessionTokens, user: UserSummary) => void;
  persist: () => Promise<void>;
  signOut: () => Promise<void>;
  forgetDevice: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  userId: null,
  isAnonymous: true,
  hydrated: false,

  hydrate: async () => {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Pick<
        AuthState,
        'accessToken' | 'refreshToken' | 'userId' | 'isAnonymous'
      >;
      set({
        accessToken: saved.accessToken,
        refreshToken: saved.refreshToken,
        userId: saved.userId,
        isAnonymous: saved.isAnonymous,
      });
    }
    set({ hydrated: true });
  },

  ensureSession: async () => {
    if (get().accessToken) return;

    // One registration at a time. Two callers racing would each mint their own
    // device token and register it, splitting the guest across two accounts —
    // and on a first launch the second insert collides on the synthetic email
    // the account carries, which surfaces as a 500 on /auth/device.
    if (!sessionInFlight) {
      sessionInFlight = (async () => {
        try {
          const deviceToken = await getOrCreateDeviceToken();
          const data = await api.post<DeviceRegistration>('/auth/device', {
            device_token: deviceToken,
          });
          set({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            userId: data.user.id,
            isAnonymous: data.user.is_anonymous,
          });
          await get().persist();
        } finally {
          sessionInFlight = null;
        }
      })();
    }
    return sessionInFlight;
  },

  setSession: (tokens, user) => {
    set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      userId: user.id,
      isAnonymous: user.is_anonymous,
    });
    void get().persist();
  },

  persist: async () => {
    const { accessToken, refreshToken, userId, isAnonymous } = get();
    await SecureStore.setItemAsync(
      SESSION_KEY,
      JSON.stringify({ accessToken, refreshToken, userId, isAnonymous }),
    );
  },

  signOut: async () => {
    // The device token stays: signing out of an account should drop back to
    // the same guest identity, not to a stranger's empty one.
    await SecureStore.deleteItemAsync(SESSION_KEY);
    set({ accessToken: null, refreshToken: null, userId: null, isAnonymous: true });
  },

  forgetDevice: async () => {
    // "Erase everything on this device" — the guest's route to being
    // forgotten without ever having made an account (Guideline 5.1.1(v)).
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY);
    set({ accessToken: null, refreshToken: null, userId: null, isAnonymous: true });
  },
}));

export { getOrCreateDeviceToken };
