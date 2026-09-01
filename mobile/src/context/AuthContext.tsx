import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { AppUser, School } from '@/lib/types';

interface AuthValue { profile: AppUser | null; school: School | null; loading: boolean; signIn: (email: string, password: string) => Promise<string | null>; signOut: () => Promise<void>; }
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async (session: Session | null) => {
      if (!session) { if (mounted) { setProfile(null); setSchool(null); setLoading(false); } return; }
      const { data } = await supabase.from('app_users').select('*').eq('user_id', session.user.id).maybeSingle();
      if (!mounted) return;
      setProfile(data as AppUser | null);
      if (data?.school_id) {
        const { data: schoolData } = await supabase.from('schools').select('id,name,logo_url').eq('id', data.school_id).maybeSingle();
        if (mounted) setSchool(schoolData as School | null);
      }
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { load(session); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error?.message ?? null;
  };
  const signOut = async () => { await supabase.auth.signOut(); setProfile(null); setSchool(null); };
  return <AuthContext.Provider value={{ profile, school, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider missing'); return value; }
