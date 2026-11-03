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
   1. alle Dateien aus `supabase/migrations/` **in der Reihenfolge ihrer Namen**
      (`20261102000000_initial_schema.sql`, `20261103000000_admin_overview.sql`,
      `20261104000000_marketing.sql`, …)
      Falls bei der dritten Datei ein Fehler zu `pg_cron` oder `pg_net` kommt: unter
      **Database → Extensions** die Erweiterungen `pg_cron` und `pg_net` einschalten und die Datei erneut ausführen.
   2. den Inhalt von `supabase/seed.sql` (Beispiel-Preisliste und Platzhalter-Adresse, optional)
5. **E-Mail-Vorlagen auf Code umstellen** (die App fragt einen 6-stelligen Code ab, keinen Link):
   Links **Authentication → Emails → Templates**, dann bei **Confirm signup** und bei **Magic link**
   jeweils Betreff `Dein Anmeldecode` und als Inhalt den Text aus
   `supabase/templates/confirmation.html` einfügen und speichern.
   Wichtig ist der Platzhalter `{{ .Token }}`, das ist der Code.
6. Unter **Project Settings → API** die **Project URL** und den
   **Publishable key** kopieren.
7. In `app/` die Datei `.env.example` nach `.env.local` kopieren und die beiden Werte eintragen.

### E-Mail-Versand für echte Kunden (vor dem Start, kostenlos)

Der eingebaute E-Mail-Versand von Supabase ist nur zum Testen gedacht. Er schickt nur
sehr wenige E-Mails pro Stunde und nur an Adressen von Mitgliedern deines Supabase-Teams.
Vor dem Start mit echten Kunden brauchen wir einen eigenen Versand.

**Ohne eigene Domain: Gmail (kostenlos, bis ca. 500 E-Mails pro Tag)**

1. Ein Gmail-Konto für den Salon anlegen (z. B. `barbershop.akay@gmail.com`),
   damit die Codes nicht von deiner privaten Adresse kommen.
2. In diesem Konto die **Bestätigung in zwei Schritten** einschalten
   (Google-Konto → Sicherheit).
3. Unter <https://myaccount.google.com/apppasswords> ein **App-Passwort** erzeugen
   (Name z. B. „Supabase“). Es ist 16 Zeichen lang.
4. In Supabase: **Authentication → Emails → SMTP Settings**, „Enable custom SMTP“:
   - Host: `smtp.gmail.com`, Port: `587`
   - Benutzername: die Gmail-Adresse
   - Passwort: das App-Passwort
   - Absender-Adresse: die Gmail-Adresse, Absender-Name: Name des Salons
5. Unter **Authentication → Rate Limits** das Limit für E-Mails z. B. auf 100 pro Stunde setzen.

Das App-Passwort gibst du nur in Supabase ein, nirgendwo sonst (auch nicht im Chat).

**Später mit eigener Domain:** Eine `.de`-Domain kostet ca. 5–15 € pro Jahr. Damit wirken die
E-Mails professioneller (`info@dein-salon.de`), und ein Dienst wie Resend
(kostenlos bis 3.000 E-Mails pro Monat) kann sie verschicken.

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

## 5. Web-Dashboard veröffentlichen (kostenlos, ab Phase 3)

1. Auf <https://vercel.com> mit deinem GitHub-Konto anmelden.
2. **Add New → Project**, das Repository `App2` auswählen.
3. **Root Directory**: `dashboard` (Framework wird automatisch als Next.js erkannt).
4. Unter **Environment Variables** eintragen:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL aus Supabase
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = Publishable key aus Supabase
5. **Deploy**. Danach ist das Dashboard unter einer Adresse wie `app2-xyz.vercel.app` erreichbar.
6. Anmelden kann sich nur, wer in der App registriert ist **und** Admin ist (siehe oben).

## 6. Google-Bewertungslink (für die Bewertungsanfrage)

In deinem **Google Unternehmensprofil** (Google Maps / Google Suche → dein Salon →
„Rezensionen erhalten“ bzw. „Bewertungslink teilen“) den Link kopieren und im Dashboard unter
**Einstellungen → Link zu Google-Bewertungen** eintragen. Ohne Link fragt die App trotzdem nach
einer Bewertung, leitet aber nicht zu Google weiter.

## 7. Push-Nachrichten auf dem iPhone

Damit Push-Nachrichten auf iPhones ankommen, braucht Expo Zugang zu Apples Push-Dienst.
Das richtet Expo beim ersten iOS-Build automatisch ein, dafür ist das **Apple Developer
Program** nötig (Schritt 4). Für Android ist später ein kostenloser Firebase-Schlüssel nötig;
das erledigen wir vor dem Android-Build.

## 8. Später (Phase 5)

- Link zu den Google-Bewertungen des Salons (Google Unternehmensprofil →
  „Rezensionen erhalten“).
- Impressum und Datenschutzerklärung, z. B. über den kostenlosen Generator von e-recht24.
