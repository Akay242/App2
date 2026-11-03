'use client';

import { useEffect, useMemo, useState } from 'react';

import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { CustomerOverview } from '@/types/database';

export default function Kunden() {
  const [rows, setRows] = useState<CustomerOverview[] | null>(null);
  const [stampsPerCycle, setStampsPerCycle] = useState(12);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase.rpc('admin_customer_overview'),
      supabase.from('salon_settings').select('stamps_per_cycle').single(),
    ]).then(([overview, settings]) => {
      if (overview.error) setError(friendlyError(overview.error));
      else setRows(overview.data);
      if (settings.data) setStampsPerCycle(settings.data.stamps_per_cycle);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!rows || !q) return rows;
    return rows.filter((r) =>
      [r.first_name, r.last_name, r.email].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Kunden</h1>
        <p className="muted">Alle registrierten Kunden, zuletzt dagewesene zuerst.</p>
      </div>

      <input
        type="search"
        placeholder="Suchen nach Name oder E-Mail …"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ maxWidth: 360 }}
      />

      {error && <p className="error">{error}</p>}

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>E-Mail</th>
              <th className="num">Besuche</th>
              <th className="num">Stempelkarte</th>
              <th className="num">Offene Belohnungen</th>
              <th>Letzter Besuch</th>
              <th>Dabei seit</th>
            </tr>
          </thead>
          <tbody>
            {!filtered && (
              <tr>
                <td colSpan={7} className="muted">
                  Laden …
                </td>
              </tr>
            )}
            {filtered?.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  Keine Kunden gefunden.
                </td>
              </tr>
            )}
            {filtered?.map((r) => (
              <tr key={r.id}>
                <td>
                  {[r.first_name, r.last_name].filter(Boolean).join(' ') || '–'}{' '}
                  {r.role === 'admin' && <span className="badge accent">Admin</span>}
                </td>
                <td className="muted">{r.email}</td>
                <td className="num">{r.total_visits}</td>
                <td className="num">
                  {r.stamps_in_cycle} / {stampsPerCycle}
                </td>
                <td className="num">{r.available_rewards || '–'}</td>
                <td>{formatDate(r.last_visit_at)}</td>
                <td className="muted">{formatDate(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
