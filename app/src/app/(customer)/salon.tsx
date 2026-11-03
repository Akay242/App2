import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LegalLinks } from '@/components/LegalLinks';
import { Button, Card, Loading, text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { confirmAsync } from '@/lib/confirm';
import { friendlyError } from '@/lib/errors';
import { parseOpeningHours } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { SalonSettings } from '@/types/database';
import { spacing } from '@/theme';

type Info = Pick<SalonSettings, 'name' | 'address' | 'phone' | 'opening_hours'>;

/** Salon-Infos: Adresse mit Kartenlink, Anruf-Button, Öffnungszeiten. */
export default function Salon() {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { signOut } = useAuth();

  useFocusEffect(
    useCallback(() => {
      if (!supabase) return;
      supabase
        .from('salon_settings')
        .select('name, address, phone, opening_hours')
        .single()
        .then(({ data, error: err }) => {
          if (err) setError(friendlyError(err));
          else setInfo(data);
        });
    }, []),
  );

  if (error) return <Text style={[text.error, { padding: spacing.lg }]}>{error}</Text>;
  if (!info) return <Loading />;

  const hours = parseOpeningHours(info.opening_hours);

  async function deleteAccount() {
    if (!supabase) return;
    const ok = await confirmAsync(
      'Konto wirklich löschen?',
      'Dein Konto, alle Stempel, Belohnungen und Bewertungen werden sofort und endgültig gelöscht. Das kann nicht rückgängig gemacht werden.',
      'Endgültig löschen',
    );
    if (!ok) return;
    setDeleting(true);
    setDeleteError(null);
    const { error: err } = await supabase.rpc('delete_my_account');
    if (err) {
      setDeleting(false);
      setDeleteError(friendlyError(err));
      return;
    }
    // Konto existiert nicht mehr: nur lokal abmelden (der Server kennt den Nutzer nicht mehr).
    await supabase.auth.signOut({ scope: 'local' });
  }

  function openMaps() {
    const q = encodeURIComponent(info!.address ?? '');
    void Linking.openURL(
      Platform.OS === 'ios' ? `http://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`,
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={text.title}>{info.name}</Text>

      {info.phone && (
        <Button
          title={`Anrufen: ${info.phone}`}
          onPress={() => Linking.openURL(`tel:${info.phone!.replace(/[^\d+]/g, '')}`)}
        />
      )}

      {info.address && (
        <Card>
          <Text style={text.heading}>Adresse</Text>
          <Text style={text.body}>{info.address}</Text>
          <Button title="In Karten öffnen" variant="secondary" onPress={openMaps} />
        </Card>
      )}

      {hours.length > 0 && (
        <Card>
          <Text style={text.heading}>Öffnungszeiten</Text>
          {hours.map((row, i) => (
            <View key={i} style={styles.hoursRow}>
              <Text style={text.body}>{row.label}</Text>
              <Text style={text.body}>{row.hours}</Text>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <Text style={text.heading}>Mein Konto</Text>
        <Button title="Abmelden" variant="secondary" onPress={signOut} disabled={deleting} />
        <Button title="Konto löschen" variant="secondary" onPress={deleteAccount} loading={deleting} />
        {deleteError && <Text style={text.error}>{deleteError}</Text>}
      </Card>

      <LegalLinks />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
});
