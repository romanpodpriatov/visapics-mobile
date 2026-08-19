/** The print sheet is built in Task 10. */
import { StyleSheet, Text, View } from 'react-native';

import { display, theme } from '../../src/theme';

export default function Prints() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Prints</Text>
      <Text style={styles.body}>Print sheets you make appear here.</Text>
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
