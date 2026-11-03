import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Loading, text } from '@/components/ui';
import type { LegalSection } from '@/content/legal';
import { supabase } from '@/lib/supabase';
import type { SalonSettings } from '@/types/database';
import { spacing } from '@/theme';

type Info = Pick<
  SalonSettings,
  'name' | 'address' | 'phone' | 'imprint_owner' | 'imprint_email' | 'imprint_vat_id' | 'imprint_extra'
>;

/** Lädt die Salon-Angaben und rendert Impressum bzw. Datenschutzerklärung. */
export function LegalPage({ build }: { build: (info: Info) => LegalSection[] }) {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    supabase
      ?.from('salon_settings')
      .select('name, address, phone, imprint_owner, imprint_email, imprint_vat_id, imprint_extra')
      .single()
      .then(({ data }) => data && setInfo(data));
  }, []);

  if (!info) return <Loading />;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      {build(info).map((section) => (
        <View key={section.heading} style={{ gap: spacing.sm }}>
          <Text style={text.heading}>{section.heading}</Text>
          {section.paragraphs.map((p, i) => (
            <Text key={i} style={text.body}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
