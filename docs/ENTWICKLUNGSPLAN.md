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
| Plattform | **Start als Web-App (PWA)**, kostenlos und ohne App Store. Später zusätzlich native App im App Store und bei Google Play (gleicher Code) |
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
| Web-Dashboard | Next.js (statischer Export) auf Vercel (Gratis-Tarif) | 0 € |
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

### Phase 2 – Kernfunktion ✅
- [x] Registrierung und Login per E-Mail-Code, danach einmalig Namen abfragen
- [x] Kunden-Startseite: persönlicher QR-Code und Stempelkarte (x von 12), aktualisiert sich alle 10 s
- [x] Liste der freigeschalteten Belohnungen
- [x] Admin-Modus: Kamera-Scanner, Ergebnis mit Stempelstand, Belohnung einlösen
- [x] Rollen-abhängige Navigation (Kunde sieht nie den Scanner)
- [x] Lokales Supabase (`supabase/config.toml`) mit deutschen Code-E-Mails, End-to-End-Test im Browser
- [ ] Erster Test auf echten Handys (braucht Supabase-Zugangsdaten und einen Development-Build)

### Phase 3 – Inhalte und Web-Dashboard ✅
- [x] App: Reiter „Karte“, „Preise“, „Salon“
- [x] Preisliste nach Kategorien, Salon-Infos mit Anruf-Button, Kartenlink und Öffnungszeiten
- [x] Web-Dashboard (Next.js, statisch, Login per E-Mail-Code, nur für Admins)
- [x] Übersicht mit Kennzahlen (Besuche, Kunden, aktive Kunden, eingelöste Belohnungen)
- [x] Kundenliste mit Suche, Besuchen, Stempelstand, offenen Belohnungen
- [x] Leistungen anlegen, bearbeiten, ausblenden, löschen
- [x] Einstellungen: Salon-Daten, Öffnungszeiten, Bonus-Regeln, Rückholaktion
- [x] End-to-End-Test: Änderungen im Dashboard erscheinen in der App
- [ ] **Inhaber:** Dashboard auf Vercel veröffentlichen (siehe SETUP.md)

### Phase 4 – Marketing ✅
- [x] App fragt nach Push-Erlaubnis (mit Erklärung) und speichert den Push-Token, beim Abmelden wird er gelöscht
- [x] Täglicher Job (pg_cron, 09:00 UTC): Kunden ohne Besuch seit 6 Wochen bekommen einmal pro
      Abwesenheit einen 10-%-Gutschein (14 Tage gültig) und eine Push-Nachricht.
      Ohne Push-Erlaubnis steht der Gutschein trotzdem in der App
- [x] Push-Versand direkt aus der Datenbank (pg_net → Expo Push Service), in Paketen à 100
- [x] Dashboard: Push-Aktionen an alle Kunden mit Erlaubnis, mit Vorschau und Verlauf
- [x] Bewertungsanfrage in der App für Besuche der letzten 7 Tage; 4–5 Sterne → Bitte um
      Google-Bewertung, 1–3 Sterne → nur intern. Keine Belohnung für Bewertungen
- [x] Dashboard: Bewertungsseite (Durchschnitt, Verteilung, Kommentare) und neue Kennzahlen
      (Rückhol-Gutscheine, zurückgeholte Kunden, Ø Bewertung, Kunden mit Push)
- [x] End-to-End-Test mit nachgebautem Push-Dienst
- [ ] Test der echten Push-Nachrichten auf dem iPhone (braucht Apple-Entwicklerkonto)

### Phase 5 – Start als Web-App ✅ (dieser Stand)
- [x] Kunden-App läuft im Browser und ist als Web-App installierbar (Manifest, Icons, iPhone-Hinweis
      „Zum Home-Bildschirm“, Android „App installieren“)
- [x] Admin-Scanner mit der Browser-Kamera (auch iPhone/Safari); QR-Erkennung vom eigenen Server
- [x] Impressum und Datenschutzerklärung (Vorlage, Angaben aus dem Dashboard), ohne Login erreichbar
- [x] Konto löschen in der App (DSGVO, später Pflicht bei Apple); letztes Admin-Konto geschützt
- [x] Weiterleitung nach dem Login über `redirectTo` (Admin → Scanner, Kunde → Stempelkarte)
- [x] Hosting-Konfiguration für Vercel (`app/vercel.json`), Platzhalter-Icon
- [x] End-to-End-Test mit echtem QR-Scan über eine simulierte Kamera; alle früheren Tests weiter grün
- [ ] **Inhaber:** Supabase einrichten, beide Vercel-Projekte veröffentlichen, Impressumsangaben eintragen,
      Rechtstexte prüfen (siehe SETUP.md)
- [ ] Testphase mit einigen Stammkunden

### Phase 6 – App Store und Google Play (später)
- Apple Developer Program (99 €/Jahr) und Google Play (25 $ einmalig)
- Push-Nachrichten auf dem iPhone/Android (für die Web-Version optional: Web-Push)
- Store-Texte, Screenshots, endgültiges App-Icon
- Einreichung bei Apple und Google

## 5. Offene Punkte

- Name, Logo und Farben des Salons (Platzhalter-Icon „SB“ bis dahin)
- Web-Push für die Web-Version (optional, eigener Ausbauschritt)
- Konkretes Extra beim 6. Besuch (in `salon_settings.small_reward_label` einstellbar)
- Google-Bewertungslink des Salons (Phase 4)
- Eigener E-Mail-Versand vor dem Start: zunächst über ein Salon-Gmail-Konto (kostenlos), später ggf. eigene Domain
- Apple-Konto (Phase 6): als Privatperson schnell, als Organisation mit D-U-N-S-Nummer
