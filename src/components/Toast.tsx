import { useEffect } from 'react';
import { Animated, StyleSheet, Text, useAnimatedValue } from 'react-native';

import { shadow, theme } from '../theme';

type Props = {
  message: string | null;
  onDismiss: () => void;
  /** Milliseconds on screen. The reference uses 2400. */
  duration?: number;
};

/**
 * The confirmation pill. Sits above the tab bar rather than at the bottom of
 * the screen, so it never covers the thing it is confirming.
 */
export function Toast({ message, onDismiss, duration = 2400 }: Props) {
  const opacity = useAnimatedValue(0);

  useEffect(() => {
    if (!message) return;

    Animated.timing(opacity, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(onDismiss);
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onDismiss, opacity]);

  if (!message) return null;

  return (
    <Animated.View
      style={[styles.pill, { opacity }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
    >
      <Text style={styles.tick}>✓</Text>
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.text,
    ...shadow.lifted,
  },
  tick: {
    width: 17,
    height: 17,
    lineHeight: 17,
    textAlign: 'center',
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: theme.color.success,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  message: { flex: 1, fontFamily: theme.type.body, fontSize: 13, color: '#FFFFFF' },
});
