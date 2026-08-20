/** The pipeline screen is built in Task 8. */
import { StyleSheet, Text, View } from 'react-native';

import { display, theme } from '../src/theme';

export default function Processing() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Making your photo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.xxl,
    backgroundColor: theme.color.surface,
  },
  title: { ...display(24), textAlign: 'center' },
});
