import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { shadow, theme } from '../theme';

type Props = {
  children: ReactNode;
  /** Removes the inner padding, for cards whose rows manage their own. */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The white panel every screen is built from: 1pt border, 16pt radius, the
 * site's --shadow-card. `flush` is for list-shaped cards, where each row draws
 * its own padding and its own hairline.
 */
export function Card({ children, flush = false, style }: Props) {
  return (
    <View style={[styles.card, !flush && styles.padded, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.color.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  padded: { padding: theme.space.lg },
});
