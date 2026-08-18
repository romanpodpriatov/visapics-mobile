import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

type Props = {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
};

/**
 * The switch rows on the home screen: 36×20 track, 16pt knob, 2pt inset,
 * exactly as the reference draws them.
 *
 * The whole row is the target rather than the switch alone — a 20pt track is
 * well under the 44pt minimum, and hitting a switch precisely is annoying on
 * a phone even when it is legal.
 */
export function Toggle({ value, onChange, label, hint, disabled = false }: Props) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={[styles.row, disabled && styles.disabled]}
    >
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: theme.minTouchTarget,
  },
  disabled: { opacity: 0.45 },
  track: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.color.borderStrong,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: theme.color.brand },
  knob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginLeft: 2,
    shadowColor: theme.color.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  knobOn: { marginLeft: 18 },
  text: { flex: 1, minWidth: 0 },
  label: {
    fontFamily: theme.type.body,
    fontSize: 13.5,
    fontWeight: '500',
    color: theme.color.text,
  },
  hint: {
    fontFamily: theme.type.body,
    fontSize: 11.5,
    color: theme.color.muted,
    marginTop: 1,
  },
});
