import { useMemo, useState, useEffect } from 'react';
import { FileText, Plus, Pencil, Eye, Send, ArrowLeft, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useAcademic } from '@/context/AcademicContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Spinner';
import { formatDate, relativeTime } from '@/lib/utils';
import type { StudentReport, Student, ClassRow, AcademicYear, Term, ExamMark, Attendance } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  changes_requested: 'Changes Requested',
  resubmitted: 'Resubmitted',
  approved: 'Approved',
  published: 'Published',
};

const ASSESSMENT_OPTIONS = [
  { value: '', label: 'Select assessment' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'very_good', label: 'Very Good' },
  { value: 'good', label: 'Good' },
  { value: 'satisfactory', label: 'Satisfactory' },
  { value: 'needs_improvement', label: 'Needs Improvement' },
];

interface ReportForm {
  student_id: string;
  class_id: string;
  academic_year_id: string;
  term_id: string;
  academic_progress: string;
  strengths: string;
  areas_for_improvement: string;
  behaviour: string;
  teacher_comment: string;
  recommendations: string;
  overall_assessment: string;
}

const emptyForm: ReportForm = {
  student_id: '',
  class_id: '',
  academic_year_id: '',
  term_id: '',
  academic_progress: '',
  strengths: '',
  areas_for_improvement: '',
  behaviour: '',
  teacher_comment: '',
  recommendations: '',
  overall_assessment: '',
};

