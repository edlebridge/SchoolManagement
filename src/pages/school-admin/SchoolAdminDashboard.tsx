import { LayoutDashboard, GraduationCap, Users, BookOpen, BookCopy, CalendarDays, ClipboardList, CalendarCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useAcademic } from '@/context/AcademicContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { RowSkeleton, CardSkeleton } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate, relativeTime } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import type { ParentAttendanceRequest } from '@/types';

export function SchoolAdminDashboard() {
  const { profile, school } = useAuth();
  const { students, teachers, classes, subjects, examSessions, loading } = useSchoolData();
  const { years, terms, selectedYearId, selectedTermId } = useAcademic();
  const [pendingRequests, setPendingRequests] = useState<ParentAttendanceRequest[]>([]);

  useEffect(() => {
    if (!profile?.school_id) return;
    supabase
      .from('parent_attendance_requests')
      .select('*')
      .eq('school_id', profile.school_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setPendingRequests((data as ParentAttendanceRequest[]) ?? []));
  }, [profile?.school_id]);

  const activeYear = years.find((y) => y.id === selectedYearId);
  const activeTerm = terms.find((t) => t.id === selectedTermId);
  const activeSessions = examSessions.filter((s) => s.status === 'scheduled' || s.status === 'published');
  const recentStudents = students.slice(0, 5);

  return (
    <div>
      <PageHeader
        title={`Welcome, ${profile?.full_name?.split(' ')[0] ?? 'Admin'}`}
        subtitle={school?.name ?? 'School Administration'}
        icon={<LayoutDashboard className="h-6 w-6" />}
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Students" value={students.length} icon={<GraduationCap className="h-6 w-6" />} accent="bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-light" />
          <StatCard label="Total Teachers" value={teachers.length} icon={<Users className="h-6 w-6" />} accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" />
          <StatCard label="Total Classes" value={classes.length} icon={<BookOpen className="h-6 w-6" />} accent="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" />
          <StatCard label="Total Subjects" value={subjects.length} icon={<BookCopy className="h-6 w-6" />} accent="bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Academic Year Info */}
        <Card className="lg:col-span-1">
          <CardHeader title="Academic Period" subtitle="Current active year & term" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-muted">Academic Year</span>
              {activeYear ? (
                <Badge variant={activeYear.is_active ? 'success' : 'secondary'}>
                  {activeYear.name}
                </Badge>
              ) : (
                <span className="text-sm text-ink-muted">—</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-muted">Term</span>
              {activeTerm ? (
                <Badge variant={activeTerm.is_active ? 'success' : 'secondary'}>
                  {activeTerm.name}
                </Badge>
              ) : (
                <span className="text-sm text-ink-muted">—</span>
              )}
            </div>
            {activeYear && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">Year Duration</span>
                <span className="text-sm text-ink-soft dark:text-slate-300">
                  {formatDate(activeYear.start_date)} — {formatDate(activeYear.end_date)}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Active Exam Sessions */}
        <Card className="lg:col-span-1">
          <CardHeader title="Exam Sessions" subtitle="Active & upcoming sessions" />
          {examSessions.length === 0 ? (
            <p className="text-sm text-ink-muted py-4 text-center">No exam sessions created yet.</p>
          ) : (
            <div className="space-y-2">
              {activeSessions.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-ink-muted" />
                    <span className="text-sm font-medium text-ink dark:text-slate-100">{s.name}</span>
                  </div>
                  <Badge variant={s.status === 'published' ? 'success' : 'primary'}>{s.status}</Badge>
                </div>
              ))}
              {activeSessions.length === 0 && (
                <p className="text-sm text-ink-muted py-2">No active exam sessions.</p>
              )}
            </div>
          )}
        </Card>

        {/* Recent Students */}
        <Card className="lg:col-span-1">
          <CardHeader title="Recent Students" subtitle="Latest enrolled students" />
          {loading ? (
            <RowSkeleton rows={3} />
          ) : recentStudents.length === 0 ? (
            <p className="text-sm text-ink-muted py-4 text-center">No students enrolled yet.</p>
          ) : (
            <div className="space-y-3">
              {recentStudents.map((s) => {
                const cls = classes.find((c) => c.id === s.class_id);
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <Avatar name={s.full_name} src={s.photo_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink dark:text-slate-100 truncate">{s.full_name}</p>
                      <p className="text-xs text-ink-muted">{cls?.name ?? 'Unassigned'}</p>
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

      {/* Pending Attendance Requests */}
      {pendingRequests.length > 0 && (
        <Card className="mt-6">
          <CardHeader
            title="Pending Attendance Requests"
            subtitle={`${pendingRequests.length} request${pendingRequests.length !== 1 ? 's' : ''} awaiting review`}
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
    </div>
  );
}
