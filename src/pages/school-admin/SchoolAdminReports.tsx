import { useMemo, useState, useEffect } from 'react';
import { FileText, CheckCircle, AlertCircle, Send, Eye, BarChart3, Plus, Download, Pencil } from 'lucide-react';
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
import type { StudentReport, SchoolReport, Student, ClassRow, AcademicYear, Term, AppUser, ExamMark, Attendance, School } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  changes_requested: 'Changes Requested',
  resubmitted: 'Resubmitted',
  approved: 'Approved',
  published: 'Published',
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  term: 'Term School Report',
  annual: 'Annual School Report',
  academic_performance: 'Academic Performance',
  attendance_overview: 'Attendance Overview',
  school_improvement: 'School Improvement Report',
};

export function SchoolAdminReports() {
  const { profile, school } = useAuth();
  const schoolId = profile?.school_id ?? '';
  const { students, teachers, classes, subjects, classSubjects, examSessions } = useSchoolData();
  const { years, terms } = useAcademic();
  const { toast } = useToast();

  const [tab, setTab] = useState<'student' | 'school'>('student');
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [filters, setFilters] = useState({ academic_year_id: '', term_id: '', class_id: '', teacher_id: '', status: '' });
  const [reviewReport, setReviewReport] = useState<StudentReport | null>(null);
  const [approveConfirm, setApproveConfirm] = useState<StudentReport | null>(null);
  const [publishConfirm, setPublishConfirm] = useState<StudentReport | null>(null);
  const [changesModal, setChangesModal] = useState<StudentReport | null>(null);
  const [changesComment, setChangesComment] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  // School reports state
  const [schoolReports, setSchoolReports] = useState<SchoolReport[]>([]);
  const [schoolReportsLoading, setSchoolReportsLoading] = useState(true);
  const [schoolReportModal, setSchoolReportModal] = useState(false);
  const [editingSchoolReport, setEditingSchoolReport] = useState<SchoolReport | null>(null);
  const [srForm, setSrForm] = useState({
    title: '', report_type: 'term', academic_year_id: '', term_id: '',
    school_overview: '', academic_commentary: '', attendance_commentary: '',
    achievements: '', challenges: '', improvements: '', next_steps: '', principal_message: '',
  });
  const [srSaving, setSrSaving] = useState(false);
  const [analytics, setAnalytics] = useState<{
    overallAvg?: number;
    subjectPerformance?: Record<string, number>;
    classPerformance?: Record<string, number>;
    schoolAttendance?: number;
    passRate?: number;
    totalStudents?: number;
    totalMarks?: number;
  }>({});
  const [srPreview, setSrPreview] = useState<SchoolReport | null>(null);

  const studentMap = useMemo(() => { const m: Record<string, Student> = {}; students.forEach((s) => { m[s.id] = s; }); return m; }, [students]);
  const classMap = useMemo(() => { const m: Record<string, ClassRow> = {}; classes.forEach((c) => { m[c.id] = c; }); return m; }, [classes]);
  const teacherMap = useMemo(() => { const m: Record<string, AppUser> = {}; teachers.forEach((t) => { m[t.id] = t; }); return m; }, [teachers]);
  const yearMap = useMemo(() => { const m: Record<string, AcademicYear> = {}; years.forEach((y) => { m[y.id] = y; }); return m; }, [years]);
  const termMap = useMemo(() => { const m: Record<string, Term> = {}; terms.forEach((t) => { m[t.id] = t; }); return m; }, [terms]);

  const loadReports = async () => {
    if (!schoolId) return;
    setReportsLoading(true);
    const { data } = await supabase.from('student_reports').select('*').eq('school_id', schoolId).order('updated_at', { ascending: false });
    setReports((data as StudentReport[]) ?? []);
    setReportsLoading(false);
  };

  const loadSchoolReports = async () => {
    if (!schoolId) return;
    setSchoolReportsLoading(true);
    const { data } = await supabase.from('school_reports').select('*').eq('school_id', schoolId).order('updated_at', { ascending: false });
    setSchoolReports((data as SchoolReport[]) ?? []);
    setSchoolReportsLoading(false);
  };

  useEffect(() => { loadReports(); }, [schoolId]);
  useEffect(() => { loadSchoolReports(); }, [schoolId]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (filters.academic_year_id && r.academic_year_id !== filters.academic_year_id) return false;
      if (filters.term_id && r.term_id !== filters.term_id) return false;
      if (filters.class_id && r.class_id !== filters.class_id) return false;
      if (filters.teacher_id && r.teacher_id !== filters.teacher_id) return false;
      if (filters.status && r.status !== filters.status) return false;
      return true;
    });
  }, [reports, filters]);

  const stats = useMemo(() => {
    const draft = reports.filter((r) => r.status === 'draft').length;
    const awaiting = reports.filter((r) => r.status === 'submitted' || r.status === 'resubmitted').length;
    const changes = reports.filter((r) => r.status === 'changes_requested').length;
    const approved = reports.filter((r) => r.status === 'approved').length;
    const published = reports.filter((r) => r.status === 'published').length;
    const completed = approved + published;
    return { total: reports.length, draft, awaiting, changes, approved, published, completed };
  }, [reports]);

  // Teacher progress: per teacher, how many students have reports
  const teacherProgress = useMemo(() => {
    const teacherIds = new Set(reports.map((r) => r.teacher_id));
    return Array.from(teacherIds).map((tid) => {
      const teacher = teacherMap[tid];
      const teacherReports = reports.filter((r) => r.teacher_id === tid);
      const teacherClassIds = new Set(teacherReports.map((r) => r.class_id).filter(Boolean) as string[]);
      const totalStudents = students.filter((s) => teacherClassIds.has(s.class_id ?? '') && s.enrollment_status === 'active').length;
      const completed = teacherReports.filter((r) => ['approved', 'published'].includes(r.status)).length;
      const pending = totalStudents - completed;
      return { teacher, totalStudents, completed, pending, className: Array.from(teacherClassIds).map((id) => classMap[id]?.name).join(', ') };
    });
  }, [reports, teacherMap, students, classMap]);

  const handleApprove = async () => {
    if (!approveConfirm || !profile?.id) return;
    setActing(approveConfirm.id);
    try {
      const { error } = await supabase
        .from('student_reports')
        .update({ status: 'approved', approved_by: profile.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', approveConfirm.id);
      if (error) throw error;
      // Notify teacher
      const stu = studentMap[approveConfirm.student_id];
      await supabase.from('notifications').insert({
        school_id: approveConfirm.school_id,
        user_id: approveConfirm.teacher_id,
        type: 'student_report_approved',
        title: 'Report approved',
        body: `${stu?.full_name ?? 'Student'}'s report has been approved.`,
        link: '/teacher',
      });
      toast('Report approved');
      setApproveConfirm(null);
      loadReports();
    } catch { toast('Failed to approve report', 'error'); } finally { setActing(null); }
  };

  const handleRequestChanges = async () => {
    if (!changesModal || !changesComment.trim()) { toast('Please enter feedback', 'error'); return; }
    setActing(changesModal.id);
    try {
      const { error } = await supabase
        .from('student_reports')
        .update({ status: 'changes_requested', admin_feedback: changesComment.trim(), updated_at: new Date().toISOString() })
        .eq('id', changesModal.id);
      if (error) throw error;
      const stu = studentMap[changesModal.student_id];
      const term = termMap[changesModal.term_id ?? ''];
      await supabase.from('notifications').insert({
        school_id: changesModal.school_id,
        user_id: changesModal.teacher_id,
        type: 'student_report_changes_requested',
        title: 'Changes requested on report',
        body: `Changes have been requested for ${stu?.full_name ?? 'student'}'s ${term?.name ?? 'term'} report.`,
        link: '/teacher',
      });
      toast('Changes requested and teacher notified');
      setChangesModal(null);
      setChangesComment('');
      loadReports();
    } catch { toast('Failed to request changes', 'error'); } finally { setActing(null); }
  };

  const handlePublish = async () => {
    if (!publishConfirm) return;
    setActing(publishConfirm.id);
    try {
      const { error } = await supabase
        .from('student_reports')
        .update({ status: 'published', published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', publishConfirm.id);
      if (error) throw error;
      // Notify parent(s)
      const { data: parents } = await supabase
        .from('student_parents')
        .select('parent_user_id')
        .eq('student_id', publishConfirm.student_id);
      const stu = studentMap[publishConfirm.student_id];
      const term = termMap[publishConfirm.term_id ?? ''];
      if (parents && parents.length > 0) {
        const notifications = parents.map((p: { parent_user_id: string }) => ({
          school_id: publishConfirm.school_id,
          user_id: p.parent_user_id,
          type: 'student_report_published',
          title: 'New Student Report',
          body: `${stu?.full_name ?? 'Your child'}'s ${term?.name ?? 'term'} report is now available.`,
          link: '/parent',
        }));
        await supabase.from('notifications').insert(notifications);
      }
      toast('Report published and parent notified');
      setPublishConfirm(null);
      loadReports();
    } catch { toast('Failed to publish report', 'error'); } finally { setActing(null); }
  };

  // School report analytics computation
  const computeAnalytics = async (): Promise<{ overallAvg: number; subjectPerformance: Record<string, number>; classPerformance: Record<string, number>; schoolAttendance: number; passRate: number; totalStudents: number; totalMarks: number }> => {
    if (!schoolId) return {};
    const [{ data: marks }, { data: att }] = await Promise.all([
      supabase.from('exam_marks').select('*').eq('school_id', schoolId),
      supabase.from('attendance').select('*').eq('school_id', schoolId),
    ]);
    const markRecords = (marks as ExamMark[]) ?? [];
    const attRecords = (att as Attendance[]) ?? [];

    // Overall average
    const totalObtained = markRecords.reduce((s, m) => s + (m.marks ?? 0), 0);
    const totalMax = markRecords.reduce((s, m) => s + m.total_marks, 0);
    const overallAvg = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;

    // Subject performance
    const subjectStats: Record<string, { total: number; max: number }> = {};
    markRecords.forEach((m) => {
      const subj = subjects.find((s) => s.id === m.subject_id);
      const name = subj?.name ?? 'Unknown';
      if (!subjectStats[name]) subjectStats[name] = { total: 0, max: 0 };
      subjectStats[name].total += m.marks ?? 0;
      subjectStats[name].max += m.total_marks;
    });
    const subjectPerformance: Record<string, number> = {};
    Object.entries(subjectStats).forEach(([name, s]) => {
      subjectPerformance[name] = s.max > 0 ? Math.round((s.total / s.max) * 100) : 0;
    });

    // Class performance
    const classStats: Record<string, { total: number; max: number }> = {};
    markRecords.forEach((m) => {
      const cls = classMap[m.class_id ?? ''];
      const name = cls?.name ?? 'Unknown';
      if (!classStats[name]) classStats[name] = { total: 0, max: 0 };
      classStats[name].total += m.marks ?? 0;
      classStats[name].max += m.total_marks;
    });
    const classPerformance: Record<string, number> = {};
    Object.entries(classStats).forEach(([name, s]) => {
      classPerformance[name] = s.max > 0 ? Math.round((s.total / s.max) * 100) : 0;
    });

    // Attendance
    const present = attRecords.filter((a) => a.status === 'present').length;
    const totalAtt = attRecords.length;
    const schoolAttendance = totalAtt > 0 ? Math.round((present / totalAtt) * 100) : 0;

    // Pass rate
    const passCount = markRecords.filter((m) => m.total_marks > 0 && ((m.marks ?? 0) / m.total_marks) * 100 >= 50).length;
    const passRate = markRecords.length > 0 ? Math.round((passCount / markRecords.length) * 100) : 0;

    return { overallAvg, subjectPerformance, classPerformance, schoolAttendance, passRate, totalStudents: students.length, totalMarks: markRecords.length };
  };

  const openCreateSchoolReport = async () => {
    const activeYear = years.find((y) => y.is_active) ?? years[0];
    const activeTerm = terms.find((t) => t.is_active) ?? terms[0];
    setEditingSchoolReport(null);
    setSrForm({ title: '', report_type: 'term', academic_year_id: activeYear?.id ?? '', term_id: activeTerm?.id ?? '', school_overview: '', academic_commentary: '', attendance_commentary: '', achievements: '', challenges: '', improvements: '', next_steps: '', principal_message: '' });
    const a = await computeAnalytics();
    setAnalytics(a);
    setSchoolReportModal(true);
  };

  const openEditSchoolReport = async (sr: SchoolReport) => {
    setEditingSchoolReport(sr);
    setSrForm({
      title: sr.title, report_type: sr.report_type, academic_year_id: sr.academic_year_id ?? '', term_id: sr.term_id ?? '',
      school_overview: sr.school_overview, academic_commentary: sr.academic_commentary, attendance_commentary: sr.attendance_commentary,
      achievements: sr.achievements, challenges: sr.challenges, improvements: sr.improvements, next_steps: sr.next_steps, principal_message: sr.principal_message,
    });
    setAnalytics(sr.analytics_snapshot ?? {});
    setSchoolReportModal(true);
  };

  const handleSaveSchoolReport = async (publish: boolean) => {
    if (!profile?.id || !schoolId) return;
    if (!srForm.title.trim()) { toast('Enter a title', 'error'); return; }
    setSrSaving(true);
    try {
      const payload = {
        school_id: schoolId,
        academic_year_id: srForm.academic_year_id || null,
        term_id: srForm.term_id || null,
        report_type: srForm.report_type,
        title: srForm.title.trim(),
        school_overview: srForm.school_overview,
        academic_commentary: srForm.academic_commentary,
        attendance_commentary: srForm.attendance_commentary,
        achievements: srForm.achievements,
        challenges: srForm.challenges,
        improvements: srForm.improvements,
        next_steps: srForm.next_steps,
        principal_message: srForm.principal_message,
        analytics_snapshot: analytics,
        status: publish ? 'published' : 'draft',
        published_at: publish ? new Date().toISOString() : null,
        created_by: editingSchoolReport ? undefined : profile.id,
      };
      if (editingSchoolReport) {
        const { error } = await supabase.from('school_reports').update(payload).eq('id', editingSchoolReport.id);
        if (error) throw error;
        toast(publish ? 'School report published' : 'School report saved');
      } else {
        const { error } = await supabase.from('school_reports').insert(payload);
        if (error) throw error;
        toast(publish ? 'School report published' : 'School report saved as draft');
      }
      setSchoolReportModal(false);
      loadSchoolReports();
    } catch { toast('Failed to save school report', 'error'); } finally { setSrSaving(false); }
  };

  const reviewStudent = reviewReport ? studentMap[reviewReport.student_id] : null;
  const reviewClass = reviewReport ? classMap[reviewReport.class_id ?? ''] : null;
  const reviewTeacher = reviewReport ? teacherMap[reviewReport.teacher_id] : null;
  const reviewYear = reviewReport ? yearMap[reviewReport.academic_year_id ?? ''] : null;
  const reviewTerm = reviewReport ? termMap[reviewReport.term_id ?? ''] : null;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Review, approve and publish student reports."
        icon={<FileText className="h-5 w-5" />}
        action={tab === 'school' ? <Button onClick={openCreateSchoolReport} leftIcon={<Plus className="h-4 w-4" />}>New School Report</Button> : undefined}
      />

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <Button size="sm" variant={tab === 'student' ? 'primary' : 'ghost'} onClick={() => setTab('student')}>Student Reports</Button>
        <Button size="sm" variant={tab === 'school' ? 'primary' : 'ghost'} onClick={() => setTab('school')}>School Reports</Button>
      </div>

      {tab === 'student' ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Total Reports" value={stats.total} icon={<FileText className="h-5 w-5 text-primary" />} />
            <StatCard label="Draft" value={stats.draft} icon={<Pencil className="h-5 w-5 text-amber-500" />} accent="bg-amber-50 dark:bg-amber-500/15" />
            <StatCard label="Awaiting Review" value={stats.awaiting} icon={<AlertCircle className="h-5 w-5 text-orange-500" />} accent="bg-orange-50 dark:bg-orange-500/15" />
            <StatCard label="Changes Requested" value={stats.changes} icon={<AlertCircle className="h-5 w-5 text-red-500" />} accent="bg-red-50 dark:bg-red-500/15" />
            <StatCard label="Approved" value={stats.approved} icon={<CheckCircle className="h-5 w-5 text-green-500" />} accent="bg-green-50 dark:bg-green-500/15" />
            <StatCard label="Published" value={stats.published} icon={<CheckCircle className="h-5 w-5 text-primary" />} />
          </div>

          {/* Report completion */}
          <div className="mt-4">
            <Card>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Report Completion</p>
                <p className="text-sm text-ink-muted">{stats.completed} of {stats.total} reports completed</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-overlay">
                <div className="h-full bg-primary transition-all" style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }} />
              </div>
            </Card>
          </div>

          {/* Teacher progress */}
          {teacherProgress.length > 0 && (
            <div className="mt-4">
              <Card>
                <p className="mb-3 text-sm font-semibold text-ink">Teacher Report Progress</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-border text-left text-ink-muted">
                        <th className="py-2 pr-4 font-medium">Teacher</th>
                        <th className="py-2 pr-4 font-medium">Class</th>
                        <th className="py-2 pr-4 font-medium">Total Students</th>
                        <th className="py-2 pr-4 font-medium">Completed</th>
                        <th className="py-2 pr-4 font-medium">Pending</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {teacherProgress.map((tp, i) => (
                        <tr key={i} className="text-ink-soft">
                          <td className="py-2.5 pr-4 font-medium text-ink">{tp.teacher?.full_name ?? '—'}</td>
                          <td className="py-2.5 pr-4">{tp.className || '—'}</td>
                          <td className="py-2.5 pr-4">{tp.totalStudents}</td>
                          <td className="py-2.5 pr-4 text-green-600">{tp.completed}</td>
                          <td className="py-2.5 pr-4 text-orange-500">{tp.pending}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* Filters */}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Select value={filters.academic_year_id} onChange={(e) => setFilters({ ...filters, academic_year_id: e.target.value })}>
              <option value="">All Years</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
            <Select value={filters.term_id} onChange={(e) => setFilters({ ...filters, term_id: e.target.value })}>
              <option value="">All Terms</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <Select value={filters.class_id} onChange={(e) => setFilters({ ...filters, class_id: e.target.value })}>
              <option value="">All Classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select value={filters.teacher_id} onChange={(e) => setFilters({ ...filters, teacher_id: e.target.value })}>
              <option value="">All Teachers</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </Select>
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>

          {/* Reports table */}
          <div className="mt-4">
            {reportsLoading ? (
              <RowSkeleton rows={5} />
            ) : filteredReports.length === 0 ? (
              <Card><EmptyState title="No reports found" description="No student reports match the current filters." icon={<FileText className="h-10 w-10" />} /></Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-border text-left text-ink-muted">
                        <th className="py-2 pr-4 font-medium">Student</th>
                        <th className="py-2 pr-4 font-medium">Class</th>
                        <th className="py-2 pr-4 font-medium">Teacher</th>
                        <th className="py-2 pr-4 font-medium">Term</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Updated</th>
                        <th className="py-2 pr-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {filteredReports.map((r) => (
                        <tr key={r.id} className="text-ink-soft">
                          <td className="py-2.5 pr-4 font-medium text-ink">{studentMap[r.student_id]?.full_name ?? '—'}</td>
                          <td className="py-2.5 pr-4">{classMap[r.class_id ?? '']?.name ?? '—'}</td>
                          <td className="py-2.5 pr-4">{teacherMap[r.teacher_id]?.full_name ?? '—'}</td>
                          <td className="py-2.5 pr-4">{termMap[r.term_id ?? '']?.name ?? '—'}</td>
                          <td className="py-2.5 pr-4"><Badge variant={statusBadge(r.status).variant}>{STATUS_LABELS[r.status] ?? r.status}</Badge></td>
                          <td className="py-2.5 pr-4 text-ink-muted">{relativeTime(r.updated_at)}</td>
                          <td className="py-2.5 pr-4">
                            <div className="flex justify-end">
                              <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => setReviewReport(r)}>Review</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </>
      ) : (
        /* School Reports Tab */
        <>
          {schoolReportsLoading ? (
            <RowSkeleton rows={4} />
          ) : schoolReports.length === 0 ? (
            <Card><EmptyState title="No school reports" description="Create a school report to get started." icon={<BarChart3 className="h-10 w-10" />} /></Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {schoolReports.map((sr) => (
                <Card key={sr.id} hover>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-ink">{sr.title}</p>
                      <p className="mt-1 text-xs text-ink-muted">{REPORT_TYPE_LABELS[sr.report_type] ?? sr.report_type}</p>
                    </div>
                    <Badge variant={sr.status === 'published' ? 'success' : 'secondary'}>{sr.status === 'published' ? 'Published' : 'Draft'}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-muted">
                    {sr.academic_year_id && yearMap[sr.academic_year_id] && <span>{yearMap[sr.academic_year_id].name}</span>}
                    {sr.term_id && termMap[sr.term_id] && <span>· {termMap[sr.term_id].name}</span>}
                    <span>· {relativeTime(sr.updated_at)}</span>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => setSrPreview(sr)}>Preview</Button>
                    <Button size="sm" variant="ghost" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEditSchoolReport(sr)}>Edit</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Review Report Modal */}
      <Modal
        open={!!reviewReport}
        onClose={() => setReviewReport(null)}
        title="Review Student Report"
        description={reviewStudent ? `${reviewStudent.full_name} · ${reviewClass?.name ?? ''}` : ''}
        size="lg"
        footer={
          reviewReport ? (
            <>
              <Button variant="secondary" onClick={() => setReviewReport(null)}>Close</Button>
              {(reviewReport.status === 'submitted' || reviewReport.status === 'resubmitted') && (
                <>
                  <Button variant="secondary" className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:border-orange-500/30 dark:hover:bg-orange-500/10" leftIcon={<AlertCircle className="h-4 w-4" />} onClick={() => { setChangesModal(reviewReport); setReviewReport(null); }}>Request Changes</Button>
                  <Button leftIcon={<CheckCircle className="h-4 w-4" />} onClick={() => { setApproveConfirm(reviewReport); setReviewReport(null); }}>Approve</Button>
                </>
              )}
              {reviewReport.status === 'approved' && (
                <Button leftIcon={<Send className="h-4 w-4" />} onClick={() => { setPublishConfirm(reviewReport); setReviewReport(null); }}>Publish & Notify Parent</Button>
              )}
            </>
          ) : null
        }
      >
        {reviewReport && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-ink-muted">Student:</span> <span className="font-medium text-ink">{reviewStudent?.full_name}</span></div>
              <div><span className="text-ink-muted">Class:</span> <span className="font-medium text-ink">{reviewClass?.name ?? '—'}</span></div>
              <div><span className="text-ink-muted">Teacher:</span> <span className="font-medium text-ink">{reviewTeacher?.full_name ?? '—'}</span></div>
              <div><span className="text-ink-muted">Year:</span> <span className="font-medium text-ink">{reviewYear?.name ?? '—'}</span></div>
              <div><span className="text-ink-muted">Term:</span> <span className="font-medium text-ink">{reviewTerm?.name ?? '—'}</span></div>
              <div><span className="text-ink-muted">Status:</span> <Badge variant={statusBadge(reviewReport.status).variant}>{STATUS_LABELS[reviewReport.status] ?? reviewReport.status}</Badge></div>
            </div>
            {reviewReport.attendance_summary && (
              <div className="rounded-lg border border-surface-border bg-surface-overlay p-3">
                <p className="mb-1 text-sm font-semibold text-ink">Attendance</p>
                <div className="flex flex-wrap gap-4 text-sm text-ink-muted">
                  <span className="font-bold text-ink">{reviewReport.attendance_summary.percentage}%</span>
                  <span>Present: {reviewReport.attendance_summary.present}</span>
                  <span>Absent: {reviewReport.attendance_summary.absent}</span>
                  <span>Late: {reviewReport.attendance_summary.late}</span>
                  <span>Excused: {reviewReport.attendance_summary.excused}</span>
                </div>
              </div>
            )}
            {reviewReport.academic_results.length > 0 && (
              <div className="rounded-lg border border-surface-border bg-surface-overlay p-3">
                <p className="mb-2 text-sm font-semibold text-ink">Academic Results</p>
                {reviewReport.academic_results.map((r, i) => (
                  <div key={i} className="flex justify-between text-sm py-0.5">
                    <span className="text-ink-soft">{r.subject}</span>
                    <span className="font-medium text-ink">{r.score} · {r.grade}</span>
                  </div>
                ))}
              </div>
            )}
            {[
              ['Academic Progress', reviewReport.academic_progress],
              ['Strengths', reviewReport.strengths],
              ['Areas for Improvement', reviewReport.areas_for_improvement],
              ['Behaviour & Participation', reviewReport.behaviour],
              ["Teacher's Comment", reviewReport.teacher_comment],
              ['Recommendations', reviewReport.recommendations],
            ].map(([label, val]) => val && val.trim() ? (
              <div key={label}>
                <p className="text-sm font-semibold text-ink">{label}</p>
                <p className="mt-1 text-sm text-ink-muted whitespace-pre-wrap">{val}</p>
              </div>
            ) : null)}
            {reviewReport.overall_assessment && (
              <div><p className="text-sm font-semibold text-ink">Overall Assessment</p><p className="mt-1 text-sm text-ink-muted capitalize">{reviewReport.overall_assessment.replace(/_/g, ' ')}</p></div>
            )}
            {reviewReport.admin_feedback && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-500/30 dark:bg-orange-500/10">
                <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Previous Admin Feedback</p>
                <p className="mt-1 text-sm text-orange-600 dark:text-orange-300">{reviewReport.admin_feedback}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Approve Confirmation */}
      <Modal open={!!approveConfirm} onClose={() => setApproveConfirm(null)} title="Approve Report" size="sm"
        footer={<><Button variant="secondary" onClick={() => setApproveConfirm(null)}>Cancel</Button><Button onClick={handleApprove} loading={acting !== null}>Approve</Button></>}>
        <p className="text-sm text-ink-muted">Approve this student report? The teacher will be notified and can no longer edit the report. The report will not be sent to the parent until you publish it.</p>
      </Modal>

      {/* Publish Confirmation */}
      <Modal open={!!publishConfirm} onClose={() => setPublishConfirm(null)} title="Publish & Notify Parent" size="sm"
        footer={<><Button variant="secondary" onClick={() => setPublishConfirm(null)}>Cancel</Button><Button onClick={handlePublish} loading={acting !== null}>Publish & Notify Parent</Button></>}>
        <p className="text-sm text-ink-muted">Publish this report to the parent? Once published, the parent will be notified and will be able to view the report in the Parent Mobile App.</p>
      </Modal>

      {/* Request Changes Modal */}
      <Modal open={!!changesModal} onClose={() => { setChangesModal(null); setChangesComment(''); }} title="Request Changes" size="md"
        footer={<><Button variant="secondary" onClick={() => { setChangesModal(null); setChangesComment(''); }}>Cancel</Button><Button onClick={handleRequestChanges} loading={acting !== null}>Send Feedback</Button></>}>
        <Textarea label="Feedback for Teacher" placeholder="e.g. Please add more detail about the student's Mathematics progress." rows={4} value={changesComment} onChange={(e) => setChangesComment(e.target.value)} />
      </Modal>

      {/* School Report Modal */}
      <Modal open={schoolReportModal} onClose={() => setSchoolReportModal(false)} title={editingSchoolReport ? 'Edit School Report' : 'New School Report'} description="School analytics are generated automatically. Add your commentary below." size="xl"
        footer={<><Button variant="secondary" onClick={() => setSchoolReportModal(false)}>Cancel</Button><Button variant="secondary" onClick={() => setSrPreview({ ...srForm, analytics_snapshot: analytics, id: '', school_id: schoolId, status: 'draft', created_by: null, created_at: '', updated_at: '', published_at: null } as SchoolReport)}>Preview</Button><Button variant="secondary" onClick={() => handleSaveSchoolReport(false)} loading={srSaving}>Save Draft</Button><Button onClick={() => handleSaveSchoolReport(true)} loading={srSaving}>Publish</Button></>}>
        <div className="space-y-4">
          {/* Auto-generated analytics */}
          {Object.keys(analytics).length > 0 && (
            <div className="rounded-xl border border-surface-border bg-surface-overlay p-4">
              <p className="mb-3 text-sm font-semibold text-ink">Automatically Generated Analytics</p>
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                <div><span className="text-ink-muted">Overall Average:</span> <span className="font-bold text-ink">{analytics.overallAvg ?? 0}{'%'}</span></div>
                <div><span className="text-ink-muted">School Attendance:</span> <span className="font-bold text-ink">{analytics.schoolAttendance ?? 0}{'%'}</span></div>
                <div><span className="text-ink-muted">Pass Rate:</span> <span className="font-bold text-ink">{analytics.passRate ?? 0}{'%'}</span></div>
              </div>
              {analytics.subjectPerformance && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-ink-muted">Subject Performance</p>
                  <div className="mt-1 grid grid-cols-2 gap-2 md:grid-cols-3">
                    {Object.entries(analytics.subjectPerformance).map(([subj, pct]) => (
                      <span key={subj} className="text-sm text-ink-soft">{subj}: <span className="font-medium text-ink">{pct}{'%'}</span></span>
                    ))}
                  </div>
                </div>
              )}
              {analytics.classPerformance && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-ink-muted">Class Performance</p>
                  <div className="mt-1 grid grid-cols-2 gap-2 md:grid-cols-3">
                    {Object.entries(analytics.classPerformance).map(([cls, pct]) => (
                      <span key={cls} className="text-sm text-ink-soft">{cls}: <span className="font-medium text-ink">{pct}{'%'}</span></span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <Input label="Title" placeholder="e.g. Term 1 School Report 2026/27" value={srForm.title} onChange={(e) => setSrForm({ ...srForm, title: e.target.value })} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select label="Report Type" value={srForm.report_type} onChange={(e) => setSrForm({ ...srForm, report_type: e.target.value })}>
              {Object.entries(REPORT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <Select label="Academic Year" value={srForm.academic_year_id} onChange={(e) => setSrForm({ ...srForm, academic_year_id: e.target.value })}>
              <option value="">Select year</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
            <Select label="Term" value={srForm.term_id} onChange={(e) => setSrForm({ ...srForm, term_id: e.target.value })}>
              <option value="">Select term</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
          <Textarea label="School Overview" rows={2} value={srForm.school_overview} onChange={(e) => setSrForm({ ...srForm, school_overview: e.target.value })} />
          <Textarea label="Academic Performance Commentary" rows={2} value={srForm.academic_commentary} onChange={(e) => setSrForm({ ...srForm, academic_commentary: e.target.value })} />
          <Textarea label="Attendance Commentary" rows={2} value={srForm.attendance_commentary} onChange={(e) => setSrForm({ ...srForm, attendance_commentary: e.target.value })} />
          <Textarea label="Achievements" rows={2} value={srForm.achievements} onChange={(e) => setSrForm({ ...srForm, achievements: e.target.value })} />
          <Textarea label="Challenges" rows={2} value={srForm.challenges} onChange={(e) => setSrForm({ ...srForm, challenges: e.target.value })} />
          <Textarea label="Improvements" rows={2} value={srForm.improvements} onChange={(e) => setSrForm({ ...srForm, improvements: e.target.value })} />
          <Textarea label="Next Steps" rows={2} value={srForm.next_steps} onChange={(e) => setSrForm({ ...srForm, next_steps: e.target.value })} />
          <Textarea label="Admin/Principal Message" rows={3} value={srForm.principal_message} onChange={(e) => setSrForm({ ...srForm, principal_message: e.target.value })} />
        </div>
      </Modal>

      {/* School Report Preview */}
      <Modal open={!!srPreview} onClose={() => setSrPreview(null)} title="School Report Preview" size="lg"
        footer={<><Button variant="secondary" onClick={() => setSrPreview(null)}>Close</Button></>}>
        {srPreview && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 border-b border-surface-border pb-3">
              {school?.logo_url && <img src={school.logo_url} alt="" className="h-12 w-12 rounded-lg object-contain" />}
              <div>
                <p className="font-bold text-ink">{school?.name ?? 'School'}</p>
                <p className="text-sm text-ink-muted">{srPreview.title}</p>
              </div>
            </div>
            {Object.keys(srPreview.analytics_snapshot ?? {}).length > 0 && (
              <div className="rounded-lg border border-surface-border bg-surface-overlay p-3">
                <p className="mb-2 text-sm font-semibold text-ink">Analytics</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <span>Overall: <b className="text-ink">{(srPreview.analytics_snapshot as Record<string, number>).overallAvg ?? 0}{'%'}</b></span>
                  <span>Attendance: <b className="text-ink">{(srPreview.analytics_snapshot as Record<string, number>).schoolAttendance ?? 0}{'%'}</b></span>
                  <span>Pass Rate: <b className="text-ink">{(srPreview.analytics_snapshot as Record<string, number>).passRate ?? 0}{'%'}</b></span>
                </div>
              </div>
            )}
            {[
              ['School Overview', srPreview.school_overview],
              ['Academic Performance', srPreview.academic_commentary],
              ['Attendance', srPreview.attendance_commentary],
              ['Achievements', srPreview.achievements],
              ['Challenges', srPreview.challenges],
              ['Improvements', srPreview.improvements],
              ['Next Steps', srPreview.next_steps],
              ['Principal Message', srPreview.principal_message],
            ].map(([label, val]) => val && val.trim() ? (
              <div key={label}><p className="text-sm font-semibold text-ink">{label}</p><p className="mt-1 text-sm text-ink-muted whitespace-pre-wrap">{val}</p></div>
            ) : null)}
          </div>
        )}
      </Modal>
    </div>
  );
}