export function TeacherReports() {
  const { profile } = useAuth();
  const { classes, subjects, classSubjects, students, loading } = useSchoolData();
  const { years, terms } = useAcademic();
  const { toast } = useToast();

  const [reports, setReports] = useState<StudentReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState<StudentReport | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitConfirm, setSubmitConfirm] = useState<StudentReport | null>(null);
  const [form, setForm] = useState<ReportForm>(emptyForm);
  const [attendanceData, setAttendanceData] = useState<{ percentage: number; present: number; absent: number; late: number; excused: number } | null>(null);
  const [academicData, setAcademicData] = useState<{ subject: string; score: string; grade: string }[]>([]);

  const myClasses = useMemo(() => {
    if (!profile) return [];
    return classes.filter(
      (c) =>
        c.class_teacher_id === profile.id ||
        classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === profile.id)
    );
  }, [classes, classSubjects, profile]);

  const myClassIds = useMemo(() => new Set(myClasses.map((c) => c.id)), [myClasses]);

  const myStudents = useMemo(
    () => students.filter((s) => s.class_id && myClassIds.has(s.class_id) && s.enrollment_status === 'active'),
    [students, myClassIds]
  );

  const classMap = useMemo(() => {
    const m: Record<string, ClassRow> = {};
    classes.forEach((c) => { m[c.id] = c; });
    return m;
  }, [classes]);

  const studentMap = useMemo(() => {
    const m: Record<string, Student> = {};
    students.forEach((s) => { m[s.id] = s; });
    return m;
  }, [students]);

  const yearMap = useMemo(() => {
    const m: Record<string, AcademicYear> = {};
    years.forEach((y) => { m[y.id] = y; });
    return m;
  }, [years]);

  const termMap = useMemo(() => {
    const m: Record<string, Term> = {};
    terms.forEach((t) => { m[t.id] = t; });
    return m;
  }, [terms]);

  const loadReports = async () => {
    if (!profile?.id) return;
    setReportsLoading(true);
    const { data } = await supabase
      .from('student_reports')
      .select('*')
      .eq('teacher_id', profile.id)
      .order('updated_at', { ascending: false });
    setReports((data as StudentReport[]) ?? []);
    setReportsLoading(false);
  };

  useEffect(() => { loadReports(); }, [profile?.id]);

  // Load attendance + academic data when student is selected in the form
  useEffect(() => {
    if (!form.student_id || !profile?.school_id) { setAttendanceData(null); setAcademicData([]); return; }
    (async () => {
      const [{ data: att }, { data: marks }] = await Promise.all([
        supabase.from('attendance').select('*').eq('student_id', form.student_id),
        supabase.from('exam_marks').select('*').eq('student_id', form.student_id),
      ]);
      const attRecords = (att as Attendance[]) ?? [];
      const present = attRecords.filter((a) => a.status === 'present').length;
      const absent = attRecords.filter((a) => a.status === 'absent').length;
      const late = attRecords.filter((a) => a.status === 'late').length;
      const excused = attRecords.filter((a) => a.status === 'excused').length;
      const total = attRecords.length;
      const pct = total > 0 ? Math.round((present / total) * 100) : 0;
      setAttendanceData({ percentage: pct, present, absent, late, excused });

      const markRecords = (marks as ExamMark[]) ?? [];
      const results: { subject: string; score: string; grade: string }[] = [];
      for (const m of markRecords) {
        const subj = subjects.find((s) => s.id === m.subject_id);
        const pctScore = m.total_marks > 0 ? Math.round(((m.marks ?? 0) / m.total_marks) * 100) : 0;
        results.push({
          subject: subj?.name ?? 'Unknown',
          score: `${pctScore}%`,
          grade: m.grade ?? '—',
        });
      }
      setAcademicData(results);
    })();
  }, [form.student_id, profile?.school_id, subjects]);

  const stats = useMemo(() => {
    const draft = reports.filter((r) => r.status === 'draft').length;
    const submitted = reports.filter((r) => r.status === 'submitted' || r.status === 'resubmitted').length;
    const changesRequested = reports.filter((r) => r.status === 'changes_requested').length;
    const approved = reports.filter((r) => r.status === 'approved').length;
    const published = reports.filter((r) => r.status === 'published').length;
    return { totalStudents: myStudents.length, draft, submitted, changesRequested, approved, published };
  }, [reports, myStudents.length]);

  const canEdit = (status: string) => status === 'draft' || status === 'changes_requested';

  const openCreate = () => {
    const activeYear = years.find((y) => y.is_active) ?? years[0];
    const activeTerm = terms.find((t) => t.is_active) ?? terms[0];
    setEditId(null);
    setForm({
      ...emptyForm,
      class_id: myClasses[0]?.id ?? '',
      academic_year_id: activeYear?.id ?? '',
      term_id: activeTerm?.id ?? '',
    });
    setAttendanceData(null);
    setAcademicData([]);
    setModalOpen(true);
  };

  const openEdit = (report: StudentReport) => {
    setEditId(report.id);
    setForm({
      student_id: report.student_id,
      class_id: report.class_id ?? '',
      academic_year_id: report.academic_year_id ?? '',
      term_id: report.term_id ?? '',
      academic_progress: report.academic_progress ?? '',
      strengths: report.strengths ?? '',
      areas_for_improvement: report.areas_for_improvement ?? '',
      behaviour: report.behaviour ?? '',
      teacher_comment: report.teacher_comment ?? '',
      recommendations: report.recommendations ?? '',
      overall_assessment: report.overall_assessment ?? '',
    });
    setModalOpen(true);
  };

  const handleSaveDraft = async () => {
    if (!profile?.id || !profile?.school_id) { toast('Missing profile', 'error'); return; }
    if (!form.student_id || !form.class_id) { toast('Select a student and class', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        school_id: profile.school_id,
        teacher_id: profile.id,
        student_id: form.student_id,
        class_id: form.class_id,
        academic_year_id: form.academic_year_id || null,
        term_id: form.term_id || null,
        academic_progress: form.academic_progress,
        strengths: form.strengths,
        areas_for_improvement: form.areas_for_improvement,
        behaviour: form.behaviour,
        attendance_summary: attendanceData,
        academic_results: academicData,
        teacher_comment: form.teacher_comment,
        recommendations: form.recommendations,
        overall_assessment: form.overall_assessment,
        status: 'draft',
      };
      if (editId) {
        const { error } = await supabase.from('student_reports').update(payload).eq('id', editId);
        if (error) throw error;
        toast('Report draft updated');
      } else {
        const { error } = await supabase.from('student_reports').insert(payload);
        if (error) throw error;
        toast('Report draft saved');
      }
      setModalOpen(false);
      loadReports();
    } catch { toast('Failed to save report', 'error'); } finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    if (!submitConfirm) return;
    setSubmitting(submitConfirm.id);
    try {
      const { error } = await supabase
        .from('student_reports')
        .update({ status: 'submitted', updated_at: new Date().toISOString() })
        .eq('id', submitConfirm.id);
      if (error) throw error;
      // Notify school admins
      const { data: admins } = await supabase
        .from('app_users')
        .select('user_id')
        .eq('school_id', submitConfirm.school_id)
        .eq('role', 'school_admin')
        .eq('active', true);
      const stu = studentMap[submitConfirm.student_id];
      if (admins && admins.length > 0) {
        const notifications = admins.map((a: { user_id: string }) => ({
          school_id: submitConfirm.school_id,
          user_id: a.user_id,
          type: 'student_report_submitted',
          title: 'New student report submitted for review',
          body: `${stu?.full_name ?? 'A student'}'s report has been submitted by ${profile?.full_name ?? 'a teacher'}.`,
          link: '/school-admin/reports',
        }));
        await supabase.from('notifications').insert(notifications);
      }
      toast('Report submitted to admin for review');
      setSubmitConfirm(null);
      loadReports();
    } catch { toast('Failed to submit report', 'error'); } finally { setSubmitting(null); }
  };

  const filteredTerms = useMemo(() => {
    if (!form.academic_year_id) return terms;
    return terms.filter((t) => t.academic_year_id === form.academic_year_id);
  }, [terms, form.academic_year_id]);

  const studentsInClass = useMemo(
    () => myStudents.filter((s) => s.class_id === form.class_id),
    [myStudents, form.class_id]
  );

  const previewStudent = previewReport ? studentMap[previewReport.student_id] : null;
  const previewClass = previewReport ? classMap[previewReport.class_id ?? ''] : null;
  const previewYear = previewReport ? yearMap[previewReport.academic_year_id ?? ''] : null;
  const previewTerm = previewReport ? termMap[previewReport.term_id ?? ''] : null;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Write and manage reports for your students."
        icon={<FileText className="h-5 w-5" />}
        action={<Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>Write Report</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Students" value={stats.totalStudents} icon={<FileText className="h-5 w-5 text-primary" />} />
        <StatCard label="Draft" value={stats.draft} icon={<Pencil className="h-5 w-5 text-amber-500" />} accent="bg-amber-50 dark:bg-amber-500/15" />
        <StatCard label="Submitted" value={stats.submitted} icon={<Send className="h-5 w-5 text-blue-500" />} accent="bg-blue-50 dark:bg-blue-500/15" />
        <StatCard label="Changes Requested" value={stats.changesRequested} icon={<AlertCircle className="h-5 w-5 text-orange-500" />} accent="bg-orange-50 dark:bg-orange-500/15" />
        <StatCard label="Approved" value={stats.approved} icon={<CheckCircle className="h-5 w-5 text-green-500" />} accent="bg-green-50 dark:bg-green-500/15" />
        <StatCard label="Published" value={stats.published} icon={<CheckCircle className="h-5 w-5 text-primary" />} />
      </div>

      <div className="mt-6">
        {loading || reportsLoading ? (
          <RowSkeleton rows={5} />
        ) : reports.length === 0 ? (
          <Card>
            <EmptyState
              title="No reports yet"
              description="Click 'Write Report' to create your first student report."
              icon={<FileText className="h-10 w-10" />}
            />
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-left text-ink-muted">
                    <th className="py-2 pr-4 font-medium">Student</th>
                    <th className="py-2 pr-4 font-medium">Class</th>
                    <th className="py-2 pr-4 font-medium">Term</th>
                    <th className="py-2 pr-4 font-medium">Academic Year</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Last Updated</th>
                    <th className="py-2 pr-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {reports.map((r) => {
                    const stu = studentMap[r.student_id];
                    const cls = classMap[r.class_id ?? ''];
                    const term = termMap[r.term_id ?? ''];
                    const yr = yearMap[r.academic_year_id ?? ''];
                    return (
                      <tr key={r.id} className="text-ink-soft">
                        <td className="py-2.5 pr-4 font-medium text-ink">{stu?.full_name ?? '—'}</td>
                        <td className="py-2.5 pr-4">{cls?.name ?? '—'}</td>
                        <td className="py-2.5 pr-4">{term?.name ?? '—'}</td>
                        <td className="py-2.5 pr-4">{yr?.name ?? '—'}</td>
                        <td className="py-2.5 pr-4"><Badge variant={statusBadge(r.status).variant}>{STATUS_LABELS[r.status] ?? r.status}</Badge></td>
                        <td className="py-2.5 pr-4 text-ink-muted">{relativeTime(r.updated_at)}</td>
                        <td className="py-2.5 pr-4">
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => setPreviewReport(r)}>View</Button>
                            {canEdit(r.status) && (
                              <>
                                <Button size="sm" variant="ghost" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(r)}>Edit</Button>
                                <Button size="sm" variant="ghost" leftIcon={<Send className="h-3.5 w-3.5" />} loading={submitting === r.id} onClick={() => setSubmitConfirm(r)}>Submit</Button>
                              </>
                            )}
                            {r.status === 'changes_requested' && r.admin_feedback && (
                              <span className="text-xs text-orange-600 dark:text-orange-400" title={r.admin_feedback}>Has feedback</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Write/Edit Report Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Student Report' : 'Write Student Report'}
        description="Fill in the report sections below. Attendance and academic results are retrieved automatically."
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => { if (editId) { setPreviewReport(reports.find((r) => r.id === editId) ?? null); } }}>Preview</Button>
            <Button onClick={handleSaveDraft} loading={saving}>Save Draft</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select label="Class" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value, student_id: '' })}>
              <option value="">Select a class</option>
              {myClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Student" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} disabled={!form.class_id}>
              <option value="">Select a student</option>
              {studentsInClass.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </Select>
            <Select label="Academic Year" value={form.academic_year_id} onChange={(e) => setForm({ ...form, academic_year_id: e.target.value, term_id: '' })}>
              <option value="">Select academic year</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
            <Select label="Term" value={form.term_id} onChange={(e) => setForm({ ...form, term_id: e.target.value })}>
              <option value="">Select term</option>
              {filteredTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>

          {/* Auto-retrieved attendance */}
          {form.student_id && attendanceData && (
            <div className="rounded-xl border border-surface-border bg-surface-overlay p-4">
              <p className="mb-2 text-sm font-semibold text-ink">Attendance (Auto-retrieved)</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="font-bold text-ink">{attendanceData.percentage}%</span>
                <span className="text-green-600">Present: {attendanceData.present}</span>
                <span className="text-red-500">Absent: {attendanceData.absent}</span>
                <span className="text-amber-500">Late: {attendanceData.late}</span>
                <span className="text-blue-500">Excused: {attendanceData.excused}</span>
              </div>
            </div>
          )}

          {/* Auto-retrieved academic results */}
          {form.student_id && academicData.length > 0 && (
            <div className="rounded-xl border border-surface-border bg-surface-overlay p-4">
              <p className="mb-2 text-sm font-semibold text-ink">Academic Results (Auto-retrieved)</p>
              <div className="space-y-1">
                {academicData.map((r, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-ink-soft">{r.subject}</span>
                    <span className="font-medium text-ink">{r.score} · {r.grade}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Textarea label="Academic Progress" placeholder="Describe the student's academic progress..." rows={3} value={form.academic_progress} onChange={(e) => setForm({ ...form, academic_progress: e.target.value })} />
          <Textarea label="Strengths" placeholder="Describe the student's strengths..." rows={3} value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} />
          <Textarea label="Areas for Improvement" placeholder="Describe areas for improvement..." rows={3} value={form.areas_for_improvement} onChange={(e) => setForm({ ...form, areas_for_improvement: e.target.value })} />
          <Textarea label="Behaviour & Participation" placeholder="Describe behaviour and participation..." rows={3} value={form.behaviour} onChange={(e) => setForm({ ...form, behaviour: e.target.value })} />
          <Textarea label="Teacher's Overall Comment" placeholder="Overall comment about the student..." rows={3} value={form.teacher_comment} onChange={(e) => setForm({ ...form, teacher_comment: e.target.value })} />
          <Textarea label="Recommendations" placeholder="Recommendations for the student..." rows={3} value={form.recommendations} onChange={(e) => setForm({ ...form, recommendations: e.target.value })} />
          <Select label="Overall Assessment" value={form.overall_assessment} onChange={(e) => setForm({ ...form, overall_assessment: e.target.value })}>
            {ASSESSMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
      </Modal>

      {/* Submit Confirmation */}
      <Modal
        open={!!submitConfirm}
        onClose={() => setSubmitConfirm(null)}
        title="Submit Report for Admin Review"
        description="Once submitted, the school admin will be notified to review this report."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSubmitConfirm(null)}>Cancel</Button>
            <Button onClick={handleSubmit} loading={submitting !== null}>Submit</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">Submit this report for Admin review? You will not be able to edit it until the admin reviews it.</p>
      </Modal>

      {/* Preview Modal */}
      <Modal
        open={!!previewReport}
        onClose={() => setPreviewReport(null)}
        title="Report Preview"
        description={previewStudent ? `${previewStudent.full_name} · ${previewClass?.name ?? ''}` : ''}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPreviewReport(null)}>Close</Button>
            {previewReport && canEdit(previewReport.status) && (
              <Button leftIcon={<Pencil className="h-4 w-4" />} onClick={() => { openEdit(previewReport); setPreviewReport(null); }}>Edit</Button>
            )}
            {previewReport && canEdit(previewReport.status) && (
              <Button leftIcon={<Send className="h-4 w-4" />} loading={submitting === previewReport.id} onClick={() => { setSubmitConfirm(previewReport); setPreviewReport(null); }}>Submit to Admin</Button>
            )}
          </>
        }
      >
        {previewReport && (
          <div className="space-y-4">
            {previewReport.status === 'changes_requested' && previewReport.admin_feedback && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-500/30 dark:bg-orange-500/10">
                <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Admin Feedback</p>
                <p className="mt-1 text-sm text-orange-600 dark:text-orange-300">{previewReport.admin_feedback}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-ink-muted">Student:</span> <span className="font-medium text-ink">{previewStudent?.full_name}</span></div>
              <div><span className="text-ink-muted">Class:</span> <span className="font-medium text-ink">{previewClass?.name ?? '—'}</span></div>
              <div><span className="text-ink-muted">Year:</span> <span className="font-medium text-ink">{previewYear?.name ?? '—'}</span></div>
              <div><span className="text-ink-muted">Term:</span> <span className="font-medium text-ink">{previewTerm?.name ?? '—'}</span></div>
            </div>
            {previewReport.attendance_summary && (
              <div className="rounded-lg border border-surface-border bg-surface-overlay p-3">
                <p className="mb-1 text-sm font-semibold text-ink">Attendance</p>
                <div className="flex gap-4 text-sm text-ink-muted">
                  <span className="font-bold text-ink">{previewReport.attendance_summary.percentage}%</span>
                  <span>Present: {previewReport.attendance_summary.present}</span>
                  <span>Absent: {previewReport.attendance_summary.absent}</span>
                  <span>Late: {previewReport.attendance_summary.late}</span>
                  <span>Excused: {previewReport.attendance_summary.excused}</span>
                </div>
              </div>
            )}
            {previewReport.academic_results.length > 0 && (
              <div className="rounded-lg border border-surface-border bg-surface-overlay p-3">
                <p className="mb-2 text-sm font-semibold text-ink">Academic Results</p>
                {previewReport.academic_results.map((r, i) => (
                  <div key={i} className="flex justify-between text-sm py-0.5">
                    <span className="text-ink-soft">{r.subject}</span>
                    <span className="font-medium text-ink">{r.score} · {r.grade}</span>
                  </div>
                ))}
              </div>
            )}
            {[
              ['Academic Progress', previewReport.academic_progress],
              ['Strengths', previewReport.strengths],
              ['Areas for Improvement', previewReport.areas_for_improvement],
              ['Behaviour & Participation', previewReport.behaviour],
              ["Teacher's Comment", previewReport.teacher_comment],
              ['Recommendations', previewReport.recommendations],
            ].map(([label, val]) => val && val.trim() ? (
              <div key={label}>
                <p className="text-sm font-semibold text-ink">{label}</p>
                <p className="mt-1 text-sm text-ink-muted whitespace-pre-wrap">{val}</p>
              </div>
            ) : null)}
            {previewReport.overall_assessment && (
              <div>
                <p className="text-sm font-semibold text-ink">Overall Assessment</p>
                <p className="mt-1 text-sm text-ink-muted capitalize">{previewReport.overall_assessment.replace(/_/g, ' ')}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
