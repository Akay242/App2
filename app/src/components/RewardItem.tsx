import { StyleSheet, Text, View } from 'react-native';

import { text } from '@/components/ui';
import type { Reward } from '@/types/database';
import { colors, spacing } from '@/theme';

const ICONS: Record<Reward['type'], string> = {
  small_extra: '★',
  free_cut: '✂',
  winback_discount: '%',
};

type Props = {
  reward: Pick<Reward, 'type' | 'label' | 'valid_until'>;
  /** Aktion unter der Beschreibung, z. B. der Einlösen-Button */
  right?: React.ReactNode;
};

export function RewardItem({ reward, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>{ICONS[reward.type]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={text.body}>{reward.label}</Text>
        {reward.valid_until && (
          <Text style={text.muted}>
            Gültig bis {new Date(reward.valid_until).toLocaleDateString('de-DE')}
          </Text>
        )}
        {right && <View style={styles.action}>{right}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: colors.accent, fontSize: 18, fontWeight: '700' },
});
