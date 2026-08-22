import { useMemo, useState, useEffect } from 'react';
import { ClipboardCheck, Calendar, Info, Lock, BookOpen, ChevronRight, ArrowLeft, LayoutGrid, List } from 'lucide-react';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useAuth } from '@/context/AuthContext';
import { useAcademic } from '@/context/AcademicContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Form';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Spinner';
import { ExamTimetable } from '@/components/exam/ExamTimetable';
import { formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Exam, ExamSession, ClassRow, Subject, AppUser } from '@/types';

export function TeacherExamSessions() {
  const { profile } = useAuth();
  const { examSessions, classes, subjects, teachers, classSubjects, loading } = useSchoolData();
  const { years, selectedYearId, setYear } = useAcademic();

  const [selectedYear, setSelectedYear] = useState(selectedYearId);
  const [examCounts, setExamCounts] = useState<Record<string, number>>({});
  const [viewingSession, setViewingSession] = useState<ExamSession | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'timetable' | 'list'>('timetable');
  const [classFilter, setClassFilter] = useState('');

  useEffect(() => { setSelectedYear(selectedYearId); }, [selectedYearId]);

  // Classes the teacher is assigned to (as class teacher or subject teacher)
  const myClasses = useMemo(() => {
    if (!profile) return [];
    return classes.filter(
      (c) =>
        c.class_teacher_id === profile.id ||
        classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === profile.id)
    );
  }, [classes, classSubjects, profile]);

  const myClassIds = useMemo(() => myClasses.map((c) => c.id), [myClasses]);

  // Filter sessions to only those that have exams in the teacher's classes
  const filteredSessions = useMemo(() => {
    if (!selectedYear) return examSessions;
    return examSessions.filter((es) => es.academic_year_id === selectedYear);
  }, [examSessions, selectedYear]);

  useEffect(() => {
    if (filteredSessions.length === 0) { setExamCounts({}); return; }
    supabase
      .from('exams')
      .select('exam_session_id, class_id')
      .in('exam_session_id', filteredSessions.map((s) => s.id))
      .in('class_id', myClassIds)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        (data ?? []).forEach((r: { exam_session_id: string }) => {
          counts[r.exam_session_id] = (counts[r.exam_session_id] ?? 0) + 1;
        });
        setExamCounts(counts);
      });
  }, [filteredSessions, myClassIds]);

  // Sessions relevant to this teacher (have at least 1 exam in their classes)
  const teacherSessions = useMemo(() => {
    return filteredSessions.filter((s) => (examCounts[s.id] ?? 0) > 0);
  }, [filteredSessions, examCounts]);

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

  const openSessionDetail = async (s: ExamSession) => {
    setViewingSession(s);
    setClassFilter('');
    setExamsLoading(true);
    const { data } = await supabase
      .from('exams')
      .select('*')
      .eq('exam_session_id', s.id)
      .in('class_id', myClassIds)
      .order('exam_date', { ascending: true });
    setExams((data as Exam[]) ?? []);
    setExamsLoading(false);
  };

  if (viewingSession) {
    const visibleExams = classFilter ? exams.filter((e) => e.class_id === classFilter) : exams;

    return (
      <div>
        <button onClick={() => setViewingSession(null)} className="mb-4 flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink dark:hover:text-slate-100">
          <ArrowLeft className="h-4 w-4" /> Back to exam sessions
        </button>

        <PageHeader
          title={viewingSession.name}
          subtitle={`${years.find((y) => y.id === viewingSession.academic_year_id)?.name ?? '—'}`}
          icon={<ClipboardCheck className="h-6 w-6" />}
        />

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-sm text-ink-muted">Duration</p>
            <p className="mt-1 font-medium text-ink dark:text-slate-100">
              {viewingSession.start_date || viewingSession.end_date
                ? `${formatDate(viewingSession.start_date)} — ${formatDate(viewingSession.end_date)}`
                : '—'}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-ink-muted">Exams in Your Classes</p>
            <p className="mt-1 font-medium text-ink dark:text-slate-100">{exams.length}</p>
          </Card>
          <Card>
            <p className="text-sm text-ink-muted">Status</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={statusBadge(viewingSession.status).variant}>{statusBadge(viewingSession.status).label}</Badge>
              {viewingSession.published && <Badge variant="success">Published</Badge>}
            </div>
          </Card>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('timetable')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${viewMode === 'timetable' ? 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-light' : 'text-ink-muted hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <LayoutGrid className="h-4 w-4" /> Timetable
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-light' : 'text-ink-muted hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <List className="h-4 w-4" /> List
            </button>
          </div>
          <div className="sm:w-64">
            <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">All my classes</option>
              {myClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
        </div>

        {examsLoading ? (
          <RowSkeleton rows={4} />
        ) : exams.length === 0 ? (
          <Card>
            <EmptyState title="No exams in your classes" description="The school administrator has not scheduled any exams for your classes in this session yet." icon={<BookOpen className="h-10 w-10" />} />
          </Card>
        ) : viewMode === 'timetable' ? (
          <ExamTimetable
            exams={visibleExams}
            classes={myClasses}
            subjects={subjects}
            teachers={teachers}
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-ink-muted">
                    <th className="py-2 pr-4 font-medium">Exam</th>
                    <th className="py-2 pr-4 font-medium">Subject</th>
                    <th className="py-2 pr-4 font-medium">Class</th>
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Time</th>
                    <th className="py-2 pr-4 font-medium">Room</th>
                    <th className="py-2 pr-4 font-medium">Teacher</th>
                    <th className="py-2 pr-4 font-medium text-right">Max Marks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleExams.map((ex) => (
                    <tr key={ex.id} className="text-ink-soft dark:text-slate-300">
                      <td className="py-2.5 pr-4"><p className="font-medium text-ink dark:text-slate-100">{ex.name}</p></td>
                      <td className="py-2.5 pr-4">{subjectMap[ex.subject_id ?? '']?.name ?? '—'}</td>
                      <td className="py-2.5 pr-4">{classMap[ex.class_id ?? '']?.name ?? '—'}</td>
                      <td className="py-2.5 pr-4">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-ink-muted" />
                          {ex.exam_date ? formatDate(ex.exam_date) : '—'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">{ex.start_time ? `${ex.start_time}${ex.end_time ? `–${ex.end_time}` : ''}` : '—'}</td>
                      <td className="py-2.5 pr-4">{ex.room ?? '—'}</td>
                      <td className="py-2.5 pr-4">{ex.teacher_id ? (teacherMap[ex.teacher_id]?.full_name ?? '—') : '—'}</td>
                      <td className="py-2.5 pr-4 text-right"><Badge variant="secondary">{ex.total_marks}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Exam Sessions"
        subtitle="View exam timetables for your assigned classes"
        icon={<ClipboardCheck className="h-5 w-5" />}
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary-100 bg-primary-50 p-4 dark:border-primary-500/20 dark:bg-primary-500/10">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary-600 dark:text-primary-light" />
        <div>
          <p className="text-sm font-medium text-primary-700 dark:text-primary-light">
            Exam timetables are created by your School Administrator.
          </p>
          <p className="text-sm text-primary-600/80 dark:text-primary-light/70 mt-0.5">
            You only see exams for classes you teach. Click a session to view the full timetable.
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <Select label="Academic Year" value={selectedYear} onChange={(e) => {
          setSelectedYear(e.target.value);
          setYear(e.target.value);
        }}>
          <option value="">All Years</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>{y.name}</option>
          ))}
        </Select>
      </Card>

      {loading ? (
        <RowSkeleton rows={4} />
      ) : teacherSessions.length === 0 ? (
        <Card>
          <EmptyState
            title="No exam sessions"
            description="There are no exam sessions with exams scheduled for your classes in the selected academic year."
            icon={<ClipboardCheck className="h-10 w-10" />}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teacherSessions.map((es) => {
            const badge = statusBadge(es.status);
            const examCount = examCounts[es.id] ?? 0;
            return (
              <Card key={es.id} hover>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-light">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-ink dark:text-slate-100">{es.name}</p>
                      <p className="text-xs text-ink-muted">
                        {years.find((y) => y.id === es.academic_year_id)?.name ?? '—'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(es.start_date)} — {formatDate(es.end_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-ink-muted">
                    <BookOpen className="h-4 w-4" />
                    <span>{examCount} exam{examCount !== 1 ? 's' : ''} in your classes</span>
                  </div>
                  {es.published && (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <Lock className="h-4 w-4" />
                      <span>Results published</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => openSessionDetail(es)}
                  className="mt-4 flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-light transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  View Exam Timetable
                  <ChevronRight className="h-4 w-4" />
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
