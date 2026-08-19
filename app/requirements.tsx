/** Built in Task 4. */
import { StyleSheet, Text, View } from 'react-native';

import { display, theme } from '../src/theme';

export default function Requirements() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Official rules</Text>
      <Text style={styles.body}>What this document requires, and where the rule comes from.</Text>
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
    lineHeight: 21,
    color: theme.color.muted,
    textAlign: 'center',
  },
});
