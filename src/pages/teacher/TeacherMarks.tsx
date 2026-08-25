import { useMemo, useState, useEffect, useCallback } from 'react';
import { ClipboardList, Save, Plus, ChevronRight, GraduationCap } from 'lucide-react';
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
import { percentage, gradeFromPercentage, cn } from '@/lib/utils';
import type { AcademicYear, Exam, ExamMark, ExamSession, Student } from '@/types';

export function TeacherMarks() {
  const { profile } = useAuth();
  const { students, classes, classSubjects, subjects, loading } = useSchoolData();
  const { years, selectedYearId, setYear } = useAcademic();
  const { toast } = useToast();

  // Step state
  const [yearId, setYearId] = useState(selectedYearId);
  const [yearSearch, setYearSearch] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [examId, setExamId] = useState('');

  // Data state
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [marksMap, setMarksMap] = useState<Record<string, number | ''>>({});
  const [totalMarks, setTotalMarks] = useState(100);
  const [saving, setSaving] = useState(false);
  const [loadingExams, setLoadingExams] = useState(false);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [creatingYear, setCreatingYear] = useState(false);

  // Sync year with academic context
  useEffect(() => {
    setYearId(selectedYearId);
  }, [selectedYearId]);

  // My classes
  const myClasses = useMemo(() => {
    if (!profile) return [];
    return classes.filter(
      (c) =>
        c.class_teacher_id === profile.id ||
        classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === profile.id)
    );
  }, [classes, classSubjects, profile]);

  // Subjects available for selected class (where teacher_id === profile.id)
  const availableSubjects = useMemo(() => {
    if (!classId || !profile) return [];
    const csForClass = classSubjects.filter(
      (cs) => cs.class_id === classId && cs.teacher_id === profile.id
    );
    return subjects.filter((s) => csForClass.some((cs) => cs.subject_id === s.id));
  }, [classId, classSubjects, subjects, profile]);

  // Check if year search matches existing year; offer create option
  const yearExists = years.some((y) => y.name.toLowerCase() === yearSearch.toLowerCase().trim());
  const showCreateYear = yearSearch.trim().length > 0 && !yearExists && !yearId;

  // Load exam sessions for selected year
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
      .in('status', ['scheduled', 'published'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setSessions((data as ExamSession[]) ?? []);
      });
  }, [yearId, profile?.school_id]);

  // Reset downstream selections when upstream changes
  useEffect(() => { setSessionId(''); setExams([]); }, [yearId]);
  useEffect(() => { setClassId(''); }, [sessionId]);
  useEffect(() => { setSubjectId(''); setExamId(''); }, [classId]);
  useEffect(() => { setExamId(''); }, [subjectId]);

  // Load exams for selected session + class + subject
  useEffect(() => {
    if (!sessionId || !classId || !subjectId || !profile?.school_id) {
      setExams([]);
      return;
    }
    setLoadingExams(true);
    supabase
      .from('exams')
      .select('*')
      .eq('school_id', profile.school_id)
      .eq('exam_session_id', sessionId)
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .order('exam_date', { ascending: false })
      .then(({ data }) => {
        setExams((data as Exam[]) ?? []);
        setLoadingExams(false);
      });
  }, [sessionId, classId, subjectId, profile?.school_id]);

  // Load students for selected class
  useEffect(() => {
    if (!classId) {
      setClassStudents([]);
      return;
    }
    const list = students.filter((s) => s.class_id === classId && s.enrollment_status === 'active');
    setClassStudents(list);
  }, [classId, students]);

  // Load existing marks when exam is selected
  const loadMarks = useCallback(async () => {
    if (!examId || !profile?.school_id) {
      setMarksMap({});
      return;
    }
    setLoadingMarks(true);
    const { data } = await supabase
      .from('exam_marks')
      .select('*')
      .eq('exam_id', examId);

    const existingMarks: Record<string, number | ''> = {};
    ((data as ExamMark[]) ?? []).forEach((m) => {
      existingMarks[m.student_id] = m.marks ?? '';
    });
    setMarksMap(existingMarks);
    setLoadingMarks(false);
  }, [examId, profile?.school_id]);

  useEffect(() => {
    loadMarks();
  }, [loadMarks]);

  // Set total marks from selected exam
  useEffect(() => {
    const exam = exams.find((e) => e.id === examId);
    if (exam) {
      setTotalMarks(exam.total_marks);
    }
  }, [examId, exams]);

  // Create new academic year
  const handleCreateYear = async () => {
    if (!profile?.school_id || !yearSearch.trim()) return;
    setCreatingYear(true);
    try {
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('academic_years')
        .insert({
          school_id: profile.school_id,
          name: yearSearch.trim(),
          start_date: startDate,
          end_date: endDate,
          is_active: false,
          archived: false,
        })
        .select()
        .single();

      if (error) throw error;
      toast('Academic year created');
      setYearSearch('');
      setYear((data as AcademicYear).id);
      setYearId((data as AcademicYear).id);
    } catch {
      toast('Failed to create academic year', 'error');
    } finally {
      setCreatingYear(false);
    }
  };

  const setMark = (studentId: string, value: string) => {
    const numValue = value === '' ? '' : Math.min(Math.max(0, Number(value)), totalMarks);
    setMarksMap((prev) => ({ ...prev, [studentId]: numValue as number | '' }));
  };

  const handleSave = async () => {
    if (!profile?.id || !profile?.school_id || !examId || !classId || !subjectId) {
      toast('Please complete all selections', 'error');
      return;
    }

    const rows = classStudents
      .filter((s) => marksMap[s.id] !== '' && marksMap[s.id] !== undefined)
      .map((s) => {
        const marks = Number(marksMap[s.id]);
        const pct = percentage(marks, totalMarks);
        const grade = gradeFromPercentage(pct);
        return {
          school_id: profile.school_id!,
          exam_id: examId,
          student_id: s.id,
          subject_id: subjectId,
          class_id: classId,
          marks,
          total_marks: totalMarks,
          grade,
          teacher_comment: null,
          entered_by: profile.user_id,
        };
      });

    if (rows.length === 0) {
      toast('No marks to save', 'error');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('exam_marks')
        .upsert(rows, { onConflict: 'exam_id,student_id,subject_id' });

      if (error) throw error;
      toast(`Saved ${rows.length} mark${rows.length !== 1 ? 's' : ''} successfully`);
      loadMarks();
    } catch (err) {
      toast((err as Error).message || 'Failed to save marks', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Compute grade for display
  const getGrade = (studentId: string): string => {
    const m = marksMap[studentId];
    if (m === '' || m === undefined) return '—';
    return gradeFromPercentage(percentage(Number(m), totalMarks));
  };

  const allStepsComplete = yearId && sessionId && classId && subjectId && examId;
  const selectedExam = exams.find((e) => e.id === examId);

  return (
    <div>
      <PageHeader
        title="Marks Entry"
        subtitle="Enter and manage exam marks for your classes"
        icon={<ClipboardList className="h-5 w-5" />}
      />

      {/* Step 1: Academic Year */}
      <Card className="mb-4">
        <CardHeader title="Step 1: Select Academic Year" subtitle="Choose an existing year or type to create a new one" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Existing Academic Year"
            value={yearId}
            onChange={(e) => {
              setYearId(e.target.value);
              setYear(e.target.value);
              setYearSearch('');
            }}
          >
            <option value="">Select a year...</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </Select>
          <div>
            <label className="input-label">Or type a new year name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. 2025-2026"
              value={yearSearch}
              onChange={(e) => setYearSearch(e.target.value)}
            />
            {showCreateYear && (
              <button
                onClick={handleCreateYear}
                disabled={creatingYear}
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100 dark:bg-primary-500/15 dark:text-primary-light"
              >
                {creatingYear ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create new year: {yearSearch.trim()}
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Step 2: Exam Session */}
      {yearId && (
        <Card className="mb-4">
          <CardHeader title="Step 2: Select Exam Session" subtitle="Only scheduled or published sessions are shown" />
          <Select
            label="Exam Session"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          >
            <option value="">Select a session...</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          {sessions.length === 0 && (
            <p className="mt-2 text-sm text-ink-muted">No exam sessions found for this year.</p>
          )}
        </Card>
      )}

      {/* Step 3: Class */}
      {sessionId && (
        <Card className="mb-4">
          <CardHeader title="Step 3: Select Class" subtitle="Only classes you teach are shown" />
          <Select
            label="Class"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">Select a class...</option>
            {myClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Card>
      )}

      {/* Step 4: Subject */}
      {classId && (
        <Card className="mb-4">
          <CardHeader title="Step 4: Select Subject" subtitle="Only subjects you teach in this class are shown" />
          <Select
            label="Subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="">Select a subject...</option>
            {availableSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          {availableSubjects.length === 0 && (
            <p className="mt-2 text-sm text-ink-muted">You are not assigned to teach any subject in this class.</p>
          )}
        </Card>
      )}

      {/* Step 5: Select Exam & Enter Marks */}
      {subjectId && (
        <Card className="mb-4">
          <CardHeader title="Step 5: Select Exam & Enter Marks" subtitle="Choose the exam to attach marks to" />
          {loadingExams ? (
            <RowSkeleton rows={2} />
          ) : exams.length === 0 ? (
            <EmptyState
              title="No exams found"
              description="No exams have been created for this session, class, and subject combination."
              icon={<ClipboardList className="h-10 w-10" />}
            />
          ) : (
            <>
              <Select
                label="Exam"
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
              >
                <option value="">Select an exam...</option>
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.total_marks} marks)
                  </option>
                ))}
              </Select>

              {selectedExam && (
                <div className="mt-2 flex gap-2">
                  <Badge variant="primary">Total: {selectedExam.total_marks} marks</Badge>
                  {selectedExam.exam_date && <Badge variant="secondary">{selectedExam.exam_date}</Badge>}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Marks Entry Grid */}
      {allStepsComplete && (
        <Card>
          <CardHeader
            title="Marks Entry"
            subtitle={`${classStudents.length} students · ${subjects.find((s) => s.id === subjectId)?.name ?? ''} · Total: ${totalMarks}`}
            action={
              <Button onClick={handleSave} loading={saving} leftIcon={<Save className="h-4 w-4" />}>
                Save Marks
              </Button>
            }
          />
          {loadingMarks ? (
            <RowSkeleton rows={5} />
          ) : classStudents.length === 0 ? (
            <EmptyState title="No students" description="No active students in this class." icon={<GraduationCap className="h-10 w-10" />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-sm text-ink-muted dark:border-slate-800">
                    <th className="pb-3 pr-4 font-medium">#</th>
                    <th className="pb-3 pr-4 font-medium">Student</th>
                    <th className="pb-3 pr-4 font-medium">Admission No.</th>
                    <th className="pb-3 pr-4 font-medium">Marks (/{totalMarks})</th>
                    <th className="pb-3 pr-4 font-medium">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {classStudents.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 pr-4 text-sm text-ink-muted">{idx + 1}</td>
                      <td className="py-3 pr-4 font-medium text-ink dark:text-slate-100">{s.full_name}</td>
                      <td className="py-3 pr-4 text-sm text-ink-muted">{s.admission_number}</td>
                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          min={0}
                          max={totalMarks}
                          step="0.5"
                          className="input w-24"
                          value={marksMap[s.id] ?? ''}
                          onChange={(e) => setMark(s.id, e.target.value)}
                          placeholder="—"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="primary">{getGrade(s.id)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Save button at bottom */}
          {!loadingMarks && classStudents.length > 0 && (
            <div className="mt-4 flex justify-end">
              <Button onClick={handleSave} loading={saving} leftIcon={<Save className="h-4 w-4" />}>
                Save All Marks
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Progress indicator when not all steps complete */}
      {!allStepsComplete && !loading && (
        <Card>
          <div className="flex items-center gap-3 text-sm text-ink-muted">
            <ChevronRight className="h-5 w-5" />
            <span>
              {!yearId && 'Select an academic year to begin'}
              {yearId && !sessionId && 'Select an exam session'}
              {sessionId && !classId && 'Select a class'}
              {classId && !subjectId && 'Select a subject'}
              {subjectId && !examId && 'Select an exam to enter marks'}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
