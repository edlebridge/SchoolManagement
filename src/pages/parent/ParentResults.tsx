import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChartBar as BarChart3, Printer, FileDown, Trophy, Award, TrendingUp, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useParent } from '@/context/ParentContext';
import { useAcademic } from '@/context/AcademicContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { RowSkeleton, CardSkeleton } from '@/components/ui/Spinner';
import { formatDate, percentage, gradeFromPercentage, cn } from '@/lib/utils';
import type { ExamMark, ExamSession, Exam, Subject, AcademicYear } from '@/types';

interface ResultRow {
  mark: ExamMark;
  subject_name: string;
  subject_code: string | null;
  exam_name: string;
  pct: number;
  grade: string;
}

export function ParentResults() {
  const { profile } = useAuth();
  const { children, selectedChild, selectedChildClass, loading, selectChild } = useParent();
  const { years, selectedYearId, setYear } = useAcademic();
  const { toast } = useToast();

  const [yearId, setYearId] = useState(selectedYearId);
  const [sessionId, setSessionId] = useState('');
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [marks, setMarks] = useState<ExamMark[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [childMenuOpen, setChildMenuOpen] = useState(false);

  useEffect(() => { setYearId(selectedYearId); }, [selectedYearId]);

  // Reset session when year changes
  useEffect(() => { setSessionId(''); }, [yearId]);

  // Load exam sessions for the selected year
  useEffect(() => {
    if (!yearId || !profile?.school_id) {
      setSessions([]);
      return;
    }
    supabase
      .from('exam_sessions')
      .select('*')
      .eq('school_id', profile.school_id)
      .eq('academic_year_id', yearId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setSessions((data as ExamSession[]) ?? []));
  }, [yearId, profile?.school_id]);

  // Load subjects for the school (used to resolve subject names)
  useEffect(() => {
    if (!profile?.school_id) {
      setSubjects([]);
      return;
    }
    supabase
      .from('subjects')
      .select('*')
      .eq('school_id', profile.school_id)
      .then(({ data }) => setSubjects((data as Subject[]) ?? []));
  }, [profile?.school_id]);

  // Load exams and marks when session + child selected
  const loadData = useCallback(async () => {
    if (!sessionId || !selectedChild || !profile?.school_id) {
      setExams([]);
      setMarks([]);
      return;
    }
    setDataLoading(true);
    try {
      // Load exams for this session
      const { data: examsData } = await supabase
        .from('exams')
        .select('*')
        .eq('school_id', profile.school_id)
        .eq('exam_session_id', sessionId)
        .order('exam_date', { ascending: true });
      const examList = (examsData as Exam[]) ?? [];
      setExams(examList);

      // Load marks for this child in this session's exams
      const examIds = examList.map((e) => e.id);
      if (examIds.length === 0) {
        setMarks([]);
        setDataLoading(false);
        return;
      }

      const { data: marksData } = await supabase
        .from('exam_marks')
        .select('*')
        .eq('school_id', profile.school_id)
        .eq('student_id', selectedChild.id)
        .in('exam_id', examIds)
        .order('created_at', { ascending: true });
      setMarks((marksData as ExamMark[]) ?? []);
    } catch {
      setExams([]);
      setMarks([]);
    } finally {
      setDataLoading(false);
    }
  }, [sessionId, selectedChild, profile?.school_id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Build result rows joining with subjects and exams to get NAMES
  const resultRows: ResultRow[] = useMemo(() => {
    if (marks.length === 0) return [];

    return marks.map((mark) => {
      const subject = subjects.find((s) => s.id === mark.subject_id);
      const exam = exams.find((e) => e.id === mark.exam_id);
      const pct = percentage(mark.marks ?? 0, mark.total_marks ?? 0);
      const grade = mark.grade ?? gradeFromPercentage(pct);

      return {
        mark,
        subject_name: subject?.name ?? 'Unknown Subject',
        subject_code: subject?.code ?? null,
        exam_name: exam?.name ?? 'Unknown Exam',
        pct,
        grade,
      };
    });
  }, [marks, subjects, exams]);

  // Overall summary
  const overallSummary = useMemo(() => {
    if (resultRows.length === 0) return null;
    const totalObtained = resultRows.reduce((sum, r) => sum + (r.mark.marks ?? 0), 0);
    const totalMax = resultRows.reduce((sum, r) => sum + (r.mark.total_marks ?? 0), 0);
    const avgPct = totalMax > 0 ? percentage(totalObtained, totalMax) : 0;
    const bestSubject = resultRows.reduce((best, r) => (r.pct > best.pct ? r : best), resultRows[0]);
    const worstSubject = resultRows.reduce((worst, r) => (r.pct < worst.pct ? r : worst), resultRows[0]);
    const passedCount = resultRows.filter((r) => r.pct >= 50).length;
    const position = resultRows[0]?.mark.position ?? null;

    return {
      totalObtained,
      totalMax,
      avgPct,
      bestSubject,
      worstSubject,
      passedCount,
      totalSubjects: resultRows.length,
      position,
    };
  }, [resultRows]);

  const selectedSession = sessions.find((s) => s.id === sessionId);
  const selectedYear = years.find((y) => y.id === yearId);

  // Check if session is published
  const isPublished = selectedSession?.published ?? false;

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // Download PDF (uses browser print dialog with Save as PDF)
  const handleDownloadPDF = () => {
    window.print();
  };

  // Download CSV
  const handleDownloadCSV = () => {
    if (resultRows.length === 0) {
      toast('No results to download', 'error');
      return;
    }

    const headers = ['Subject', 'Subject Code', 'Exam Name', 'Marks', 'Total Marks', 'Percentage', 'Grade', 'Remarks', 'Position'];
    const csvRows: string[] = [headers.join(',')];

    resultRows.forEach((row) => {
      const csvLine = [
        `"${row.subject_name}"`,
        `"${row.subject_code ?? ''}"`,
        `"${row.exam_name}"`,
        row.mark.marks ?? '',
        row.mark.total_marks ?? '',
        `${row.pct}%`,
        row.grade,
        `"${row.mark.remarks ?? ''}"`,
        row.mark.position ?? '',
      ].join(',');
      csvRows.push(csvLine);
    });

    // Add summary row
    if (overallSummary) {
      csvRows.push('');
      csvRows.push(`"Overall Average","","","${overallSummary.totalObtained}","${overallSummary.totalMax}","${overallSummary.avgPct}%","","",""`);
      csvRows.push(`"Position","","","","","","","","${overallSummary.position ?? ''}"`);
    }

    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `results_${selectedChild?.full_name ?? 'student'}_${selectedSession?.name ?? 'session'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast('CSV downloaded successfully');
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Results" subtitle="View your child's exam results" icon={<BarChart3 className="h-5 w-5" />} />
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
        <PageHeader title="Results" subtitle="View your child's exam results" icon={<BarChart3 className="h-5 w-5" />} />
        <Card>
          <EmptyState
            title="No children linked"
            description="No student records are linked to your account. Please contact the school administrator."
            icon={<BarChart3 className="h-10 w-10" />}
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Results"
          subtitle="View your child's exam results"
          icon={<BarChart3 className="h-5 w-5" />}
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

        {/* Filters */}
        <Card className="mb-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              label="Academic Year"
              value={yearId}
              onChange={(e) => { setYearId(e.target.value); setYear(e.target.value); }}
            >
              <option value="">Select year...</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </Select>

            <Select
              label="Exam Session"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              disabled={!yearId}
            >
              <option value="">Select session...</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.published ? ' (Published)' : ' (Unpublished)'}
                </option>
              ))}
            </Select>
          </div>
        </Card>
      </div>

      {/* Results Content */}
      <div className="print:hidden">
        {!yearId || !sessionId ? (
          <Card>
            <EmptyState
              title="Select filters"
              description="Choose an academic year and exam session to view your child's results."
              icon={<BarChart3 className="h-10 w-10" />}
            />
          </Card>
        ) : dataLoading ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
            <RowSkeleton rows={5} />
          </>
        ) : resultRows.length === 0 ? (
          <Card>
            <EmptyState
              title="No results"
              description="No exam marks have been recorded for your child in this exam session."
              icon={<BarChart3 className="h-10 w-10" />}
            />
          </Card>
        ) : (
          <>
            {/* Summary Stats */}
            {overallSummary && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
                <StatCard
                  label="Overall Average"
                  value={`${overallSummary.avgPct}%`}
                  icon={<TrendingUp className="h-5 w-5" />}
                  accent="bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-light"
                />
                <StatCard
                  label="Best Subject"
                  value={overallSummary.bestSubject.subject_name}
                  icon={<Award className="h-5 w-5" />}
                  accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                />
                <StatCard
                  label="Class Position"
                  value={overallSummary.position ? `#${overallSummary.position}` : '—'}
                  icon={<Trophy className="h-5 w-5" />}
                  accent="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
                />
              </div>
            )}

            {/* Results Table */}
            <Card>
              <CardHeader
                title="Exam Results"
                subtitle={`${selectedSession?.name ?? ''} · ${selectedYear?.name ?? ''}`}
                action={
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" leftIcon={<Printer className="h-3.5 w-3.5" />} onClick={handlePrint}>
                      Print
                    </Button>
                    <Button size="sm" variant="secondary" leftIcon={<FileDown className="h-3.5 w-3.5" />} onClick={handleDownloadPDF}>
                      PDF
                    </Button>
                    <Button size="sm" variant="secondary" leftIcon={<FileDown className="h-3.5 w-3.5" />} onClick={handleDownloadCSV}>
                      CSV
                    </Button>
                  </div>
                }
              />

              {!isPublished && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                  <Award className="h-4 w-4" />
                  This exam session has not been officially published. Results may be subject to change.
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-sm text-ink-muted dark:border-slate-800">
                      <th className="pb-3 pr-4 font-medium">Subject</th>
                      <th className="pb-3 pr-4 font-medium">Exam</th>
                      <th className="pb-3 pr-4 font-medium text-right">Marks</th>
                      <th className="pb-3 pr-4 font-medium text-right">Total</th>
                      <th className="pb-3 pr-4 font-medium text-right">%</th>
                      <th className="pb-3 pr-4 font-medium">Grade</th>
                      <th className="pb-3 pr-4 font-medium">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {resultRows.map((row, idx) => (
                      <tr key={row.mark.id ?? idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-ink dark:text-slate-100">{row.subject_name}</p>
                          {row.subject_code && (
                            <p className="text-xs text-ink-muted">{row.subject_code}</p>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-sm text-ink-muted">{row.exam_name}</td>
                        <td className="py-3 pr-4 text-right font-medium text-ink dark:text-slate-100">
                          {row.mark.marks ?? '—'}
                        </td>
                        <td className="py-3 pr-4 text-right text-sm text-ink-muted">
                          {row.mark.total_marks}
                        </td>
                        <td className="py-3 pr-4 text-right text-sm font-medium text-ink dark:text-slate-100">
                          {row.pct}%
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={row.pct >= 50 ? 'success' : 'error'}>{row.grade}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-sm text-ink-muted">
                          {row.mark.remarks ?? (row.pct >= 50 ? 'Pass' : 'Fail')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {overallSummary && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                        <td className="py-3 pr-4 font-semibold text-ink dark:text-slate-100" colSpan={2}>
                          Overall
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold text-ink dark:text-slate-100">
                          {overallSummary.totalObtained}
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold text-ink dark:text-slate-100">
                          {overallSummary.totalMax}
                        </td>
                        <td className="py-3 pr-4 text-right font-bold text-primary-600 dark:text-primary-light">
                          {overallSummary.avgPct}%
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={overallSummary.avgPct >= 50 ? 'success' : 'error'}>
                            {gradeFromPercentage(overallSummary.avgPct)}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-sm text-ink-muted">
                          {overallSummary.passedCount}/{overallSummary.totalSubjects} passed
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Position Badge */}
              {overallSummary?.position && (
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-amber-50 p-4 dark:bg-amber-500/10">
                  <Trophy className="h-6 w-6 text-amber-500" />
                  <div>
                    <p className="font-semibold text-ink dark:text-slate-100">
                      Class Position: #{overallSummary.position}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {overallSummary.position === 1
                        ? 'Congratulations! Your child ranked first in the class!'
                        : overallSummary.position <= 3
                        ? 'Excellent! Your child is in the top 3!'
                        : overallSummary.position <= 10
                        ? 'Great work! Your child is in the top 10!'
                        : 'Keep working hard!'}
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      {/* Print View */}
      <div className="hidden print:block">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">{selectedChild?.full_name ?? ''} — Exam Results</h1>
          <p className="text-sm">{selectedSession?.name ?? ''} · {selectedYear?.name ?? ''}</p>
          <p className="text-xs">Admission No: {selectedChild?.admission_number ?? ''} · Class: {selectedChildClass?.name ?? ''}</p>
          <p className="text-xs">Generated on {formatDate(new Date().toISOString())}</p>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="pb-2 pr-3 text-left">Subject</th>
              <th className="pb-2 pr-3 text-left">Exam</th>
              <th className="pb-2 pr-3 text-right">Marks</th>
              <th className="pb-2 pr-3 text-right">Total</th>
              <th className="pb-2 pr-3 text-right">%</th>
              <th className="pb-2 pr-3 text-left">Grade</th>
              <th className="pb-2 pr-3 text-left">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {resultRows.map((row, idx) => (
              <tr key={row.mark.id ?? idx} className="border-b border-gray-300">
                <td className="py-2 pr-3 font-medium">{row.subject_name}</td>
                <td className="py-2 pr-3">{row.exam_name}</td>
                <td className="py-2 pr-3 text-right">{row.mark.marks ?? '—'}</td>
                <td className="py-2 pr-3 text-right">{row.mark.total_marks}</td>
                <td className="py-2 pr-3 text-right">{row.pct}%</td>
                <td className="py-2 pr-3">{row.grade}</td>
                <td className="py-2 pr-3">{row.mark.remarks ?? (row.pct >= 50 ? 'Pass' : 'Fail')}</td>
              </tr>
            ))}
          </tbody>
          {overallSummary && (
            <tfoot>
              <tr className="border-t-2 border-black font-semibold">
                <td className="py-2 pr-3" colSpan={2}>Overall</td>
                <td className="py-2 pr-3 text-right">{overallSummary.totalObtained}</td>
                <td className="py-2 pr-3 text-right">{overallSummary.totalMax}</td>
                <td className="py-2 pr-3 text-right">{overallSummary.avgPct}%</td>
                <td className="py-2 pr-3">{gradeFromPercentage(overallSummary.avgPct)}</td>
                <td className="py-2 pr-3">{overallSummary.passedCount}/{overallSummary.totalSubjects} passed</td>
              </tr>
            </tfoot>
          )}
        </table>
        {overallSummary?.position && (
          <p className="mt-4 text-center font-semibold">Class Position: #{overallSummary.position}</p>
        )}
      </div>
    </div>
  );
}
