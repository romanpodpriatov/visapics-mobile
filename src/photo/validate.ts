/**
 * Getting a photo from the library into a shape the server will accept.
 *
 * Two things make this more than a size check. iPhones produce HEIC by
 * default and the server cannot read one, so a HEIC is converted rather than
 * refused — refusing it would refuse most people's photos. And the server
 * measures head height in pixels, so compressing has a floor: a photo small
 * enough to upload but too small to measure has not been made usable.
 */
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** The limit the website states, and comfortably inside the server's own. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Below this the server cannot measure a head reliably. */
export const MIN_LONG_EDGE = 2000;

const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4];

export type PickedAsset = {
  uri: string;
  fileSize?: number | null;
  mimeType?: string | null;
  fileName?: string | null;
  width?: number;
  height?: number;
};

export type UploadProblem = 'too_large' | 'too_small' | 'no_face' | 'multi_face';

export type ValidationResult =
  | { ok: true; uri: string }
  | { ok: false; kind: UploadProblem; bytes?: number };

export function isHeic(asset: PickedAsset): boolean {
  const mime = (asset.mimeType ?? '').toLowerCase();
  const name = (asset.fileName ?? '').toLowerCase();
  return mime.includes('heic') || mime.includes('heif') || /\.hei[cf]$/.test(name);
}

/** The picker usually reports a size; when it does not, ask the file. */
function bytesOf(uri: string, reported?: number | null): number {
  if (typeof reported === 'number' && reported > 0) return reported;
  return new File(uri).size ?? 0;
}

async function reencode(asset: PickedAsset, compress: number): Promise<string> {
  const context = ImageManipulator.manipulate(asset.uri);

  const longEdge = Math.max(asset.width ?? 0, asset.height ?? 0);
  if (longEdge > MIN_LONG_EDGE) {
    const portrait = (asset.height ?? 0) >= (asset.width ?? 0);
    context.resize(portrait ? { height: MIN_LONG_EDGE } : { width: MIN_LONG_EDGE });
  }

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress });
  return saved.uri;
}

/**
 * Decide what to do with a photo straight from the library.
 *
 * Over the limit is not a refusal — it is the question the error sheet asks,
 * and prepareForUpload is the answer.
 */
export async function validatePhoto(asset: PickedAsset): Promise<ValidationResult> {
  const bytes = bytesOf(asset.uri, asset.fileSize);
  if (bytes > MAX_UPLOAD_BYTES) return { ok: false, kind: 'too_large', bytes };

  if (isHeic(asset)) return { ok: true, uri: await reencode(asset, QUALITY_STEPS[0]) };

  return { ok: true, uri: asset.uri };
}

/** Convert and compress until it fits, or report the size it would not go below. */
export async function prepareForUpload(asset: PickedAsset): Promise<ValidationResult> {
  let bytes = bytesOf(asset.uri, asset.fileSize);

  for (const compress of QUALITY_STEPS) {
    const uri = await reencode(asset, compress);
    bytes = bytesOf(uri, null);
    if (bytes > 0 && bytes <= MAX_UPLOAD_BYTES) return { ok: true, uri };
  }

  return { ok: false, kind: 'too_large', bytes };
}

/**
 * The processing failures that deserve their own explanation rather than a
 * generic error. The asynchronous pipeline reports them as prose, so this
 * reads the prose; anything else falls through to the ordinary error path.
 */
export function failureFromServer(message: string): UploadProblem | null {
  const text = (message ?? '').toLowerCase();
  if (text.includes('multiple faces')) return 'multi_face';
  if (text.includes('no face')) return 'no_face';
  // Seen on production against a 300×400 photo: "Image resolution too low.
  // Your image is 300x400 pixels, but we need at least 992x1275 pixels".
  if (text.includes('resolution too low')) return 'too_small';
  return null;
}
