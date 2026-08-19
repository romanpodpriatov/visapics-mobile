/**
 * The icon set, traced from the design reference rather than pulled from an
 * icon font: the reference draws its own 24×24 stroked glyphs, and a
 * lookalike from a library is the kind of small drift that adds up to an app
 * that does not feel like the product it belongs to.
 */
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { theme } from '../theme';

type Props = {
  size?: number;
  /** ColorValue rather than string: the tab bar hands its icons one. */
  color?: ColorValue;
  strokeWidth?: number;
};

const frame = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
});

const stroke = (color: ColorValue, strokeWidth: number) => ({
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function CameraIcon({ size = 21, color = theme.color.faint, strokeWidth = 1.8 }: Props) {
  return (
    <Svg {...frame(size)}>
      <Path
        {...stroke(color, strokeWidth)}
        d="M3 9a2 2 0 012-2h1.5l1.2-2h6.6l1.2 2H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
      />
      <Circle cx={12} cy={13} r={3.4} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function ImageIcon({ size = 21, color = theme.color.faint, strokeWidth = 1.8 }: Props) {
  return (
    <Svg {...frame(size)}>
      <Path
        {...stroke(color, strokeWidth)}
        d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </Svg>
  );
}

export function PrinterIcon({ size = 21, color = theme.color.faint, strokeWidth = 1.8 }: Props) {
  return (
    <Svg {...frame(size)}>
      <Path
        {...stroke(color, strokeWidth)}
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
      />
    </Svg>
  );
}

export function PersonIcon({ size = 21, color = theme.color.faint, strokeWidth = 1.8 }: Props) {
  return (
    <Svg {...frame(size)}>
      <Path {...stroke(color, strokeWidth)} d="M12 12a4 4 0 100-8 4 4 0 000 8zM5 20a7 7 0 0114 0" />
    </Svg>
  );
}

export function ChevronIcon({ size = 16, color = theme.color.faint, strokeWidth = 2 }: Props) {
  return (
    <Svg {...frame(size)}>
      <Path {...stroke(color, strokeWidth)} d="M9 6l6 6-6 6" />
    </Svg>
  );
}

export function ArrowRightIcon({ size = 16, color = '#FFFFFF', strokeWidth = 2 }: Props) {
  return (
    <Svg {...frame(size)}>
      <Path {...stroke(color, strokeWidth)} d="M13 7l5 5-5 5M18 12H6" />
    </Svg>
  );
}

export function InfoIcon({ size = 14, color = theme.color.brand, strokeWidth = 2 }: Props) {
  return (
    <Svg {...frame(size)}>
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={strokeWidth} />
      <Path {...stroke(color, strokeWidth)} d="M12 8h.01M11 12h1v4h1" />
    </Svg>
  );
}
