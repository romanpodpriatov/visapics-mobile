/**
 * Turning server values into the strings the screens show.
 *
 * Kept out of the components so the wording can be tested without a render,
 * and so the same document reads identically wherever it appears.
 */

import type { Coverage, Specification } from './api/types';

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

/** A millimetre value with no trailing zeros: 35, 50.8, 28.6. */
const mm = (value: number) => String(Number(value.toFixed(1)));

/**
 * "35×45 mm". The fraction stays when there is one: 2×2 inch is 50.8 mm, and
 * a document that states 50.8 has not been satisfied by 51.
 */
export function formatDimensions(spec: {
  photo_width_mm: number;
  photo_height_mm: number;
}): string {
  return `${mm(spec.photo_width_mm)}×${mm(spec.photo_height_mm)} mm`;
}

/** "29–34 mm", "35 mm", "at least 29 mm", "not specified". */
function formatBand(low: number | null, high: number | null): string {
  // Three documents state one share for both ends of the head height, and a
  // couple state one millimetre value. "35–35 mm" is a band of nothing.
  if (low !== null && high !== null && low === high) return `${mm(low)} mm`;
  if (low !== null && high !== null) return `${mm(low)}–${mm(high)} mm`;
  if (low !== null) return `at least ${mm(low)} mm`;
  if (high !== null) return `at most ${mm(high)} mm`;
  return 'not specified';
}

type HeadHeight = {
  head_height_min_mm: number | null;
  head_height_max_mm: number | null;
  head_height_min_percent: number | null;
  head_height_max_percent: number | null;
  photo_height_mm: number;
};

/**
 * Head height in millimetres, whichever way the document states it.
 *
 * Only 525 of the 951 specifications carry millimetres; 949 carry a share of
 * the photo height. Deriving the band from the share is what keeps the other
 * four hundred documents from rendering an empty measurement — the server
 * derives it the same way when it grades a photo.
 */
export function formatHeadHeight(spec: HeadHeight): string {
  let low = spec.head_height_min_mm;
  let high = spec.head_height_max_mm;

  if (low === null && high === null) {
    const { photo_height_mm: height } = spec;
    // toFixed first: 0.7 × 45 is 31.499999999999996 in binary floating point,
    // which rounds to 31 and states the band a millimetre tighter than the
    // document does. This is a reading of the rule, not a grading of a photo —
    // the server measures against the exact share.
    const derive = (share: number) => Math.round(Number((share * height).toFixed(6)));
    if (spec.head_height_min_percent !== null) low = derive(spec.head_height_min_percent);
    if (spec.head_height_max_percent !== null) high = derive(spec.head_height_max_percent);
  }

  return formatBand(low, high);
}

/** "Light grey" from "light_grey". */
function colourName(colour: string): string {
  const words = colour.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Free text a document adds for itself. Two of the 951 rows carry any, and one
 * of those two is the literal word "None" — which is a note about there being
 * no note, and has no business on screen.
 */
function meaningfulNotes(notes: string | null): string | null {
  const text = (notes ?? '').trim();
  if (!text || /^(none|n\/a|na)$/i.test(text)) return null;
  return text;
}

export type SpecRow = { label: string; value: string };

/**
 * The specification table. A measurement the document does not state is left
 * out rather than rendered as a blank or a zero.
 */
export function buildSpecRows(spec: Specification): SpecRow[] {
  const r = spec.requirements;
  const rows: SpecRow[] = [
    { label: 'Photo size', value: formatDimensions({
      photo_width_mm: spec.dimensions.width_mm,
      photo_height_mm: spec.dimensions.height_mm,
    }) },
    { label: 'Head height', value: formatHeadHeight({
      head_height_min_mm: r.head_height_min_mm,
      head_height_max_mm: r.head_height_max_mm,
      head_height_min_percent: r.head_height_min_percent,
      head_height_max_percent: r.head_height_max_percent,
      photo_height_mm: spec.dimensions.height_mm,
    }) },
  ];

  if (r.eyes_position_from_bottom_mm !== null || r.eyes_position_max_from_bottom_mm !== null) {
    rows.push({
      label: 'Eye line from bottom',
      value: formatBand(r.eyes_position_from_bottom_mm, r.eyes_position_max_from_bottom_mm),
    });
  }

  if (r.background_color) {
    rows.push({ label: 'Background', value: colourName(r.background_color) });
  }

  rows.push({ label: 'Resolution', value: `${spec.dimensions.dpi} dpi` });

  if (r.file_size_max_kb) {
    rows.push({ label: 'File size', value: `up to ${r.file_size_max_kb} KB` });
  }

  return rows;
}

export type Rule = { label: string; body: string; allowed: boolean };

const GLASSES: Record<string, Rule> = {
  no: {
    label: 'Glasses',
    body: 'Not allowed for this document, medically necessary or not.',
    allowed: false,
  },
  yes: {
    label: 'Glasses',
    body: 'Allowed, as long as the frames do not cover the eyes and there is no glare.',
    allowed: true,
  },
  if_no_glare: {
    label: 'Glasses',
    body: 'Allowed only when there is no glare on the lenses.',
    allowed: true,
  },
};

/**
 * The rules the document itself states.
 *
 * The design reference hardcodes six UK rules — head coverings, shoulders,
 * children under six — that nothing in the catalogue holds. A rule invented
 * for a screen about a government document is worse than a short list.
 */
export function buildRules(spec: Specification): Rule[] {
  const r = spec.requirements;
  const rules: Rule[] = [];

  const glasses = r.glasses_allowed ? GLASSES[r.glasses_allowed] : undefined;
  if (glasses) rules.push(glasses);

  if (r.neutral_expression_required) {
    rules.push({
      label: 'Expression',
      body: 'Neutral face, mouth closed, both eyes open and looking at the camera.',
      allowed: true,
    });
  }

  if (r.background_color) {
    rules.push({
      label: 'Background',
      body: `Plain ${colourName(r.background_color).toLowerCase()}, no pattern, no shadow and nobody else in the frame.`,
      allowed: true,
    });
  }

  const notes = meaningfulNotes(spec.notes);
  if (notes) rules.push({ label: 'Also required', body: notes, allowed: true });

  return rules;
}

/** What the pill by the wordmark says. */
export function creditLabel(credits: number | undefined): string {
  if (!credits) return 'Guest';
  return credits === 1 ? '1 credit' : `${credits} credits`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "7 Jul 2025" from an ISO timestamp.
 *
 * Read off the string rather than through Date: the backend sends microsecond
 * precision and no zone, which parses differently on different engines and can
 * shift the day either side of midnight. The day is the whole point here.
 */
export function formatSpecDate(iso: string | null): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!match) return null;
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

/**
 * Whole hours before the server deletes the file, floored so the card never
 * promises more time than there is. `retentionHours` comes from
 * /api/v1/config — the app does not hold an opinion about it.
 */
export function hoursLeft(startedAt: number, retentionHours: number, now: number): number {
  const elapsed = (now - startedAt) / (60 * 60 * 1000);
  return Math.max(0, Math.floor(retentionHours - elapsed));
}

/** "22 h" while that is meaningful, "6 days" once it stops being. */
export function deletionLabel(hours: number): string {
  if (hours >= 48) return `${Math.floor(hours / 24)} days`;
  return `${hours} h`;
}
