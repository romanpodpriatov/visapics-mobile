/**
 * Getting rid of things: the account on the server, and everything this
 * device holds.
 */
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { useConsentStore } from '../store/consent';
import { useDraftStore } from '../store/draft';

/**
 * Delete the account, in one call, from inside the app.
 *
 * The server anonymises rather than hard-deletes — order rows have to survive
 * for accounting and for Apple's refund handling — but everything identifying
 * is destroyed, and the session is refused afterwards.
 */
export async function deleteAccount(): Promise<void> {
  await api.del('/account');
  await eraseDevice();
}

/**
 * Forget this device: the guest identity, the draft, the consent.
 *
 * This is how someone is forgotten without ever having made an account. Apple
 * asks about accounts, but a photo app that can only forget you if you first
 * sign up invites the comment.
 */
export async function eraseDevice(): Promise<void> {
  await useConsentStore.getState().revoke();
  useDraftStore.getState().reset();
  await useAuthStore.getState().forgetDevice();
}
