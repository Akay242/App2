import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

type AuthState = {
  /** true, bis Sitzung und Profil geladen sind */
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(!supabase);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const fetchProfile = useCallback(async (id: string) => {
    const { data } = await supabase!.from('profiles').select('*').eq('id', id).maybeSingle();
    return data;
  }, []);

  useEffect(() => {
    if (!supabase || !userId) return;
    let cancelled = false;
    fetchProfile(userId).then((data) => {
      if (cancelled) return;
      setProfile(data);
      setProfileUserId(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !userId) return;
    setProfile(await fetchProfile(userId));
  }, [userId, fetchProfile]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    // Nach dem Abmelden keine Nachrichten mehr an dieses Gerät schicken.
    if (userId) await supabase.from('profiles').update({ push_token: null }).eq('id', userId);
    await supabase.auth.signOut();
  }, [userId]);

  const loading = !sessionLoaded || (userId !== null && profileUserId !== userId);

  return (
    <AuthContext.Provider
      value={{ loading, session, profile: userId ? profile : null, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth muss innerhalb von <AuthProvider> verwendet werden');
  return ctx;
}
