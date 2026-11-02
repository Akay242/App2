# Salon Bonus

Kunden-App für einen Herren-Friseursalon: digitale Stempelkarte per QR-Code,
Belohnungen, Rückhol-Gutscheine per Push, Preisliste und Google-Bewertungen.

- **Plan:** [docs/ENTWICKLUNGSPLAN.md](docs/ENTWICKLUNGSPLAN.md)
- **Einrichtung (Konten, Supabase):** [docs/SETUP.md](docs/SETUP.md)

## Projektstruktur

```
app/        Expo-App (iOS + Android), React Native + TypeScript
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

Prüfen vor jedem Commit:

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
