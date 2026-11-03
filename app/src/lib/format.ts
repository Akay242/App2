const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

/** 2500 → "25,00 €", mit priceIsFrom → "ab 25,00 €" */
export function formatPrice(cents: number, priceIsFrom = false): string {
  return `${priceIsFrom ? 'ab ' : ''}${euro.format(cents / 100)}`;
}

export type OpeningHoursRow = { label: string; hours: string };

/** Liest die Öffnungszeiten robust aus dem JSON-Feld der Salon-Einstellungen. */
export function parseOpeningHours(value: unknown): OpeningHoursRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is OpeningHoursRow =>
      Boolean(row) && typeof row.label === 'string' && typeof row.hours === 'string')
    .map(({ label, hours }) => ({ label, hours }));
}
