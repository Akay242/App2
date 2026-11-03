'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { PushCampaign } from '@/types/database';

const TITLE_MAX = 65;
const BODY_MAX = 240;

export default function Push() {
  const [audience, setAudience] = useState<number | null>(null);
  const [history, setHistory] = useState<PushCampaign[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [aud, hist] = await Promise.all([
      supabase.rpc('admin_push_audience'),
      supabase.from('push_campaigns').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    if (aud.error) setMessage({ ok: false, text: friendlyError(aud.error) });
    else setAudience(aud.data);
    if (hist.data) setHistory(hist.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Daten laden beim Öffnen
    void load();
  }, [load]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!confirm(`Diese Nachricht jetzt an ${audience ?? 0} Kunden schicken?`)) return;
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.rpc('admin_send_push', { p_title: title, p_body: body });
    setBusy(false);
    if (error) {
      setMessage({ ok: false, text: friendlyError(error) });
      return;
    }
    setMessage({ ok: true, text: `Gesendet an ${data.recipients} Kunden.` });
    setTitle('');
    setBody('');
    await load();
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Push-Nachrichten</h1>
        <p className="muted">
          Geht an alle Kunden, die Benachrichtigungen erlaubt haben – aktuell{' '}
          <strong className="success">{audience ?? '…'}</strong>. Sparsam einsetzen: zu viele Nachrichten führen dazu,
          dass Kunden Push abschalten.
        </p>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <form className="card stack" onSubmit={send}>
          <h2>Neue Nachricht</h2>
          <label>
            Titel ({title.length}/{TITLE_MAX})
            <input
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Diese Woche: 15 % auf Bartpflege"
              required
            />
          </label>
          <label>
            Text ({body.length}/{BODY_MAX})
            <textarea
              value={body}
              maxLength={BODY_MAX}
              rows={4}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Nur bis Samstag – zeig einfach deinen QR-Code an der Kasse."
              required
            />
          </label>
          <div className="row">
            <button type="submit" disabled={busy || !audience}>
              {busy ? 'Senden …' : 'Jetzt senden'}
            </button>
            {message && <span className={message.ok ? 'success' : 'error'}>{message.text}</span>}
          </div>
          {audience === 0 && <p className="muted">Noch kein Kunde hat Benachrichtigungen erlaubt.</p>}
        </form>

        <div className="card stack">
          <h2>Vorschau</h2>
          <div className="push-preview">
            <div className="push-app">SALON BONUS · jetzt</div>
            <div className="push-title">{title || 'Titel der Nachricht'}</div>
            <div className="push-body">{body || 'Text der Nachricht'}</div>
          </div>
          <p className="muted">
            Automatisch verschickt die App außerdem den Rückhol-Gutschein an Kunden, die länger nicht da waren
            (einstellbar unter „Einstellungen“).
          </p>
        </div>
      </div>

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Gesendet am</th>
              <th>Nachricht</th>
              <th className="num">Empfänger</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  Noch keine Nachrichten gesendet.
                </td>
              </tr>
            )}
            {history.map((c) => (
              <tr key={c.id}>
                <td className="muted">{new Date(c.created_at).toLocaleString('de-DE')}</td>
                <td>
                  <strong>{c.title}</strong>
                  <div className="muted">{c.body}</div>
                </td>
                <td className="num">{c.recipients}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
