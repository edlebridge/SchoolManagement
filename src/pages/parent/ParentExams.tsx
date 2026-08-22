import { useState, useEffect, useMemo } from 'react';
import { Calendar, ClipboardList, ChevronDown, BookOpen, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useParent } from '@/context/ParentContext';
import { useAcademic } from '@/context/AcademicContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Form';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton, CardSkeleton } from '@/components/ui/Spinner';
import { ExamTimetable } from '@/components/exam/ExamTimetable';
import { formatDate, cn } from '@/lib/utils';
import type { ExamSession, Exam, Subject, ClassRow, AppUser } from '@/types';

export function ParentExams() {
  const { profile } = useAuth();
  const { children, selectedChild, selectedChildClass, loading, selectChild } = useParent();
  const { years, selectedYearId, setYear } = useAcademic();

  const [yearId, setYearId] = useState(selectedYearId);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<AppUser[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [childMenuOpen, setChildMenuOpen] = useState(false);

  useEffect(() => { setYearId(selectedYearId); }, [selectedYearId]);

  useEffect(() => {
    if (!yearId || !profile?.school_id) { setSessions([]); return; }
    supabase
      .from('exam_sessions')
      .select('*')
      .eq('school_id', profile.school_id)
      .eq('academic_year_id', yearId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setSessions((data as ExamSession[]) ?? []));
  }, [yearId, profile?.school_id]);

  useEffect(() => {
    if (!profile?.school_id) { setSubjects([]); setClasses([]); setTeachers([]); return; }
    Promise.all([
      supabase.from('subjects').select('*').eq('school_id', profile.school_id),
      supabase.from('classes').select('*').eq('school_id', profile.school_id),
      supabase.from('app_users').select('*').eq('school_id', profile.school_id).eq('role', 'teacher'),
    ]).then(([subRes, clsRes, tRes]) => {
      setSubjects((subRes.data as Subject[]) ?? []);
      setClasses((clsRes.data as ClassRow[]) ?? []);
      setTeachers((tRes.data as AppUser[]) ?? []);
    });
  }, [profile?.school_id]);

  useEffect(() => {
    if (sessions.length === 0 || !selectedChild?.class_id) { setExams([]); return; }
    setDataLoading(true);
    const sessionIds = sessions.map((s) => s.id);
    supabase
      .from('exams')
      .select('*')
      .in('exam_session_id', sessionIds)
      .eq('class_id', selectedChild.class_id)
      .order('exam_date', { ascending: true })
      .then(({ data }) => {
        setExams((data as Exam[]) ?? []);
        setDataLoading(false);
      });
  }, [sessions, selectedChild]);

  const childClass = useMemo(() => {
    if (!selectedChild?.class_id) return null;
    return classes.find((c) => c.id === selectedChild.class_id) ?? null;
  }, [classes, selectedChild]);

  const examsBySession = useMemo(() => {
    const map: Record<string, Exam[]> = {};
    exams.forEach((ex) => {
      const key = ex.exam_session_id ?? 'unknown';
      if (!map[key]) map[key] = [];
      map[key].push(ex);
    });
    return map;
  }, [exams]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Exam Schedule" subtitle="View upcoming exams for your child" icon={<ClipboardList className="h-5 w-5" />} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="mt-6"><RowSkeleton rows={4} /></div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div>
        <PageHeader title="Exam Schedule" subtitle="View upcoming exams for your child" icon={<ClipboardList className="h-5 w-5" />} />
        <Card>
          <EmptyState title="No children linked" description="No student records are linked to your account. Please contact the school administrator." icon={<ClipboardList className="h-10 w-10" />} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Exam Schedule"
        subtitle="View upcoming exams for your child"
        icon={<ClipboardList className="h-5 w-5" />}
        action={
          children.length > 1 ? (
            <div className="relative">
              <button
                onClick={() => setChildMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-ink dark:text-slate-100 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Avatar name={selectedChild?.full_name ?? ''} src={selectedChild?.photo_url} size="xs" />
                <span className="max-w-[120px] truncate">{selectedChild?.full_name}</span>
                <ChevronDown className="h-4 w-4 text-ink-muted" />
              </button>
              {childMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setChildMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-lg">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => { selectChild(child.id); setChildMenuOpen(false); }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors',
                          selectedChild?.id === child.id ? 'bg-primary-50 dark:bg-primary-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}
                      >
                        <Avatar name={child.full_name} src={child.photo_url} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink dark:text-slate-100">{child.full_name}</p>
                          <p className="text-xs text-ink-muted">{child.admission_number}</p>
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

      {selectedChild && (
        <Card className="mb-6">
          <div className="flex items-center gap-4">
            <Avatar name={selectedChild.full_name} src={selectedChild.photo_url} size="md" />
            <div>
              <p className="font-semibold text-ink dark:text-slate-100">{selectedChild.full_name}</p>
              <p className="text-sm text-ink-muted">
                {selectedChild.admission_number} · {childClass?.name ?? 'No class assigned'}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <Select label="Academic Year" value={yearId} onChange={(e) => { setYearId(e.target.value); setYear(e.target.value); }}>
          <option value="">Select year...</option>
          {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
        </Select>
      </Card>

      {!yearId ? (
        <Card>
          <EmptyState title="Select academic year" description="Choose an academic year to view exam schedules for your child." icon={<Calendar className="h-10 w-10" />} />
        </Card>
      ) : dataLoading ? (
        <RowSkeleton rows={4} />
      ) : sessions.length === 0 ? (
        <Card>
          <EmptyState title="No exam sessions" description="There are no exam sessions for the selected academic year." icon={<ClipboardList className="h-10 w-10" />} />
        </Card>
      ) : (
        <div className="space-y-6">
          {sessions.map((session) => {
            const sessionExams = examsBySession[session.id] ?? [];
            const badge = statusBadge(session.status);
            return (
              <Card key={session.id}>
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-ink dark:text-slate-100">{session.name}</h3>
                    <p className="text-sm text-ink-muted mt-0.5">
                      {formatDate(session.start_date)} — {formatDate(session.end_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    {session.published && <Badge variant="success">Published</Badge>}
                  </div>
                </div>

                {sessionExams.length === 0 ? (
                  <div className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                    <p className="text-sm text-ink-muted">
                      No exams scheduled for {childClass?.name ?? "your child's class"} yet.
                    </p>
                  </div>
                ) : (
                  <ExamTimetable
                    exams={sessionExams}
                    classes={childClass ? [childClass] : []}
                    subjects={subjects}
                    teachers={teachers}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
