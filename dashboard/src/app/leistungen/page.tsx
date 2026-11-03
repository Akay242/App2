'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { friendlyError } from '@/lib/errors';
import { formatEuro, parseEuroToCents } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Service } from '@/types/database';

type Draft = {
  category: string;
  name: string;
  description: string;
  price: string;
  price_is_from: boolean;
  duration_min: string;
  sort_order: string;
  active: boolean;
};

const EMPTY: Draft = {
  category: 'Haare',
  name: '',
  description: '',
  price: '',
  price_is_from: false,
  duration_min: '',
  sort_order: '',
  active: true,
};

function toDraft(s: Service): Draft {
  return {
    category: s.category,
    name: s.name,
    description: s.description ?? '',
    price: (s.price_cents / 100).toFixed(2).replace('.', ','),
    price_is_from: s.price_is_from,
    duration_min: s.duration_min?.toString() ?? '',
    sort_order: s.sort_order.toString(),
    active: s.active,
  };
}

function fromDraft(d: Draft, fallbackSort: number) {
  const price_cents = parseEuroToCents(d.price);
  if (!d.name.trim()) return { error: 'Bitte einen Namen eingeben.' } as const;
  if (price_cents === null) return { error: 'Bitte einen gültigen Preis eingeben, z. B. 25,00.' } as const;
  const duration = d.duration_min.trim() ? Number(d.duration_min) : null;
  if (duration !== null && !(Number.isInteger(duration) && duration > 0))
    return { error: 'Dauer bitte als ganze Minuten angeben.' } as const;
  return {
    values: {
      category: d.category.trim() || 'Sonstiges',
      name: d.name.trim(),
      description: d.description.trim() || null,
      price_cents,
      price_is_from: d.price_is_from,
      duration_min: duration,
      sort_order: d.sort_order.trim() ? Math.round(Number(d.sort_order)) || 0 : fallbackSort,
      active: d.active,
    },
  } as const;
}

export default function Leistungen() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: err } = await supabase.from('services').select('*').order('sort_order').order('name');
    if (err) setError(friendlyError(err));
    else setServices(data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Daten laden beim Öffnen
    void load();
  }, [load]);

  const nextSort = (services?.reduce((m, s) => Math.max(m, s.sort_order), 0) ?? 0) + 10;
  const categories = [...new Set(services?.map((s) => s.category) ?? [])];

  async function remove(s: Service) {
    if (!supabase || !confirm(`„${s.name}“ wirklich löschen?`)) return;
    const { error: err } = await supabase.from('services').delete().eq('id', s.id);
    if (err) setError(friendlyError(err));
    else await load();
  }

  return (
    <div className="stack">
      <div className="page-head row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>Preise & Leistungen</h1>
          <p className="muted">So erscheint die Preisliste in der App. Inaktive Leistungen sind für Kunden unsichtbar.</p>
        </div>
        {editing !== 'new' && <button onClick={() => setEditing('new')}>+ Neue Leistung</button>}
      </div>

      {error && <p className="error">{error}</p>}

      {editing === 'new' && (
        <ServiceForm
          initial={{ ...EMPTY, sort_order: String(nextSort) }}
          categories={categories}
          fallbackSort={nextSort}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Kategorie</th>
              <th>Leistung</th>
              <th className="num">Dauer</th>
              <th className="num">Preis</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!services && (
              <tr>
                <td colSpan={6} className="muted">
                  Laden …
                </td>
              </tr>
            )}
            {services?.map((s) =>
              editing === s.id ? (
                <tr key={s.id}>
                  <td colSpan={6}>
                    <ServiceForm
                      serviceId={s.id}
                      initial={toDraft(s)}
                      categories={categories}
                      fallbackSort={s.sort_order}
                      onCancel={() => setEditing(null)}
                      onSaved={async () => {
                        setEditing(null);
                        await load();
                      }}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={s.id} style={s.active ? undefined : { opacity: 0.55 }}>
                  <td className="muted">{s.category}</td>
                  <td>
                    {s.name}
                    {s.description && <div className="muted">{s.description}</div>}
                  </td>
                  <td className="num">{s.duration_min ? `${s.duration_min} Min.` : '–'}</td>
                  <td className="num">
                    {s.price_is_from && 'ab '}
                    {formatEuro(s.price_cents)}
                  </td>
                  <td>{s.active ? <span className="badge accent">Aktiv</span> : <span className="badge">Inaktiv</span>}</td>
                  <td className="num">
                    <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      <button className="secondary" onClick={() => setEditing(s.id)}>
                        Bearbeiten
                      </button>
                      <button className="danger" onClick={() => remove(s)}>
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type FormProps = {
  serviceId?: string;
  initial: Draft;
  categories: string[];
  fallbackSort: number;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
};

function ServiceForm({ serviceId, initial, categories, fallbackSort, onCancel, onSaved }: FormProps) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const parsed = fromDraft(d, fallbackSort);
    if ('error' in parsed) {
      setError(parsed.error ?? null);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = serviceId
      ? await supabase.from('services').update(parsed.values).eq('id', serviceId)
      : await supabase.from('services').insert(parsed.values);
    setBusy(false);
    if (err) setError(friendlyError(err));
    else await onSaved();
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>{serviceId ? 'Leistung bearbeiten' : 'Neue Leistung'}</h2>
      <div className="grid-2">
        <label>
          Name
          <input value={d.name} onChange={(e) => set('name', e.target.value)} required />
        </label>
        <label>
          Kategorie
          <input list="categories" value={d.category} onChange={(e) => set('category', e.target.value)} />
          <datalist id="categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label>
          Preis in €
          <input inputMode="decimal" value={d.price} onChange={(e) => set('price', e.target.value)} placeholder="25,00" required />
        </label>
        <label>
          Dauer in Minuten (optional)
          <input inputMode="numeric" value={d.duration_min} onChange={(e) => set('duration_min', e.target.value)} />
        </label>
        <label>
          Beschreibung (optional)
          <input value={d.description} onChange={(e) => set('description', e.target.value)} />
        </label>
        <label>
          Reihenfolge (kleine Zahl = weiter oben)
          <input inputMode="numeric" value={d.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
        </label>
      </div>
      <div className="row">
        <label className="checkbox">
          <input type="checkbox" checked={d.price_is_from} onChange={(e) => set('price_is_from', e.target.checked)} />
          „ab“-Preis
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={d.active} onChange={(e) => set('active', e.target.checked)} />
          In der App anzeigen
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" disabled={busy}>
          {busy ? 'Speichern …' : 'Speichern'}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
