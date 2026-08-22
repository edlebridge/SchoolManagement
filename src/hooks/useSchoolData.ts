import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Student, ClassRow, Subject, AppUser, ClassSubject, ExamSession } from '@/types';

interface SchoolData {
  students: Student[];
  teachers: AppUser[];
  parents: AppUser[];
  classes: ClassRow[];
  subjects: Subject[];
  classSubjects: ClassSubject[];
  examSessions: ExamSession[];
  loading: boolean;
  refresh: () => void;
}

export function useSchoolData(): SchoolData {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<AppUser[]>([]);
  const [parents, setParents] = useState<AppUser[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [examSessions, setExamSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!profile?.school_id) { setLoading(false); return; }
    const sid = profile.school_id;
    setLoading(true);
    Promise.all([
      supabase.from('students').select('*').eq('school_id', sid).order('full_name'),
      supabase.from('app_users').select('*').eq('school_id', sid).eq('role', 'teacher').order('full_name'),
      supabase.from('app_users').select('*').eq('school_id', sid).eq('role', 'parent').order('full_name'),
      supabase.from('classes').select('*').eq('school_id', sid).order('name'),
      supabase.from('subjects').select('*').eq('school_id', sid).order('name'),
      supabase.from('class_subjects').select('*').eq('school_id', sid),
      supabase.from('exam_sessions').select('*').eq('school_id', sid).order('created_at', { ascending: false }),
    ]).then(([s, t, p, c, sub, cs, es]) => {
      setStudents((s.data as Student[]) ?? []);
      setTeachers((t.data as AppUser[]) ?? []);
      setParents((p.data as AppUser[]) ?? []);
      setClasses((c.data as ClassRow[]) ?? []);
      setSubjects((sub.data as Subject[]) ?? []);
      setClassSubjects((cs.data as ClassSubject[]) ?? []);
      setExamSessions((es.data as ExamSession[]) ?? []);
      setLoading(false);
    });
  }, [profile?.school_id]);

  useEffect(() => { load(); }, [load]);

  return { students, teachers, parents, classes, subjects, classSubjects, examSessions, loading, refresh: load };
}
