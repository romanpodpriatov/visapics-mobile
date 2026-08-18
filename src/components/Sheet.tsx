import { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { shadow, theme } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Fraction of the screen the sheet may grow to. The reference uses 0.82. */
  maxHeight?: number;
  /** A dialog the user must answer cannot be dismissed by tapping away. */
  dismissible?: boolean;
};

/**
 * The bottom sheet the paywall, consent and picker screens are built from:
 * 22pt top corners, a grab handle, a dim backdrop.
 *
 * Uses Modal rather than an absolutely-positioned view so the system back
 * gesture on Android closes it — a sheet that swallows Back is a bug report.
 */
export function Sheet({
  visible,
  onClose,
  children,
  maxHeight = 0.82,
  dismissible = true,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={dismissible ? onClose : undefined}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={dismissible ? onClose : undefined}
          accessibilityLabel={dismissible ? 'Close' : undefined}
          accessibilityRole={dismissible ? 'button' : undefined}
        />
        <View style={[styles.sheet, { maxHeight: `${maxHeight * 100}%` }]}>
          <View style={styles.handle} />
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    // Written out rather than spreading StyleSheet.absoluteFillObject, which
    // React Native 0.86 no longer types.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.48)',
  },
  sheet: {
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    ...shadow.lifted,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.color.borderStrong,
    alignSelf: 'center',
    marginBottom: 16,
  },
  content: { paddingHorizontal: theme.space.xl, paddingBottom: 30 },
});
