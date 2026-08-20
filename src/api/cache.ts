/**
 * Dropping what the cache holds about a person.
 *
 * Not the whole cache: the catalogue and the config belong to nobody, and
 * throwing them away only makes the next screen refetch them. What has to go
 * is anything scoped to the account that no longer exists.
 */
import type { QueryClient } from '@tanstack/react-query';

const PERSONAL = [['credits'], ['vault-photos'], ['photo-status']];

export function forgetCachedAccount(client: QueryClient): void {
  for (const queryKey of PERSONAL) client.removeQueries({ queryKey });
}
