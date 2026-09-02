import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { supabase } from '@/lib/supabase';
import type { Exam, ExamMark, Student, Subject } from '@/lib/types';
import { Card, Empty, Loading, Badge, Select } from '@/components/ui';
import { percentage, gradeFromPercentage, formatDate } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

interface ResultRow { student: Student; marks: number; totalMarks: number; position: number; subjectMarks: Record<string, { marks: number; total: number }>; }

export default function TeacherResults() {
  const { profile } = useAuth();
  const { colors, styles } = useTheme();
  const { classes, subjects, classSubjects, students, examSessions, academicYears, loading } = useSchoolData();
  const [yearId, setYearId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [classId, setClassId] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [marks, setMarks] = useState<ExamMark[]>([]);
  const [fetching, setFetching] = useState(false);

  const myClassIds = useMemo(() => {
    if (!profile?.id) return [];
    return classes.filter((c) => c.class_teacher_id === profile.id || classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === profile.id)).map((c) => c.id);
  }, [classes, classSubjects, profile?.id]);

  const filteredSessions = useMemo(() => {
    if (!yearId) return examSessions;
    return examSessions.filter((s) => s.academic_year_id === yearId);
  }, [examSessions, yearId]);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  useEffect(() => {
    if (!sessionId || !classId || !profile?.school_id) { setExams([]); setMarks([]); return; }
    setFetching(true);
    (async () => {
      const [ex, mk] = await Promise.all([
        supabase.from('exams').select('*').eq('school_id', profile.school_id).eq('exam_session_id', sessionId).eq('class_id', classId).order('exam_date', { ascending: true }),
        supabase.from('exam_marks').select('*').eq('school_id', profile.school_id).eq('class_id', classId).in('exam_id', (await supabase.from('exams').select('id').eq('exam_session_id', sessionId).eq('class_id', classId)).data?.map((x: { id: string }) => x.id) ?? []),
      ]);
      setExams((ex.data as Exam[]) ?? []);
      setMarks((mk.data as ExamMark[]) ?? []);
      setFetching(false);
    })();
  }, [sessionId, classId, profile?.school_id]);

  const classStudents = useMemo(() => students.filter((s) => s.class_id === classId && s.enrollment_status === 'active').sort((a, b) => a.full_name.localeCompare(b.full_name)), [students, classId]);

  const resultRows = useMemo(() => {
    const examIds = new Set(exams.map((e) => e.id));
    const relevantMarks = marks.filter((m) => examIds.has(m.exam_id));
    const byStudent = new Map<string, { marks: number; total: number; subjects: Record<string, { marks: number; total: number }> }>();
    relevantMarks.forEach((m) => {
      const cur = byStudent.get(m.student_id) ?? { marks: 0, total: 0, subjects: {} };
      cur.marks += m.marks;
      cur.total += m.total_marks;
      cur.subjects[m.subject_id] = { marks: m.marks, total: m.total_marks };
      byStudent.set(m.student_id, cur);
    });
    const rows: ResultRow[] = classStudents.map((s) => {
      const data = byStudent.get(s.id);
      return { student: s, marks: data?.marks ?? 0, totalMarks: data?.total ?? 0, position: 0, subjectMarks: data?.subjects ?? {} };
    });
    rows.sort((a, b) => b.marks - a.marks);
    let pos = 0; let prevMarks: number | null = null;
    rows.forEach((r) => { if (prevMarks === null || r.marks !== prevMarks) { pos++; prevMarks = r.marks; } r.position = pos; });
    return rows;
  }, [exams, marks, classStudents]);

  if (loading) return <Loading />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Examinations</Text>
      <Text style={styles.title}>Results</Text>
      <Text style={styles.subtitle}>View and analyze student performance</Text>

      {academicYears.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Select label="Academic Year" value={yearId} options={[{ label: 'All years', value: '' }, ...academicYears.map((y) => ({ label: y.name, value: y.id }))]} onSelect={(v) => { setYearId(v); setSessionId(''); setClassId(''); }} />
        </View>
      )}
      <Select label="Exam Session" value={sessionId} options={filteredSessions.map((s) => ({ label: s.name, value: s.id }))} onSelect={(v) => { setSessionId(v); setClassId(''); }} />
      <Select label="Class" value={classId} options={classes.filter((c) => myClassIds.includes(c.id)).map((c) => ({ label: c.name, value: c.id }))} onSelect={setClassId} />

      {fetching ? <Loading /> : sessionId && classId ? (
        <View style={{ marginTop: 16 }}>
          {!resultRows.length ? <Card><Empty title="No results" body="No marks found for this session and class." /></Card> : resultRows.map((r) => {
            const pct = r.totalMarks ? percentage(r.marks, r.totalMarks) : 0;
            const grade = gradeFromPercentage(pct);
            return (
              <Card key={r.student.id}>
                <View style={styles.row}>
                  {r.position <= 3 ? <Trophy color={r.position === 1 ? '#fbbf24' : r.position === 2 ? '#94a3b8' : '#cd7f32'} size={20} /> : <Text style={{ color: colors.muted, fontWeight: '700', width: 20 }}>#{r.position}</Text>}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontWeight: '700', color: colors.ink }}>{r.student.full_name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>{r.student.admission_number}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: '800', color: colors.ink }}>{r.marks}/{r.totalMarks}</Text>
                    <View style={{ marginTop: 4 }}><Badge label={`${pct}% · ${grade}`} color={pct >= 50 ? colors.success : colors.error} bg={pct >= 50 ? colors.successSoft : colors.errorSoft} /></View>
                  </View>
                </View>
                {Object.keys(r.subjectMarks).length > 0 && (
                  <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                    {Object.entries(r.subjectMarks).map(([sid, sm]) => (
                      <View key={sid} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                        <Text style={{ color: colors.muted }}>{subjectMap.get(sid)?.name ?? 'Subject'}</Text>
                        <Text style={{ color: colors.ink }}>{sm.marks}/{sm.total}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}
