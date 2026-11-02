import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, TextField, text } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Login ohne Passwort: E-Mail eingeben → Code aus der E-Mail eingeben.
 * Neue Kunden werden dabei automatisch registriert.
 */
export default function Login() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const normalizedEmail = email.trim().toLowerCase();

  async function sendCode() {
    if (!supabase) return;
    if (!EMAIL_RE.test(normalizedEmail)) {
      setError('Bitte eine gültige E-Mail-Adresse eingeben.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (err) {
      setError(friendlyError(err));
      return;
    }
    setInfo(`Wir haben dir einen Code an ${normalizedEmail} geschickt.`);
    setStep('code');
  }

  async function verifyCode() {
    if (!supabase) return;
    const token = code.replace(/\D/g, '');
    if (token.length < 6) {
      setError('Bitte den vollständigen Code eingeben.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token,
      type: 'email',
    });
    setBusy(false);
    if (err) setError(friendlyError(err));
    // Bei Erfolg wechselt das Layout automatisch zum nächsten Bildschirm.
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.xs }}>
            <Text style={text.title}>Willkommen</Text>
            <Text style={text.muted}>
              Sammle bei jedem Besuch einen Stempel. Beim 6. Besuch gibt es ein Extra, beim 12. einen
              Gratis-Haarschnitt.
            </Text>
          </View>

          {step === 'email' ? (
            <>
              <TextField
                label="E-Mail-Adresse"
                value={email}
                onChangeText={setEmail}
                placeholder="name@beispiel.de"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={sendCode}
              />
              <Button title="Code anfordern" onPress={sendCode} loading={busy} />
            </>
          ) : (
            <>
              {info && <Text style={text.body}>{info}</Text>}
              <TextField
                label="Code aus der E-Mail"
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={10}
                returnKeyType="done"
                onSubmitEditing={verifyCode}
              />
              <Button title="Anmelden" onPress={verifyCode} loading={busy} />
              <Button title="Code erneut senden" variant="secondary" onPress={sendCode} disabled={busy} />
              <Button
                title="Andere E-Mail-Adresse"
                variant="secondary"
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setError(null);
                }}
                disabled={busy}
              />
            </>
          )}

          {error && <Text style={text.error}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
});
