import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Save } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { supabase } from '@/lib/supabase';
import type { Exam, ExamMark, Student } from '@/lib/types';
import { Card, Empty, Loading, Badge, Select } from '@/components/ui';
import { percentage, gradeFromPercentage } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

export default function TeacherMarks() {
  const { profile } = useAuth();
  const { colors, styles } = useTheme();
  const { classes, subjects, classSubjects, students, academicYears, examSessions, loading } = useSchoolData();
  const [yearId, setYearId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [examId, setExamId] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);

  const myClassIds = useMemo(() => {
    if (!profile?.id) return [];
    return classes.filter((c) => c.class_teacher_id === profile.id || classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === profile.id)).map((c) => c.id);
  }, [classes, classSubjects, profile?.id]);

  const filteredSessions = useMemo(() => {
    if (!yearId) return examSessions.filter((s) => s.status === 'scheduled' || s.status === 'published');
    return examSessions.filter((s) => s.academic_year_id === yearId && (s.status === 'scheduled' || s.status === 'published'));
  }, [examSessions, yearId]);

  const availableSubjects = useMemo(() => {
    if (!classId || !profile?.id) return [];
    return subjects.filter((s) => classSubjects.some((cs) => cs.class_id === classId && cs.subject_id === s.id && cs.teacher_id === profile.id));
  }, [classId, subjects, classSubjects, profile?.id]);

  const classStudents = useMemo(() => students.filter((s) => s.class_id === classId && s.enrollment_status === 'active'), [students, classId]);

  const selectedExam = useMemo(() => exams.find((e) => e.id === examId), [exams, examId]);

  useEffect(() => {
    if (!sessionId || !classId || !subjectId || !profile?.school_id) { setExams([]); return; }
    setFetching(true);
    supabase.from('exams').select('*').eq('school_id', profile.school_id).eq('exam_session_id', sessionId).eq('class_id', classId).eq('subject_id', subjectId).order('exam_date', { ascending: false }).then(({ data }) => { setExams((data as Exam[]) ?? []); setFetching(false); });
  }, [sessionId, classId, subjectId, profile?.school_id]);

  useEffect(() => {
    if (!examId) { setMarks({}); return; }
    supabase.from('exam_marks').select('*').eq('exam_id', examId).then(({ data }) => {
      const m: Record<string, string> = {};
      (data as ExamMark[])?.forEach((x) => { m[x.student_id] = String(x.marks); });
      setMarks(m);
    });
  }, [examId]);

  const save = async () => {
    if (!selectedExam || !profile?.id || !profile.school_id) return;
    setSaving(true);
    const rows = classStudents.map((s) => {
      const raw = marks[s.id] ?? '';
      const val = raw === '' ? null : Math.max(0, Math.min(selectedExam.total_marks, parseFloat(raw)));
      const pct = val != null ? percentage(val, selectedExam.total_marks) : 0;
      return { school_id: profile.school_id, exam_id: examId, student_id: s.id, subject_id: selectedExam.subject_id, class_id: classId, marks: val ?? 0, total_marks: selectedExam.total_marks, grade: val != null ? gradeFromPercentage(pct) : 'F', teacher_comment: null, entered_by: profile.id };
    });
    await supabase.from('exam_marks').upsert(rows, { onConflict: 'exam_id,student_id,subject_id' });
    setSaving(false);
  };

  if (loading) return <Loading />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Examinations</Text>
      <Text style={styles.title}>Marks</Text>
      <Text style={styles.subtitle}>Enter exam marks for your students</Text>

      {academicYears.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Select label="1. Academic Year" value={yearId} options={[{ label: 'All years', value: '' }, ...academicYears.map((y) => ({ label: y.name, value: y.id }))]} onSelect={(v) => { setYearId(v); setSessionId(''); setClassId(''); setSubjectId(''); setExamId(''); }} />
        </View>
      )}
      <Select label="2. Exam Session" value={sessionId} options={filteredSessions.map((s) => ({ label: s.name, value: s.id }))} onSelect={(v) => { setSessionId(v); setClassId(''); setSubjectId(''); setExamId(''); }} />
      <Select label="3. Class" value={classId} options={classes.filter((c) => myClassIds.includes(c.id)).map((c) => ({ label: c.name, value: c.id }))} onSelect={(v) => { setClassId(v); setSubjectId(''); setExamId(''); }} />
      <Select label="4. Subject" value={subjectId} options={availableSubjects.map((s) => ({ label: s.name, value: s.id }))} onSelect={(v) => { setSubjectId(v); setExamId(''); }} />
      <Select label="5. Exam" value={examId} options={exams.map((e) => ({ label: `${e.name} (${e.total_marks} marks)`, value: e.id }))} onSelect={(v) => setExamId(v)} />

      {fetching ? <Loading /> : examId && selectedExam ? (
        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.sectionTitle}>Students ({classStudents.length})</Text>
            <Pressable onPress={save} disabled={saving} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
              <Save color="#fff" size={18} /><Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
          {!classStudents.length ? <Card><Empty title="No students" body="No active students in this class." /></Card> : classStudents.map((s, i) => {
            const raw = marks[s.id] ?? '';
            const val = raw === '' ? null : parseFloat(raw);
            const pct = val != null ? percentage(val, selectedExam.total_marks) : 0;
            return (
              <Card key={s.id}>
                <View style={styles.row}>
                  <Text style={{ color: colors.muted, marginRight: 8 }}>{i + 1}.</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: colors.ink }}>{s.full_name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>{s.admission_number}</Text>
                  </View>
                  <TextInput
                    value={raw}
                    onChangeText={(v) => setMarks({ ...marks, [s.id]: v })}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    style={{ width: 60, textAlign: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 8, color: colors.ink }}
                  />
                  <Text style={{ color: colors.muted, marginLeft: 6 }}>/ {selectedExam.total_marks}</Text>
                  {val != null && <View style={{ marginLeft: 8 }}><Badge label={gradeFromPercentage(pct)} color={pct >= 50 ? colors.success : colors.error} bg={pct >= 50 ? colors.successSoft : colors.errorSoft} /></View>}
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}
