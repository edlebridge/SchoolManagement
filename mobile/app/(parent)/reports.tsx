import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { FileText, Download, ChevronDown, CheckCircle } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useParentMobile } from '@/context/ParentMobileContext';
import { supabase } from '@/lib/supabase';
import type { StudentReport, School, ClassRow, Term, AcademicYear, AppUser } from '@/lib/types';
import { Card, Empty, Loading, Badge, Select } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

export default function ParentReports() {
  const { profile } = useAuth();
  const { children, selectedChild, selectChild, loading } = useParentMobile();
  const { colors, styles } = useTheme();
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [classes, setClasses] = useState<Record<string, ClassRow>>({});
  const [terms, setTerms] = useState<Record<string, Term>>({});
  const [years, setYears] = useState<Record<string, AcademicYear>>({});
  const [teachers, setTeachers] = useState<Record<string, AppUser>>({});
  const [fetching, setFetching] = useState(true);
  const [selectedReport, setSelectedReport] = useState<StudentReport | null>(null);

  useEffect(() => {
    if (!profile?.school_id) { setFetching(false); return; }
    (async () => {
      const [{ data: s }, { data: cls }, { data: tms }, { data: yrs }, { data: tchs }] = await Promise.all([
        supabase.from('schools').select('*').eq('id', profile.school_id).maybeSingle(),
        supabase.from('classes').select('*').eq('school_id', profile.school_id),
        supabase.from('terms').select('*').eq('school_id', profile.school_id),
        supabase.from('academic_years').select('*').eq('school_id', profile.school_id),
        supabase.from('app_users').select('*').eq('school_id', profile.school_id).eq('role', 'teacher'),
      ]);
      setSchool((s as School) ?? null);
      const cm: Record<string, ClassRow> = {};
      ((cls as ClassRow[]) ?? []).forEach((c) => { cm[c.id] = c; });
      setClasses(cm);
      const tm: Record<string, Term> = {};
      ((tms as Term[]) ?? []).forEach((t) => { tm[t.id] = t; });
      setTerms(tm);
      const ym: Record<string, AcademicYear> = {};
      ((yrs as AcademicYear[]) ?? []).forEach((y) => { ym[y.id] = y; });
      setYears(ym);
      const tm2: Record<string, AppUser> = {};
      ((tchs as AppUser[]) ?? []).forEach((t) => { tm2[t.id] = t; });
      setTeachers(tm2);
    })();
  }, [profile?.school_id]);

  useEffect(() => {
    if (!selectedChild?.id || !profile?.user_id) { setReports([]); setFetching(false); return; }
    setFetching(true);
    (async () => {
      const { data: links } = await supabase
        .from('student_parents')
        .select('student_id')
        .eq('parent_user_id', profile.user_id);
      const childIds = ((links ?? []).map((x: { student_id: string }) => x.student_id));
      if (!childIds.includes(selectedChild.id)) { setReports([]); setFetching(false); return; }
      const { data: rpts } = await supabase
        .from('student_reports')
        .select('*')
        .eq('student_id', selectedChild.id)
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      setReports((rpts as StudentReport[]) ?? []);
      setFetching(false);
    })();
  }, [selectedChild?.id, profile?.user_id]);

  const publishedReports = useMemo(() => reports.filter((r) => r.status === 'published'), [reports]);

  const downloadReport = (report: StudentReport) => {
    const stu = selectedChild;
    const cls = classes[report.class_id ?? ''];
    const term = terms[report.term_id ?? ''];
    const yr = years[report.academic_year_id ?? ''];
    const teacher = teachers[report.teacher_id];
    const att = report.attendance_summary;
    const lines: string[] = [];
    lines.push(`${school?.name ?? 'School'} - Student Report`);
    lines.push('='.repeat(40));
    lines.push(`Student: ${stu?.full_name ?? ''}`);
    lines.push(`Admission No: ${stu?.admission_number ?? ''}`);
    lines.push(`Class: ${cls?.name ?? ''}`);
    lines.push(`Academic Year: ${yr?.name ?? ''}`);
    lines.push(`Term: ${term?.name ?? ''}`);
    lines.push(`Teacher: ${teacher?.full_name ?? ''}`);
    lines.push(`Published: ${report.published_at ? formatDate(report.published_at) : ''}`);
    lines.push('');
    if (att) {
      lines.push('ATTENDANCE');
      lines.push(`Overall: ${att.percentage}%`);
      lines.push(`Present: ${att.present}, Absent: ${att.absent}, Late: ${att.late}, Excused: ${att.excused}`);
      lines.push('');
    }
    if (report.academic_results.length > 0) {
      lines.push('ACADEMIC RESULTS');
      report.academic_results.forEach((r) => lines.push(`  ${r.subject}: ${r.score} (${r.grade})`));
      lines.push('');
    }
    const sections: [string, string | null | undefined][] = [
      ['Academic Progress', report.academic_progress],
      ['Strengths', report.strengths],
      ['Areas for Improvement', report.areas_for_improvement],
      ['Behaviour & Participation', report.behaviour],
      ["Teacher's Comment", report.teacher_comment],
      ['Recommendations', report.recommendations],
    ];
    sections.forEach(([label, val]) => {
      if (val && val.trim()) { lines.push(label.toUpperCase()); lines.push(val); lines.push(''); }
    });
    if (report.overall_assessment) { lines.push('OVERALL ASSESSMENT'); lines.push(report.overall_assessment.replace(/_/g, ' ')); }
    Share.share({ message: lines.join('\n'), title: `Report_${stu?.full_name ?? 'student'}` }).catch(() => {});
  };

  if (loading || fetching) return <Loading />;

  // Detail view
  if (selectedReport) {
    const cls = classes[selectedReport.class_id ?? ''];
    const term = terms[selectedReport.term_id ?? ''];
    const yr = years[selectedReport.academic_year_id ?? ''];
    const teacher = teachers[selectedReport.teacher_id];
    const att = selectedReport.attendance_summary;
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Pressable onPress={() => setSelectedReport(null)}><Text style={{ color: colors.primary, fontWeight: '600', marginBottom: 12 }}>← Back to Reports</Text></Pressable>

        {/* School header */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {school?.logo_url ? null : <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>E</Text></View>}
            <View>
              <Text style={{ fontWeight: '800', color: colors.ink, fontSize: 16 }}>{school?.name ?? 'School'}</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Official Student Report</Text>
            </View>
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.muted }}>Student</Text><Text style={{ fontWeight: '700', color: colors.ink }}>{selectedChild?.full_name}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: colors.muted }}>Class</Text><Text style={{ color: colors.ink }}>{cls?.name ?? '—'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: colors.muted }}>Academic Year</Text><Text style={{ color: colors.ink }}>{yr?.name ?? '—'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: colors.muted }}>Term</Text><Text style={{ color: colors.ink }}>{term?.name ?? '—'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: colors.muted }}>Teacher</Text><Text style={{ color: colors.ink }}>{teacher?.full_name ?? '—'}</Text>
          </View>
        </Card>

        {att && (
          <Card>
            <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 8 }}>Attendance</Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.primary }}>{att.percentage}%</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
              <Text style={{ color: colors.success }}>Present: {att.present}</Text>
              <Text style={{ color: colors.error }}>Absent: {att.absent}</Text>
              <Text style={{ color: '#f59e0b' }}>Late: {att.late}</Text>
              <Text style={{ color: colors.muted }}>Excused: {att.excused}</Text>
            </View>
          </Card>
        )}

        {selectedReport.academic_results.length > 0 && (
          <Card>
            <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 8 }}>Academic Results</Text>
            {selectedReport.academic_results.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: i < selectedReport.academic_results.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.muted }}>{r.subject}</Text>
                <Text style={{ color: colors.ink, fontWeight: '600' }}>{r.score} · {r.grade}</Text>
              </View>
            ))}
          </Card>
        )}

        {[
          ['Academic Progress', selectedReport.academic_progress],
          ['Strengths', selectedReport.strengths],
          ['Areas for Improvement', selectedReport.areas_for_improvement],
          ['Behaviour & Participation', selectedReport.behaviour],
          ["Teacher's Overall Comment", selectedReport.teacher_comment],
          ['Recommendations', selectedReport.recommendations],
        ].map(([label, val]) => val && val.trim() ? (
          <Card key={label}>
            <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 6 }}>{label}</Text>
            <Text style={{ color: colors.muted }}>{val}</Text>
          </Card>
        ) : null)}

        {selectedReport.overall_assessment && (
          <Card>
            <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 6 }}>Overall Assessment</Text>
            <Text style={{ color: colors.muted, textTransform: 'capitalize', fontWeight: '600' }}>{selectedReport.overall_assessment.replace(/_/g, ' ')}</Text>
          </Card>
        )}

        <Pressable onPress={() => downloadReport(selectedReport)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, borderRadius: 14, paddingVertical: 13, marginTop: 12 }}>
          <Download color={colors.primary} size={18} /><Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 6 }}>Download Report</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // List view
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Reports</Text>
      <Text style={styles.title}>Student Reports</Text>
      <Text style={styles.subtitle}>View your child's school reports</Text>

      {children.length > 1 && (
        <View style={{ marginTop: 16 }}>
          <Select
            label="Select Child"
            value={selectedChild?.id ?? ''}
            options={children.map((c) => ({ label: c.full_name, value: c.id }))}
            onSelect={selectChild}
          />
        </View>
      )}

      <View style={{ marginTop: 16 }}>
        {!publishedReports.length ? (
          <Card><Empty title="No reports available" body="Published reports will appear here once the school releases them." /></Card>
        ) : (
          publishedReports.map((r) => {
            const term = terms[r.term_id ?? ''];
            const yr = years[r.academic_year_id ?? ''];
            const cls = classes[r.class_id ?? ''];
            return (
              <Card key={r.id}>
                <Pressable onPress={() => setSelectedReport(r)}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: colors.ink }}>{term?.name ?? 'Term'} Report</Text>
                      <Text style={{ color: colors.muted, marginTop: 4, fontSize: 13 }}>{yr?.name ?? ''} · {cls?.name ?? ''}</Text>
                      <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>Published {r.published_at ? formatDate(r.published_at) : ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <CheckCircle color={colors.success} size={20} />
                      <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 6, fontSize: 13 }}>View</Text>
                    </View>
                  </View>
                </Pressable>
              </Card>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
