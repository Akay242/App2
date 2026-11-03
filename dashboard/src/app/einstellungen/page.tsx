'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { friendlyError } from '@/lib/errors';
import { parseOpeningHours, type OpeningHoursRow } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { SalonSettings } from '@/types/database';

type Editable = Omit<SalonSettings, 'id' | 'timezone' | 'updated_at' | 'opening_hours'>;

const NUMBER_FIELDS = [
  'stamps_per_cycle',
  'small_reward_at',
  'winback_after_days',
  'winback_discount_percent',
  'winback_valid_days',
] as const;

export default function Einstellungen() {
  const [form, setForm] = useState<Editable | null>(null);
  const [hours, setHours] = useState<OpeningHoursRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase
      ?.from('salon_settings')
      .select('*')
      .single()
      .then(({ data, error }) => {
        if (error) {
          setMessage({ ok: false, text: friendlyError(error) });
          return;
        }
        setForm({
          name: data.name,
          address: data.address,
          phone: data.phone,
          google_review_url: data.google_review_url,
          stamps_per_cycle: data.stamps_per_cycle,
          small_reward_at: data.small_reward_at,
          small_reward_label: data.small_reward_label,
          free_cut_label: data.free_cut_label,
          winback_after_days: data.winback_after_days,
          winback_discount_percent: data.winback_discount_percent,
          winback_valid_days: data.winback_valid_days,
        });
        setHours(parseOpeningHours(data.opening_hours));
      });
  }, []);

  if (!form) return <p className="muted">{message?.text ?? 'Laden …'}</p>;

  const set = <K extends keyof Editable>(k: K, v: Editable[K]) => setForm({ ...form, [k]: v });
  const text = (k: keyof Editable) => ({
    value: (form[k] as string | null) ?? '',
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
  });
  const num = (k: (typeof NUMBER_FIELDS)[number]) => ({
    type: 'number' as const,
    min: 1,
    value: Number.isFinite(form[k]) ? form[k] : '',
    onChange: (e: { target: { value: string } }) => set(k, Number.parseInt(e.target.value, 10)),
  });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !form) return;
    for (const k of NUMBER_FIELDS) {
      if (!Number.isInteger(form[k]) || form[k] < 1) {
        setMessage({ ok: false, text: 'Bitte alle Zahlenfelder mit ganzen Zahlen ab 1 ausfüllen.' });
        return;
      }
    }
    if (form.small_reward_at >= form.stamps_per_cycle) {
      setMessage({ ok: false, text: 'Das kleine Extra muss vor dem Gratis-Haarschnitt kommen.' });
      return;
    }
    if (form.winback_discount_percent > 100) {
      setMessage({ ok: false, text: 'Der Rabatt darf höchstens 100 % betragen.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    const clean = (v: string | null) => (v?.trim() ? v.trim() : null);
    const { error } = await supabase
      .from('salon_settings')
      .update({
        ...form,
        name: form.name.trim() || 'Mein Salon',
        address: clean(form.address),
        phone: clean(form.phone),
        google_review_url: clean(form.google_review_url),
        opening_hours: hours.filter((h) => h.label.trim() || h.hours.trim()),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    setBusy(false);
    setMessage(error ? { ok: false, text: friendlyError(error) } : { ok: true, text: 'Gespeichert.' });
  }

  return (
    <form className="stack" onSubmit={save}>
      <div className="page-head">
        <h1>Einstellungen</h1>
        <p className="muted">Änderungen sind sofort in der App sichtbar.</p>
      </div>

      <section className="card stack">
        <h2>Salon</h2>
        <div className="grid-2">
          <label>
            Name des Salons
            <input {...text('name')} required />
          </label>
          <label>
            Telefon
            <input type="tel" {...text('phone')} placeholder="+49 …" />
          </label>
          <label>
            Adresse
            <input {...text('address')} placeholder="Straße Nr., PLZ Ort" />
          </label>
          <label>
            Link zu Google-Bewertungen (für die Bewertungsanfrage)
            <input type="url" {...text('google_review_url')} placeholder="https://g.page/r/…" />
          </label>
        </div>
      </section>

      <section className="card stack">
        <h2>Öffnungszeiten</h2>
        {hours.map((row, i) => (
          <div key={i} className="row">
            <input
              aria-label="Tage"
              value={row.label}
              placeholder="Mo–Fr"
              onChange={(e) => setHours(hours.map((h, j) => (j === i ? { ...h, label: e.target.value } : h)))}
            />
            <input
              aria-label="Zeiten"
              value={row.hours}
              placeholder="09:00–18:00"
              onChange={(e) => setHours(hours.map((h, j) => (j === i ? { ...h, hours: e.target.value } : h)))}
            />
            <button type="button" className="danger" onClick={() => setHours(hours.filter((_, j) => j !== i))}>
              Entfernen
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="secondary" onClick={() => setHours([...hours, { label: '', hours: '' }])}>
            + Zeile hinzufügen
          </button>
        </div>
      </section>

      <section className="card stack">
        <h2>Stempelkarte</h2>
        <div className="grid-2">
          <label>
            Stempel für den Gratis-Haarschnitt
            <input {...num('stamps_per_cycle')} />
          </label>
          <label>
            Kleines Extra beim Stempel Nr.
            <input {...num('small_reward_at')} />
          </label>
          <label>
            Bezeichnung kleines Extra
            <input {...text('small_reward_label')} required />
          </label>
          <label>
            Bezeichnung Hauptbelohnung
            <input {...text('free_cut_label')} required />
          </label>
        </div>
        <p className="muted">Neue Bezeichnungen gelten für künftig verdiente Belohnungen.</p>
      </section>

      <section className="card stack">
        <h2>Rückholaktion (automatisch, täglich)</h2>
        <div className="grid-2">
          <label>
            Gutschein nach … Tagen ohne Besuch
            <input {...num('winback_after_days')} />
          </label>
          <label>
            Rabatt in %
            <input {...num('winback_discount_percent')} max={100} />
          </label>
          <label>
            Gutschein gültig für … Tage
            <input {...num('winback_valid_days')} />
          </label>
        </div>
      </section>

      <div className="row">
        <button type="submit" disabled={busy}>
          {busy ? 'Speichern …' : 'Speichern'}
        </button>
        {message && <span className={message.ok ? 'success' : 'error'}>{message.text}</span>}
      </div>
    </form>
  );
}
