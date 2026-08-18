/**
 * The app and the website must read as one product, so these values are not a
 * separate palette — they are the same tokens, copied from
 * static/css/design-tokens.css in the visapics repository. A drift here shows
 * up as an app that looks almost, but not quite, like the site it belongs to.
 */
import { shadow, theme } from '../theme';

describe('colour tokens', () => {
  it('matches the website surfaces and ink', () => {
    expect(theme.color.surface).toBe('#FAFAF5');
    expect(theme.color.card).toBe('#FFFFFF');
    expect(theme.color.text).toBe('#0F172A');
    expect(theme.color.muted).toBe('#475569');
    expect(theme.color.faint).toBe('#94A3B8');
  });

  it('matches the website borders', () => {
    expect(theme.color.border).toBe('#E7E5E0');
    expect(theme.color.borderStrong).toBe('#CBD5E1');
  });

  it('matches the website brand', () => {
    expect(theme.color.brand).toBe('#1E3A8A');
    expect(theme.color.brandHover).toBe('#1E40AF');
    expect(theme.color.brandSoft).toBe('#EFF3FB');
  });

  it('matches the website semantic colours', () => {
    expect(theme.color.success).toBe('#047857');
    expect(theme.color.warning).toBe('#B45309');
    expect(theme.color.danger).toBe('#B91C1C');
    expect(theme.color.dangerHover).toBe('#991B1B');
    expect(theme.color.accent).toBe('#C2410C');
  });
});

describe('radii', () => {
  it('matches the website scale', () => {
    expect(theme.radius.sm).toBe(6);
    expect(theme.radius.md).toBe(12);
    expect(theme.radius.lg).toBe(20);
  });

  it('carries the card radius the screens are drawn at', () => {
    // The design reference draws cards at 16, between the site's md and lg.
    expect(theme.radius.card).toBe(16);
  });
});

describe('type', () => {
  it('names the three families the site loads', () => {
    // React Native resolves fontFamily against a registered face, not a CSS
    // family, and it will not interpolate a variable font — so each weight is
    // its own static instance and its own name.
    expect(theme.type.display).toBe('Fraunces-Regular');
    expect(theme.type.body).toBe('Inter-Regular');
    expect(theme.type.mono).toBe('JetBrainsMono-Regular');
  });

  it('carries a bold face for headings, since fontWeight cannot supply one', () => {
    expect(theme.type.displayBold).toBe('Fraunces-Bold');
    expect(theme.type.bodyMedium).toBe('Inter-Medium');
  });
});

describe('shadow', () => {
  it('gives iOS and Android their own mechanism', () => {
    // React Native has no box-shadow: iOS reads shadowOpacity/Radius/Offset,
    // Android reads elevation. A style with only one of them is invisible on
    // the other platform.
    for (const name of ['subtle', 'card', 'lifted'] as const) {
      expect(shadow[name].shadowColor).toBe('#0F172A');
      expect(typeof shadow[name].shadowOpacity).toBe('number');
      expect(typeof shadow[name].elevation).toBe('number');
    }
  });

  it('increases with prominence', () => {
    expect(shadow.card.elevation).toBeGreaterThan(shadow.subtle.elevation);
    expect(shadow.lifted.elevation).toBeGreaterThan(shadow.card.elevation);
  });
});

describe('touch targets', () => {
  it('states the minimum Apple requires', () => {
    // The reference draws 34pt back buttons; anything below this needs hitSlop.
    expect(theme.minTouchTarget).toBe(44);
  });
});
