/**
 * One line of the server's compliance report.
 *
 * The measured value and the document's own tolerance sit side by side,
 * because "Head height 31.5 mm" means nothing without "29–34 mm" beside it.
 */
import { StyleSheet, Text, View } from 'react-native';

import type { ComplianceCheck } from '../api/types';
import { theme } from '../theme';

export function ComplianceRow({ check }: { check: ComplianceCheck }) {
  const failed = check.verdict === 'fail';

  return (
    <View style={styles.row}>
      <Text style={[styles.glyph, failed ? styles.glyphFail : styles.glyphPass]}>
        {failed ? '✕' : '✓'}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {check.label}
      </Text>
      <Text style={[styles.value, failed && styles.valueFail]}>
        {failed
          ? `${check.measured_display} / ${check.requirement_display}`
          : check.measured_display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.hairline,
  },
  glyph: {
    width: 16,
    height: 16,
    borderRadius: 9,
    textAlign: 'center',
    lineHeight: 16,
    fontSize: 9,
    color: '#FFFFFF',
    fontFamily: theme.type.bodySemiBold,
    overflow: 'hidden',
  },
  glyphPass: { backgroundColor: theme.color.success },
  glyphFail: { backgroundColor: theme.color.danger },
  label: { flex: 1, fontFamily: theme.type.body, fontSize: 13.5, color: theme.color.text },
  value: {
    fontFamily: theme.type.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    color: theme.color.muted,
  },
  valueFail: { color: theme.color.danger },
});
