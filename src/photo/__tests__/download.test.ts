import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

import { downloadToCache, saveToFiles, saveToPhotos } from '../download';

const mockDownload = jest.fn();
jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map(String).join('/');
    }
    static downloadFileAsync: (...args: unknown[]) => Promise<{ uri: string }> = (...args) =>
      mockDownload(...args);
  },
  Directory: class {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map(String).join('/');
    }
  },
  Paths: { cache: 'file:///cache' },
}));

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

const media = MediaLibrary as unknown as {
  requestPermissionsAsync: jest.Mock;
  saveToLibraryAsync: jest.Mock;
};
const sharing = Sharing as unknown as { isAvailableAsync: jest.Mock; shareAsync: jest.Mock };

beforeEach(() => {
  mockDownload.mockReset().mockResolvedValue({ uri: 'file:///cache/visapics-photo.jpg' });
  media.requestPermissionsAsync.mockReset().mockResolvedValue({ granted: true });
  media.saveToLibraryAsync.mockReset().mockResolvedValue(undefined);
  sharing.isAvailableAsync.mockReset().mockResolvedValue(true);
  sharing.shareAsync.mockReset().mockResolvedValue(undefined);
});

describe('downloadToCache', () => {
  it('brings the file down and reports where it landed', async () => {
    await expect(downloadToCache('https://visapics.org/x.jpg', 'photo.jpg')).resolves.toBe(
      'file:///cache/visapics-photo.jpg',
    );
    expect(mockDownload).toHaveBeenCalled();
  });
});

describe('saveToPhotos', () => {
  it('downloads first, then saves the local file', async () => {
    // saveToLibraryAsync takes a local path; handing it a URL saves nothing.
    await expect(saveToPhotos('https://visapics.org/x.jpg')).resolves.toBe('saved');
    expect(media.saveToLibraryAsync).toHaveBeenCalledWith('file:///cache/visapics-photo.jpg');
  });

  it('says when the system refused rather than pretending it saved', async () => {
    media.requestPermissionsAsync.mockResolvedValue({ granted: false });

    await expect(saveToPhotos('https://visapics.org/x.jpg')).resolves.toBe('denied');
    expect(media.saveToLibraryAsync).not.toHaveBeenCalled();
  });
});

describe('saveToFiles', () => {
  it('shares the downloaded file, never the signed URL', async () => {
    // The URL expires in fifteen minutes. A share sheet opened at minute
    // fourteen and used at minute sixteen would deliver an error page.
    await saveToFiles('https://visapics.org/api/v1/photo/download/tok');

    expect(sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/visapics-photo.jpg',
      expect.any(Object),
    );
  });

  it('does nothing when the platform has no share sheet', async () => {
    sharing.isAvailableAsync.mockResolvedValue(false);
    await saveToFiles('https://visapics.org/x.jpg');
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });
});
