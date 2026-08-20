/** Built in Task 13. */
import { StyleSheet, Text, View } from 'react-native';

import { display, theme } from '../src/theme';

export default function Billing() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Billing</Text>
      <Text style={styles.body}>Credits, purchases and receipts.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm,
    padding: theme.space.xxl,
    backgroundColor: theme.color.surface,
  },
  title: { ...display(24), textAlign: 'center' },
  body: {
    fontFamily: theme.type.body,
    fontSize: 14,
    color: theme.color.muted,
    textAlign: 'center',
  },
});
