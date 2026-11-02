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
