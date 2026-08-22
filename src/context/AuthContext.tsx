import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { AppUser, School } from '@/types';

interface AuthContextValue {
  profile: AppUser | null;
  school: School | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingUid = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile(uid: string) {
      if (loadingUid.current === uid) return;
      loadingUid.current = uid;

      const { data: p } = await supabase.from('app_users').select('*').eq('user_id', uid).maybeSingle();
      if (!mounted) return;
      setProfile(p as AppUser | null);

      if (p?.school_id) {
        const { data: s } = await supabase.from('schools').select('*').eq('id', p.school_id).maybeSingle();
        if (mounted) setSchool(s as School | null);
      }
      if (mounted) setLoading(false);
    }

    // Single source of truth: onAuthStateChange handles INITIAL_SESSION, SIGNED_IN, SIGNED_OUT
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      if (!session) {
        loadingUid.current = null;
        setProfile(null);
        setSchool(null);
        setLoading(false);
        return;
      }
      loadProfile(session.user.id);
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ profile, school, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
