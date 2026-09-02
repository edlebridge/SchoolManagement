import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useParentMobile } from '@/context/ParentMobileContext';
import { supabase } from '@/lib/supabase';
import type { ExamSession, Exam, Subject, ClassRow, AppUser } from '@/lib/types';
import { Card, Empty, Loading, Badge, Select } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

export default function ParentExams() {
  const { profile } = useAuth();
  const { selectedChild, loading } = useParentMobile();
  const { colors, styles } = useTheme();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<AppUser[]>([]);
  const [yearId, setYearId] = useState('');
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!profile?.school_id || !selectedChild?.class_id) { setFetching(false); return; }
    (async () => {
      const [ay, sub, cls, tch] = await Promise.all([
        supabase.from('academic_years').select('id, name').eq('school_id', profile.school_id).order('start_date', { ascending: false }),
        supabase.from('subjects').select('*').eq('school_id', profile.school_id),
        supabase.from('classes').select('*').eq('school_id', profile.school_id),
        supabase.from('app_users').select('*').eq('school_id', profile.school_id).eq('role', 'teacher'),
      ]);
      setAcademicYears((ay.data as { id: string; name: string }[]) ?? []);
      setSubjects((sub.data as Subject[]) ?? []);
      setClasses((cls.data as ClassRow[]) ?? []);
      setTeachers((tch.data as AppUser[]) ?? []);
      setFetching(false);
    })();
  }, [profile?.school_id, selectedChild?.class_id]);

  useEffect(() => {
    if (!profile?.school_id || !selectedChild?.class_id) { setSessions([]); setExams([]); return; }
    (async () => {
      let query = supabase.from('exam_sessions').select('*').eq('school_id', profile.school_id).order('created_at', { ascending: false });
      if (yearId) query = query.eq('academic_year_id', yearId);
      const { data: sess } = await query;
      setSessions((sess as ExamSession[]) ?? []);
      if (sess && sess.length) {
        const { data: ex } = await supabase.from('exams').select('*').in('exam_session_id', (sess as ExamSession[]).map((s) => s.id)).eq('class_id', selectedChild.class_id).order('exam_date', { ascending: true });
        setExams((ex as Exam[]) ?? []);
      } else { setExams([]); }
    })();
  }, [profile?.school_id, selectedChild?.class_id, yearId]);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);

  const examsBySession = useMemo(() => {
    const m = new Map<string, Exam[]>();
    exams.forEach((e) => { const arr = m.get(e.exam_session_id) ?? []; arr.push(e); m.set(e.exam_session_id, arr); });
    return m;
  }, [exams]);

  if (loading || fetching) return <Loading />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{selectedChild?.full_name ?? 'Student'}</Text>
      <Text style={styles.title}>Exams</Text>
      <Text style={styles.subtitle}>Exam sessions and timetable</Text>

      {academicYears.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Select label="Academic Year" value={yearId} options={[{ label: 'All years', value: '' }, ...academicYears.map((y) => ({ label: y.name, value: y.id }))]} onSelect={setYearId} />
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Sessions</Text>
      {!sessions.length ? <Card><Empty title="No exam sessions" body="Exam sessions will appear here once created." /></Card> : sessions.map((s) => {
        const sessionExams = examsBySession.get(s.id) ?? [];
        return (
          <Card key={s.id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }}>{s.name}</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>{formatDate(s.start_date)} – {formatDate(s.end_date)}</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>{sessionExams.length} exam{sessionExams.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Badge label={s.status} color={colors.primary} bg={colors.primarySoft} />
                {s.published && <Badge label="Published" color={colors.success} bg={colors.successSoft} />}
              </View>
            </View>
            {sessionExams.length > 0 && (
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                {sessionExams.map((e) => (
                  <View key={e.id} style={{ paddingVertical: 6 }}>
                    <Text style={{ fontWeight: '700', color: colors.ink }}>{e.name}</Text>
                    <Text style={{ color: colors.muted, marginTop: 3 }}>{subjectMap.get(e.subject_id)?.name ?? '—'} · {formatDate(e.exam_date)} {e.start_time ? `· ${e.start_time}` : ''} {e.room ? `· ${e.room}` : ''}</Text>
                    <Text style={{ color: colors.muted, marginTop: 2 }}>{e.total_marks} marks</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}
