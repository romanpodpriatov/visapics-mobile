import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { eyebrow } from '../theme';

/**
 * The small monospace label above nearly every heading in the reference. The
 * lozenge is part of the mark, so it lives here rather than in every caller.
 */
export function Eyebrow({
  children,
  lozenge = true,
  style,
}: {
  children: string;
  lozenge?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[styles.text, style]} accessibilityRole="header">
      {lozenge ? '◆ ' : ''}
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({ text: eyebrow });
