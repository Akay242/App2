import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme';

type Status =
  | { state: 'loading' }
  | { state: 'not_configured' }
  | { state: 'error'; message: string }
  | { state: 'ok'; salonName: string; serviceCount: number };

/**
 * Phase 1: Startbildschirm mit Verbindungstest zum Backend.
 * Wird in Phase 2 durch Login und Stempelkarte ersetzt.
 */
export default function Index() {
  const [status, setStatus] = useState<Status>(
    supabase ? { state: 'loading' } : { state: 'not_configured' },
  );

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const [settings, services] = await Promise.all([
        supabase.from('salon_settings').select('name').single(),
        supabase.from('services').select('id', { count: 'exact', head: true }),
      ]);
      if (settings.error || services.error) {
        setStatus({ state: 'error', message: (settings.error ?? services.error)!.message });
        return;
      }
      setStatus({
        state: 'ok',
        salonName: settings.data.name,
        serviceCount: services.count ?? 0,
      });
    })();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Salon Bonus' }} />
      <Text style={styles.title}>Salon Bonus</Text>
      <Text style={styles.subtitle}>Phase 1 · Grundgerüst</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Backend-Verbindung</Text>
        {status.state === 'loading' && <ActivityIndicator color={colors.accent} />}
        {status.state === 'not_configured' && (
          <Text style={styles.warning}>
            Noch nicht eingerichtet: app/.env.local mit den Supabase-Zugangsdaten anlegen (siehe
            .env.example).
          </Text>
        )}
        {status.state === 'error' && <Text style={styles.error}>Fehler: {status.message}</Text>}
        {status.state === 'ok' && (
          <>
            <Text style={styles.ok}>Verbunden</Text>
            <Text style={styles.text}>Salon: {status.salonName}</Text>
            <Text style={styles.text}>Leistungen in der Preisliste: {status.serviceCount}</Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  title: { color: colors.text, fontSize: 32, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 16 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  text: { color: colors.text, fontSize: 15 },
  ok: { color: colors.success, fontSize: 15, fontWeight: '600' },
  warning: { color: colors.accent, fontSize: 15 },
  error: { color: colors.danger, fontSize: 15 },
});
