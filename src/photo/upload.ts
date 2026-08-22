/**
 * Sending a photo to be processed, and waiting for the answer.
 */
import { useQuery } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { useRef } from 'react';

import { ApiError, api } from '../api/client';
import { retryPolicy } from '../api/hooks';
import type { CompletedTask, TaskAccepted, TaskStatus, UnlockResult } from '../api/types';

export const POLL_INTERVAL_MS = 1500;

/** A poll loop with no ceiling drains the battery of anyone who walks away. */
export const POLL_DEADLINE_MS = 3 * 60 * 1000;

/**
 * The photo is gone, or empty, by the time the upload is built.
 *
 * Worth its own type because React Native cannot say why a multipart body
 * failed: if the file behind the uri is unreadable, `fetch` rejects with a
 * bare network error and the screen would blame the server for something that
 * never left the phone.
 */
export class PhotoUnreadableError extends Error {
  constructor(readonly uri: string) {
    super(`The photo could not be read (${uri})`);
    this.name = 'PhotoUnreadableError';
  }
}

/** Refuse a photo that is not there, while there is still something to say. */
export function assertPhotoReadable(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists && (file.size ?? 0) > 0) return;
  } catch {
    // An unusable uri throws rather than reporting itself missing.
  }
  throw new PhotoUnreadableError(uri);
}

/**
 * What to put on screen when an upload fails.
 *
 * The old text — "Could not reach the server" — was a guess, and production
 * showed it was the wrong one: the device had just registered and read its
 * credits over the same connection, and the upload never left the phone. A
 * failure nobody can name is a failure nobody can fix, so this one is named.
 */
export function uploadErrorMessage(error: unknown): string {
  if (error instanceof PhotoUnreadableError) {
    return 'That photo could not be opened. Choose it again.';
  }
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return `Upload failed — ${error.message}`;
  return 'The upload did not complete.';
}

export type ProcessingRequest = {
  countryCode: string;
  documentType: string;
  removeBackground: boolean;
  enhance: boolean;
};

/**
 * Start processing and return the task id.
 *
 * No mode is sent. The server pins JWT callers to preview, which is the
 * behaviour the app wants and could not override anyway; asking for anything
 * else would read like an attempt to skip the paywall.
 */
export function processingParts(
  photoUri: string,
  request: ProcessingRequest,
): [string, unknown][] {
  return [
    // A File, not React Native's {uri, name, type} part. Expo's fetch builds
    // the multipart body in JavaScript and takes a string, a Blob, or an
    // object with bytes(); handed a uri part it throws "Unsupported
    // FormDataPart implementation" and the request never leaves the phone.
    // expo-file-system's File implements Blob, and carries the name the
    // server needs to keep the upload.
    ['photo', new File(photoUri)],
    ['country_code', request.countryCode],
    ['document_type', request.documentType],
    ['remove_background', String(request.removeBackground)],
    ['enhance_photo', String(request.enhance)],
  ];
}

export async function startProcessing(
  photoUri: string,
  request: ProcessingRequest,
): Promise<string> {
  assertPhotoReadable(photoUri);

  const form = new FormData();
  for (const [name, value] of processingParts(photoUri, request)) {
    form.append(name, value as Blob);
  }

  const accepted = await api.upload<TaskAccepted>('/photo/process/async', form);
  return accepted.task_id;
}

/** Narrows a poll result to the finished shape, which carries the report. */
export function completed(status: TaskStatus | undefined): CompletedTask | null {
  return status && status.state === 'SUCCESS' ? status : null;
}

/** How long to wait before asking again, or false to stop asking. */
export function nextPoll(
  state: string | undefined,
  elapsedMs: number,
  error?: unknown,
): number | false {
  // A 4xx is a verdict, not a hiccup. Production showed a refused photo being
  // polled 150 times in three minutes for the same answer, while the screen
  // said "Preparing your photo…". A 5xx is worth another go.
  if (error instanceof ApiError && error.status < 500) return false;
  if (state === 'SUCCESS') return false;
  if (elapsedMs >= POLL_DEADLINE_MS) return false;
  return POLL_INTERVAL_MS;
}

export function usePhotoStatus(taskId: string | null) {
  const startedAt = useRef(Date.now());

  return useQuery({
    queryKey: ['photo-status', taskId],
    queryFn: () => api.get<TaskStatus>(`/photo/status/${taskId}`),
    enabled: Boolean(taskId),
    staleTime: 0,
    retry: retryPolicy,
    // A processing failure comes back as a 400, which the client turns into an
    // ApiError — so the query's error is the failure, and retryPolicy already
    // knows not to retry something the server meant.
    refetchInterval: (query) =>
      nextPoll(query.state.data?.state, Date.now() - startedAt.current, query.state.error),
  });
}

/**
 * Spend a credit and release the clean files.
 *
 * Idempotent per task on the server, so a retry after a dropped response
 * returns fresh links rather than charging twice. A 402 comes back carrying
 * the product catalogue, which is what opens the paywall.
 */
export function unlockPhoto(taskId: string): Promise<UnlockResult> {
  return api.post<UnlockResult>(`/photo/${taskId}/unlock`);
}
