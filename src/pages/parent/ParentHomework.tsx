import { useState, useEffect, useCallback, useMemo } from 'react';
import { BookOpen, CalendarClock, BookX, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useParent } from '@/context/ParentContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { RowSkeleton, CardSkeleton } from '@/components/ui/Spinner';
import { formatDate, relativeTime, cn } from '@/lib/utils';
import type { Homework, Subject } from '@/types';

interface HomeworkWithSubject extends Homework {
  subject_name: string;
  subject_code: string | null;
  is_overdue: boolean;
}

export function ParentHomework() {
  const { profile } = useAuth();
  const { children, selectedChild, selectedChildClass, loading, selectChild } = useParent();
  const [homework, setHomework] = useState<HomeworkWithSubject[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [childMenuOpen, setChildMenuOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'overdue'>('all');

  const loadData = useCallback(async () => {
    if (!selectedChild || !profile?.school_id) {
      setHomework([]);
      setSubjects([]);
      return;
    }
    setDataLoading(true);
    try {
      const classId = selectedChild.class_id;
      if (!classId) {
        setHomework([]);
        setSubjects([]);
        setDataLoading(false);
        return;
      }

      const [hwRes, subjectsRes] = await Promise.all([
        supabase
          .from('homework')
          .select('*')
          .eq('school_id', profile.school_id)
          .eq('class_id', classId)
          .order('due_date', { ascending: true }),
        supabase
          .from('subjects')
          .select('*')
          .eq('school_id', profile.school_id),
      ]);

      const subjectList = (subjectsRes.data as Subject[]) ?? [];
      setSubjects(subjectList);

      const now = new Date();
      const hwList: HomeworkWithSubject[] = ((hwRes.data as Homework[]) ?? []).map((hw) => {
        const subject = subjectList.find((s) => s.id === hw.subject_id);
        const dueDate = new Date(hw.due_date);
        return {
          ...hw,
          subject_name: subject?.name ?? 'General',
          subject_code: subject?.code ?? null,
          is_overdue: dueDate < now,
        };
      });

      setHomework(hwList);
    } catch {
      setHomework([]);
      setSubjects([]);
    } finally {
      setDataLoading(false);
    }
  }, [selectedChild, profile?.school_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered homework
  const filteredHomework = useMemo(() => {
    if (filter === 'pending') {
      return homework.filter((hw) => !hw.is_overdue);
    }
    if (filter === 'overdue') {
      return homework.filter((hw) => hw.is_overdue);
    }
    return homework;
  }, [homework, filter]);

  // Stats
  const stats = useMemo(() => {
    const pending = homework.filter((hw) => !hw.is_overdue).length;
    const overdue = homework.filter((hw) => hw.is_overdue).length;
    const total = homework.length;
    return { pending, overdue, total };
  }, [homework]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Homework" subtitle="View homework assigned to your child's class" icon={<BookOpen className="h-5 w-5" />} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
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
        <PageHeader title="Homework" subtitle="View homework assigned to your child's class" icon={<BookOpen className="h-5 w-5" />} />
        <Card>
          <EmptyState
            title="No children linked"
            description="No student records are linked to your account. Please contact the school administrator."
            icon={<BookX className="h-10 w-10" />}
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Homework"
        subtitle="View homework assigned to your child's class"
        icon={<BookOpen className="h-5 w-5" />}
        action={
          children.length > 1 ? (
            <div className="relative">
              <button
                onClick={() => setChildMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Avatar name={selectedChild?.full_name ?? ''} src={selectedChild?.photo_url} size="xs" />
                <span className="max-w-[120px] truncate">{selectedChild?.full_name}</span>
                <ChevronDown className="h-4 w-4 text-ink-muted" />
              </button>
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

      {/* Child Info */}
      {selectedChild && (
        <Card className="mb-6">
          <div className="flex items-center gap-4">
            <Avatar name={selectedChild.full_name} src={selectedChild.photo_url} size="md" />
            <div>
              <p className="font-semibold text-ink dark:text-slate-100">{selectedChild.full_name}</p>
              <p className="text-sm text-ink-muted">
                {selectedChild.admission_number} · {selectedChildClass?.name ?? 'No class assigned'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Assignments"
          value={dataLoading ? '—' : stats.total}
          icon={<BookOpen className="h-5 w-5" />}
          accent="bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-light"
        />
        <StatCard
          label="Pending"
          value={dataLoading ? '—' : stats.pending}
          icon={<CalendarClock className="h-5 w-5" />}
          accent="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
        />
        <StatCard
          label="Overdue"
          value={dataLoading ? '—' : stats.overdue}
          icon={<BookX className="h-5 w-5" />}
          accent="bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
        />
      </div>

      {/* Filter Tabs */}
      <div className="mt-6 flex gap-2">
        {(['all', 'pending', 'overdue'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              filter === tab
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-light'
                : 'text-ink-muted hover:bg-slate-50 dark:hover:bg-slate-800'
            )}
          >
            {tab}
            {tab === 'pending' && stats.pending > 0 && (
              <span className="ml-1.5 text-xs">({stats.pending})</span>
            )}
            {tab === 'overdue' && stats.overdue > 0 && (
              <span className="ml-1.5 text-xs">({stats.overdue})</span>
            )}
          </button>
        ))}
      </div>

      {/* Homework List */}
      <Card className="mt-4">
        <CardHeader title="Assignments" subtitle={`${filteredHomework.length} item${filteredHomework.length !== 1 ? 's' : ''}`} />

        {dataLoading ? (
          <RowSkeleton rows={5} />
        ) : filteredHomework.length === 0 ? (
          <EmptyState
            title="No homework"
            description={
              filter === 'overdue'
                ? 'No overdue assignments. Great job!'
                : filter === 'pending'
                ? 'No pending assignments for your child.'
                : 'No homework has been assigned to your child\'s class yet.'
            }
            icon={<BookOpen className="h-10 w-10" />}
          />
        ) : (
          <div className="space-y-3">
            {filteredHomework.map((hw) => (
              <div
                key={hw.id}
                className={cn(
                  'flex items-start gap-4 rounded-xl border p-4 transition-colors',
                  hw.is_overdue
                    ? 'border-rose-200 bg-rose-50/30 dark:border-rose-500/20 dark:bg-rose-500/5'
                    : 'border-slate-100 dark:border-slate-800'
                )}
              >
                {/* Subject Badge */}
                <div className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  hw.is_overdue
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
                    : 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-light'
                )}>
                  <BookOpen className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium text-ink dark:text-slate-100">{hw.title}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="primary">{hw.subject_name}</Badge>
                        {hw.subject_code && (
                          <Badge variant="secondary">{hw.subject_code}</Badge>
                        )}
                        {hw.is_overdue ? (
                          <Badge variant="error">Overdue</Badge>
                        ) : (
                          <Badge variant="warning">Due {relativeTime(hw.due_date)}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-ink-muted">Due Date</p>
                      <p className={cn(
                        'text-sm font-medium',
                        hw.is_overdue ? 'text-rose-600 dark:text-rose-400' : 'text-ink dark:text-slate-100'
                      )}>
                        {formatDate(hw.due_date)}
                      </p>
                    </div>
                  </div>

                  {hw.description && (
                    <p className="mt-2 text-sm text-ink-muted line-clamp-3">{hw.description}</p>
                  )}

                  <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
                    <span>Assigned {relativeTime(hw.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
