/**
 * Signing in — with Apple, or with the account the website already has.
 *
 * Both paths send the device token, because both have to: it is what moves a
 * guest's credits onto the account. The site's own /auth/login takes no such
 * thing, which is why email sign-in goes to /api/v1/auth/email instead — the
 * same merge, and a two-step API for two-factor accounts rather than the
 * website's Flask session and redirect to /account/2fa.
 *
 * Google and Facebook are still not offered. Guideline 4.8 bites when an app
 * offers third-party sign-in, and an email form of one's own is not that.
 */
import * as AppleAuthentication from 'expo-apple-authentication';

import { api } from '../api/client';
import type {
  DeviceRegistration,
  EmailSignInResult,
  SessionTokens,
  UserSummary,
} from '../api/types';
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


/** What the first step of an email sign-in produced. */
export type EmailSignIn =
  | { status: 'signed-in' }
  | { status: 'needs-2fa'; challengeToken: string };

function needsSecondFactor(
  result: EmailSignInResult,
): result is { requires_2fa: true; challenge_token: string } {
  return 'requires_2fa' in result && result.requires_2fa;
}

/**
 * Sign in with an email and password.
 *
 * Throws an ApiError the caller can show: the server distinguishes a wrong
 * password from an unverified address, a deactivated account and a locked one,
 * and each of those needs a different thing from the person reading it.
 */
export async function signInWithEmail(email: string, password: string): Promise<EmailSignIn> {
  const result = await api.post<EmailSignInResult>('/auth/email', {
    email: email.trim(),
    password,
    device_token: await getOrCreateDeviceToken(),
  });

  if (needsSecondFactor(result)) {
    return { status: 'needs-2fa', challengeToken: result.challenge_token };
  }

  useAuthStore.getState().setSession(result, result.user);
  return { status: 'signed-in' };
}

/** Finish a sign-in that wanted a code. The challenge expires in five minutes. */
export async function completeTwoFactor(challengeToken: string, code: string): Promise<void> {
  const result = await api.post<SessionTokens & { user: UserSummary }>('/auth/email/2fa', {
    challenge_token: challengeToken,
    // Authenticator apps and backup codes are read off a screen and typed with
    // spaces as often as not.
    code: code.replace(/\s+/g, ''),
    device_token: await getOrCreateDeviceToken(),
  });

  useAuthStore.getState().setSession(result, result.user);
}

/**
 * Create an account.
 *
 * Nobody is signed in by this: the account is unverified until the emailed
 * link is followed, and signInWithEmail refuses an unverified account. The
 * device token is not sent either — a guest's credits move on the first
 * successful sign-in, and moving them onto an account that may never be
 * confirmed would strand them somewhere worse than where they started.
 */
export async function registerWithEmail(
  email: string,
  password: string,
): Promise<{ email: string }> {
  const result = await api.post<{ email: string; verification_required: boolean }>(
    '/auth/register',
    { email: email.trim(), password },
  );
  return { email: result.email };
}
