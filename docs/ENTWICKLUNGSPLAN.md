# Entwicklungsplan – Salon Bonus App

Stand: 02.11.2026

## 1. Ziel

Eine native App (iOS und Android) für die Kunden **eines** Herren-Friseursalons.
Sie soll Stammkunden binden, verlorene Kunden zurückholen und über Google-Bewertungen
neue Kunden bringen. Der Inhaber pflegt die App selbst.

## 2. Entscheidungen

| Bereich | Entscheidung |
|---|---|
| Salon | Ein Salon, Herren aller Altersgruppen, überwiegend Terminkunden |
| Pflege | Inhaber selbst (Admin) |
| Stempelkarte | 6. Besuch: kleines Extra · 12. Besuch: Gratis-Haarschnitt, danach neue Karte |
| QR-Code | Kunde zeigt seinen persönlichen Code, **Admin scannt** |
| Missbrauchsschutz | Maximal 1 Scan pro Kunde und Tag |
| Rückholaktion | Push mit **10 %** Gutschein, wenn ein Kunde **6 Wochen** nicht da war. Gültig 14 Tage, einmal pro Abwesenheit |
| Bewertungen | Anfrage nach einem Scan. 4–5 Sterne → Weiterleitung zu Google. **Keine** Belohnung für Bewertungen (Google-Richtlinien und UWG) |
| Inhalte | Preisliste und Leistungen, Salon-Infos mit Anruf-Button |
| Nicht im Umfang | Online-Terminbuchung, „Freunde werben“ |
| Plattform | Native App im App Store und bei Google Play |
| Verwaltung | Admin-Modus in der App (Scannen) und Web-Dashboard (Verwaltung) |
| Design | Name, Logo und Farben folgen später, bis dahin Platzhalter |

Alle Bonus-Regeln (6/12 Besuche, 6 Wochen, 10 %, 14 Tage, Bezeichnung des Extras)
stehen in der Tabelle `salon_settings` und lassen sich später ohne neuen Code ändern.

## 3. Technik

| Baustein | Technologie | Kosten |
|---|---|---|
| App (iOS + Android aus einem Code) | React Native mit Expo (SDK 58), Expo Router, TypeScript | 0 € |
| Backend: Datenbank, Login, Rechte, Zeitpläne | Supabase (PostgreSQL, Gratis-Tarif) | 0 € |
| Push-Nachrichten | Expo Push Service | 0 € |
| Web-Dashboard | Next.js auf Vercel (Gratis-Tarif) | 0 € |
| App-Builds und Store-Upload | EAS Build/Submit (Gratis-Kontingent) | 0 € |
| Google Play Konto | einmalig | 25 $ |
| Apple Developer Programm | jährlich | 99 € |

### Architektur

```
 Kunden-App ──┐                         ┌── Web-Dashboard (Inhaber, Browser)
 (iOS/Android)│                         │
              ├──► Supabase (Auth, DB) ◄┤
 Admin-Modus ─┘     │  Row Level Security
 (gleiche App)      │  RPC: record_visit, redeem_reward
                    └── täglicher Job (pg_cron) ──► Expo Push ──► Kunden
```

- **Eine App für alle:** Die Rolle im Profil (`customer` oder `admin`) entscheidet,
  ob die Stempelkarte oder der Scanner angezeigt wird.
- **Sicherheit:** Kunden können Besuche und Belohnungen nur lesen. Eintragen geht nur über
  die Datenbankfunktionen `record_visit` und `redeem_reward`, und die prüfen die Admin-Rolle.
- **Login:** E-Mail mit Einmal-Code, ohne Passwort und ohne SMS-Kosten.

### Datenmodell

| Tabelle | Inhalt |
|---|---|
| `salon_settings` | Salon-Daten und alle Bonus-Regeln (genau 1 Zeile) |
| `profiles` | Kunde oder Admin, Name, persönlicher QR-Token, Push-Token, letzter Besuch |
| `visits` | Gescannte Besuche, eindeutig pro Kunde und Tag |
| `rewards` | Verdiente Belohnungen: `small_extra`, `free_cut`, `winback_discount` |
| `services` | Preisliste |
| `reviews` | Bewertungen, nur zu eigenen, echten Besuchen |

## 4. Phasen

### Phase 1 – Grundlagen ✅
- [x] Projektstruktur: `app/` (Expo), `supabase/` (Datenbank), `docs/`
- [x] Expo-App mit Expo Router, TypeScript, Supabase-Client und Platzhalter-Design
- [x] Datenbankschema mit Rechten (RLS), Stempellogik, 1-Scan-pro-Tag-Sperre, Einlösen von Belohnungen
- [x] Beispiel-Preisliste (`supabase/seed.sql`)
- [x] Lokaler Datenbank-Test (`supabase/tests/`)
- [ ] **Inhaber:** Konten anlegen, siehe [SETUP.md](SETUP.md)

### Phase 2 – Kernfunktion ✅ (dieser Stand)
- [x] Registrierung und Login per E-Mail-Code, danach einmalig Namen abfragen
- [x] Kunden-Startseite: persönlicher QR-Code und Stempelkarte (x von 12), aktualisiert sich alle 10 s
- [x] Liste der freigeschalteten Belohnungen
- [x] Admin-Modus: Kamera-Scanner, Ergebnis mit Stempelstand, Belohnung einlösen
- [x] Rollen-abhängige Navigation (Kunde sieht nie den Scanner)
- [x] Lokales Supabase (`supabase/config.toml`) mit deutschen Code-E-Mails, End-to-End-Test im Browser
- [ ] Erster Test auf echten Handys (braucht Supabase-Zugangsdaten und einen Development-Build)

### Phase 3 – Inhalte und Web-Dashboard
- Preisliste und Salon-Infos (Adresse, Öffnungszeiten, Anruf-Button) in der App
- Web-Dashboard: Login für den Admin, Leistungen und Preise bearbeiten,
  Salon-Einstellungen und Bonus-Regeln, Kundenliste mit Besuchen

### Phase 4 – Marketing
- Push-Berechtigung und Push-Token speichern
- Täglicher Job: Kunden ohne Besuch seit 6 Wochen bekommen einen 10-%-Gutschein und eine Push-Nachricht
- Manuelle Push-Aktionen aus dem Dashboard
- Bewertungsanfrage nach dem Scan mit Weiterleitung zu Google
- Statistik im Dashboard: Neukunden, aktive Kunden, eingelöste Belohnungen, zurückgeholte Kunden

### Phase 5 – Test und Veröffentlichung
- Testphase mit einigen Stammkunden (TestFlight bzw. interner Google-Play-Test)
- Impressum, Datenschutzerklärung, Konto-Löschfunktion (Pflicht bei Apple)
- Store-Texte, Screenshots, App-Icon
- Einreichung bei Apple und Google

## 5. Offene Punkte

- Name, Logo und Farben des Salons (vor Phase 5)
- Konkretes Extra beim 6. Besuch (in `salon_settings.small_reward_label` einstellbar)
- Google-Bewertungslink des Salons (Phase 4)
- Eigener E-Mail-Versand (SMTP, z. B. Resend) und Absender-Domain vor dem Start
- Apple-Konto als Organisation: D-U-N-S-Nummer früh beantragen
