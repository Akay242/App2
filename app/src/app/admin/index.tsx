import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Loading, text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admin: QR-Code des Kunden scannen und Besuch eintragen. */
export default function Scanner() {
  const { signOut } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  // Verhindert doppelte Auswertung, weil die Kamera denselben Code mehrfach pro Sekunde meldet.
  const locked = useRef(false);

  // Kamera nur aktiv, solange dieser Bildschirm sichtbar ist.
  useFocusEffect(
    useCallback(() => {
      locked.current = false;
      setActive(true);
      setError(null);
      return () => setActive(false);
    }, []),
  );

  async function onScanned({ data }: BarcodeScanningResult) {
    if (locked.current || !supabase) return;
    locked.current = true;

    const token = data.trim();
    if (!UUID_RE.test(token)) {
      setError(friendlyError('unknown_qr_code'));
      return;
    }

    setBusy(true);
    setError(null);
    const { data: result, error: err } = await supabase.rpc('record_visit', { p_qr_token: token });
    setBusy(false);
    if (err) {
      setError(friendlyError(err));
      return;
    }
    router.push({ pathname: '/admin/result', params: { data: JSON.stringify(result) } });
  }

  const header = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <Pressable onPress={signOut} hitSlop={12} accessibilityRole="button">
            <Text style={{ color: colors.textMuted }}>Abmelden</Text>
          </Pressable>
        ),
      }}
    />
  );

  if (!permission) return <Loading />;

  if (!permission.granted) {
    return (
      <View style={styles.padded}>
        {header}
        <Card>
          <Text style={text.heading}>Kamera-Zugriff nötig</Text>
          <Text style={text.body}>Zum Scannen der Kunden-QR-Codes braucht die App Zugriff auf die Kamera.</Text>
          <Button title="Kamera erlauben" onPress={requestPermission} />
        </Card>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {header}
      {active && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={busy || error ? undefined : onScanned}
        />
      )}
      <View style={styles.frame} pointerEvents="none" />

      <View style={styles.bottom}>
        {busy && (
          <Card style={styles.row}>
            <ActivityIndicator color={colors.accent} />
            <Text style={text.body}>Besuch wird eingetragen …</Text>
          </Card>
        )}
        {error && (
          <Card>
            <Text style={text.error}>{error}</Text>
            <Button
              title="Erneut scannen"
              onPress={() => {
                setError(null);
                locked.current = false;
              }}
            />
          </Card>
        )}
        {!busy && !error && (
          <Card>
            <Text style={[text.body, { textAlign: 'center' }]}>QR-Code des Kunden in den Rahmen halten</Text>
          </Card>
        )}
      </View>
    </View>
  );
}

const FRAME = 240;

const styles = StyleSheet.create({
  padded: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  frame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: FRAME,
    height: FRAME,
    marginLeft: -FRAME / 2,
    marginTop: -FRAME / 2 - 40,
    borderWidth: 3,
    borderColor: colors.accent,
    borderRadius: 24,
  },
  bottom: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
