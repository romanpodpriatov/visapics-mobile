/**
 * Turning server values into the strings the screens show.
 *
 * Kept out of the components so the wording can be tested without a render,
 * and so the same document reads identically wherever it appears.
 */

import type { Coverage } from './api/types';

/**
 * "951 of 951 specs verified · 100%". The reference states 952 of 954 · 99.8%;
 * these are the counts /api/v1/config actually reports.
 */
export function verifiedLine(coverage: Coverage): string {
  const share = (coverage.with_official_source / coverage.specifications) * 100;
  return `${coverage.with_official_source} of ${coverage.specifications} specs verified · ${Number(share.toFixed(1))}%`;
}

/** 🇬🇧 for "gb". Empty for anything that is not a two-letter code. */
export function flagEmoji(countryCode: string): string {
  if (!/^[a-zA-Z]{2}$/.test(countryCode)) return '';
  const base = 0x1f1e6 - 'A'.charCodeAt(0);
  return countryCode
    .toUpperCase()
    .split('')
    .map((letter) => String.fromCodePoint(letter.charCodeAt(0) + base))
    .join('');
}

/**
 * "35×45 mm". The fraction stays when there is one: 2×2 inch is 50.8 mm, and
 * a document that states 50.8 has not been satisfied by 51.
 */
export function photoSize(spec: { photo_width_mm: number; photo_height_mm: number }): string {
  const trim = (n: number) => String(Number(n.toFixed(2)));
  return `${trim(spec.photo_width_mm)}×${trim(spec.photo_height_mm)} mm`;
}

/** What the pill by the wordmark says. */
export function creditLabel(credits: number | undefined): string {
  if (!credits) return 'Guest';
  return credits === 1 ? '1 credit' : `${credits} credits`;
}
