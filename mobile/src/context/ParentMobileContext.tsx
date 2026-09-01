import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Student, ClassRow } from '@/lib/types';

interface ParentMobileValue { children: Student[]; selectedChild: Student | null; selectedClass: ClassRow | null; selectChild: (id: string) => void; loading: boolean; }
const Context = createContext<ParentMobileValue | null>(null);
export function ParentMobileProvider({ children: content }: { children: ReactNode }) { const { profile } = useAuth(); const [children, setChildren] = useState<Student[]>([]); const [classes, setClasses] = useState<ClassRow[]>([]); const [selectedId, setSelectedId] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { if (!profile?.user_id || !profile.school_id) return; (async () => { setLoading(true); const { data: links } = await supabase.from('student_parents').select('student_id').eq('parent_user_id', profile.user_id); const ids = (links ?? []).map((x: { student_id: string }) => x.student_id); if (!ids.length) { setChildren([]); setLoading(false); return; } const [students, classRows] = await Promise.all([supabase.from('students').select('*').in('id', ids).order('full_name'), supabase.from('classes').select('*').eq('school_id', profile.school_id).order('name')]); const list = (students.data as Student[]) ?? []; setChildren(list); setClasses((classRows.data as ClassRow[]) ?? []); setSelectedId((current) => current && list.some((x) => x.id === current) ? current : list[0]?.id ?? ''); setLoading(false); })(); }, [profile?.user_id, profile?.school_id]);
  const selectedChild = children.find((x) => x.id === selectedId) ?? null; const selectedClass = classes.find((x) => x.id === selectedChild?.class_id) ?? null; return <Context.Provider value={{ children, selectedChild, selectedClass, selectChild: setSelectedId, loading }}>{content}</Context.Provider>; }
export function useParentMobile() { const value = useContext(Context); if (!value) throw new Error('ParentMobileProvider missing'); return value; }
