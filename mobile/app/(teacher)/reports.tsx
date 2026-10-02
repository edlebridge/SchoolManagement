import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, Modal, Alert } from 'react-native';
import { FileText, AlertCircle, CheckCircle } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { StudentReport, Student, ClassRow, Term, AcademicYear } from '@/lib/types';
import { Card, Empty, Loading, Badge, Button, Field, Select } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  changes_requested: 'Changes Requested',
  resubmitted: 'Resubmitted',
  approved: 'Approved',
  published: 'Published',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#f59e0b',
  submitted: '#3b82f6',
  under_review: '#8b5cf6',
  changes_requested: '#f97316',
  resubmitted: '#3b82f6',
  approved: '#22c55e',
  published: '#1769e8',
};

export default function TeacherReports() {
  const { profile } = useAuth();
  const { colors, styles } = useTheme();
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [students, setStudents] = useState<Record<string, Student>>({});
  const [classes, setClasses] = useState<Record<string, ClassRow>>({});
  const [terms, setTerms] = useState<Record<string, Term>>({});
  const [years, setYears] = useState<Record<string, AcademicYear>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StudentReport | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ studentId: '', academicYearId: '', termId: '', progress: '', strengths: '', comment: '' });

  useEffect(() => {
    if (!profile?.id || !profile?.school_id) { setLoading(false); return; }
    (async () => {
      const [{ data: rpts }, { data: studs }, { data: cls }, { data: tms }, { data: yrs }] = await Promise.all([
        supabase.from('student_reports').select('*').eq('teacher_id', profile.id).order('updated_at', { ascending: false }),
        supabase.from('students').select('*').eq('school_id', profile.school_id),
        supabase.from('classes').select('*').eq('school_id', profile.school_id),
        supabase.from('terms').select('*').eq('school_id', profile.school_id),
        supabase.from('academic_years').select('*').eq('school_id', profile.school_id),
      ]);
      setReports((rpts as StudentReport[]) ?? []);
      const sm: Record<string, Student> = {};
      ((studs as Student[]) ?? []).forEach((s) => { sm[s.id] = s; });
      setStudents(sm);
      const cm: Record<string, ClassRow> = {};
      ((cls as ClassRow[]) ?? []).forEach((c) => { cm[c.id] = c; });
      setClasses(cm);
      const tm: Record<string, Term> = {};
      ((tms as Term[]) ?? []).forEach((t) => { tm[t.id] = t; });
      setTerms(tm);
      const ym: Record<string, AcademicYear> = {};
      ((yrs as AcademicYear[]) ?? []).forEach((y) => { ym[y.id] = y; });
      setYears(ym);
      setLoading(false);
    })();
  }, [profile?.id, profile?.school_id]);

  const canEdit = (status: string) => status === 'draft' || status === 'changes_requested';

  const openCreate = () => {
    const activeYear = Object.values(years).find((y) => y.is_active);
    const activeTerm = Object.values(terms).find((t) => t.academic_year_id === activeYear?.id && t.is_active);
    setForm({ studentId: '', academicYearId: activeYear?.id ?? '', termId: activeTerm?.id ?? '', progress: '', strengths: '', comment: '' });
    setCreateOpen(true);
  };

  const saveDraft = async () => {
    if (!form.studentId) { Alert.alert('Validation', 'Please select a student.'); return; }
    if (!form.academicYearId) { Alert.alert('Validation', 'Please select an academic year.'); return; }
    if (!profile?.id || !profile?.school_id) { Alert.alert('Error', 'Missing profile information.'); return; }
    if (saving) return;
    setSaving(true);
    try {
      const stu = students[form.studentId];
      const payload = {
        school_id: profile.school_id,
        student_id: form.studentId,
        teacher_id: profile.id,
        class_id: stu?.class_id ?? null,
        academic_year_id: form.academicYearId || null,
        term_id: form.termId || null,
        academic_progress: form.progress.trim() || null,
        strengths: form.strengths.trim() || null,
        areas_for_improvement: null,
        behaviour: null,
        teacher_comment: form.comment.trim() || null,
        recommendations: null,
        overall_assessment: 'good',
        status: 'draft',
        admin_feedback: null,
        approved_by: null,
        approved_at: null,
        published_at: null,
      };
      const { error } = await supabase.from('student_reports').insert(payload).select().single();
      if (error) throw error;
      setCreateOpen(false);
      const { data: rpts } = await supabase.from('student_reports').select('*').eq('teacher_id', profile.id).order('updated_at', { ascending: false });
      setReports((rpts as StudentReport[]) ?? []);
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message ?? 'Could not save report. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleResubmit = async (report: StudentReport) => {
    setSubmitting(report.id);
    try {
      const { error } = await supabase
        .from('student_reports')
        .update({ status: 'resubmitted', updated_at: new Date().toISOString() })
        .eq('id', report.id);
      if (error) throw error;
      setReports((prev) => prev.map((r) => r.id === report.id ? { ...r, status: 'resubmitted' } : r));
      setSelected(null);
    } catch { /* ignore */ } finally { setSubmitting(null); }
  };

  if (loading) return <Loading />;

  if (selected) {
    const stu = students[selected.student_id];
    const cls = classes[selected.class_id ?? ''];
    const term = terms[selected.term_id ?? ''];
    const yr = years[selected.academic_year_id ?? ''];
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Pressable onPress={() => setSelected(null)}><Text style={{ color: colors.primary, fontWeight: '600', marginBottom: 12 }}>← Back to Reports</Text></Pressable>
        <Text style={styles.eyebrow}>{stu?.full_name ?? 'Student'}</Text>
        <Text style={styles.title}>Report</Text>
        <Text style={styles.subtitle}>{cls?.name ?? ''} · {term?.name ?? ''} · {yr?.name ?? ''}</Text>

        <View style={{ marginTop: 12 }}>
          <Badge label={STATUS_LABELS[selected.status] ?? selected.status} color={STATUS_COLORS[selected.status] ?? colors.muted} bg={colors.primarySoft} />
        </View>

        {selected.status === 'changes_requested' && selected.admin_feedback && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AlertCircle color={colors.error} size={18} />
              <Text style={{ fontWeight: '700', color: colors.error }}>Admin Feedback</Text>
            </View>
            <Text style={{ color: colors.muted, marginTop: 8 }}>{selected.admin_feedback}</Text>
          </Card>
        )}

        {selected.attendance_summary && (
          <Card>
            <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 8 }}>Attendance</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Text style={{ fontWeight: '800', color: colors.ink }}>{selected.attendance_summary.percentage}%</Text>
              <Text style={{ color: colors.muted }}>Present: {selected.attendance_summary.present}</Text>
              <Text style={{ color: colors.muted }}>Absent: {selected.attendance_summary.absent}</Text>
              <Text style={{ color: colors.muted }}>Late: {selected.attendance_summary.late}</Text>
            </View>
          </Card>
        )}

        {selected.academic_results.length > 0 && (
          <Card>
            <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 8 }}>Academic Results</Text>
            {selected.academic_results.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ color: colors.muted }}>{r.subject}</Text>
                <Text style={{ color: colors.ink, fontWeight: '600' }}>{r.score} · {r.grade}</Text>
              </View>
            ))}
          </Card>
        )}

        {[
          ['Academic Progress', selected.academic_progress],
          ['Strengths', selected.strengths],
          ['Areas for Improvement', selected.areas_for_improvement],
          ['Behaviour & Participation', selected.behaviour],
          ["Teacher's Comment", selected.teacher_comment],
          ['Recommendations', selected.recommendations],
        ].map(([label, val]) => val && val.trim() ? (
          <Card key={label}>
            <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 6 }}>{label}</Text>
            <Text style={{ color: colors.muted }}>{val}</Text>
          </Card>
        ) : null)}

        {selected.overall_assessment && (
          <Card>
            <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 6 }}>Overall Assessment</Text>
            <Text style={{ color: colors.muted, textTransform: 'capitalize' }}>{selected.overall_assessment.replace(/_/g, ' ')}</Text>
          </Card>
        )}

        {canEdit(selected.status) && (
          <Pressable onPress={() => handleResubmit(selected)} disabled={submitting === selected.id} style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{submitting === selected.id ? 'Submitting...' : 'Resubmit to Admin'}</Text>
          </Pressable>
        )}
      </ScrollView>
    );
  }

  const studentOptions = Object.values(students).filter((s) => s.enrollment_status === 'active').map((s) => ({ label: s.full_name, value: s.id }));
  const yearOptions = Object.values(years).map((y) => ({ label: y.name, value: y.id }));
  const termOptions = form.academicYearId ? Object.values(terms).filter((t) => t.academic_year_id === form.academicYearId).map((t) => ({ label: t.name, value: t.id })) : [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Reports</Text>
      <Text style={styles.title}>Student Reports</Text>
      <Text style={styles.subtitle}>View and manage your student reports</Text>
      <Button label="New Student Report" onPress={openCreate} />

      {!reports.length ? (
        <Card><Empty title="No reports" body="Your student reports will appear here." /></Card>
      ) : (
        <View style={{ marginTop: 16 }}>
          {reports.map((r) => {
            const stu = students[r.student_id];
            const cls = classes[r.class_id ?? ''];
            return (
              <Card key={r.id}>
                <Pressable onPress={() => setSelected(r)}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: colors.ink }}>{stu?.full_name ?? 'Student'}</Text>
                      <Text style={{ color: colors.muted, marginTop: 3, fontSize: 13 }}>{cls?.name ?? ''} · {STATUS_LABELS[r.status] ?? r.status}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {r.status === 'changes_requested' ? <AlertCircle color={colors.error} size={20} /> : r.status === 'published' ? <CheckCircle color={colors.success} size={20} /> : <FileText color={colors.muted} size={20} />}
                    </View>
                  </View>
                </Pressable>
              </Card>
            );
          })}
        </View>
      )}

      <Modal visible={createOpen} animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Pressable onPress={() => setCreateOpen(false)}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>‹ Cancel</Text></Pressable>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginLeft: 16 }}>New Student Report</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Select label="Student" value={form.studentId} options={studentOptions} onSelect={(v) => setForm({ ...form, studentId: v })} />
            <Select label="Academic Year" value={form.academicYearId} options={yearOptions} onSelect={(v) => setForm({ ...form, academicYearId: v, termId: '' })} />
            <Select label="Term" value={form.termId} options={termOptions} onSelect={(v) => setForm({ ...form, termId: v })} />
            <Field label="Academic Progress" value={form.progress} onChangeText={(v) => setForm({ ...form, progress: v })} placeholder="Describe academic progress" multiline numberOfLines={4} />
            <Field label="Strengths" value={form.strengths} onChangeText={(v) => setForm({ ...form, strengths: v })} placeholder="Describe strengths" multiline numberOfLines={4} />
            <Field label="Teacher Comment" value={form.comment} onChangeText={(v) => setForm({ ...form, comment: v })} placeholder="Add an overall comment" multiline numberOfLines={4} />
            <Button label="Save Draft" onPress={saveDraft} loading={saving} />
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}
