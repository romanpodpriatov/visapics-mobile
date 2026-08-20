import type { Specification } from '../api/types';
import {
  buildRules,
  formatSpecDate,
  buildSpecRows,
  creditLabel,
  flagEmoji,
  formatDimensions,
  formatHeadHeight,
} from '../format';

describe('flagEmoji', () => {
  it('turns a country code into its flag', () => {
    expect(flagEmoji('gb')).toBe('🇬🇧');
    expect(flagEmoji('US')).toBe('🇺🇸');
  });

  it('handles the EU, which the catalogue lists as a country', () => {
    expect(flagEmoji('eu')).toBe('🇪🇺');
  });

  it('gives back nothing for a code it cannot read', () => {
    expect(flagEmoji('')).toBe('');
    expect(flagEmoji('gbr')).toBe('');
  });
});

describe('formatDimensions', () => {
  it('reads as the document states it', () => {
    expect(formatDimensions({ photo_width_mm: 35, photo_height_mm: 45 })).toBe('35×45 mm');
  });

  it('keeps the fraction when a document has one', () => {
    // 2×2 inch is 50.8 mm, and rounding it to 51 would misstate the spec.
    expect(formatDimensions({ photo_width_mm: 50.8, photo_height_mm: 63.5 })).toBe(
      '50.8×63.5 mm',
    );
  });
});

describe('formatHeadHeight', () => {
  const spec = (over: Partial<Parameters<typeof formatHeadHeight>[0]>) =>
    formatHeadHeight({
      head_height_min_mm: null,
      head_height_max_mm: null,
      head_height_min_percent: null,
      head_height_max_percent: null,
      photo_height_mm: 45,
      ...over,
    });

  it('prefers millimetres when the spec has them', () => {
    expect(spec({ head_height_min_mm: 29, head_height_max_mm: 34 })).toBe('29–34 mm');
  });

  it('derives millimetres from the percentage when there are none', () => {
    // 426 of the 951 specifications are in this shape. An empty measurement
    // on four hundred documents is the failure this exists to prevent.
    expect(spec({ head_height_min_percent: 0.6, head_height_max_percent: 0.7 })).toBe(
      '27–32 mm',
    );
  });

  it('says so plainly when a spec states no head height', () => {
    expect(spec({})).toBe('not specified');
  });

  it('handles a one-sided bound', () => {
    expect(spec({ head_height_min_mm: 29 })).toBe('at least 29 mm');
    expect(spec({ head_height_max_mm: 34 })).toBe('at most 34 mm');
  });
});

describe('creditLabel', () => {
  it('says Guest when there is nothing to spend', () => {
    expect(creditLabel(undefined)).toBe('Guest');
    expect(creditLabel(0)).toBe('Guest');
  });

  it('counts credits, and counts one of them singly', () => {
    expect(creditLabel(1)).toBe('1 credit');
    expect(creditLabel(5)).toBe('5 credits');
  });
});

const specification = (over: Partial<Specification['requirements']> = {}): Specification => ({
  id: 1,
  country_code: 'gb',
  country_name: 'United Kingdom',
  document_type: 'UK Passport 35x45 mm',
  dimensions: { width_mm: 35, height_mm: 45, dpi: 600 },
  requirements: {
    background_color: 'light_grey',
    head_height_min_percent: null,
    head_height_max_percent: null,
    head_height_min_mm: 29,
    head_height_max_mm: 34,
    eyes_position_from_bottom_mm: null,
    eyes_position_max_from_bottom_mm: null,
    file_size_min_kb: null,
    file_size_max_kb: null,
    neutral_expression_required: true,
    glasses_allowed: 'no',
    ...over,
  },
  official_source: ['https://www.gov.uk/photos-for-passports'],
  spec_updated_at: '2025-07-07T03:36:24.318790',
  is_reviewed: true,
  notes: null,
});

describe('buildSpecRows', () => {
  const valueOf = (rows: { label: string; value: string }[], label: string) =>
    rows.find((r) => r.label === label)?.value;

  it('always states the size, the head height and the resolution', () => {
    const rows = buildSpecRows(specification());
    expect(valueOf(rows, 'Photo size')).toBe('35×45 mm');
    expect(valueOf(rows, 'Head height')).toBe('29–34 mm');
    expect(valueOf(rows, 'Resolution')).toBe('600 dpi');
  });

  it('leaves out a measurement the document does not state', () => {
    const rows = buildSpecRows(specification());
    expect(valueOf(rows, 'Eye line from bottom')).toBeUndefined();
    expect(valueOf(rows, 'File size')).toBeUndefined();
  });

  it('states the ones it does', () => {
    const rows = buildSpecRows(
      specification({
        eyes_position_from_bottom_mm: 28.575,
        eyes_position_max_from_bottom_mm: 34.925,
        file_size_max_kb: 240,
      }),
    );
    expect(valueOf(rows, 'Eye line from bottom')).toBe('28.6–34.9 mm');
    expect(valueOf(rows, 'File size')).toBe('up to 240 KB');
  });

  it('reads a background colour the way a person would', () => {
    expect(valueOf(buildSpecRows(specification()), 'Background')).toBe('Light grey');
  });
});

describe('buildRules', () => {
  const labels = (spec: Specification) => buildRules(spec).map((r) => r.label);

  it('states the glasses rule the document actually carries', () => {
    const banned = buildRules(specification({ glasses_allowed: 'no' }))[0];
    expect(banned.label).toBe('Glasses');
    expect(banned.allowed).toBe(false);

    const allowed = buildRules(specification({ glasses_allowed: 'yes' })).find(
      (r) => r.label === 'Glasses',
    );
    expect(allowed?.allowed).toBe(true);
  });

  it('leaves the glasses rule out when the document says nothing about them', () => {
    expect(labels(specification({ glasses_allowed: null }))).not.toContain('Glasses');
  });

  it('does not invent the rules the mock hardcoded', () => {
    // "Head covering", "Shoulders" and "Children under 6" are UK copy in the
    // design reference. Nothing in the catalogue states them.
    const shown = labels(specification());
    expect(shown).not.toContain('Head covering');
    expect(shown).not.toContain('Shoulders');
    expect(shown).not.toContain('Children under 6');
  });

  it('passes on what a document adds in its own words', () => {
    const spec = { ...specification(), notes: 'Head width: 15-22 mm.' };
    expect(buildRules(spec).some((r) => r.body === 'Head width: 15-22 mm.')).toBe(true);
  });

  it('ignores a note that is the word None', () => {
    // One row in the catalogue holds the literal string "None".
    const spec = { ...specification(), notes: 'None' };
    expect(buildRules(spec).some((r) => r.body === 'None')).toBe(false);
  });
});

describe('formatSpecDate', () => {
  it('reads as a date a person would write', () => {
    expect(formatSpecDate('2025-07-07T03:36:24.318790')).toBe('7 Jul 2025');
  });

  it('gives back nothing when the server has no date', () => {
    expect(formatSpecDate(null)).toBeNull();
  });
});
