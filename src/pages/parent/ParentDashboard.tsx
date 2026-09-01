import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, CalendarCheck, BookOpen, ChartBar as BarChart3, Megaphone, MessageSquare, User, ChevronDown, TrendingUp, Award, CircleAlert as AlertCircle, Paperclip } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useParent } from '@/context/ParentContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { RowSkeleton, CardSkeleton } from '@/components/ui/Spinner';
import { formatDate, relativeTime, percentage, cn } from '@/lib/utils';
import type { Attendance, Homework, ExamMark } from '@/types';

interface Attachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface Announcement {
  id: string;
  school_id: string;
  author_id: string | null;
  title: string;
  body: string;
  audience: string;
  class_id: string | null;
  attachments: Attachment[] | null;
  created_at: string;
}

interface DashboardStats {
  attendanceRecords: Attendance[];
  homeworkList: Homework[];
  examMarks: ExamMark[];
  announcements: Announcement[];
}

export function ParentDashboard() {
  const { profile } = useAuth();
  const { children, selectedChild, selectedChildClass, loading, selectChild } = useParent();
  const [childMenuOpen, setChildMenuOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    attendanceRecords: [],
    homeworkList: [],
    examMarks: [],
    announcements: [],
  });
  const [statsLoading, setStatsLoading] = useState(false);

  const loadStats = useCallback(async () => {
    if (!selectedChild || !profile?.school_id) {
      setStats({ attendanceRecords: [], homeworkList: [], examMarks: [], announcements: [] });
      return;
    }
    setStatsLoading(true);
    try {
      const classId = selectedChild.class_id;
      const now = new Date().toISOString();

      const [attendanceRes, homeworkRes, marksRes, announcementsRes] = await Promise.all([
        supabase.from('attendance').select('*').eq('school_id', profile.school_id).eq('student_id', selectedChild.id).order('date', { ascending: false }).limit(100),
        classId ? supabase.from('homework').select('*').eq('school_id', profile.school_id).eq('class_id', classId).order('due_date', { ascending: true }) : Promise.resolve({ data: [] }),
        supabase.from('exam_marks').select('*').eq('school_id', profile.school_id).eq('student_id', selectedChild.id).order('created_at', { ascending: false }),
        supabase.from('announcements').select('*').eq('school_id', profile.school_id).order('created_at', { ascending: false }).limit(20),
      ]);

      // Filter announcements to only those relevant to this parent:
      // school-wide, parents-only, or class-targeted matching the child's class.
      const childClassId = selectedChild.class_id;
      const allAnnouncements = (announcementsRes.data as Announcement[]) ?? [];
      const visibleAnnouncements = allAnnouncements.filter((a) => {
        if (a.audience === 'school' || a.audience === 'parents') return true;
        if ((a.audience === 'class' || a.audience === 'class_all') && a.class_id && a.class_id === childClassId) return true;
        return false;
      });

      setStats({
        attendanceRecords: (attendanceRes.data as Attendance[]) ?? [],
        homeworkList: (homeworkRes.data as Homework[]) ?? [],
        examMarks: (marksRes.data as ExamMark[]) ?? [],
        announcements: visibleAnnouncements,
      });
    } catch {
      setStats({ attendanceRecords: [], homeworkList: [], examMarks: [], announcements: [] });
    } finally {
      setStatsLoading(false);
    }
  }, [selectedChild, profile?.school_id]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Compute attendance percentage
  const attendancePct = useMemo(() => {
    const records = stats.attendanceRecords;
    if (records.length === 0) return 0;
    const present = records.filter((r) => r.status === 'present' || r.status === 'late').length;
    return Math.round((present / records.length) * 100);
  }, [stats.attendanceRecords]);

  // Homework due count
  const homeworkDueCount = stats.homeworkList.length;

  // Exam results count (unique exams with marks)
  const examResultsCount = useMemo(() => {
    const examIds = new Set(stats.examMarks.map((m) => m.exam_id));
    return examIds.size;
  }, [stats.examMarks]);

  // Latest exam average
  const latestExamAvg = useMemo(() => {
    if (stats.examMarks.length === 0) return null;
    const totalObtained = stats.examMarks.reduce((sum, m) => sum + (m.marks ?? 0), 0);
    const totalMax = stats.examMarks.reduce((sum, m) => sum + (m.total_marks ?? 0), 0);
    if (totalMax === 0) return null;
    return percentage(totalObtained, totalMax);
  }, [stats.examMarks]);

  const quickLinks = [
    { to: '/parent/attendance', label: 'Attendance', icon: CalendarCheck, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' },
    { to: '/parent/homework', label: 'Homework', icon: BookOpen, color: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400' },
    { to: '/parent/results', label: 'Results', icon: BarChart3, color: 'bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400' },
    { to: '/parent/messages', label: 'Messages', icon: MessageSquare, color: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' },
    { to: '/parent/profile', label: 'Profile', icon: User, color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Parent Portal" icon={<LayoutDashboard className="h-5 w-5" />} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="mt-6">
          <RowSkeleton rows={5} />
        </div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Parent Portal" icon={<LayoutDashboard className="h-5 w-5" />} />
        <Card>
          <EmptyState
            title="No children linked"
            description="No student records are linked to your account. Please contact the school administrator to link your children."
            icon={<AlertCircle className="h-10 w-10" />}
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back to your parent portal"
        icon={<LayoutDashboard className="h-5 w-5" />}
        action={
          children.length > 1 ? (
            <div className="relative">
              <Button
                variant="secondary"
                leftIcon={<ChevronDown className="h-4 w-4" />}
                onClick={() => setChildMenuOpen((prev) => !prev)}
              >
                Switch Child
              </Button>
              {childMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setChildMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-100 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => {
                          selectChild(child.id);
                          setChildMenuOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors',
                          selectedChild?.id === child.id
                            ? 'bg-primary-50 dark:bg-primary-500/15'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}
                      >
                        <Avatar name={child.full_name} src={child.photo_url} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink dark:text-slate-100">
                            {child.full_name}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {child.admission_number}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : undefined
        }
      />

      {/* Selected Child Info Card */}
      {selectedChild && (
        <Card className="mb-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Avatar name={selectedChild.full_name} src={selectedChild.photo_url} size="lg" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink dark:text-slate-100">{selectedChild.full_name}</h2>
                <Badge variant={statusBadge(selectedChild.enrollment_status).variant}>
                  {statusBadge(selectedChild.enrollment_status).label}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
                <span>Adm: {selectedChild.admission_number}</span>
                <span>Class: {selectedChildClass?.name ?? '—'}</span>
                {selectedChild.gender && <span className="capitalize">Gender: {selectedChild.gender}</span>}
              </div>
            </div>
            {children.length > 1 && (
              <div className="flex gap-2">
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => selectChild(child.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      selectedChild.id === child.id
                        ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/15 dark:text-primary-light'
                        : 'border-slate-200 text-ink-muted hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                    )}
                  >
                    <Avatar name={child.full_name} src={child.photo_url} size="xs" />
                    <span className="max-w-[100px] truncate">{child.full_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Attendance"
          value={statsLoading ? '—' : `${attendancePct}%`}
          icon={<CalendarCheck className="h-5 w-5" />}
          accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
        />
        <StatCard
          label="Homework Due"
          value={statsLoading ? '—' : homeworkDueCount}
          icon={<BookOpen className="h-5 w-5" />}
          accent="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
        />
        <StatCard
          label="Exam Results"
          value={statsLoading ? '—' : examResultsCount}
          icon={<BarChart3 className="h-5 w-5" />}
          accent="bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400"
        />
        <StatCard
          label="Announcements"
          value={statsLoading ? '—' : stats.announcements.length}
          icon={<Megaphone className="h-5 w-5" />}
          accent="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick Links */}
        <Card className="lg:col-span-1">
          <CardHeader title="Quick Links" subtitle="Jump to a module" />
          <div className="grid grid-cols-1 gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
              >
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', link.color)}>
                  <link.icon className="h-5 w-5" />
                </div>
                <span className="flex-1 text-sm font-medium text-ink dark:text-slate-100">{link.label}</span>
                <ChevronDown className="h-4 w-4 -rotate-90 text-ink-muted" />
              </Link>
            ))}
          </div>
        </Card>

        {/* Recent Announcements */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent Announcements"
            subtitle="Latest news from the school"
            action={
              <Megaphone className="h-5 w-5 text-ink-muted" />
            }
          />
          {statsLoading ? (
            <RowSkeleton rows={4} />
          ) : stats.announcements.length === 0 ? (
            <EmptyState
              title="No announcements"
              description="There are no announcements at this time."
              icon={<Megaphone className="h-10 w-10" />}
            />
          ) : (
            <div className="space-y-3">
              {stats.announcements.slice(0, 5).map((ann) => (
                <div
                  key={ann.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink dark:text-slate-100">{ann.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{ann.body}</p>
                    {ann.attachments && ann.attachments.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {ann.attachments.map((att, i) => (
                          <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-600 hover:bg-primary-100 dark:bg-primary-500/15 dark:text-primary-light dark:hover:bg-primary-500/25">
                            <Paperclip className="h-3 w-3" />
                            {att.name}
                          </a>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-ink-muted">{relativeTime(ann.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Latest Exam Performance */}
      {latestExamAvg !== null && (
        <Card className="mt-6">
          <CardHeader
            title="Latest Exam Performance"
            subtitle="Summary of your child's most recent exam results"
            action={
              <Link to="/parent/results">
                <Button size="sm" variant="secondary" leftIcon={<TrendingUp className="h-3.5 w-3.5" />}>
                  View Results
                </Button>
              </Link>
            }
          />
          <div className="flex items-center gap-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-500/15">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary-600 dark:text-primary-light">{latestExamAvg}%</p>
                <p className="text-xs text-ink-muted">Average</p>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                <p className="text-sm font-medium text-ink dark:text-slate-100">
                  {stats.examMarks.length} subject{stats.examMarks.length !== 1 ? 's' : ''} recorded
                </p>
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {latestExamAvg >= 50
                  ? 'Your child is performing well. Keep encouraging them!'
                  : 'Your child may need additional support. Consider speaking with their teachers.'}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
