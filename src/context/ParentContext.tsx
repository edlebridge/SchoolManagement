import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Student, ClassRow } from '@/types';

interface ParentContextValue {
  children: Student[];
  classes: ClassRow[];
  selectedChild: Student | null;
  selectedChildClass: ClassRow | null;
  loading: boolean;
  selectChild: (id: string) => void;
  refresh: () => void;
}

const ParentContext = createContext<ParentContextValue | undefined>(undefined);
const STORAGE_KEY = 'edubridge:selectedChild';

export function ParentProvider({ children: kids }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [children, setChildren] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!profile?.user_id || !profile?.school_id) { setChildren([]); setLoading(false); return; }
    setLoading(true);
    (async () => {
      const { data: links } = await supabase.from('student_parents').select('student_id').eq('parent_user_id', profile.user_id);
      const ids = (links ?? []).map((l: { student_id: string }) => l.student_id);
      if (ids.length === 0) { setChildren([]); setClasses([]); setLoading(false); return; }
      const [studsRes, clsRes] = await Promise.all([
        supabase.from('students').select('*').in('id', ids).order('full_name'),
        supabase.from('classes').select('*').eq('school_id', profile.school_id).order('name'),
      ]);
      setChildren((studsRes.data as Student[]) ?? []);
      setClasses((clsRes.data as ClassRow[]) ?? []);
      setLoading(false);
    })();
  }, [profile?.user_id, profile?.school_id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (children.length === 0) { setSelectedId(''); return; }
    const saved = localStorage.getItem(STORAGE_KEY);
    const stillExists = saved && children.some((c) => c.id === saved);
    if (stillExists) setSelectedId(saved);
    else { setSelectedId(children[0].id); localStorage.setItem(STORAGE_KEY, children[0].id); }
  }, [children]);

  const selectChild = useCallback((id: string) => { setSelectedId(id); localStorage.setItem(STORAGE_KEY, id); }, []);
  const selectedChild = children.find((c) => c.id === selectedId) ?? null;
  const selectedChildClass = selectedChild?.class_id ? classes.find((c) => c.id === selectedChild.class_id) ?? null : null;

  return (
    <ParentContext.Provider value={{ children, classes, selectedChild, selectedChildClass, loading, selectChild, refresh: load }}>
      {kids}
    </ParentContext.Provider>
  );
}

export function useParent() {
  const ctx = useContext(ParentContext);
  if (!ctx) throw new Error('useParent must be used within ParentProvider');
  return ctx;
}
