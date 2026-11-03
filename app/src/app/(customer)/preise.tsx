import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { Loading, text } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Service } from '@/types/database';
import { colors, spacing } from '@/theme';

type Section = { title: string; data: Service[] };

/** Preisliste, gruppiert nach Kategorie in der vom Inhaber festgelegten Reihenfolge. */
export default function Preise() {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: err } = await supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .order('name');
    if (err) {
      setError(friendlyError(err));
      return;
    }
    const groups = new Map<string, Service[]>();
    for (const s of data) groups.set(s.category, [...(groups.get(s.category) ?? []), s]);
    setError(null);
    setSections([...groups].map(([title, items]) => ({ title, data: items })));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!sections && !error) return <Loading />;

  return (
    <SectionList
      sections={sections ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.accent}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListHeaderComponent={error ? <Text style={text.error}>{error}</Text> : undefined}
      ListEmptyComponent={!error ? <Text style={text.muted}>Noch keine Leistungen eingetragen.</Text> : undefined}
      renderSectionHeader={({ section }) => <Text style={styles.category}>{section.title}</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={text.body}>{item.name}</Text>
            {(item.description || item.duration_min) && (
              <Text style={text.muted}>
                {[item.description, item.duration_min ? `ca. ${item.duration_min} Min.` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            )}
          </View>
          <Text style={styles.price}>{formatPrice(item.price_cents, item.price_is_from)}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.xs },
  category: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  price: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
