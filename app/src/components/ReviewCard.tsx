import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, text } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme';

type Props = {
  customerId: string;
  visitId: string;
  googleReviewUrl: string | null;
  /** Karte ausblenden (bewertet oder "Später") */
  onDone: () => void;
};

/**
 * Bewertungsanfrage nach einem Besuch. Gute Bewertungen (4–5 Sterne) werden
 * zu Google weitergeleitet. Es gibt bewusst KEINE Belohnung für Bewertungen
 * (Google-Richtlinien und Wettbewerbsrecht).
 */
export function ReviewCard({ customerId, visitId, googleReviewUrl, onDone }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [step, setStep] = useState<'rate' | 'google' | 'thanks'>('rate');
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!supabase || rating === 0) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('reviews')
      .insert({ customer_id: customerId, visit_id: visitId, rating, comment: comment.trim() || null })
      .select('id')
      .single();
    setBusy(false);
    if (err) {
      setError(friendlyError(err));
      return;
    }
    setReviewId(data.id);
    setStep(rating >= 4 && googleReviewUrl ? 'google' : 'thanks');
  }

  async function openGoogle() {
    if (!googleReviewUrl) return;
    await Linking.openURL(googleReviewUrl);
    if (supabase && reviewId) {
      await supabase.from('reviews').update({ forwarded_to_google: true }).eq('id', reviewId);
    }
    onDone();
  }

  if (step === 'google') {
    return (
      <Card style={{ borderColor: colors.accent }}>
        <Text style={text.heading}>Danke, das freut uns sehr!</Text>
        <Text style={text.body}>
          Würdest du das auch kurz auf Google teilen? Das hilft uns enorm, neue Kunden zu finden.
        </Text>
        <Button title="Auf Google bewerten" onPress={openGoogle} />
        <Button title="Nein danke" variant="secondary" onPress={onDone} />
      </Card>
    );
  }

  if (step === 'thanks') {
    return (
      <Card>
        <Text style={text.heading}>Danke für dein Feedback!</Text>
        <Text style={text.body}>
          {rating <= 3 ? 'Wir schauen uns das an und wollen es beim nächsten Mal besser machen.' : 'Bis zum nächsten Mal!'}
        </Text>
        <Button title="Schließen" variant="secondary" onPress={onDone} />
      </Card>
    );
  }

  return (
    <Card style={{ borderColor: colors.accent }}>
      <Text style={text.heading}>Wie war dein Besuch?</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => setRating(n)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${n} ${n === 1 ? 'Stern' : 'Sterne'}`}
          >
            <Text style={[styles.star, n <= rating && styles.starActive]}>★</Text>
          </Pressable>
        ))}
      </View>
      {rating > 0 && (
        <>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={rating <= 3 ? 'Was können wir besser machen? (optional)' : 'Möchtest du noch etwas sagen? (optional)'}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            style={styles.input}
          />
          <Button title="Bewertung senden" onPress={submit} loading={busy} />
        </>
      )}
      <Button title="Später" variant="secondary" onPress={onDone} disabled={busy} />
      {error && <Text style={text.error}>{error}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  star: { fontSize: 40, color: colors.border },
  starActive: { color: colors.accent },
  input: {
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
});
