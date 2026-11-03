import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { PushPrompt } from '@/components/PushPrompt';
import { ReviewCard } from '@/components/ReviewCard';
import { RewardItem } from '@/components/RewardItem';
import { StampCard } from '@/components/StampCard';
import { Card, Loading, text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Reward, SalonSettings } from '@/types/database';
import { colors, spacing } from '@/theme';

type Data = {
  settings: Pick<
    SalonSettings,
    'small_reward_at' | 'small_reward_label' | 'free_cut_label' | 'google_review_url'
  >;
  /** Letzter Besuch der letzten 7 Tage, der noch nicht bewertet wurde */
  reviewVisitId: string | null;
  stamps: number;
  stampsPerCycle: number;
  totalVisits: number;
  rewards: Reward[];
};

/** Wie oft die Startseite im Vordergrund neu lädt, damit ein frischer Stempel sofort erscheint. */
const POLL_MS = 10_000;

/** Bewertungsanfrage nur für Besuche der letzten 7 Tage. */
const REVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const dismissedKey = (visitId: string) => `review_dismissed_${visitId}`;

function isDismissed(visitId: string): boolean {
  try {
    return localStorage.getItem(dismissedKey(visitId)) === '1';
  } catch {
    return false;
  }
}

export default function CustomerHome() {
  const { profile } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !profile) return;
    const now = new Date().toISOString();
    const since = new Date(Date.now() - REVIEW_WINDOW_MS).toISOString();
    const [settings, progress, rewards, lastVisit] = await Promise.all([
      supabase
        .from('salon_settings')
        .select('small_reward_at, small_reward_label, free_cut_label, google_review_url')
        .single(),
      supabase.rpc('stamp_progress', { p_customer_id: profile.id }),
      supabase
        .from('rewards')
        .select('*')
        .eq('status', 'available')
        .or(`valid_until.is.null,valid_until.gt.${now}`)
        .order('earned_at'),
      supabase
        .from('visits')
        .select('id')
        .gt('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const err = settings.error ?? progress.error ?? rewards.error ?? lastVisit.error;
    if (err || !settings.data) {
      setError(friendlyError(err));
      return;
    }
    let reviewVisitId: string | null = null;
    if (lastVisit.data && !isDismissed(lastVisit.data.id)) {
      const { count } = await supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('visit_id', lastVisit.data.id);
      if (count === 0) reviewVisitId = lastVisit.data.id;
    }
    const p = progress.data?.[0];
    setError(null);
    setData({
      settings: settings.data,
      stamps: p?.stamps_in_cycle ?? 0,
      stampsPerCycle: p?.stamps_per_cycle ?? 12,
      totalVisits: p?.total_visits ?? 0,
      rewards: rewards.data ?? [],
      reviewVisitId,
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

      {data?.reviewVisitId && (
        <ReviewCard
          key={data.reviewVisitId}
          customerId={profile.id}
          visitId={data.reviewVisitId}
          googleReviewUrl={data.settings.google_review_url}
          onDone={() => {
            try {
              localStorage.setItem(dismissedKey(data.reviewVisitId!), '1');
            } catch {}
            setData({ ...data, reviewVisitId: null });
          }}
        />
      )}

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

          <PushPrompt userId={profile.id} />

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
