import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { Trophy, Download } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useParentMobile } from '@/context/ParentMobileContext';
import { supabase } from '@/lib/supabase';
import type { ExamMark, ExamSession, Exam, Subject } from '@/lib/types';
import { Card, Empty, Loading, Badge, Select, StatCard } from '@/components/ui';
import { percentage, gradeFromPercentage, formatDate } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

export default function ParentResults() {
  const { profile } = useAuth();
  const { selectedChild, loading } = useParentMobile();
  const { colors, styles } = useTheme();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [marks, setMarks] = useState<ExamMark[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [yearId, setYearId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!profile?.school_id || !selectedChild?.id) { setFetching(false); return; }
    (async () => {
      const [ay, sub] = await Promise.all([
        supabase.from('academic_years').select('id, name').eq('school_id', profile.school_id).order('start_date', { ascending: false }),
        supabase.from('subjects').select('*').eq('school_id', profile.school_id),
      ]);
      setAcademicYears((ay.data as { id: string; name: string }[]) ?? []);
      setSubjects((sub.data as Subject[]) ?? []);
      setFetching(false);
    })();
  }, [profile?.school_id, selectedChild?.id]);

  useEffect(() => {
    if (!profile?.school_id || !selectedChild?.id) { setSessions([]); setMarks([]); setExams([]); return; }
    (async () => {
      let q = supabase.from('exam_sessions').select('*').eq('school_id', profile.school_id).order('created_at', { ascending: false });
      if (yearId) q = q.eq('academic_year_id', yearId);
      const { data: sess } = await q;
      setSessions((sess as ExamSession[]) ?? []);
      setSessionId('');
    })();
  }, [profile?.school_id, selectedChild?.id, yearId]);

  useEffect(() => {
    if (!profile?.school_id || !selectedChild?.id || !sessionId) { setMarks([]); setExams([]); return; }
    (async () => {
      const { data: ex } = await supabase.from('exams').select('*').eq('school_id', profile.school_id).eq('exam_session_id', sessionId).order('exam_date', { ascending: true });
      const examList = (ex as Exam[]) ?? [];
      setExams(examList);
      if (examList.length) {
        const { data: mk } = await supabase.from('exam_marks').select('*').eq('school_id', profile.school_id).eq('student_id', selectedChild.id).in('exam_id', examList.map((e) => e.id)).order('created_at', { ascending: true });
        setMarks((mk as ExamMark[]) ?? []);
      } else { setMarks([]); }
    })();
  }, [profile?.school_id, selectedChild?.id, sessionId]);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const examMap = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);

  const resultRows = useMemo(() => {
    return marks.map((m) => {
      const exam = examMap.get(m.exam_id);
      const subject = subjectMap.get(m.subject_id);
      const pct = percentage(m.marks, m.total_marks);
      return { mark: m, subjectName: subject?.name ?? '—', examName: exam?.name ?? '—', pct, grade: gradeFromPercentage(pct) };
    });
  }, [marks, examMap, subjectMap]);

  const totalObtained = marks.reduce((sum, m) => sum + m.marks, 0);
  const totalMax = marks.reduce((sum, m) => sum + m.total_marks, 0);
  const avgPct = totalMax ? percentage(totalObtained, totalMax) : 0;

  const downloadCSV = () => {
    if (!resultRows.length) return;
    const headers = ['Subject', 'Exam', 'Marks', 'Total', 'Percentage', 'Grade'];
    const lines = [headers.join(',')];
    resultRows.forEach((r) => { lines.push([`"${r.subjectName}"`, `"${r.examName}"`, String(r.mark.marks), String(r.mark.total_marks), `${r.pct}%`, r.grade].join(',')); });
    lines.push('');
    lines.push(`"Overall","","${totalObtained}","${totalMax}","${avgPct}%",""`);
    const csv = lines.join('\n');
    Share.share({ message: csv, title: `Results_${selectedChild?.full_name ?? 'student'}` }).catch(() => {});
  };

  if (loading || fetching) return <Loading />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{selectedChild?.full_name ?? 'Student'}</Text>
      <Text style={styles.title}>Results</Text>
      <Text style={styles.subtitle}>Exam performance and grades</Text>

      {academicYears.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Select label="Academic Year" value={yearId} options={[{ label: 'All years', value: '' }, ...academicYears.map((y) => ({ label: y.name, value: y.id }))]} onSelect={(v) => { setYearId(v); setSessionId(''); }} />
        </View>
      )}
      <Select label="Exam Session" value={sessionId} options={sessions.map((s) => ({ label: s.name, value: s.id }))} onSelect={setSessionId} />

      {sessionId && marks.length > 0 && (
        <>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <StatCard icon={<Trophy color={colors.primary} size={22} />} value={`${avgPct}%`} label="Average" color={colors.primary} />
            <StatCard icon={<Trophy color={colors.primary} size={22} />} value={resultRows.length} label="Subjects" color={colors.primary} />
          </View>

          <Pressable onPress={downloadCSV} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, borderRadius: 14, paddingVertical: 13, marginTop: 12 }}>
            <Download color={colors.primary} size={18} /><Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 6 }}>Download Results</Text>
          </Pressable>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Subject Results</Text>
          {resultRows.map((r) => (
            <Card key={r.mark.id}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colors.ink }}>{r.subjectName}</Text>
                  <Text style={{ color: colors.muted, marginTop: 3 }}>{r.examName} · {formatDate(r.mark.created_at)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontWeight: '800', color: colors.ink }}>{r.mark.marks}/{r.mark.total_marks}</Text>
                  <View style={{ marginTop: 4 }}><Badge label={`${r.pct}% · ${r.grade}`} color={r.pct >= 50 ? colors.success : colors.error} bg={r.pct >= 50 ? colors.successSoft : colors.errorSoft} /></View>
                </View>
              </View>
              {r.mark.teacher_comment ? <Text style={{ color: colors.muted, marginTop: 8 }}>{r.mark.teacher_comment}</Text> : null}
            </Card>
          ))}

          <Card>
            <View style={styles.row}>
              <Text style={{ flex: 1, fontWeight: '700', color: colors.ink }}>Total</Text>
              <Text style={{ fontWeight: '800', color: colors.ink }}>{totalObtained}/{totalMax} · {avgPct}%</Text>
            </View>
          </Card>
        </>
      )}

      {sessionId && !marks.length && <Card><Empty title="No results" body="No exam marks found for this session." /></Card>}
      {!sessionId && <Card><Empty title="Select an exam session" body="Choose an academic year and exam session to view results." /></Card>}
    </ScrollView>
  );
}
