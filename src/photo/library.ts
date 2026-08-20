/**
 * Getting a photo out of the library, and the bundled specimen.
 *
 * The system picker is used directly rather than a picker of our own. On iOS
 * that is what makes limited access work — the person picks from the set they
 * chose to share and the app never sees the rest — and building a grid would
 * mean asking for the whole library to draw it.
 */
import { Asset } from 'expo-asset';
import * as ImagePicker from 'expo-image-picker';

import type { PickedAsset } from './validate';

/**
 * 1600×2133. The onboarding specimen is 300×400, which the server refuses
 * outright — "Image resolution too low… we need at least 992×1275" — so the
 * sample photo is its own asset, big enough for the pipeline to work on.
 */
const specimen = require('../../assets/sample/specimen.jpg');

export type PickOutcome =
  | { status: 'picked'; asset: PickedAsset }
  | { status: 'cancelled' }
  | { status: 'denied' };

export async function pickFromLibrary(): Promise<PickOutcome> {
  const permission = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    const asked = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // 'limited' counts as granted: the person shared a selection, which is a
    // choice to be respected rather than a denial to be worked around.
    if (!asked.granted) return { status: 'denied' };
  } else if (!permission.granted) {
    return { status: 'denied' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    exif: false,
  });

  if (result.canceled || !result.assets[0]) return { status: 'cancelled' };

  const asset = result.assets[0];
  return {
    status: 'picked',
    asset: {
      uri: asset.uri,
      fileSize: asset.fileSize,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      width: asset.width,
      height: asset.height,
    },
  };
}

/**
 * The photo behind "Try it with a sample photo".
 *
 * It goes through the ordinary upload path, so an App Review tester sees the
 * real pipeline rather than a demo branch — which is the point of it existing.
 */
export async function sampleAsset(): Promise<PickedAsset | null> {
  const [asset] = await Asset.loadAsync(specimen);
  const uri = asset?.localUri ?? asset?.uri;
  if (!uri) return null;
  return {
    uri,
    fileName: 'specimen.jpg',
    mimeType: 'image/jpeg',
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
  };
}
