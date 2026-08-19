import { creditLabel, flagEmoji, photoSize } from '../format';

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

describe('photoSize', () => {
  it('reads as the document states it', () => {
    expect(photoSize({ photo_width_mm: 35, photo_height_mm: 45 })).toBe('35×45 mm');
  });

  it('keeps the fraction when a document has one', () => {
    // 2×2 inch is 50.8 mm, and rounding it to 51 would misstate the spec.
    expect(photoSize({ photo_width_mm: 50.8, photo_height_mm: 50.8 })).toBe('50.8×50.8 mm');
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
