import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { RewardItem } from '@/components/RewardItem';
import { Button, Card, text } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { RecordVisitResult } from '@/types/database';
import { colors, spacing } from '@/theme';

/** Admin: Ergebnis nach dem Scan. Zeigt Stempelstand und erlaubt das Einlösen von Belohnungen. */
export default function ScanResult() {
  const params = useLocalSearchParams<{ data: string }>();
  const result = useMemo<RecordVisitResult | null>(() => {
    try {
      return JSON.parse(params.data) as RecordVisitResult;
    } catch {
      return null;
    }
  }, [params.data]);

  const [redeemed, setRedeemed] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!result) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={text.error}>Ergebnis konnte nicht gelesen werden.</Text>
        <Button title="Zurück zum Scanner" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  async function redeem(rewardId: string) {
    if (!supabase) return;
    setBusyId(rewardId);
    setError(null);
    const { error: err } = await supabase.rpc('redeem_reward', { p_reward_id: rewardId });
    setBusyId(null);
    if (err) {
      setError(friendlyError(err));
      return;
    }
    setRedeemed((prev) => new Set(prev).add(rewardId));
  }

  const cardFull = result.stamp_position === result.stamps_per_cycle;
  const newIds = new Set(result.new_rewards.map((r) => r.id));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={{ alignItems: 'center' }}>
        <Text style={styles.check}>✓</Text>
        <Text style={text.title}>{result.customer_name || 'Kunde'}</Text>
        <Text style={styles.stamp}>
          Stempel {result.stamp_position} von {result.stamps_per_cycle}
        </Text>
        <Text style={text.muted}>
          {cardFull ? 'Karte voll – nächster Besuch startet eine neue Karte.' : `Besuch Nr. ${result.total_visits}`}
        </Text>
      </Card>

      {result.new_rewards.length > 0 && (
        <Card style={{ borderColor: colors.accent }}>
          <Text style={text.heading}>Neue Belohnung freigeschaltet!</Text>
          {result.new_rewards.map((r) => (
            <RewardItem key={r.id} reward={{ ...r, valid_until: null }} />
          ))}
        </Card>
      )}

      <Card>
        <Text style={text.heading}>Einlösbare Belohnungen</Text>
        {result.available_rewards.length === 0 ? (
          <Text style={text.muted}>Keine.</Text>
        ) : (
          result.available_rewards.map((r) => (
            <RewardItem
              key={r.id}
              reward={r}
              right={
                redeemed.has(r.id) ? (
                  <Text style={text.success}>Eingelöst</Text>
                ) : (
                  <Button
                    title={newIds.has(r.id) ? 'Jetzt einlösen' : 'Einlösen'}
                    variant="secondary"
                    onPress={() => redeem(r.id)}
                    loading={busyId === r.id}
                  />
                )
              }
            />
          ))
        )}
        {error && <Text style={text.error}>{error}</Text>}
      </Card>

      <Button title="Nächster Kunde" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  check: { color: colors.success, fontSize: 48, fontWeight: '700' },
  stamp: { color: colors.accent, fontSize: 20, fontWeight: '700' },
});
