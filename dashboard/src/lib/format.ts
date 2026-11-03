const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const date = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' });

export const formatEuro = (cents: number) => euro.format(cents / 100);
export const formatDate = (iso: string | null) => (iso ? date.format(new Date(iso)) : '–');

/** "25,50" oder "25.5" → 2550; ungültig → null */
export function parseEuroToCents(input: string): number | null {
  const n = Number(input.replace(/\s|€/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export type OpeningHoursRow = { label: string; hours: string };

export function parseOpeningHours(value: unknown): OpeningHoursRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((r): r is OpeningHoursRow => Boolean(r) && typeof r.label === 'string' && typeof r.hours === 'string')
    .map(({ label, hours }) => ({ label, hours }));
}
