import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { Button, Card, text } from '@/components/ui';
import { getPushPermission, registerForPush, type PushPermission } from '@/lib/push';

/**
 * Bittet um die Push-Erlaubnis, solange der Kunde noch nicht entschieden hat.
 * Ist sie schon erteilt, wird der Token still aktualisiert.
 */
export function PushPrompt({ userId }: { userId: string }) {
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPushPermission().then(async (status) => {
      if (status === 'granted') await registerForPush(userId, false).catch(() => undefined);
      if (!cancelled) setPermission(status);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (permission !== 'undetermined') return null;

  return (
    <Card>
      <Text style={text.heading}>Keine Gutscheine verpassen</Text>
      <Text style={text.body}>
        Erlaube Benachrichtigungen, dann sagen wir dir Bescheid, wenn du eine Belohnung oder einen Rabatt
        bekommst. Kein Spam, versprochen.
      </Text>
      <Button
        title="Benachrichtigungen erlauben"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          const status = await registerForPush(userId, true).catch(() => 'denied' as const);
          setBusy(false);
          setPermission(status);
        }}
      />
    </Card>
  );
}
