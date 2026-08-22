import { useMemo, useState, useEffect, useCallback } from 'react';
import { ChartBar as BarChart3, Printer, FileDown, FileSpreadsheet, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useAcademic } from '@/context/AcademicContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Spinner';
import { formatDate, percentage, gradeFromPercentage } from '@/lib/utils';
import type { Exam, ExamMark, ExamSession, Student, Subject } from '@/types';

interface ResultRow {
  student: Student;
  marks: ExamMark[];
  totalMarks: number;
  maxTotal: number;
  position: number;
}

export function TeacherResults() {
  const { profile } = useAuth();
  const { classes, classSubjects, subjects, loading } = useSchoolData();
  const { years, selectedYearId, setYear } = useAcademic();
  const { toast } = useToast();

  const [yearId, setYearId] = useState(selectedYearId);
  const [sessionId, setSessionId] = useState('');
  const [classId, setClassId] = useState('');
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [marks, setMarks] = useState<ExamMark[]>([]);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => { setYearId(selectedYearId); }, [selectedYearId]);

  // My classes
  const myClasses = useMemo(() => {
    if (!profile) return [];
    return classes.filter(
      (c) =>
        c.class_teacher_id === profile.id ||
        classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === profile.id)
    );
  }, [classes, classSubjects, profile]);

  // Load sessions for year
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

  // Reset downstream
  useEffect(() => { setSessionId(''); }, [yearId]);
  useEffect(() => { setClassId(''); }, [sessionId]);

  // Load exams and students when session + class selected
  const loadData = useCallback(async () => {
    if (!sessionId || !classId || !profile?.school_id) {
      setExams([]); setMarks([]); setClassStudents([]);
      return;
    }
    setLoadingData(true);

    const [examsRes, studentsList] = await Promise.all([
      supabase
        .from('exams')
        .select('*')
        .eq('school_id', profile.school_id)
        .eq('exam_session_id', sessionId)
        .eq('class_id', classId)
        .order('exam_date', { ascending: true }),
      supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .eq('enrollment_status', 'active')
        .order('full_name', { ascending: true }),
    ]);

    const examList = (examsRes.data as Exam[]) ?? [];
    const studs = (studentsList.data as Student[]) ?? [];
    setExams(examList);
    setClassStudents(studs);

    // Load marks for all exams in this session+class
    if (examList.length > 0) {
      const examIds = examList.map((e) => e.id);
      const { data: marksData } = await supabase
        .from('exam_marks')
        .select('*')
        .in('exam_id', examIds);
      setMarks((marksData as ExamMark[]) ?? []);
    } else {
      setMarks([]);
    }

    setLoadingData(false);
  }, [sessionId, classId, profile?.school_id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Build result rows with positions
  const resultRows: ResultRow[] = useMemo(() => {
    if (!classStudents.length || !exams.length) return [];

    const rows = classStudents.map((student) => {
      const studentMarks = marks.filter((m) => m.student_id === student.id);
      const totalMarks = studentMarks.reduce((sum, m) => sum + (m.marks ?? 0), 0);
      const maxTotal = studentMarks.reduce((sum, m) => sum + (m.total_marks ?? 0), 0);
      return { student, marks: studentMarks, totalMarks, maxTotal, position: 0 };
    });

    // Sort by total marks descending and assign positions
    rows.sort((a, b) => b.totalMarks - a.totalMarks);
    let currentPosition = 0;
    let previousMarks: number | null = null;
    rows.forEach((row, idx) => {
      if (previousMarks === null || row.totalMarks !== previousMarks) {
        currentPosition = idx + 1;
        previousMarks = row.totalMarks;
      }
      row.position = currentPosition;
    });

    return rows;
  }, [classStudents, exams, marks]);

  // Subject lookup
  const getSubjectName = (subjectId: string): string => {
    return subjects.find((s) => s.id === subjectId)?.name ?? '—';
  };

  // Get unique subjects from exams
  const examSubjects = useMemo(() => {
    const subjectIds = [...new Set(exams.map((e) => e.subject_id).filter(Boolean))] as string[];
    return subjectIds.map((sid) => ({
      id: sid,
      name: getSubjectName(sid),
      exam: exams.find((e) => e.subject_id === sid),
    }));
  }, [exams, subjects]);

  const selectedSession = sessions.find((s) => s.id === sessionId);
  const selectedClass = myClasses.find((c) => c.id === classId);
  const selectedYear = years.find((y) => y.id === yearId);

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // Download PDF (uses print dialog)
  const handleDownloadPDF = () => {
    window.print();
  };

  // Download CSV
  const handleDownloadCSV = () => {
    if (resultRows.length === 0) {
      toast('No results to download', 'error');
      return;
    }

    const subjectHeaders = examSubjects.map((s) => s.name);
    const headers = ['Position', 'Student Name', 'Admission Number', ...subjectHeaders, 'Total', 'Max Total', 'Percentage', 'Grade'];

    const csvRows: string[] = [headers.join(',')];

    resultRows.forEach((row) => {
      const subjectMarks = examSubjects.map((s) => {
        const mark = row.marks.find((m) => m.subject_id === s.id);
        return mark ? `${mark.marks ?? ''}/${mark.total_marks}` : '-';
      });
      const pct = row.maxTotal > 0 ? percentage(row.totalMarks, row.maxTotal) : 0;
      const grade = gradeFromPercentage(pct);
      const csvLine = [
        row.position,
        `"${row.student.full_name}"`,
        `"${row.student.admission_number}"`,
        ...subjectMarks,
        row.totalMarks,
        row.maxTotal,
        `${pct}%`,
        grade,
      ].join(',');
      csvRows.push(csvLine);
    });

    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `results_${selectedClass?.name ?? 'class'}_${selectedSession?.name ?? 'session'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast('CSV downloaded successfully');
  };

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Results"
          subtitle="View and download exam results for your classes"
          icon={<BarChart3 className="h-5 w-5" />}
        />

        {/* Filters */}
        <Card className="mb-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select label="Academic Year" value={yearId} onChange={(e) => { setYearId(e.target.value); setYear(e.target.value); }}>
              <option value="">Select year...</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </Select>

            <Select label="Exam Session" value={sessionId} onChange={(e) => setSessionId(e.target.value)} disabled={!yearId}>
              <option value="">Select session...</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>

            <Select label="Class" value={classId} onChange={(e) => setClassId(e.target.value)} disabled={!sessionId}>
              <option value="">Select class...</option>
              {myClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
        </Card>
      </div>

      {/* Results Table */}
      <div className="print:hidden">
        {loading || loadingData ? (
          <RowSkeleton rows={6} />
        ) : !sessionId || !classId ? (
          <Card>
            <EmptyState
              title="Select filters"
              description="Choose an academic year, exam session, and class to view results."
              icon={<BarChart3 className="h-10 w-10" />}
            />
          </Card>
        ) : resultRows.length === 0 ? (
          <Card>
            <EmptyState
              title="No results"
              description="No marks have been entered for this exam session and class."
              icon={<BarChart3 className="h-10 w-10" />}
            />
          </Card>
        ) : (
          <Card>
            <CardHeader
              title={`${selectedClass?.name ?? ''} Results`}
              subtitle={`${selectedSession?.name ?? ''} · ${selectedYear?.name ?? ''}`}
              action={
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" leftIcon={<Printer className="h-3.5 w-3.5" />} onClick={handlePrint}>
                    Print
                  </Button>
                  <Button size="sm" variant="secondary" leftIcon={<FileDown className="h-3.5 w-3.5" />} onClick={handleDownloadPDF}>
                    PDF
                  </Button>
                  <Button size="sm" variant="secondary" leftIcon={<FileSpreadsheet className="h-3.5 w-3.5" />} onClick={handleDownloadCSV}>
                    Excel
                  </Button>
                </div>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-sm text-ink-muted dark:border-slate-800">
                    <th className="pb-3 pr-3 font-medium">Pos</th>
                    <th className="pb-3 pr-3 font-medium">Student Name</th>
                    <th className="pb-3 pr-3 font-medium">Admission No.</th>
                    {examSubjects.map((s) => (
                      <th key={s.id} className="pb-3 pr-3 font-medium whitespace-nowrap">{s.name}</th>
                    ))}
                    <th className="pb-3 pr-3 font-medium">Total</th>
                    <th className="pb-3 pr-3 font-medium">%</th>
                    <th className="pb-3 pr-3 font-medium">Grade</th>
                    <th className="pb-3 pr-3 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {resultRows.map((row) => {
                    const pct = row.maxTotal > 0 ? percentage(row.totalMarks, row.maxTotal) : 0;
                    const grade = gradeFromPercentage(pct);
                    return (
                      <tr key={row.student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 pr-3">
                          {row.position <= 3 ? (
                            <span className="flex items-center gap-1">
                              <Trophy className={row.position === 1 ? 'h-4 w-4 text-amber-500' : row.position === 2 ? 'h-4 w-4 text-slate-400' : 'h-4 w-4 text-amber-700'} />
                              {row.position}
                            </span>
                          ) : (
                            <span className="text-sm text-ink-muted">{row.position}</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 font-medium text-ink dark:text-slate-100">{row.student.full_name}</td>
                        <td className="py-3 pr-3 text-sm text-ink-muted">{row.student.admission_number}</td>
                        {examSubjects.map((s) => {
                          const mark = row.marks.find((m) => m.subject_id === s.id);
                          return (
                            <td key={s.id} className="py-3 pr-3 text-sm">
                              {mark ? (
                                <span className="text-ink dark:text-slate-100">
                                  {mark.marks ?? '—'}
                                  <span className="text-ink-muted">/{mark.total_marks}</span>
                                </span>
                              ) : (
                                <span className="text-ink-muted">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3 pr-3 font-semibold text-ink dark:text-slate-100">
                          {row.totalMarks}
                          <span className="text-ink-muted font-normal">/{row.maxTotal}</span>
                        </td>
                        <td className="py-3 pr-3 text-sm font-medium text-ink dark:text-slate-100">{pct}%</td>
                        <td className="py-3 pr-3">
                          <Badge variant={pct >= 50 ? 'success' : 'error'}>{grade}</Badge>
                        </td>
                        <td className="py-3 pr-3 text-sm text-ink-muted">
                          {row.marks[0]?.remarks ?? (pct >= 50 ? 'Pass' : 'Fail')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Print View */}
      <div className="hidden print:block">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">{selectedClass?.name ?? ''} — Exam Results</h1>
          <p className="text-sm">{selectedSession?.name ?? ''} · {selectedYear?.name ?? ''}</p>
          <p className="text-xs">Generated on {formatDate(new Date().toISOString())}</p>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="pb-2 pr-3 text-left">Pos</th>
              <th className="pb-2 pr-3 text-left">Student Name</th>
              <th className="pb-2 pr-3 text-left">Admission No.</th>
              {examSubjects.map((s) => (
                <th key={s.id} className="pb-2 pr-3 text-left whitespace-nowrap">{s.name}</th>
              ))}
              <th className="pb-2 pr-3 text-left">Total</th>
              <th className="pb-2 pr-3 text-left">%</th>
              <th className="pb-2 pr-3 text-left">Grade</th>
            </tr>
          </thead>
          <tbody>
            {resultRows.map((row) => {
              const pct = row.maxTotal > 0 ? percentage(row.totalMarks, row.maxTotal) : 0;
              const grade = gradeFromPercentage(pct);
              return (
                <tr key={row.student.id} className="border-b border-gray-300">
                  <td className="py-2 pr-3">{row.position}</td>
                  <td className="py-2 pr-3 font-medium">{row.student.full_name}</td>
                  <td className="py-2 pr-3">{row.student.admission_number}</td>
                  {examSubjects.map((s) => {
                    const mark = row.marks.find((m) => m.subject_id === s.id);
                    return (
                      <td key={s.id} className="py-2 pr-3">
                        {mark ? `${mark.marks ?? '—'}/${mark.total_marks}` : '—'}
                      </td>
                    );
                  })}
                  <td className="py-2 pr-3 font-semibold">{row.totalMarks}/{row.maxTotal}</td>
                  <td className="py-2 pr-3">{pct}%</td>
                  <td className="py-2 pr-3">{grade}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
