# Salon Bonus

Kunden-App für einen Herren-Friseursalon: digitale Stempelkarte per QR-Code,
Belohnungen, Rückhol-Gutscheine per Push, Preisliste und Google-Bewertungen.

- **Plan:** [docs/ENTWICKLUNGSPLAN.md](docs/ENTWICKLUNGSPLAN.md)
- **Einrichtung (Konten, Supabase):** [docs/SETUP.md](docs/SETUP.md)

## Projektstruktur

```
app/        Expo-App (iOS + Android), React Native + TypeScript
dashboard/  Web-Dashboard für den Inhaber (Next.js, statischer Export)
supabase/   Datenbankschema, Beispieldaten, Tests
docs/       Plan und Anleitungen
scripts/    Hilfsskripte (End-to-End-Test)
```

## App starten (Entwicklung)

```sh
cd app
npm install
cp .env.example .env.local   # Supabase-Werte eintragen
npm start                    # QR-Code mit Expo Go scannen
```

## Dashboard starten (Entwicklung)

```sh
cd dashboard
npm install
cp .env.example .env.local   # gleiche Supabase-Werte wie in der App
npm run dev                  # http://localhost:3000
```

Prüfen vor jedem Commit (in `app/` und `dashboard/`):

```sh
npm run typecheck
npm run lint
```

## Tests

**Datenbank (lokal, ohne Supabase):** siehe [supabase/README.md](supabase/README.md).

**Komplett mit lokalem Supabase (Docker nötig):**

```sh
npx supabase start          # startet Datenbank, Login, E-Mail-Postfach (Mailpit)
# Werte aus der Ausgabe (API_URL, PUBLISHABLE_KEY) in app/.env.local eintragen
cd app && npm start
```

Die Anmeldecodes landen lokal im Mailpit-Postfach unter <http://127.0.0.1:54324>.

`scripts/e2e-web.js` spielt den Ablauf im Browser durch: Registrierung, Namen eingeben,
Admin scannt (per RPC, da es headless keine Kamera gibt), 6. Stempel mit Belohnung,
Einlösen, Kunde sieht den neuen Stand und darf selbst nicht scannen.

`scripts/e2e-dashboard.js` testet das Dashboard: Abweisung von unbekannten E-Mails und
Nicht-Admins, Kennzahlen, Kundenliste, Leistung anlegen und Preis ändern, Einstellungen
speichern (inkl. Eingabeprüfung) und ob die App die Änderungen in „Preise“ und „Salon“ zeigt.

`scripts/e2e-web-start.js` testet die Web-App: echter QR-Scan über eine simulierte Kamera
(Chromium bekommt den QR-Code als Kamerabild), Impressum/Datenschutz ohne Login,
Installations-Hinweis auf dem iPhone und Konto löschen. Braucht zusätzlich `ffmpeg`.

`scripts/e2e-marketing.js` testet Phase 4 mit einem nachgebauten Expo-Push-Dienst:
Bewertungsanfrage (gut → Google, schlecht → intern), Rückhol-Gutschein inkl. Push,
Push-Aktion aus dem Dashboard und die Bewertungsseite.

Alle Skripte brauchen Playwright und einen Web-Export von App und Dashboard, z. B.:

```sh
(cd app && EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<lokal> \
  npx expo export --platform web --output-dir /tmp/web)
(cd dashboard && NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<lokal> \
  npx next build)
npx supabase db reset
node scripts/e2e-marketing.js /tmp/web dashboard/out /tmp/screens
```
