import { account } from '../client';
import { deleteVaultPhoto, listVaultPhotos, saveToVault } from '../vault';

const photo = {
  id: 7,
  original_filename: 'photo.jpg',
  person_name: null,
  document_type: 'UK Passport 35x45 mm',
  country_code: 'gb',
  is_expired: false,
  is_expiring_soon: false,
  days_until_expiry: 170,
  created_at: '2026-08-20T10:00:00',
  thumbnail_url: '/api/photos/7/thumbnail',
};

afterEach(() => jest.restoreAllMocks());

describe('listVaultPhotos', () => {
  it('lists nothing at all when no vault has been made yet', async () => {
    // Reading must not create anything: the vault appears when a photo is
    // saved, not when the tab is opened.
    const get = jest.spyOn(account, 'get').mockResolvedValue({ vaults: [] } as never);
    const post = jest.spyOn(account, 'post');

    await expect(listVaultPhotos()).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });

  it('lists the photos of the vault that exists', async () => {
    jest
      .spyOn(account, 'get')
      .mockImplementation(((path: string) =>
        path === '/vaults'
          ? Promise.resolve({ vaults: [{ id: 4 }] })
          : Promise.resolve({ photos: [photo] })) as never);

    await expect(listVaultPhotos()).resolves.toEqual([photo]);
  });
});

describe('saveToVault', () => {
  it('makes the vault the first time something is saved', async () => {
    jest.spyOn(account, 'get').mockResolvedValue({ vaults: [] } as never);
    const post = jest.spyOn(account, 'post').mockResolvedValue({ vault: { id: 9 } } as never);
    const upload = jest.spyOn(account, 'upload').mockResolvedValue({} as never);

    await saveToVault('file:///photo.jpg', {
      countryCode: 'gb',
      documentType: 'UK Passport 35x45 mm',
    });

    expect(post).toHaveBeenCalledWith('/vaults', expect.any(Object));
    expect(upload.mock.calls[0][0]).toBe('/vaults/9/photos');
  });

  it('reuses the vault after that', async () => {
    jest.spyOn(account, 'get').mockResolvedValue({ vaults: [{ id: 4 }] } as never);
    const post = jest.spyOn(account, 'post');
    const upload = jest.spyOn(account, 'upload').mockResolvedValue({} as never);

    await saveToVault('file:///photo.jpg', {
      countryCode: 'gb',
      documentType: 'UK Passport 35x45 mm',
    });

    expect(post).not.toHaveBeenCalled();
    expect(upload.mock.calls[0][0]).toBe('/vaults/4/photos');
  });

  it('sends the document with the photo, so the vault knows what it is', async () => {
    jest.spyOn(account, 'get').mockResolvedValue({ vaults: [{ id: 4 }] } as never);
    const upload = jest.spyOn(account, 'upload').mockResolvedValue({} as never);

    await saveToVault('file:///photo.jpg', {
      countryCode: 'gb',
      documentType: 'UK Passport 35x45 mm',
    });

    const form = upload.mock.calls[0][1] as FormData;
    expect(form.get('country_code')).toBe('gb');
    expect(form.get('document_type')).toBe('UK Passport 35x45 mm');
  });
});

describe('deleteVaultPhoto', () => {
  it('deletes on the server, not only on the screen', async () => {
    const del = jest.spyOn(account, 'del').mockResolvedValue({} as never);
    await deleteVaultPhoto(7);
    expect(del).toHaveBeenCalledWith('/photos/7');
  });
});
