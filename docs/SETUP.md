# Einrichtung – was der Inhaber erledigen muss

Diese Schritte kann nur der Inhaber selbst machen, weil sie eigene Konten und
Zahlungsdaten brauchen. Für Phase 2 reichen die Schritte 1 und 2. Die Store-Konten
(Schritte 3 und 4) werden erst in Phase 5 gebraucht, sollten aber **früh beantragt**
werden, weil die Prüfung dauern kann.

## 1. Supabase-Projekt (kostenlos)

1. Auf <https://supabase.com> registrieren und **New project** wählen.
2. Region **Central EU (Frankfurt)** wählen (Datenschutz, kurze Wege).
3. Ein sicheres Datenbank-Passwort vergeben und gut aufbewahren (nicht in die App!).
4. Im Projekt links **SQL Editor** öffnen und nacheinander ausführen:
   1. den Inhalt von `supabase/migrations/20261102000000_initial_schema.sql`
   2. den Inhalt von `supabase/seed.sql` (Beispiel-Preisliste, optional)
5. Unter **Project Settings → API** die **Project URL** und den
   **Publishable key** kopieren.
6. In `app/` die Datei `.env.example` nach `.env.local` kopieren und die beiden Werte eintragen.

### Sich selbst zum Admin machen

1. Einmal in der App registrieren (ab Phase 2 möglich).
2. Im Supabase **SQL Editor** ausführen (eigene E-Mail einsetzen):
   ```sql
   update public.profiles set role = 'admin' where email = 'deine@email.de';
   ```

## 2. Expo-Konto (kostenlos)

Auf <https://expo.dev/signup> registrieren. Damit werden später die App-Dateien
in der Cloud gebaut, ganz ohne Mac.

Zum Ausprobieren auf dem Handy: die App **Expo Go** installieren
(App Store / Google Play).

## 3. Google Play Console (einmalig 25 $)

<https://play.google.com/console/signup> – Kontotyp **Organisation**, wenn der Salon
als Firma auftreten soll. Für neue private Konten verlangt Google vor der Veröffentlichung
einen geschlossenen Test mit mehreren Testern über mindestens 14 Tage.
Ein Organisationskonto vermeidet diese Hürde.

## 4. Apple Developer Program (99 €/Jahr)

1. **D-U-N-S-Nummer** für den Salon kostenlos beantragen:
   <https://developer.apple.com/enroll/duns-lookup/> (dauert ca. 1–2 Wochen).
2. Danach unter <https://developer.apple.com/programs/enroll/> als **Organisation**
   anmelden. Im App Store steht dann der Salon-Name statt deines Privatnamens.

## 5. Später (Phase 4/5)

- Link zu den Google-Bewertungen des Salons (Google Unternehmensprofil →
  „Rezensionen erhalten“).
- Impressum und Datenschutzerklärung, z. B. über den kostenlosen Generator von e-recht24.
