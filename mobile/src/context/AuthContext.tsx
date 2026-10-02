import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { AppUser, School } from '@/lib/types';

interface AuthValue { profile: AppUser | null; school: School | null; loading: boolean; signIn: (email: string, password: string) => Promise<string | null>; signOut: () => Promise<void>; }
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  const loadingRef = useRef(false);

  const loadProfile = async (session: Session | null) => {
    if (!session) {
      sessionRef.current = null;
      setProfile(null);
      setSchool(null);
      setLoading(false);
      return;
    }

    if (loadingRef.current && sessionRef.current?.user?.id === session.user.id) return;

    sessionRef.current = session;
    loadingRef.current = true;

    const { data } = await supabase.from('app_users').select('*').eq('user_id', session.user.id).maybeSingle();
    setProfile(data as AppUser | null);
    if (data?.school_id) {
      const { data: schoolData } = await supabase.from('schools').select('id,name,logo_url').eq('id', data.school_id).maybeSingle();
      setSchool(schoolData as School | null);
    } else {
      setSchool(null);
    }
    setLoading(false);
    loadingRef.current = false;
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      loadProfile(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        sessionRef.current = null;
        setProfile(null);
        setSchool(null);
        setLoading(false);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (event === 'TOKEN_REFRESHED' && sessionRef.current?.user?.id === session?.user?.id && profile) {
          return;
        }
        loadProfile(session);
      }
    });

    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error?.message ?? null;
  };

  const signOut = async () => {
    sessionRef.current = null;
    setProfile(null);
    setSchool(null);
    setLoading(true);
    await supabase.auth.signOut();
  };

  return <AuthContext.Provider value={{ profile, school, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider missing'); return value; }
