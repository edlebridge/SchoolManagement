import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronRight, Lock } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { supabase } from '@/lib/supabase';
import type { Exam, ExamSession } from '@/lib/types';
import { Card, Empty, Loading, Badge, Select } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

export default function TeacherExams() {
  const { profile } = useAuth();
  const { colors, styles } = useTheme();
  const { classes, subjects, classSubjects, examSessions, academicYears, loading } = useSchoolData();
  const [yearId, setYearId] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [fetching, setFetching] = useState(false);
  const [detailSession, setDetailSession] = useState<ExamSession | null>(null);

  const myClassIds = useMemo(() => {
    if (!profile?.id) return [];
    return classes.filter((c) => c.class_teacher_id === profile.id || classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === profile.id)).map((c) => c.id);
  }, [classes, classSubjects, profile?.id]);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const filteredSessions = useMemo(() => {
    if (!yearId) return examSessions;
    return examSessions.filter((s) => s.academic_year_id === yearId);
  }, [examSessions, yearId]);

  useEffect(() => {
    if (!profile?.school_id || !filteredSessions.length) { setExams([]); return; }
    setFetching(true);
    supabase.from('exams').select('*').in('exam_session_id', filteredSessions.map((s) => s.id)).in('class_id', myClassIds).order('exam_date', { ascending: true }).then(({ data }) => { setExams((data as Exam[]) ?? []); setFetching(false); });
  }, [filteredSessions, myClassIds, profile?.school_id]);

  const examsBySession = useMemo(() => {
    const m = new Map<string, Exam[]>();
    exams.forEach((e) => { const arr = m.get(e.exam_session_id) ?? []; arr.push(e); m.set(e.exam_session_id, arr); });
    return m;
  }, [exams]);

  if (loading) return <Loading />;

  if (detailSession) {
    const sessionExams = examsBySession.get(detailSession.id) ?? [];
    return (
      <View style={{ flex: 1 }}>
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
          <Pressable onPress={() => setDetailSession(null)}><Text style={{ color: colors.primary, fontWeight: '700' }}>‹ All sessions</Text></Pressable>
          <Text style={[styles.title, { marginTop: 14 }]}>{detailSession.name}</Text>
          <Text style={styles.subtitle}>{formatDate(detailSession.start_date)} – {formatDate(detailSession.end_date)}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Badge label={detailSession.status} color={colors.primary} bg={colors.primarySoft} />
            {detailSession.published && <Badge label="Published" color={colors.success} bg={colors.successSoft} />}
          </View>
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Exams ({sessionExams.length})</Text>
          {!sessionExams.length ? <Card><Empty title="No exams" body="No exams found for your classes in this session." /></Card> : sessionExams.map((e) => (
            <Card key={e.id}>
              <Text style={{ fontWeight: '700', color: colors.ink }}>{e.name}</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>{classMap.get(e.class_id)?.name ?? '—'} · {subjectMap.get(e.subject_id)?.name ?? '—'}</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>{formatDate(e.exam_date)} {e.start_time ? `· ${e.start_time}` : ''} {e.room ? `· ${e.room}` : ''} · {e.total_marks} marks</Text>
            </Card>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Examinations</Text>
      <Text style={styles.title}>Exam Sessions</Text>
      <Text style={styles.subtitle}>Sessions with exams for your classes</Text>
      {academicYears.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Select label="Academic Year" value={yearId} options={[{ label: 'All years', value: '' }, ...academicYears.map((y) => ({ label: y.name, value: y.id }))]} onSelect={setYearId} />
        </View>
      )}
      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Sessions</Text>
      {fetching ? <Loading /> : !filteredSessions.length ? <Card><Empty title="No exam sessions" body="Exam sessions will appear here once created by the school admin." /></Card> : filteredSessions.map((s) => {
        const count = (examsBySession.get(s.id) ?? []).length;
        return (
          <Pressable key={s.id} onPress={() => count > 0 && setDetailSession(s)}>
            <Card>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }}>{s.name}</Text>
                  <Text style={{ color: colors.muted, marginTop: 4 }}>{formatDate(s.start_date)} – {formatDate(s.end_date)}</Text>
                  <Text style={{ color: colors.muted, marginTop: 4 }}>{count} exam{count !== 1 ? 's' : ''} in your classes</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Badge label={s.status} color={colors.primary} bg={colors.primarySoft} />
                  {s.published && <Lock color={colors.muted} size={16} style={{ marginTop: 6 }} />}
                  {count > 0 && <ChevronRight color={colors.muted} size={20} style={{ marginTop: 6 }} />}
                </View>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
