/** Übersetzt technische Fehlercodes aus der Datenbank in verständliche Meldungen. */
const MESSAGES: Record<string, string> = {
  already_scanned_today: 'Dieser Kunde wurde heute schon gescannt.',
  unknown_qr_code: 'Unbekannter QR-Code. Ist das ein Code aus dieser App?',
  not_admin: 'Nur der Salon kann QR-Codes scannen.',
  reward_not_available: 'Diese Belohnung wurde bereits eingelöst.',
  reward_expired: 'Diese Belohnung ist abgelaufen.',
  unknown_reward: 'Belohnung nicht gefunden.',
  push_text_missing: 'Bitte Titel und Text eingeben.',
};

export function friendlyError(error: unknown): string {
  const message =
    typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error);
  if (MESSAGES[message]) return MESSAGES[message];
  if (/token has expired|invalid/i.test(message)) return 'Der Code ist falsch oder abgelaufen.';
  if (/signups not allowed/i.test(message))
    return 'Zu dieser E-Mail gibt es kein Konto. Bitte zuerst in der App registrieren.';
  if (/rate limit|security purposes/i.test(message))
    return 'Zu viele Versuche. Bitte kurz warten und erneut probieren.';
  if (/network|fetch/i.test(message)) return 'Keine Internetverbindung.';
  return message;
}
