/**
 * Getting a photo in, from wherever it comes.
 *
 * Shared between home and the camera-permission screen on purpose: refusing
 * the camera has to land somewhere that works, and "somewhere that works" is
 * this exact flow rather than a second copy of it that drifts.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';

import type { UploadProblemDetail } from '../components';
import { pickFromLibrary, sampleAsset } from './library';
import { type PickedAsset, prepareForUpload, validatePhoto } from './validate';

export function usePhotoImport() {
  const router = useRouter();
  const [problem, setProblem] = useState<UploadProblemDetail | null>(null);
  const [pending, setPending] = useState<PickedAsset | null>(null);
  const [noAccess, setNoAccess] = useState(false);

  const process = (photo: string) => router.push({ pathname: '/processing', params: { photo } });

  const begin = async (asset: PickedAsset) => {
    const result = await validatePhoto(asset);
    if (result.ok) {
      process(result.uri);
      return;
    }
    setPending(asset);
    setProblem(result);
  };

  const fromLibrary = async () => {
    const outcome = await pickFromLibrary();
    if (outcome.status === 'picked') await begin(outcome.asset);
    else if (outcome.status === 'denied') setNoAccess(true);
  };

  const fromSample = async () => {
    const asset = await sampleAsset();
    if (asset) await begin(asset);
  };

  const resolveProblem = async () => {
    const asset = pending;
    const kind = problem?.kind;
    setProblem(null);
    if (!asset || !kind) return;

    if (kind === 'too_large') {
      const prepared = await prepareForUpload(asset);
      if (prepared.ok) process(prepared.uri);
      else setProblem(prepared);
      return;
    }
    if (kind === 'multi_face') {
      router.push('/permission');
      return;
    }
    await fromLibrary();
  };

  return {
    problem,
    noAccess,
    fromLibrary,
    fromSample,
    resolveProblem,
    dismissProblem: () => setProblem(null),
    dismissAccess: () => setNoAccess(false),
  };
}
