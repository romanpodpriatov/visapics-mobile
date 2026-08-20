/**
 * Signing in.
 *
 * Only Sign in with Apple is offered. The reference draws Google, Facebook and
 * an email form beside it, but none of those can carry a guest's credits onto
 * the account: /api/v1/auth/apple takes a device_token and merges, and the
 * site's own /auth/login and social callbacks do not — the email path even
 * routes 2FA through a Flask session and a web redirect. Offering a sign-in
 * that silently empties someone's balance would be worse than offering fewer.
 *
 * It also settles Guideline 4.8 the simple way: the rule bites when an app
 * offers other third-party sign-in, and this one does not.
 */
import * as AppleAuthentication from 'expo-apple-authentication';

import { api } from '../api/client';
import type { DeviceRegistration } from '../api/types';
import { getOrCreateDeviceToken, useAuthStore } from '../store/auth';

function isCancellation(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  return code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED';
}

/** True once signed in, false if the sheet was dismissed. */
export async function signInWithApple(): Promise<boolean> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (error: unknown) {
    if (isCancellation(error)) return false;
    throw error;
  }

  if (!credential.identityToken) throw new Error('Apple returned no identity token');

  // Apple sends the name and email only on the very first authorization, so
  // neither is cached or re-sent: on a reinstall the app would not have them,
  // and the server keys on the Apple subject anyway.
  const data = await api.post<DeviceRegistration>('/auth/apple', {
    identity_token: credential.identityToken,
    device_token: await getOrCreateDeviceToken(),
  });

  useAuthStore.getState().setSession(data, data.user);
  return true;
}

export function appleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}
