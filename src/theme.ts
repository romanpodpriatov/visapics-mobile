/**
 * Design tokens.
 *
 * Copied from static/css/design-tokens.css in the visapics repository rather
 * than invented here: the app and the website are one product, and a palette
 * that drifts produces an app that looks almost — but not quite — like the
 * site it belongs to. src/__tests__/theme.test.ts pins the values.
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const theme = {
  color: {
    // Surfaces
    surface: '#FAFAF5',
    card: '#FFFFFF',

    // Ink
    text: '#0F172A',
    muted: '#475569',
    faint: '#94A3B8',

    // Borders
    border: '#E7E5E0',
    borderStrong: '#CBD5E1',
    hairline: '#F1EFEA',

    // Brand
    brand: '#1E3A8A',
    brandHover: '#1E40AF',
    brandSoft: '#EFF3FB',

    // Accent, used sparingly — it marks measurements on the spec diagram.
    accent: '#C2410C',

    // Semantic
    success: '#047857',
    warning: '#B45309',
    danger: '#B91C1C',
    dangerHover: '#991B1B',

    // Washes behind semantic states.
    warningWash: '#FFFBEB',
    warningBorder: '#FDE68A',
    dangerWash: '#FEF2F2',
    dangerBorder: '#FECACA',
    successWash: '#ECFDF5',

    // The camera screen is the one dark surface in the app.
    night: '#0B1120',
  },

  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 26 },

  radius: {
    sm: 6,
    md: 12,
    lg: 20,
    // The design reference draws cards at 16, between the site's md and lg.
    card: 16,
    pill: 999,
  },

  /**
   * Font faces, named per weight rather than family-plus-fontWeight.
   *
   * React Native does not interpolate a variable font — it renders the file's
   * default instance and fontWeight silently does nothing — so each weight is
   * a separate static instance cut from the same variable file the website
   * serves. Same type as the site, not a lookalike.
   */
  type: {
    display: 'Fraunces-Regular',
    displaySemiBold: 'Fraunces-SemiBold',
    displayBold: 'Fraunces-Bold',
    body: 'Inter-Regular',
    bodyMedium: 'Inter-Medium',
    bodySemiBold: 'Inter-SemiBold',
    mono: 'JetBrainsMono-Regular',
    monoMedium: 'JetBrainsMono-Medium',
  },

  /**
   * Apple's minimum touch target. The reference draws several controls at 34pt,
   * which need hitSlop to reach this — small targets draw review comments and
   * are the kind of thing that is cheap now and expensive after a rejection.
   */
  minTouchTarget: 44,
} as const;

/**
 * Elevation.
 *
 * React Native has no box-shadow. iOS reads shadowColor/Offset/Opacity/Radius,
 * Android reads elevation, and a style carrying only one of them is invisible
 * on the other platform — so every entry here sets both. The values are the
 * site's --shadow-* tokens translated.
 */
type Elevation = ViewStyle & {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  /** Required, not optional: a shadow without it is invisible on Android. */
  elevation: number;
};

export const shadow: Record<'subtle' | 'card' | 'lifted', Elevation> = {
  subtle: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  lifted: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
};

/**
 * The monospace eyebrow used above nearly every heading in the reference:
 * small, wide-tracked, uppercase, faint.
 */
export const eyebrow: TextStyle = {
  fontFamily: theme.type.mono,
  fontSize: 10,
  letterSpacing: 1.6,
  textTransform: 'uppercase',
  color: theme.color.faint,
};

/** Serif display type, used for headings only. */
export const display = (size: number): TextStyle => ({
  fontFamily: theme.type.display,
  fontSize: size,
  // The reference tightens tracking as the size grows; -0.025em at heading
  // sizes, which is roughly this in absolute terms.
  letterSpacing: size * -0.025,
  color: theme.color.text,
});

/**
 * hitSlop that lifts a control of the given size to the 44pt minimum.
 * Returns undefined when the control is already large enough.
 */
export const hitSlopTo44 = (drawnSize: number) => {
  const missing = theme.minTouchTarget - drawnSize;
  if (missing <= 0) return undefined;
  const pad = Math.ceil(missing / 2);
  return { top: pad, bottom: pad, left: pad, right: pad };
};

export const isIOS = Platform.OS === 'ios';

export type Theme = typeof theme;
