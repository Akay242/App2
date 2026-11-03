import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { RewardItem } from '@/components/RewardItem';
import { StampCard } from '@/components/StampCard';
import { Card, Loading, text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Reward, SalonSettings } from '@/types/database';
import { colors, spacing } from '@/theme';

type Data = {
  settings: Pick<SalonSettings, 'small_reward_at' | 'small_reward_label' | 'free_cut_label'>;
  stamps: number;
  stampsPerCycle: number;
  totalVisits: number;
  rewards: Reward[];
};

/** Wie oft die Startseite im Vordergrund neu lädt, damit ein frischer Stempel sofort erscheint. */
const POLL_MS = 10_000;

export default function CustomerHome() {
  const { profile } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !profile) return;
    const now = new Date().toISOString();
    const [settings, progress, rewards] = await Promise.all([
      supabase
        .from('salon_settings')
        .select('small_reward_at, small_reward_label, free_cut_label')
        .single(),
      supabase.rpc('stamp_progress', { p_customer_id: profile.id }),
      supabase
        .from('rewards')
        .select('*')
        .eq('status', 'available')
        .or(`valid_until.is.null,valid_until.gt.${now}`)
        .order('earned_at'),
    ]);
    const err = settings.error ?? progress.error ?? rewards.error;
    if (err || !settings.data) {
      setError(friendlyError(err));
      return;
    }
    const p = progress.data?.[0];
    setError(null);
    setData({
      settings: settings.data,
      stamps: p?.stamps_in_cycle ?? 0,
      stampsPerCycle: p?.stamps_per_cycle ?? 12,
      totalVisits: p?.total_visits ?? 0,
      rewards: rewards.data ?? [],
    });
  }, [profile]);

  // Beim Öffnen laden und regelmäßig aktualisieren, solange der Bildschirm sichtbar ist.
  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(load, POLL_MS);
      return () => clearInterval(timer);
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!profile) return <Loading />;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={text.title}>Hallo {profile.first_name}!</Text>

      <Card style={styles.qrCard}>
        <View style={styles.qrBox}>
          <QRCode value={profile.qr_token} size={200} backgroundColor="#FFFFFF" color="#000000" />
        </View>
        <Text style={[text.muted, { textAlign: 'center' }]}>
          Zeig diesen Code bei jedem Besuch an der Kasse, um deinen Stempel zu bekommen.
        </Text>
      </Card>

      {error && <Text style={text.error}>{error}</Text>}

      {data ? (
        <>
          <StampCard
            stamps={data.stamps}
            stampsPerCycle={data.stampsPerCycle}
            smallRewardAt={data.settings.small_reward_at}
            smallRewardLabel={data.settings.small_reward_label}
            freeCutLabel={data.settings.free_cut_label}
          />

          <Card>
            <Text style={text.heading}>Meine Belohnungen</Text>
            {data.rewards.length === 0 ? (
              <Text style={text.muted}>Noch keine. Sammle weiter Stempel!</Text>
            ) : (
              <>
                {data.rewards.map((r) => (
                  <RewardItem key={r.id} reward={r} />
                ))}
                <Text style={text.muted}>Zum Einlösen einfach beim Besuch deinen QR-Code zeigen.</Text>
              </>
            )}
          </Card>

          <Text style={[text.muted, { textAlign: 'center' }]}>
            Besuche insgesamt: {data.totalVisits}
          </Text>
        </>
      ) : (
        !error && <Loading />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  qrCard: { alignItems: 'center' },
  // Weißer Rand ("Quiet Zone") ist für zuverlässiges Scannen nötig.
  qrBox: { backgroundColor: '#FFFFFF', padding: spacing.md, borderRadius: 12 },
});
