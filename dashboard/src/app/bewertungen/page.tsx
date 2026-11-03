'use client';

import { useEffect, useState } from 'react';

import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Review } from '@/types/database';

type Row = Review & { name: string };

export default function Bewertungen() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    (async () => {
      const { data, error: err } = await client
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (err) {
        setError(friendlyError(err));
        return;
      }
      const ids = [...new Set(data.map((r) => r.customer_id))];
      const { data: people } = ids.length
        ? await client.from('profiles').select('id, first_name, last_name').in('id', ids)
        : { data: [] };
      const names = new Map(
        (people ?? []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ') || '–']),
      );
      setRows(data.map((r) => ({ ...r, name: names.get(r.customer_id) ?? '–' })));
    })();
  }, []);

  const avg = rows?.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : null;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: rows?.filter((r) => r.rating === n).length ?? 0 }));
  const max = Math.max(1, ...dist.map((d) => d.count));

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Bewertungen</h1>
        <p className="muted">
          Kunden werden nach einem Besuch um eine Bewertung gebeten. Bei 4–5 Sternen bittet die App zusätzlich um
          eine Google-Bewertung. Kritik (1–3 Sterne) landet nur hier – nutze sie, um besser zu werden.
        </p>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="grid-2">
        <div className="card">
          <div className="stat-value">{avg ? avg.toFixed(1).replace('.', ',') : '–'} ★</div>
          <div className="muted">Durchschnitt aus {rows?.length ?? 0} Bewertungen</div>
        </div>
        <div className="card stack" style={{ gap: 6 }}>
          {dist.map((d) => (
            <div key={d.n} className="row" style={{ flexWrap: 'nowrap' }}>
              <span style={{ width: 36, whiteSpace: 'nowrap' }}>{d.n} ★</span>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${(d.count / max) * 100}%` }} />
              </div>
              <span className="muted" style={{ width: 28, textAlign: 'right' }}>
                {d.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Kunde</th>
              <th>Sterne</th>
              <th>Kommentar</th>
              <th>Google</th>
            </tr>
          </thead>
          <tbody>
            {!rows && !error && (
              <tr>
                <td colSpan={5} className="muted">
                  Laden …
                </td>
              </tr>
            )}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Noch keine Bewertungen.
                </td>
              </tr>
            )}
            {rows?.map((r) => (
              <tr key={r.id}>
                <td className="muted">{formatDate(r.created_at)}</td>
                <td>{r.name}</td>
                <td style={{ color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                  {'★'.repeat(r.rating)}
                  <span style={{ color: 'var(--border)' }}>{'★'.repeat(5 - r.rating)}</span>
                </td>
                <td>{r.comment ?? <span className="muted">–</span>}</td>
                <td>{r.forwarded_to_google ? <span className="badge accent">weitergeleitet</span> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
