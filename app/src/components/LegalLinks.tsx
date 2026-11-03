import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

/** Links zu Impressum und Datenschutz (auf jeder Seite ohne Login erreichbar). */
export function LegalLinks() {
  return (
    <View style={styles.row}>
      <Link href="/impressum" style={styles.link}>
        Impressum
      </Link>
      <Text style={styles.link}>·</Text>
      <Link href="/datenschutz" style={styles.link}>
        Datenschutz
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  link: { color: colors.textMuted, fontSize: 14 },
});
