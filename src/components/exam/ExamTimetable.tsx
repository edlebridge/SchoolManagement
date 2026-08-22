import { useMemo } from 'react';
import { Calendar, Clock, MapPin, BookOpen, TriangleAlert as AlertTriangle } from 'lucide-react';
import type { Exam, ClassRow, Subject, AppUser } from '@/types';
import { formatDate, cn } from '@/lib/utils';

interface ExamTimetableProps {
  exams: Exam[];
  classes: ClassRow[];
  subjects: Subject[];
  teachers: AppUser[];
  /** When provided, only exams for these class IDs are shown. */
  classFilter?: string[];
  /** When true, shows edit/delete actions on exam cards. */
  editable?: boolean;
  onEditExam?: (exam: Exam) => void;
  onDeleteExam?: (exam: Exam) => void;
  onAddForDateClass?: (date: string, classId: string) => void;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toMinutes(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function ExamTimetable({
  exams,
  classes,
  subjects,
  teachers,
  classFilter,
  editable,
  onEditExam,
  onDeleteExam,
  onAddForDateClass,
}: ExamTimetableProps) {
  const classMap = useMemo(() => {
    const m: Record<string, ClassRow> = {};
    classes.forEach((c) => { m[c.id] = c; });
    return m;
  }, [classes]);

  const subjectMap = useMemo(() => {
    const m: Record<string, Subject> = {};
    subjects.forEach((s) => { m[s.id] = s; });
    return m;
  }, [subjects]);

  const teacherMap = useMemo(() => {
    const m: Record<string, AppUser> = {};
    teachers.forEach((t) => { m[t.id] = t; });
    return m;
  }, [teachers]);

  const visibleExams = useMemo(() => {
    if (!classFilter) return exams;
    return exams.filter((e) => e.class_id && classFilter.includes(e.class_id));
  }, [exams, classFilter]);

  const visibleClasses = useMemo(() => {
    if (!classFilter) return classes;
    return classes.filter((c) => classFilter.includes(c.id));
  }, [classes, classFilter]);

  // Group exams by date → class
  const timetable = useMemo(() => {
    const map: Record<string, Record<string, Exam[]>> = {};
    visibleExams.forEach((ex) => {
      const dateKey = ex.exam_date ?? 'unscheduled';
      const classKey = ex.class_id ?? 'no-class';
      if (!map[dateKey]) map[dateKey] = {};
      if (!map[dateKey][classKey]) map[dateKey][classKey] = [];
      map[dateKey][classKey].push(ex);
    });
    // Sort exams within each cell by start_time
    Object.values(map).forEach((classMap) => {
      Object.values(classMap).forEach((arr) => {
        arr.sort((a, b) => (toMinutes(a.start_time) ?? 9999) - (toMinutes(b.start_time) ?? 9999));
      });
    });
    return map;
  }, [visibleExams]);

  // Detect conflicts: same class, same date, overlapping time ranges
  const conflicts = useMemo(() => {
    const set = new Set<string>();
    Object.entries(timetable).forEach(([dateKey, classMap]) => {
      if (dateKey === 'unscheduled') return;
      Object.entries(classMap).forEach(([classKey, arr]) => {
        for (let i = 0; i < arr.length; i++) {
          for (let j = i + 1; j < arr.length; j++) {
            const a = arr[i];
            const b = arr[j];
            const aStart = toMinutes(a.start_time);
            const aEnd = toMinutes(a.end_time);
            const bStart = toMinutes(b.start_time);
            const bEnd = toMinutes(b.end_time);
            if (aStart != null && aEnd != null && bStart != null && bEnd != null) {
              if (aStart < bEnd && bStart < aEnd) {
                set.add(`${dateKey}|${classKey}|${a.id}|${b.id}`);
              }
            }
          }
        }
      });
    });
    return set;
  }, [timetable]);

  const sortedDates = useMemo(() => {
    const dates = Object.keys(timetable).filter((d) => d !== 'unscheduled').sort();
    if (timetable['unscheduled']) dates.push('unscheduled');
    return dates;
  }, [timetable]);

  if (visibleExams.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
        <BookOpen className="mx-auto h-10 w-10 text-ink-muted" />
        <p className="mt-2 text-sm text-ink-muted">No exams scheduled yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {conflicts.size > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {conflicts.size} scheduling conflict{conflicts.size !== 1 ? 's' : ''} detected — overlapping exam times for the same class on the same date.
          </p>
        </div>
      )}

      {sortedDates.map((dateKey) => {
        const isUnscheduled = dateKey === 'unscheduled';
        const dateObj = isUnscheduled ? null : new Date(dateKey);
        const dayLabel = isUnscheduled
          ? 'Unscheduled'
          : new Date(dateKey).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

        return (
          <div key={dateKey}>
            <div className="mb-3 flex items-center gap-2">
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                isUnscheduled
                  ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  : 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-light'
              )}>
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-ink dark:text-slate-100">{dayLabel}</h3>
                {!isUnscheduled && dateObj && (
                  <p className="text-xs text-ink-muted">{DAY_LABELS[dateObj.getDay()]} · {formatDate(dateKey)}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {visibleClasses.map((cls) => {
                const cellExams = timetable[dateKey]?.[cls.id] ?? [];
                if (cellExams.length === 0 && !editable) return null;

                return (
                  <div
                    key={cls.id}
                    className={cn(
                      'rounded-xl border p-4 transition-colors',
                      cellExams.length > 0
                        ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                        : 'border-dashed border-slate-200 dark:border-slate-700'
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink dark:text-slate-100">{cls.name}</span>
                      {cellExams.length > 0 && (
                        <span className="rounded-full bg-primary-50 dark:bg-primary-500/15 px-2 py-0.5 text-xs font-medium text-primary-600 dark:text-primary-light">
                          {cellExams.length} exam{cellExams.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {cellExams.length === 0 ? (
                      editable && onAddForDateClass ? (
                        <button
                          onClick={() => onAddForDateClass(dateKey, cls.id)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 py-2 text-xs text-ink-muted hover:border-primary-300 hover:text-primary-600 dark:hover:border-primary-500/50 dark:hover:text-primary-light"
                        >
                          + Add exam
                        </button>
                      ) : (
                        <p className="text-xs text-ink-muted">No exams</p>
                      )
                    ) : (
                      <div className="space-y-2">
                        {cellExams.map((ex) => {
                          const hasConflict = [...conflicts].some((c) => c.includes(ex.id));
                          return (
                            <div
                              key={ex.id}
                              className={cn(
                                'rounded-lg border p-3',
                                hasConflict
                                  ? 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
                                  : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50'
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-ink dark:text-slate-100">
                                    {subjectMap[ex.subject_id ?? '']?.name ?? ex.name}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                                    {ex.start_time && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {ex.start_time}{ex.end_time ? `–${ex.end_time}` : ''}
                                      </span>
                                    )}
                                    {ex.room && (
                                      <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {ex.room}
                                      </span>
                                    )}
                                  </div>
                                  {ex.teacher_id && teacherMap[ex.teacher_id] && (
                                    <p className="mt-0.5 text-xs text-ink-muted">
                                      {teacherMap[ex.teacher_id].full_name}
                                    </p>
                                  )}
                                  <span className="mt-1 inline-block rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-xs text-ink-muted">
                                    {ex.total_marks} marks
                                  </span>
                                </div>
                                {editable && (
                                  <div className="flex shrink-0 gap-1">
                                    {onEditExam && (
                                      <button
                                        onClick={() => onEditExam(ex)}
                                        className="rounded p-1 text-ink-muted hover:bg-slate-200 dark:hover:bg-slate-700"
                                        title="Edit"
                                      >
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                      </button>
                                    )}
                                    {onDeleteExam && (
                                      <button
                                        onClick={() => onDeleteExam(ex)}
                                        className="rounded p-1 text-ink-muted hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/20"
                                        title="Delete"
                                      >
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {editable && onAddForDateClass && (
                          <button
                            onClick={() => onAddForDateClass(dateKey, cls.id)}
                            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 py-1.5 text-xs text-ink-muted hover:border-primary-300 hover:text-primary-600 dark:hover:border-primary-500/50 dark:hover:text-primary-light"
                          >
                            + Add another
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
