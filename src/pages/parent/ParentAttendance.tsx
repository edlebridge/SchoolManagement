import { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarCheck, CalendarX, Sun, Moon, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useParent } from '@/context/ParentContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { RowSkeleton, CardSkeleton } from '@/components/ui/Spinner';
import { formatDate, cn } from '@/lib/utils';
import type { Attendance } from '@/types';

interface DayRecord {
  date: string;
  morning: Attendance | null;
  afternoon: Attendance | null;
}

export function ParentAttendance() {
  const { profile } = useAuth();
  const { children, selectedChild, selectedChildClass, loading, selectChild } = useParent();
  const [records, setRecords] = useState<Attendance[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [childMenuOpen, setChildMenuOpen] = useState(false);

  const loadAttendance = useCallback(async () => {
    if (!selectedChild || !profile?.school_id) {
      setRecords([]);
      return;
    }
    setDataLoading(true);
    try {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('school_id', profile.school_id)
        .eq('student_id', selectedChild.id)
        .order('date', { ascending: false })
        .order('session', { ascending: true });
      setRecords((data as Attendance[]) ?? []);
    } catch {
      setRecords([]);
    } finally {
      setDataLoading(false);
    }
  }, [selectedChild, profile?.school_id]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // Group records by date with morning/afternoon
  const dayRecords: DayRecord[] = useMemo(() => {
    const map = new Map<string, DayRecord>();
    for (const rec of records) {
      if (!map.has(rec.date)) {
        map.set(rec.date, { date: rec.date, morning: null, afternoon: null });
      }
      const day = map.get(rec.date)!;
      if (rec.session === 'morning') {
        day.morning = rec;
      } else if (rec.session === 'afternoon') {
        day.afternoon = rec;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [records]);

  // Summary stats
  const summary = useMemo(() => {
    const morningRecords = records.filter((r) => r.session === 'morning');
    const afternoonRecords = records.filter((r) => r.session === 'afternoon');

    const morningPresent = morningRecords.filter((r) => r.status === 'present' || r.status === 'late').length;
    const morningPct = morningRecords.length > 0 ? Math.round((morningPresent / morningRecords.length) * 100) : 0;

    const afternoonPresent = afternoonRecords.filter((r) => r.status === 'present' || r.status === 'late').length;
    const afternoonPct = afternoonRecords.length > 0 ? Math.round((afternoonPresent / afternoonRecords.length) * 100) : 0;

    const totalPresent = records.filter((r) => r.status === 'present' || r.status === 'late').length;
    const totalAbsent = records.filter((r) => r.status === 'absent').length;

    return { morningPct, afternoonPct, totalPresent, totalAbsent, totalRecords: records.length };
  }, [records]);

  const getStatusBadge = (status: string | null) => {
    if (!status) return <span className="text-xs text-ink-muted">—</span>;
    const info = statusBadge(status);
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Attendance" subtitle="View your child's attendance records" icon={<CalendarCheck className="h-5 w-5" />} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="mt-6">
          <RowSkeleton rows={6} />
        </div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div>
        <PageHeader title="Attendance" subtitle="View your child's attendance records" icon={<CalendarCheck className="h-5 w-5" />} />
        <Card>
          <EmptyState
            title="No children linked"
            description="No student records are linked to your account. Please contact the school administrator."
            icon={<CalendarX className="h-10 w-10" />}
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="View your child's attendance records"
        icon={<CalendarCheck className="h-5 w-5" />}
        action={
          children.length > 1 ? (
            <div className="relative">
              <button
                onClick={() => setChildMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Avatar name={selectedChild?.full_name ?? ''} src={selectedChild?.photo_url} size="xs" />
                <span className="max-w-[120px] truncate">{selectedChild?.full_name}</span>
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Morning Attendance"
          value={dataLoading ? '—' : `${summary.morningPct}%`}
          icon={<Sun className="h-5 w-5" />}
          accent="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
        />
        <StatCard
          label="Afternoon Attendance"
          value={dataLoading ? '—' : `${summary.afternoonPct}%`}
          icon={<Moon className="h-5 w-5" />}
          accent="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400"
        />
        <StatCard
          label="Total Present"
          value={dataLoading ? '—' : summary.totalPresent}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
        />
        <StatCard
          label="Total Absent"
          value={dataLoading ? '—' : summary.totalAbsent}
          icon={<TrendingDown className="h-5 w-5" />}
          accent="bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
        />
      </div>

      {/* Attendance Records */}
      <Card className="mt-6">
        <CardHeader
          title="Attendance History"
          subtitle={`${dayRecords.length} day${dayRecords.length !== 1 ? 's' : ''} recorded`}
        />

        {dataLoading ? (
          <RowSkeleton rows={6} />
        ) : dayRecords.length === 0 ? (
          <EmptyState
            title="No attendance records"
            description="No attendance has been recorded for your child yet."
            icon={<CalendarCheck className="h-10 w-10" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-left text-sm text-ink-muted dark:border-slate-800">
                  <th className="pb-3 pr-4 font-medium">Date</th>
                  <th className="pb-3 pr-4 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                      Morning
                    </div>
                  </th>
                  <th className="pb-3 pr-4 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Moon className="h-3.5 w-3.5 text-indigo-500" />
                      Afternoon
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dayRecords.map((day) => (
                  <tr key={day.date} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 pr-4">
                      <p className="text-sm font-medium text-ink dark:text-slate-100">{formatDate(day.date)}</p>
                      <p className="text-xs text-ink-muted">
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </p>
                    </td>
                    <td className="py-3 pr-4">{getStatusBadge(day.morning?.status ?? null)}</td>
                    <td className="py-3 pr-4">{getStatusBadge(day.afternoon?.status ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
