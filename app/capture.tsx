/** The live capture screen is built in Task 6. */
import { StyleSheet, Text, View } from 'react-native';

import { display, theme } from '../src/theme';

export default function Capture() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Camera</Text>
      <Text style={styles.body}>Live coaching runs here.</Text>
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
    backgroundColor: theme.color.night,
  },
  title: { ...display(24), color: '#FFFFFF', textAlign: 'center' },
  body: {
    fontFamily: theme.type.body,
    fontSize: 14,
    color: 'rgba(255,255,255,.6)',
    textAlign: 'center',
  },
});
