import { useMemo } from 'react';
import { Users, GraduationCap, BookOpen, ClipboardCheck, Calendar, TrendingUp, CalendarCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useAcademic } from '@/context/AcademicContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton, CardSkeleton } from '@/components/ui/Spinner';
import { formatDate, relativeTime } from '@/lib/utils';
import type { Homework } from '@/types';
import type { ParentAttendanceRequest } from '@/types';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export function TeacherDashboard() {
  const { profile } = useAuth();
  const { students, classes, classSubjects, examSessions, loading } = useSchoolData();
  const { years, selectedYearId } = useAcademic();
  const [homework, setHomework] = useState<Homework[]>([]);
  const [homeworkLoading, setHomeworkLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<ParentAttendanceRequest[]>([]);

  // My classes: where I'm the class teacher OR I teach a subject in that class
  const myClasses = useMemo(() => {
    if (!profile) return [];
    return classes.filter(
      (c) =>
        c.class_teacher_id === profile.id ||
        classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === profile.id)
    );
  }, [classes, classSubjects, profile]);

  const myClassIds = useMemo(() => myClasses.map((c) => c.id), [myClasses]);

  // My students: students whose class_id is in my class IDs
  const myStudents = useMemo(() => {
    if (!myClassIds.length) return [];
    return students.filter((s) => s.class_id && myClassIds.includes(s.class_id));
  }, [students, myClassIds]);

  // Fetch homework created by this teacher
  useEffect(() => {
    if (!profile?.id) return;
    setHomeworkLoading(true);
    supabase
      .from('homework')
      .select('*')
      .eq('teacher_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setHomework((data as Homework[]) ?? []);
        setHomeworkLoading(false);
      });
  }, [profile?.id]);

  // Exams for my subjects/classes in the selected year
  const myExamSessions = useMemo(() => {
    if (!selectedYearId) return examSessions;
    return examSessions.filter((es) => es.academic_year_id === selectedYearId);
  }, [examSessions, selectedYearId]);

  // Fetch pending attendance requests for my classes
  useEffect(() => {
    if (!profile?.school_id || myClassIds.length === 0) return;
    supabase
      .from('parent_attendance_requests')
      .select('*')
      .eq('school_id', profile.school_id)
      .eq('status', 'pending')
      .in('class_id', myClassIds)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setPendingRequests((data as ParentAttendanceRequest[]) ?? []));
  }, [profile?.school_id, myClassIds]);

  const activeYear = years.find((y) => y.id === selectedYearId);

  if (loading) {
    return (
      <div>
        <PageHeader title="Teacher Dashboard" subtitle="Welcome back to your teaching portal" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="mt-6">
          <RowSkeleton rows={5} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Teacher Dashboard"
        subtitle={`Welcome back, ${profile?.full_name ?? 'Teacher'}${activeYear ? ` · ${activeYear.name}` : ''}`}
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="My Classes"
          value={myClasses.length}
          icon={<GraduationCap className="h-5 w-5" />}
          accent="bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-light"
        />
        <StatCard
          label="My Students"
          value={myStudents.length}
          icon={<Users className="h-5 w-5" />}
          accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
        />
        <StatCard
          label="Homework"
          value={homework.length}
          icon={<BookOpen className="h-5 w-5" />}
          accent="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
        />
        <StatCard
          label="Exam Sessions"
          value={myExamSessions.length}
          icon={<ClipboardCheck className="h-5 w-5" />}
          accent="bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
        />
      </div>

      {/* My Classes */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="My Classes" subtitle="Classes you teach or are the class teacher for" />
          {myClasses.length === 0 ? (
            <EmptyState title="No classes assigned" description="You have not been assigned to any classes yet." />
          ) : (
            <div className="space-y-3">
              {myClasses.map((c) => {
                const studentCount = students.filter((s) => s.class_id === c.id).length;
                const isClassTeacher = c.class_teacher_id === profile?.id;
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-light">
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-ink dark:text-slate-100">{c.name}</p>
                        <p className="text-sm text-ink-muted">
                          {c.grade_level ?? '—'} {c.stream ? `· Stream ${c.stream}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{studentCount} students</Badge>
                      {isClassTeacher && <Badge variant="primary">Class Teacher</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Recent Homework */}
        <Card>
          <CardHeader title="Recent Homework" subtitle="Recently assigned homework" />
          {homeworkLoading ? (
            <RowSkeleton rows={3} />
          ) : homework.length === 0 ? (
            <EmptyState title="No homework yet" description="You have not assigned any homework yet." />
          ) : (
            <div className="space-y-3">
              {homework.map((hw) => {
                const cls = classes.find((c) => c.id === hw.class_id);
                return (
                  <div
                    key={hw.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-ink dark:text-slate-100">{hw.title}</p>
                        <p className="text-sm text-ink-muted">
                          {cls?.name ?? '—'} · Due {formatDate(hw.due_date)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={new Date(hw.due_date) < new Date() ? 'error' : 'secondary'}>
                      {relativeTime(hw.due_date)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Exam Sessions */}
      <div className="mt-6">
        <Card>
          <CardHeader
            title="Exam Sessions"
            subtitle="Exam sessions created by your school administrator"
            action={<TrendingUp className="h-5 w-5 text-ink-muted" />}
          />
          {myExamSessions.length === 0 ? (
            <EmptyState title="No exam sessions" description="There are no exam sessions for the selected academic year." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myExamSessions.slice(0, 6).map((es) => {
                const badge = statusBadge(es.status);
                return (
                  <div
                    key={es.id}
                    className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-ink-muted" />
                        <p className="font-medium text-ink dark:text-slate-100">{es.name}</p>
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-ink-muted">
                      <p>
                        {formatDate(es.start_date)} — {formatDate(es.end_date)}
                      </p>
                      {es.published && <p className="text-emerald-600">Results published</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Pending Attendance Requests */}
      {pendingRequests.length > 0 && (
        <Card className="mt-6">
          <CardHeader
            title="Pending Attendance Requests"
            subtitle={`${pendingRequests.length} request${pendingRequests.length !== 1 ? 's' : ''} awaiting your review`}
            action={<CalendarCheck className="h-5 w-5 text-amber-500" />}
          />
          <div className="space-y-2">
            {pendingRequests.map((req) => {
              const student = students.find((s) => s.id === req.student_id);
              const cls = classes.find((c) => c.id === req.class_id);
              const typeLabel = req.request_type === 'absence' ? 'Absence' : req.request_type === 'late' ? 'Late Arrival' : 'Early Collection';
              return (
                <div key={req.id} className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-sm font-medium text-ink dark:text-slate-100">{typeLabel}: {student?.full_name ?? 'Unknown'}</p>
                      <p className="text-xs text-ink-muted">{cls?.name ?? '—'} · {relativeTime(req.created_at)}</p>
                    </div>
                  </div>
                  <Badge variant="warning">Pending</Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent Students */}
      <div className="mt-6">
        <Card>
          <CardHeader title="My Students" subtitle={`${myStudents.length} students across ${myClasses.length} classes`} />
          {myStudents.length === 0 ? (
            <EmptyState title="No students" description="No students are enrolled in your classes yet." />
          ) : (
            <div className="space-y-2">
              {myStudents.slice(0, 8).map((s) => {
                const cls = classes.find((c) => c.id === s.class_id);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={s.full_name} src={s.photo_url} size="sm" />
                      <div>
                        <p className="font-medium text-ink dark:text-slate-100">{s.full_name}</p>
                        <p className="text-sm text-ink-muted">
                          {s.admission_number} · {cls?.name ?? '—'}
                        </p>
                      </div>
                    </div>
                    <Badge variant={s.enrollment_status === 'active' ? 'success' : 'secondary'}>
                      {s.enrollment_status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
