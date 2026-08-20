/**
 * Getting the finished photo off the server and onto the phone.
 *
 * Everything goes through the cache first. The download URL is signed and
 * expires in fifteen minutes, so a share sheet opened at minute fourteen and
 * used at minute sixteen would hand somebody an error page instead of their
 * passport photo — and Photos needs a local file in any case.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

export async function downloadToCache(url: string, name = 'visapics-photo.jpg'): Promise<string> {
  const file = await File.downloadFileAsync(url, new Directory(Paths.cache));
  return file.uri || `${Paths.cache}/${name}`;
}

export type SaveOutcome = 'saved' | 'denied';

/** Save into the camera roll, which needs the add-only photo permission. */
export async function saveToPhotos(url: string): Promise<SaveOutcome> {
  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) return 'denied';

  const local = await downloadToCache(url);
  await MediaLibrary.saveToLibraryAsync(local);
  return 'saved';
}

/** Hand the file to the system share sheet — Files, Mail, anywhere. */
export async function saveToFiles(url: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) return;
  const local = await downloadToCache(url);
  await Sharing.shareAsync(local, {
    mimeType: 'image/jpeg',
    dialogTitle: 'Save your photo',
    UTI: 'public.jpeg',
  });
}
