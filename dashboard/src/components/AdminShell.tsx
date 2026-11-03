'use client';

import type { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { friendlyError } from '@/lib/errors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const NAV = [
  { href: '/', label: 'Übersicht' },
  { href: '/kunden/', label: 'Kunden' },
  { href: '/leistungen/', label: 'Preise & Leistungen' },
  { href: '/push/', label: 'Push-Nachrichten' },
  { href: '/bewertungen/', label: 'Bewertungen' },
  { href: '/einstellungen/', label: 'Einstellungen' },
];

type State =
  | { kind: 'loading' }
  | { kind: 'signed_out' }
  | { kind: 'not_admin'; email: string }
  | { kind: 'admin'; email: string };

/** Login (E-Mail-Code) und Admin-Prüfung für das ganze Dashboard. */
export function AdminShell({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const pathname = usePathname();

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;

    async function evaluate(session: Session | null) {
      if (!session) {
        if (!cancelled) setState({ kind: 'signed_out' });
        return;
      }
      const { data } = await client.rpc('is_admin');
      if (cancelled) return;
      const email = session.user.email ?? '';
      setState(data ? { kind: 'admin', email } : { kind: 'not_admin', email });
    }

    client.auth.getSession().then(({ data }) => evaluate(data.session));
    const { data } = client.auth.onAuthStateChange((event, session) => {
      // Supabase empfiehlt, im Callback keine weiteren Supabase-Aufrufe direkt abzuwarten.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(() => evaluate(session), 0);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="center">
        <div className="card login stack">
          <h2>Noch nicht eingerichtet</h2>
          <p className="muted">
            Lege dashboard/.env.local an (Vorlage: .env.example) und trage die Supabase-Werte ein.
          </p>
        </div>
      </div>
    );
  }

  if (state.kind === 'loading') return <div className="center muted">Laden …</div>;
  if (state.kind === 'signed_out') return <LoginForm />;

  if (state.kind === 'not_admin') {
    return (
      <div className="center">
        <div className="card login stack">
          <h2>Kein Zugriff</h2>
          <p className="muted">
            {state.email} ist kein Admin-Konto. Das Dashboard ist nur für den Salon-Inhaber.
          </p>
          <button className="secondary" onClick={() => supabase!.auth.signOut()}>
            Abmelden
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">Salon Bonus</div>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link${pathname === item.href || pathname + '/' === item.href ? ' active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
        <div className="sidebar-footer">
          <span className="muted">{state.email}</span>
          <button className="secondary" onClick={() => supabase!.auth.signOut()}>
            Abmelden
          </button>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}

function LoginForm() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const normalized = email.trim().toLowerCase();
    if (step === 'email') {
      // Kein neues Konto anlegen: Admins registrieren sich über die App.
      const { error: err } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: { shouldCreateUser: false },
      });
      if (err) setError(friendlyError(err));
      else setStep('code');
    } else {
      const { error: err } = await supabase.auth.verifyOtp({
        email: normalized,
        token: code.replace(/\D/g, ''),
        type: 'email',
      });
      if (err) setError(friendlyError(err));
    }
    setBusy(false);
  }

  return (
    <div className="center">
      <form className="card login stack" onSubmit={submit}>
        <div>
          <h1>Salon Bonus</h1>
          <p className="muted">Verwaltung für den Salon-Inhaber</p>
        </div>
        {step === 'email' ? (
          <label>
            E-Mail-Adresse
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@beispiel.de"
            />
          </label>
        ) : (
          <>
            <p>Wir haben einen Code an {email.trim().toLowerCase()} geschickt.</p>
            <label>
              Code aus der E-Mail
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
              />
            </label>
          </>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'Bitte warten …' : step === 'email' ? 'Code anfordern' : 'Anmelden'}
        </button>
        {step === 'code' && (
          <button type="button" className="secondary" onClick={() => setStep('email')} disabled={busy}>
            Andere E-Mail-Adresse
          </button>
        )}
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
