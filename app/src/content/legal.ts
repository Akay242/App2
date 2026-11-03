/**
 * Texte für Impressum und Datenschutzerklärung.
 *
 * WICHTIG: Das ist eine sorgfältig erstellte Vorlage, aber keine Rechtsberatung.
 * Vor dem Start sollte der Inhaber die Texte prüfen (lassen), z. B. mit einem
 * Generator wie e-recht24 oder durch einen Anwalt. Die Angaben zum Salon kommen
 * aus den Einstellungen im Dashboard.
 */
import type { SalonSettings } from '@/types/database';

export type LegalSection = { heading: string; paragraphs: string[] };

type Info = Pick<
  SalonSettings,
  'name' | 'address' | 'phone' | 'imprint_owner' | 'imprint_email' | 'imprint_vat_id' | 'imprint_extra'
>;

const MISSING = '[noch nicht eingetragen]';

function responsible(s: Info): string[] {
  return [
    s.imprint_owner ? `${s.imprint_owner} (${s.name})` : `${s.name}, Inhaber: ${MISSING}`,
    s.address ?? `Adresse: ${MISSING}`,
    `Telefon: ${s.phone ?? MISSING}`,
    `E-Mail: ${s.imprint_email ?? MISSING}`,
  ];
}

export function imprint(s: Info): LegalSection[] {
  const sections: LegalSection[] = [
    { heading: 'Angaben gemäß § 5 DDG', paragraphs: responsible(s) },
  ];
  if (s.imprint_vat_id) {
    sections.push({
      heading: 'Umsatzsteuer-ID',
      paragraphs: [`Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG: ${s.imprint_vat_id}`],
    });
  }
  if (s.imprint_extra) {
    sections.push({ heading: 'Weitere Angaben', paragraphs: s.imprint_extra.split('\n').filter(Boolean) });
  }
  sections.push({
    heading: 'Verbraucherstreitbeilegung',
    paragraphs: [
      'Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
    ],
  });
  return sections;
}

export function privacyPolicy(s: Info): LegalSection[] {
  return [
    {
      heading: '1. Verantwortlicher',
      paragraphs: responsible(s),
    },
    {
      heading: '2. Worum es geht',
      paragraphs: [
        `Diese App ist das digitale Bonusprogramm von ${s.name}. Du sammelst bei jedem Besuch einen Stempel und erhältst dafür Belohnungen. Die Nutzung ist freiwillig und kostenlos.`,
      ],
    },
    {
      heading: '3. Welche Daten wir verarbeiten',
      paragraphs: [
        'Konto: E-Mail-Adresse, Vor- und (optional) Nachname, Zeitpunkt der Registrierung.',
        'Bonusprogramm: Datum deiner Besuche (wenn der Salon deinen QR-Code scannt), Stempelstand, verdiente und eingelöste Belohnungen und Gutscheine.',
        'Bewertungen: Sternebewertung und optionaler Kommentar, wenn du nach einem Besuch eine Bewertung abgibst.',
        'Benachrichtigungen (nur in der iPhone-/Android-App und nur mit deiner Erlaubnis): ein technisches Push-Kennzeichen deines Geräts.',
        'Technisch notwendig: Damit du angemeldet bleibst, wird ein Anmelde-Schlüssel im Speicher deines Browsers bzw. Geräts abgelegt. Wir verwenden keine Tracking- oder Werbe-Cookies und keine Analyse-Tools.',
      ],
    },
    {
      heading: '4. Zwecke und Rechtsgrundlagen',
      paragraphs: [
        'Durchführung des Bonusprogramms (Konto, Stempel, Belohnungen, Rückhol-Gutscheine nach längerer Abwesenheit): Art. 6 Abs. 1 lit. b DSGVO (Nutzungsvertrag).',
        'Push-Benachrichtigungen: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung). Du kannst sie jederzeit in den Einstellungen deines Geräts abschalten.',
        'Bewertungen: freiwillig, Art. 6 Abs. 1 lit. a DSGVO. Für Bewertungen gibt es keine Belohnung. Wenn du zu Google weitergeleitet wirst, gelten dort die Datenschutzbestimmungen von Google.',
        'Statistiken für den Salon (z. B. Anzahl Besuche) werden nur zusammengefasst ausgewertet: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Verbesserung des Angebots).',
      ],
    },
    {
      heading: '5. Dienstleister (Auftragsverarbeiter)',
      paragraphs: [
        'Supabase Inc. – Datenbank und Anmeldung. Die Daten werden auf Servern in Frankfurt am Main (EU) gespeichert.',
        'Vercel Inc. (USA) – Bereitstellung der Web-App. Beim Aufruf werden technisch notwendige Verbindungsdaten (z. B. IP-Adresse) verarbeitet. Vercel ist unter dem EU-US Data Privacy Framework zertifiziert.',
        'Google Ireland Ltd. – Versand der E-Mails mit dem Anmeldecode (Gmail).',
        'Expo (650 Industries Inc., USA) sowie Apple bzw. Google – Zustellung von Push-Benachrichtigungen in der iPhone-/Android-App.',
        'Mit den Dienstleistern bestehen bzw. werden Verträge zur Auftragsverarbeitung geschlossen; bei Übermittlungen in die USA stützen wir uns auf das EU-US Data Privacy Framework bzw. EU-Standardvertragsklauseln.',
      ],
    },
    {
      heading: '6. Speicherdauer',
      paragraphs: [
        'Wir speichern deine Daten, solange du dein Konto hast. Wenn du dein Konto löschst, werden Profil, Besuche, Belohnungen und Bewertungen sofort und endgültig gelöscht. Gesetzliche Aufbewahrungspflichten betreffen diese Daten in der Regel nicht.',
      ],
    },
    {
      heading: '7. Deine Rechte',
      paragraphs: [
        'Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht, eine Einwilligung jederzeit zu widerrufen.',
        'Dein Konto kannst du jederzeit selbst löschen: im Reiter „Salon“ unter „Konto löschen“. Für alle anderen Anliegen genügt eine E-Mail an die oben genannte Adresse.',
        'Du hast außerdem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, z. B. bei der Behörde deines Bundeslandes.',
      ],
    },
    {
      heading: '8. Pflicht zur Bereitstellung',
      paragraphs: [
        'Für die Teilnahme am Bonusprogramm brauchen wir deine E-Mail-Adresse und deinen Vornamen. Ohne diese Angaben kannst du die App nicht nutzen. Alle anderen Angaben sind freiwillig.',
      ],
    },
  ];
}
