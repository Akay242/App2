import { ScrollView, Text } from 'react-native';

import { Card, text } from '@/components/ui';
import { spacing } from '@/theme';

/** Wird nur angezeigt, solange app/.env.local fehlt. */
export default function Setup() {
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Card>
        <Text style={text.heading}>Backend noch nicht verbunden</Text>
        <Text style={text.body}>
          Lege die Datei app/.env.local an und trage dort die Project URL und den Publishable Key
          aus Supabase ein (Vorlage: app/.env.example). Danach die App neu starten.
        </Text>
      </Card>
    </ScrollView>
  );
}
