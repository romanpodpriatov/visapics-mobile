/**
 * What happens to the photo, said before anything is collected.
 *
 * Guideline 5.1.1(i) asks for the explanation in plain language ahead of the
 * collection; this sheet is that explanation, and it is what an App Review
 * tester reads. Each of the three lines has to stay true of the build:
 * "no advertising SDKs and no third-party analytics" is a commitment, and
 * adding an attribution or crash SDK that sees a photo makes the App Privacy
 * questionnaire a false declaration.
 */
import { StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { Sheet } from './Sheet';
import { deletionLabel } from '../format';
import { display, eyebrow, theme } from '../theme';

type Props = {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  /** From /api/v1/config. The app holds no opinion about how long that is. */
  retentionHours?: number;
};

export function ConsentSheet({ visible, onAccept, onDecline, retentionHours }: Props) {
  const rows = [
    {
      title: 'Measured, not recognised',
      body: 'we compare distances against the document spec. No face recognition, no identification, no matching against anyone.',
    },
    {
      title: retentionHours
        ? `Deleted after ${deletionLabel(retentionHours)}`
        : 'Deleted automatically',
      body: 'unless you save it to your vault. You can erase everything at any time, with or without an account.',
    },
    {
      title: 'Never sold or shared',
      body: 'no advertising SDKs and no third-party analytics touch your photo.',
    },
  ];

  return (
    // Dismissing is declining: tapping away and the Android back gesture both
    // land on "Not now" rather than trapping someone in a dialog.
    <Sheet visible={visible} onClose={onDecline}>
      <Text style={styles.eyebrow}>◆ Before we start</Text>
      <Text style={styles.title}>How your photo is handled</Text>

      <View style={styles.rows}>
        {rows.map((row, index) => (
          <View key={row.title} style={styles.row}>
            <Text style={styles.number}>{index + 1}</Text>
            <Text style={styles.body}>
              <Text style={styles.rowTitle}>{row.title}</Text> — {row.body}
            </Text>
          </View>
        ))}
      </View>

      <Button label="I understand — continue" onPress={onAccept} style={styles.accept} />
      <Button label="Not now" variant="secondary" onPress={onDecline} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...eyebrow, marginBottom: 5 },
  title: { ...display(23), lineHeight: 26.5, marginBottom: 10 },
  rows: { gap: 10, marginBottom: theme.space.lg },
  row: { flexDirection: 'row', gap: 10 },
  number: {
    width: 16,
    height: 16,
    borderRadius: 9,
    backgroundColor: theme.color.brand,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 16,
    fontSize: 9,
    fontFamily: theme.type.bodySemiBold,
    marginTop: 2,
  },
  body: {
    flex: 1,
    fontFamily: theme.type.body,
    fontSize: 13,
    lineHeight: 20,
    color: theme.color.muted,
  },
  rowTitle: { fontFamily: theme.type.bodyMedium, color: theme.color.text },
  accept: { marginBottom: theme.space.sm },
});
