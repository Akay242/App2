import { StyleSheet, Text, View } from 'react-native';

import { Card, text } from '@/components/ui';
import { colors, spacing } from '@/theme';

type Props = {
  /** Stempel auf der aktuellen Karte (0 .. stampsPerCycle - 1) */
  stamps: number;
  stampsPerCycle: number;
  smallRewardAt: number;
  smallRewardLabel: string;
  freeCutLabel: string;
};

/** Digitale Stempelkarte: zeigt gesammelte Stempel und die nächste Belohnung. */
export function StampCard({ stamps, stampsPerCycle, smallRewardAt, smallRewardLabel, freeCutLabel }: Props) {
  const slots = Array.from({ length: stampsPerCycle }, (_, i) => i + 1);
  const next =
    stamps < smallRewardAt
      ? { label: smallRewardLabel, remaining: smallRewardAt - stamps }
      : { label: freeCutLabel, remaining: stampsPerCycle - stamps };

  return (
    <Card>
      <View style={styles.header}>
        <Text style={text.heading}>Stempelkarte</Text>
        <Text style={styles.count}>
          {stamps} / {stampsPerCycle}
        </Text>
      </View>

      <View style={styles.grid} accessibilityLabel={`${stamps} von ${stampsPerCycle} Stempeln`}>
        {slots.map((slot) => {
          const filled = slot <= stamps;
          const isReward = slot === smallRewardAt || slot === stampsPerCycle;
          return (
            <View
              key={slot}
              style={[styles.slot, filled && styles.slotFilled, isReward && !filled && styles.slotReward]}
            >
              <Text style={[styles.slotText, filled && styles.slotTextFilled]}>
                {slot === stampsPerCycle ? '✂' : slot === smallRewardAt ? '★' : filled ? '✓' : slot}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={text.muted}>
        Noch {next.remaining} {next.remaining === 1 ? 'Besuch' : 'Besuche'} bis:{' '}
        <Text style={{ color: colors.accent }}>{next.label}</Text>
      </Text>
    </Card>
  );
}

const SLOT = 44;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  slot: {
    width: SLOT,
    height: SLOT,
    borderRadius: SLOT / 2,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotReward: { borderColor: colors.accent, borderStyle: 'dashed' },
  slotFilled: { backgroundColor: colors.accent, borderColor: colors.accent },
  slotText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  slotTextFilled: { color: colors.background },
});
