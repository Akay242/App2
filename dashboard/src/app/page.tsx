'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { AdminStats } from '@/types/database';

const TILES: { key: keyof AdminStats; label: string }[] = [
  { key: 'visits_today', label: 'Besuche heute' },
  { key: 'visits_30d', label: 'Besuche (30 Tage)' },
  { key: 'customers_total', label: 'Kunden gesamt' },
  { key: 'customers_new_30d', label: 'Neue Kunden (30 Tage)' },
  { key: 'customers_active_42d', label: 'Aktive Kunden (6 Wochen)' },
  { key: 'rewards_redeemed_30d', label: 'Eingelöste Belohnungen (30 Tage)' },
  { key: 'winback_sent_30d', label: 'Rückhol-Gutscheine verschickt (30 Tage)' },
  { key: 'winback_redeemed_30d', label: 'Zurückgeholte Kunden (30 Tage)' },
  { key: 'rating_avg_30d', label: 'Ø Bewertung (30 Tage)' },
  { key: 'customers_with_push', label: 'Kunden mit Push-Erlaubnis' },
];

export default function Overview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase?.rpc('admin_stats').then(({ data, error: err }) => {
      if (err) setError(friendlyError(err));
      else setStats(data as unknown as AdminStats);
    });
  }, []);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Übersicht</h1>
        <p className="muted">Die wichtigsten Zahlen auf einen Blick.</p>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="stats">
        {TILES.map((t) => (
          <div key={t.key} className="card">
            <div className="stat-value">{stats ? (stats[t.key] ?? '–') : '–'}</div>
            <div className="muted">{t.label}</div>
          </div>
        ))}
      </div>
      <div className="grid-2">
        <Link href="/leistungen/" className="card" style={{ textDecoration: 'none' }}>
          <h2>Preise & Leistungen</h2>
          <p className="muted">Preisliste bearbeiten, die Kunden in der App sehen.</p>
        </Link>
        <Link href="/push/" className="card" style={{ textDecoration: 'none' }}>
          <h2>Push-Nachricht senden</h2>
          <p className="muted">Aktionen und Neuigkeiten an alle Kunden mit Push-Erlaubnis.</p>
        </Link>
        <Link href="/einstellungen/" className="card" style={{ textDecoration: 'none' }}>
          <h2>Einstellungen</h2>
          <p className="muted">Adresse, Öffnungszeiten und Bonus-Regeln.</p>
        </Link>
      </div>
    </div>
  );
}
