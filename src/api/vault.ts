/**
 * The vault, on the account API the website has always had.
 *
 * These endpoints predate /api/v1 and answer without its envelope, which is
 * what the `account` surface in the client is for. They take the same JWT, so
 * a guest has a vault too — and the tab tells them, honestly, how long it
 * lasts.
 */
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '../store/auth';
import { SITE_BASE, account } from './client';

export type VaultPhoto = {
  id: number;
  original_filename: string;
  person_name: string | null;
  document_type: string | null;
  country_code: string | null;
  is_expired: boolean;
  is_expiring_soon: boolean;
  days_until_expiry: number | null;
  created_at: string;
  /** Relative, and behind the same bearer token as everything else. */
  thumbnail_url: string;
};

type VaultList = { vaults: { id: number; name: string; photo_count: number }[] };

async function firstVaultId(): Promise<number | null> {
  const { vaults } = await account.get<VaultList>('/vaults');
  return vaults[0]?.id ?? null;
}

/** Reading never creates: the vault appears when a photo is saved. */
export async function listVaultPhotos(): Promise<VaultPhoto[]> {
  const vaultId = await firstVaultId();
  if (vaultId === null) return [];
  const { photos } = await account.get<{ photos: VaultPhoto[] }>(`/vaults/${vaultId}/photos`);
  return photos;
}

export function useVaultPhotos() {
  const hasSession = useAuthStore((s) => s.accessToken !== null);
  return useQuery({
    queryKey: ['vault-photos'],
    queryFn: listVaultPhotos,
    enabled: hasSession,
  });
}

export async function saveToVault(
  photoUri: string,
  document: { countryCode: string; documentType: string; personName?: string },
): Promise<void> {
  const existing = await firstVaultId();
  const vaultId =
    existing ??
    (
      await account.post<{ vault: { id: number } }>('/vaults', {
        name: 'My photos',
        description: 'Photos made with the VisaPics app',
      })
    ).vault.id;

  const form = new FormData();
  form.append('file', {
    uri: photoUri,
    name: 'visapics-photo.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  form.append('country_code', document.countryCode);
  form.append('document_type', document.documentType);
  if (document.personName) form.append('person_name', document.personName);

  await account.upload(`/vaults/${vaultId}/photos`, form);
}

export async function deleteVaultPhoto(photoId: number): Promise<void> {
  await account.del(`/photos/${photoId}`);
}

/**
 * A thumbnail's source, with the token attached.
 *
 * The endpoint is behind jwt_required, and an <Image> does not carry the app's
 * session on its own — without the header every tile would render as a broken
 * box.
 */
export function thumbnailSource(photo: VaultPhoto) {
  const token = useAuthStore.getState().accessToken;
  return {
    uri: `${SITE_BASE}${photo.thumbnail_url}`,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
}
