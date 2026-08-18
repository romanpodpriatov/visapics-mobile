import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { theme } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: ReactNode;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Screen-reader label, when the visible one is not enough on its own. */
  accessibilityLabel?: string;
};

/**
 * The three button shapes the design reference uses, at the sizes it draws
 * them: primary 52pt, secondary 46pt, ghost 40pt with a dashed border.
 *
 * Every variant clears Apple's 44pt minimum on its own except ghost, which is
 * only ever a tertiary action ("try it with a sample photo") and gets hitSlop.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  busy = false,
  style,
  accessibilityLabel,
}: Props) {
  const inert = disabled || busy;

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy }}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={variant === 'ghost' ? 2 : undefined}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !inert && pressedStyles[variant],
        inert && styles.inert,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : theme.color.brand} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  label: { fontFamily: theme.type.body, fontWeight: '500' },
  inert: { opacity: 0.45 },

  primary: { height: 52, backgroundColor: theme.color.brand },
  secondary: {
    height: 46,
    backgroundColor: theme.color.card,
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
  },
  ghost: {
    height: 40,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
    borderStyle: 'dashed',
  },
  danger: {
    height: 44,
    backgroundColor: theme.color.card,
    borderWidth: 1,
    borderColor: theme.color.danger,
  },
});

const pressedStyles = StyleSheet.create({
  primary: { backgroundColor: theme.color.brandHover },
  secondary: { backgroundColor: theme.color.brandSoft, borderColor: theme.color.brand },
  ghost: { borderColor: theme.color.brand },
  danger: { backgroundColor: theme.color.dangerWash },
});

const labelStyles = StyleSheet.create({
  primary: { color: '#FFFFFF', fontSize: 15.5 },
  secondary: { color: theme.color.text, fontSize: 14.5 },
  ghost: { color: theme.color.muted, fontSize: 13 },
  danger: { color: theme.color.danger, fontSize: 14 },
});
