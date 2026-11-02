import { useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { Button, TextField, text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { spacing } from '@/theme';

/** Einmalig nach der ersten Anmeldung: Namen abfragen, damit der Salon den Kunden erkennt. */
export default function NameScreen() {
  const { session, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!supabase || !session) return;
    if (!firstName.trim()) {
      setError('Bitte gib deinen Vornamen ein.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from('profiles')
      .update({ first_name: firstName.trim(), last_name: lastName.trim() || null })
      .eq('id', session.user.id);
    if (err) {
      setBusy(false);
      setError(friendlyError(err));
      return;
    }
    await refreshProfile();
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
      <Text style={text.body}>Wie heißt du? So erkennt dich der Salon beim Scannen.</Text>
      <TextField
        label="Vorname"
        value={firstName}
        onChangeText={setFirstName}
        autoComplete="given-name"
        textContentType="givenName"
      />
      <TextField
        label="Nachname (optional)"
        value={lastName}
        onChangeText={setLastName}
        autoComplete="family-name"
        textContentType="familyName"
      />
      <Button title="Weiter" onPress={save} loading={busy} />
      {error && <Text style={text.error}>{error}</Text>}
    </ScrollView>
  );
}
