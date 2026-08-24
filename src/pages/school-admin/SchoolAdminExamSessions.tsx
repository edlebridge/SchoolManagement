import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { ClipboardList, Plus, Pencil, Trash2, Search, Calendar, ChevronRight, ArrowLeft, Wand as Wand2, CircleAlert as AlertCircle, LayoutGrid, List } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useAcademic } from '@/context/AcademicContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Spinner';
import { ExamTimetable } from '@/components/exam/ExamTimetable';
import { formatDate } from '@/lib/utils';
import { EXAM_SESSION_STATUSES, EXAM_SESSION_STATUS_LABELS } from '@/lib/constants';
import type { ExamSession, AcademicYear, Term, Exam, ClassRow, Subject, AppUser, ClassSubject } from '@/types';

const SCHOOL_ID = '47e97532-69b5-4229-92ff-7c15b7135ac5';

interface SessionFormState {
  name: string;
  academic_year_id: string;
  term_id: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface ExamFormState {
  name: string;
  class_id: string;
  subject_id: string;
  exam_type: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: string;
  room: string;
  teacher_id: string;
  total_marks: string;
  status: string;
}

const emptySessionForm: SessionFormState = {
  name: '',
  academic_year_id: '',
  term_id: '',
  start_date: '',
  end_date: '',
  status: 'draft',
};

const emptyExamForm: ExamFormState = {
  name: '',
  class_id: '',
  subject_id: '',
  exam_date: '',
  start_time: '',
  end_time: '',
  duration_minutes: '',
  room: '',
  teacher_id: '',
  total_marks: '100',
  exam_type: 'midterm',
  status: 'scheduled',
};

export function SchoolAdminExamSessions() {
  const { profile } = useAuth();
  const { examSessions, classes, subjects, teachers, classSubjects, loading, refresh } = useSchoolData();
  const { years, terms } = useAcademic();
  const { toast } = useToast();

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ExamSession | null>(null);
  const [sessionForm, setSessionForm] = useState<SessionFormState>(emptySessionForm);
  const [savingSession, setSavingSession] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<ExamSession | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);
  const [examCounts, setExamCounts] = useState<Record<string, number>>({});

  const [viewingSession, setViewingSession] = useState<ExamSession | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [examForm, setExamForm] = useState<ExamFormState>(emptyExamForm);
  const [savingExam, setSavingExam] = useState(false);
  const [deleteExamTarget, setDeleteExamTarget] = useState<Exam | null>(null);
  const [deletingExam, setDeletingExam] = useState(false);
  const [viewMode, setViewMode] = useState<'timetable' | 'list'>('timetable');
  const [classFilter, setClassFilter] = useState('');

  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [genForm, setGenForm] = useState({ term_id: '', weeks_before: '1', exam_type: 'endterm', start_time: '09:00', duration_minutes: '120', total_marks: '100', exams_per_day: '3' });
  const [generating, setGenerating] = useState(false);
  const [genPreview, setGenPreview] = useState<{ count: number; startDate: string; endDate: string } | null>(null);

  const yearMap = useMemo(() => {
    const m: Record<string, AcademicYear> = {};
    years.forEach((y) => { m[y.id] = y; });
    return m;
  }, [years]);

  const termMap = useMemo(() => {
    const m: Record<string, Term> = {};
    terms.forEach((t) => { m[t.id] = t; });
    return m;
  }, [terms]);

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

  useEffect(() => {
    if (examSessions.length === 0) { setExamCounts({}); return; }
    supabase
      .from('exams')
      .select('exam_session_id')
      .in('exam_session_id', examSessions.map((s) => s.id))
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        (data ?? []).forEach((r: { exam_session_id: string }) => {
          counts[r.exam_session_id] = (counts[r.exam_session_id] ?? 0) + 1;
        });
        setExamCounts(counts);
      });
  }, [examSessions]);

  const filteredTerms = useMemo(() => {
    if (!sessionForm.academic_year_id) return [];
    return terms.filter((t) => t.academic_year_id === sessionForm.academic_year_id);
  }, [terms, sessionForm.academic_year_id]);

  const genTerm = useMemo(() => terms.find((t) => t.id === genForm.term_id) ?? null, [terms, genForm.term_id]);

  const genPreviewData = useMemo(() => {
    if (!genTerm || !genTerm.end_date) return null;
    const termEnd = new Date(genTerm.end_date);
    const weeks = parseInt(genForm.weeks_before) || 1;
    const rawStart = new Date(termEnd);
    rawStart.setDate(rawStart.getDate() - weeks * 7);
    // Adjust to the nearest Monday (weekday=1)
    const dayOfWeek = rawStart.getDay();
    const mondayStart = new Date(rawStart);
    if (dayOfWeek === 0) mondayStart.setDate(rawStart.getDate() + 1); // Sunday → Monday
    else if (dayOfWeek === 6) mondayStart.setDate(rawStart.getDate() + 2); // Saturday → Monday
    else if (dayOfWeek > 1) mondayStart.setDate(rawStart.getDate() - (dayOfWeek - 1)); // Tue-Fri → back to Monday

    const perDay = parseInt(genForm.exams_per_day) || 3;
    const maxSubjects = Math.max(
      ...classes.map((cls) => {
        const classSubs = classSubjects.filter((cs: ClassSubject) => cs.class_id === cls.id);
        return classSubs.length > 0 ? classSubs.length : subjects.length;
      }),
      1
    );
    const weekdaysNeeded = Math.ceil(maxSubjects / perDay);
    // Calculate end date by counting only weekdays (Mon-Fri)
    let end = new Date(mondayStart);
    let weekdaysCounted = 0;
    while (weekdaysCounted < weekdaysNeeded) {
      const dow = end.getDay();
      if (dow !== 0 && dow !== 6) weekdaysCounted++;
      if (weekdaysCounted < weekdaysNeeded) end.setDate(end.getDate() + 1);
    }
    if (end > termEnd) end = new Date(termEnd);
    const totalExams = classes.reduce((sum, cls) => {
      const classSubs = classSubjects.filter((cs: ClassSubject) => cs.class_id === cls.id);
      return sum + (classSubs.length > 0 ? classSubs.length : subjects.length);
    }, 0);
    return { count: totalExams, startDate: mondayStart.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
  }, [genTerm, genForm.weeks_before, genForm.exams_per_day, classes, subjects, classSubjects]);

  useEffect(() => { setGenPreview(genPreviewData); }, [genPreviewData]);

  const openGenerateModal = () => {
    const activeTerm = terms.find((t) => t.is_active) ?? terms[0];
    setGenForm({ ...genForm, term_id: activeTerm?.id ?? '' });
    setGenerateModalOpen(true);
  };

  const runGenerate = async () => {
    if (!genTerm) { toast('Select a term', 'error'); return; }
    if (classes.length === 0) { toast('No classes found', 'error'); return; }
    if (subjects.length === 0) { toast('No subjects found', 'error'); return; }

    setGenerating(true);
    const termEnd = new Date(genTerm.end_date);
    const weeks = parseInt(genForm.weeks_before) || 1;
    const rawStart = new Date(termEnd);
    rawStart.setDate(rawStart.getDate() - weeks * 7);
    // Adjust to the nearest Monday (weekday=1)
    const dayOfWeek = rawStart.getDay();
    const examStart = new Date(rawStart);
    if (dayOfWeek === 0) examStart.setDate(rawStart.getDate() + 1); // Sunday → Monday
    else if (dayOfWeek === 6) examStart.setDate(rawStart.getDate() + 2); // Saturday → Monday
    else if (dayOfWeek > 1) examStart.setDate(rawStart.getDate() - (dayOfWeek - 1)); // Tue-Fri → back to Monday

    const sessionName = `${genTerm.name} Exams`;
    const { data: sessionData, error: sessionErr } = await supabase.from('exam_sessions').insert({
      school_id: SCHOOL_ID,
      name: sessionName,
      academic_year_id: genTerm.academic_year_id,
      term_id: genTerm.id,
      start_date: examStart.toISOString().split('T')[0],
      end_date: genTerm.end_date,
      status: 'draft',
      published: false,
      created_by: profile?.user_id ?? null,
    }).select().single();
    if (sessionErr) { toast(sessionErr.message, 'error'); setGenerating(false); return; }

    const sessionId = sessionData.id;
    const examsToInsert: Record<string, unknown>[] = [];
    const maxPerDay = parseInt(genForm.exams_per_day) || 3;
    const startTime = genForm.start_time || '09:00';
    const dur = parseInt(genForm.duration_minutes) || 120;
    const [sh, sm] = startTime.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const slotsPerDay = [
      { start: startMinutes, end: startMinutes + dur },
      { start: startMinutes + dur + 30, end: startMinutes + dur * 2 + 30 },
      { start: startMinutes + dur * 2 + 60, end: startMinutes + dur * 3 + 60 },
    ];
    const fmtTime = (mins: number) => { const h = Math.floor(mins / 60); const m = mins % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };

    // Build the list of weekday dates (Mon-Fri) starting from examStart
    const weekdayDates: string[] = [];
    const cursor = new Date(examStart);
    let safety = 0;
    while (cursor <= termEnd && safety < 90) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) {
        weekdayDates.push(cursor.toISOString().split('T')[0]);
      }
      cursor.setDate(cursor.getDate() + 1);
      safety++;
    }

    // Gather every (class, subject, teacher) exam that needs scheduling.
    type PendingExam = { cls: ClassRow; subject: Subject; teacherId: string | null };
    const pending: PendingExam[] = [];
    for (const cls of classes) {
      const classSubs = classSubjects.filter((cs: ClassSubject) => cs.class_id === cls.id);
      const subs = classSubs.length > 0
        ? classSubs.map((cs: ClassSubject) => subjects.find((s) => s.id === cs.subject_id)).filter(Boolean) as Subject[]
        : subjects;
      for (const sub of subs) {
        const teacherId = classSubs.find((cs: ClassSubject) => cs.subject_id === sub.id)?.teacher_id ?? null;
        pending.push({ cls, subject: sub, teacherId });
      }
    }

    // Conflict-free scheduling: assign each exam to a (date, slot) pair such that
    // no teacher is double-booked and no class has two exams in the same slot.
    // The allocator walks day-by-day, slot-by-slot, and fills each slot across
    // all classes before moving to the next slot. If a conflict can't be resolved
    // in the current slot, the exam is deferred to a later slot/day.
    const usedSlotKey = (date: string, slotIdx: number, classId: string) => `${date}|${slotIdx}|${classId}`;
    const teacherBusyKey = (date: string, slotIdx: number, teacherId: string) => `${date}|${slotIdx}|${teacherId}`;
    const scheduledClassSlots = new Set<string>();
    const scheduledTeacherSlots = new Set<string>();
    const remaining = [...pending];
    let dayIdx = 0;

    while (remaining.length > 0 && dayIdx < weekdayDates.length) {
      const examDate = weekdayDates[dayIdx];
      for (let slotIdx = 0; slotIdx < maxPerDay && remaining.length > 0; slotIdx++) {
        const slot = slotsPerDay[slotIdx];
        // Try to fill this slot with as many exams as possible — one per class,
        // no teacher conflict. Iterate over a copy so we can splice from remaining.
        for (let i = remaining.length - 1; i >= 0; i--) {
          const { cls, subject, teacherId } = remaining[i];
          if (scheduledClassSlots.has(usedSlotKey(examDate, slotIdx, cls.id))) continue;
          if (teacherId && scheduledTeacherSlots.has(teacherBusyKey(examDate, slotIdx, teacherId))) continue;
          // This class is free in this slot and the teacher is free — schedule it.
          scheduledClassSlots.add(usedSlotKey(examDate, slotIdx, cls.id));
          if (teacherId) scheduledTeacherSlots.add(teacherBusyKey(examDate, slotIdx, teacherId));
          examsToInsert.push({
            school_id: SCHOOL_ID,
            exam_session_id: sessionId,
            term_id: genTerm.id,
            name: `${subject.name} — ${cls.name}`,
            exam_type: genForm.exam_type,
            class_id: cls.id,
            subject_id: subject.id,
            exam_date: examDate,
            start_time: fmtTime(slot.start),
            end_time: fmtTime(slot.end),
            duration_minutes: dur,
            teacher_id: teacherId,
            total_marks: parseFloat(genForm.total_marks) || 100,
            status: 'scheduled',
          });
          remaining.splice(i, 1);
        }
      }
      dayIdx++;
    }

    // Fallback: if we ran out of weekdays, place remaining exams on the last day
    // with sequential time offsets so they at least have distinct times.
    if (remaining.length > 0) {
      const lastDate = weekdayDates[weekdayDates.length - 1] ?? examStart.toISOString().split('T')[0];
      let extraSlot = maxPerDay;
      for (const { cls, subject, teacherId } of remaining) {
        const base = startMinutes + extraSlot * (dur + 30);
        examsToInsert.push({
          school_id: SCHOOL_ID,
          exam_session_id: sessionId,
          term_id: genTerm.id,
          name: `${subject.name} — ${cls.name}`,
          exam_type: genForm.exam_type,
          class_id: cls.id,
          subject_id: subject.id,
          exam_date: lastDate,
          start_time: fmtTime(base),
          end_time: fmtTime(base + dur),
          duration_minutes: dur,
          teacher_id: teacherId,
          total_marks: parseFloat(genForm.total_marks) || 100,
          status: 'scheduled',
        });
        extraSlot++;
      }
    }

    const { error: examErr } = await supabase.from('exams').insert(examsToInsert);
    setGenerating(false);
    if (examErr) { toast(examErr.message, 'error'); return; }
    toast(`Generated ${examsToInsert.length} exams across ${classes.length} classes`);
    setGenerateModalOpen(false);
    refresh();
  };

  const filteredSessions = useMemo(() => {
    if (!search.trim()) return examSessions;
    const q = search.toLowerCase();
    return examSessions.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q) ||
      (yearMap[s.academic_year_id ?? '']?.name ?? '').toLowerCase().includes(q)
    );
  }, [examSessions, search, yearMap]);

  const openAddSession = () => {
    setEditingSession(null);
    setSessionForm(emptySessionForm);
    setSessionModalOpen(true);
  };

  const openEditSession = (s: ExamSession) => {
    setEditingSession(s);
    setSessionForm({
      name: s.name,
      academic_year_id: s.academic_year_id ?? '',
      term_id: s.term_id ?? '',
      start_date: s.start_date ?? '',
      end_date: s.end_date ?? '',
      status: s.status,
    });
    setSessionModalOpen(true);
  };

  const submitSession = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionForm.name.trim()) { toast('Session name is required', 'error'); return; }
    if (!sessionForm.academic_year_id) { toast('Academic year is required', 'error'); return; }

    setSavingSession(true);
    const willPublish = sessionForm.status === 'published';
    const payload: Record<string, unknown> = {
      school_id: SCHOOL_ID,
      name: sessionForm.name.trim(),
      academic_year_id: sessionForm.academic_year_id,
      term_id: sessionForm.term_id || null,
      start_date: sessionForm.start_date || null,
      end_date: sessionForm.end_date || null,
      status: sessionForm.status,
      published: willPublish,
      published_at: willPublish ? new Date().toISOString() : null,
      created_by: profile?.user_id ?? null,
    };

    if (editingSession) {
      if (!willPublish) { payload.published = false; payload.published_at = null; }
      const { error } = await supabase.from('exam_sessions').update(payload).eq('id', editingSession.id);
      if (error) { toast(error.message, 'error'); setSavingSession(false); return; }
      toast('Exam session updated');
    } else {
      const { error } = await supabase.from('exam_sessions').insert(payload);
      if (error) { toast(error.message, 'error'); setSavingSession(false); return; }
      toast('Exam session created');
    }
    setSavingSession(false);
    setSessionModalOpen(false);
    refresh();
  };

  const confirmDeleteSession = async () => {
    if (!deleteSessionTarget) return;
    setDeletingSession(true);
    await supabase.from('exams').delete().eq('exam_session_id', deleteSessionTarget.id);
    const { error } = await supabase.from('exam_sessions').delete().eq('id', deleteSessionTarget.id);
    setDeletingSession(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Exam session deleted');
    setDeleteSessionTarget(null);
    refresh();
  };

  const loadExams = async (sessionId: string) => {
    setExamsLoading(true);
    const { data } = await supabase
      .from('exams')
      .select('*')
      .eq('exam_session_id', sessionId)
      .order('exam_date', { ascending: true });
    setExams((data as Exam[]) ?? []);
    setExamsLoading(false);
  };

  const openSessionDetail = async (s: ExamSession) => {
    setViewingSession(s);
    setClassFilter('');
    await loadExams(s.id);
  };

  const openAddExam = (presetDate?: string, presetClassId?: string) => {
    setEditingExam(null);
    setExamForm({
      ...emptyExamForm,
      exam_date: presetDate ?? '',
      class_id: presetClassId ?? '',
    });
    setExamModalOpen(true);
  };

  const openEditExam = (ex: Exam) => {
    setEditingExam(ex);
    setExamForm({
      name: ex.name,
      class_id: ex.class_id ?? '',
      subject_id: ex.subject_id ?? '',
      exam_date: ex.exam_date ?? '',
      start_time: ex.start_time ?? '',
      end_time: ex.end_time ?? '',
      duration_minutes: ex.duration_minutes?.toString() ?? '',
      room: ex.room ?? '',
      teacher_id: ex.teacher_id ?? '',
      total_marks: ex.total_marks?.toString() ?? '100',
      exam_type: ex.exam_type ?? 'midterm',
      status: ex.status ?? 'scheduled',
    });
    setExamModalOpen(true);
  };

  // Validate exam form before save — checks for conflicts
  const validateExamForm = (): string | null => {
    if (!examForm.class_id) return 'Class is required';
    if (!examForm.subject_id) return 'Subject is required';
    if (!examForm.exam_date) return 'Exam date is required';
    if (!viewingSession) return 'No session selected';

    // Check for time conflicts with existing exams in the same class + date
    const sameSlot = exams.filter((e) =>
      e.class_id === examForm.class_id &&
      e.exam_date === examForm.exam_date &&
      e.id !== editingExam?.id &&
      examForm.start_time &&
      e.start_time === examForm.start_time
    );
    if (sameSlot.length > 0) {
      return `Another exam for ${classMap[examForm.class_id]?.name ?? 'this class'} already starts at ${examForm.start_time} on this date.`;
    }

    // Check overlap if both have time ranges
    if (examForm.start_time && examForm.end_time) {
      const newStart = toMinutes(examForm.start_time);
      const newEnd = toMinutes(examForm.end_time);
      if (newEnd <= newStart) return 'End time must be after start time';
      for (const e of exams) {
        if (e.id === editingExam?.id) continue;
        if (e.class_id !== examForm.class_id || e.exam_date !== examForm.exam_date) continue;
        if (!e.start_time || !e.end_time) continue;
        const eStart = toMinutes(e.start_time);
        const eEnd = toMinutes(e.end_time);
        if (newStart < eEnd && eStart < newEnd) {
          return `Time conflict with "${e.name}" (${e.start_time}–${e.end_time}) for ${classMap[examForm.class_id]?.name ?? 'this class'}.`;
        }
      }
    }

    // Validate date is within session range
    if (viewingSession.start_date && examForm.exam_date < viewingSession.start_date) {
      return `Exam date is before the session start (${formatDate(viewingSession.start_date)}).`;
    }
    if (viewingSession.end_date && examForm.exam_date > viewingSession.end_date) {
      return `Exam date is after the session end (${formatDate(viewingSession.end_date)}).`;
    }

    return null;
  };

  const submitExam = async (e: FormEvent) => {
    e.preventDefault();
    if (!viewingSession) return;

    const validationError = validateExamForm();
    if (validationError) { toast(validationError, 'error'); return; }

    setSavingExam(true);
    const payload: Record<string, unknown> = {
      school_id: SCHOOL_ID,
      exam_session_id: viewingSession.id,
      term_id: viewingSession.term_id,
      name: examForm.name.trim() || `${subjectMap[examForm.subject_id]?.name ?? 'Exam'} — ${classMap[examForm.class_id]?.name ?? ''}`,
      exam_type: examForm.exam_type,
      class_id: examForm.class_id,
      subject_id: examForm.subject_id,
      exam_date: examForm.exam_date || null,
      start_time: examForm.start_time || null,
      end_time: examForm.end_time || null,
      duration_minutes: examForm.duration_minutes ? parseInt(examForm.duration_minutes) : null,
      room: examForm.room || null,
      teacher_id: examForm.teacher_id || null,
      total_marks: parseFloat(examForm.total_marks) || 100,
      status: examForm.status,
    };

    if (editingExam) {
      const { error } = await supabase.from('exams').update(payload).eq('id', editingExam.id);
      if (error) { toast(error.message, 'error'); setSavingExam(false); return; }
      toast('Exam updated');
    } else {
      const { error } = await supabase.from('exams').insert(payload);
      if (error) { toast(error.message, 'error'); setSavingExam(false); return; }
      toast('Exam added to schedule');
    }
    setSavingExam(false);
    setExamModalOpen(false);
    loadExams(viewingSession.id);
  };

  const confirmDeleteExam = async () => {
    if (!deleteExamTarget || !viewingSession) return;
    setDeletingExam(true);
    const { error } = await supabase.from('exams').delete().eq('id', deleteExamTarget.id);
    setDeletingExam(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Exam deleted');
    setDeleteExamTarget(null);
    loadExams(viewingSession.id);
  };

  const sessionColumns: Column<ExamSession>[] = [
    {
      key: 'name',
      header: 'Session',
      render: (s) => (
        <div>
          <p className="font-medium text-ink dark:text-slate-100">{s.name}</p>
          <p className="text-xs text-ink-muted">
            {yearMap[s.academic_year_id ?? '']?.name ?? '—'}
            {s.term_id ? ` · ${termMap[s.term_id]?.name ?? '—'}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Duration',
      render: (s) => (
        <span className="text-ink-soft dark:text-slate-300">
          {s.start_date || s.end_date ? `${formatDate(s.start_date)} — ${formatDate(s.end_date)}` : '—'}
        </span>
      ),
    },
    {
      key: 'exams',
      header: 'Exams',
      render: (s) => <Badge variant="secondary">{examCounts[s.id] ?? 0} exam(s)</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => {
        const b = statusBadge(s.status);
        return (
          <div className="flex items-center gap-2">
            <Badge variant={b.variant}>{b.label}</Badge>
            {s.published && <Badge variant="success">Published</Badge>}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openSessionDetail(s)} className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800" title="Manage exam schedule">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => openEditSession(s)} className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setDeleteSessionTarget(s)} className="rounded-lg p-1.5 text-ink-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const examColumns: Column<Exam>[] = [
    {
      key: 'name',
      header: 'Exam',
      render: (ex) => (
        <div>
          <p className="font-medium text-ink dark:text-slate-100">{ex.name}</p>
          <p className="text-xs text-ink-muted">
            {subjectMap[ex.subject_id ?? '']?.name ?? '—'} · {classMap[ex.class_id ?? '']?.name ?? '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'exam_date',
      header: 'Date',
      render: (ex) => (
        <div className="flex items-center gap-1.5 text-ink-soft dark:text-slate-300">
          <Calendar className="h-3.5 w-3.5 text-ink-muted" />
          {ex.exam_date ? formatDate(ex.exam_date) : '—'}
        </div>
      ),
    },
    {
      key: 'time',
      header: 'Time',
      render: (ex) => (
        <span className="text-ink-soft dark:text-slate-300">
          {ex.start_time ? `${ex.start_time}${ex.end_time ? `–${ex.end_time}` : ''}` : '—'}
        </span>
      ),
    },
    {
      key: 'room',
      header: 'Room',
      render: (ex) => <span className="text-ink-soft dark:text-slate-300">{ex.room ?? '—'}</span>,
    },
    {
      key: 'teacher',
      header: 'Teacher',
      render: (ex) => (
        <span className="text-ink-soft dark:text-slate-300">{ex.teacher_id ? (teacherMap[ex.teacher_id]?.full_name ?? '—') : '—'}</span>
      ),
    },
    {
      key: 'marks',
      header: 'Max Marks',
      render: (ex) => <Badge variant="secondary">{ex.total_marks}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (ex) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEditExam(ex)} className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setDeleteExamTarget(ex)} className="rounded-lg p-1.5 text-ink-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const filteredExams = useMemo(() => {
    if (!classFilter) return exams;
    return exams.filter((e) => e.class_id === classFilter);
  }, [exams, classFilter]);

  if (viewingSession) {
    return (
      <div>
        <button onClick={() => setViewingSession(null)} className="mb-4 flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink dark:hover:text-slate-100">
          <ArrowLeft className="h-4 w-4" /> Back to sessions
        </button>

        <PageHeader
          title={viewingSession.name}
          subtitle={`${yearMap[viewingSession.academic_year_id ?? '']?.name ?? '—'}${viewingSession.term_id ? ` · ${termMap[viewingSession.term_id]?.name ?? ''}` : ''}`}
          icon={<ClipboardList className="h-6 w-6" />}
          action={<Button onClick={() => openAddExam()} leftIcon={<Plus className="h-4 w-4" />}>Add Exam</Button>}
        />

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card>
            <p className="text-sm text-ink-muted">Duration</p>
            <p className="mt-1 font-medium text-ink dark:text-slate-100">
              {viewingSession.start_date || viewingSession.end_date
                ? `${formatDate(viewingSession.start_date)} — ${formatDate(viewingSession.end_date)}`
                : '—'}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-ink-muted">Total Exams</p>
            <p className="mt-1 font-medium text-ink dark:text-slate-100">{exams.length}</p>
          </Card>
          <Card>
            <p className="text-sm text-ink-muted">Classes</p>
            <p className="mt-1 font-medium text-ink dark:text-slate-100">{new Set(exams.map((e) => e.class_id).filter(Boolean)).size}</p>
          </Card>
          <Card>
            <p className="text-sm text-ink-muted">Status</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={statusBadge(viewingSession.status).variant}>{statusBadge(viewingSession.status).label}</Badge>
              {viewingSession.published && <Badge variant="success">Published</Badge>}
            </div>
          </Card>
        </div>

        {/* View toggle + class filter */}
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
              <option value="">All classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
        </div>

        {examsLoading ? (
          <RowSkeleton rows={4} />
        ) : exams.length === 0 ? (
          <Card>
            <EmptyState title="No exams scheduled" description='Click "Add Exam" to start building the examination timetable. Each class can have its own independent schedule.' icon={<ClipboardList className="h-10 w-10" />} />
          </Card>
        ) : viewMode === 'timetable' ? (
          <ExamTimetable
            exams={filteredExams}
            classes={classes}
            subjects={subjects}
            teachers={teachers}
            editable
            onEditExam={openEditExam}
            onDeleteExam={(ex) => setDeleteExamTarget(ex)}
            onAddForDateClass={(date, classId) => openAddExam(date === 'unscheduled' ? '' : date, classId)}
          />
        ) : (
          <Card>
            <DataTable columns={examColumns} data={filteredExams} rowKey={(ex) => ex.id} />
          </Card>
        )}

        <Modal
          open={examModalOpen}
          onClose={() => setExamModalOpen(false)}
          title={editingExam ? 'Edit Exam' : 'Add Exam'}
          description={`Schedule an exam in ${viewingSession.name}`}
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setExamModalOpen(false)}>Cancel</Button>
              <Button type="submit" form="exam-form" loading={savingExam}>{editingExam ? 'Save Changes' : 'Add Exam'}</Button>
            </>
          }
        >
          <form id="exam-form" onSubmit={submitExam} className="space-y-4">
            <Input label="Exam Name" value={examForm.name} onChange={(e) => setExamForm({ ...examForm, name: e.target.value })} placeholder="Auto-generated from subject + class if left blank" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="Class *" required value={examForm.class_id} onChange={(e) => setExamForm({ ...examForm, class_id: e.target.value })}>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select label="Subject *" required value={examForm.subject_id} onChange={(e) => setExamForm({ ...examForm, subject_id: e.target.value })}>
                <option value="">Select subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Input label="Exam Date *" type="date" required value={examForm.exam_date} onChange={(e) => setExamForm({ ...examForm, exam_date: e.target.value })} />
              <Select label="Invigilating Teacher" value={examForm.teacher_id} onChange={(e) => setExamForm({ ...examForm, teacher_id: e.target.value })}>
                <option value="">Unassigned</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </Select>
              <Input label="Start Time" type="time" value={examForm.start_time} onChange={(e) => setExamForm({ ...examForm, start_time: e.target.value })} />
              <Input label="End Time" type="time" value={examForm.end_time} onChange={(e) => setExamForm({ ...examForm, end_time: e.target.value })} />
              <Input label="Duration (minutes)" type="number" value={examForm.duration_minutes} onChange={(e) => setExamForm({ ...examForm, duration_minutes: e.target.value })} />
              <Input label="Room" value={examForm.room} onChange={(e) => setExamForm({ ...examForm, room: e.target.value })} placeholder="e.g. Hall A" />
              <Input label="Total Marks" type="number" value={examForm.total_marks} onChange={(e) => setExamForm({ ...examForm, total_marks: e.target.value })} />
              <Select label="Exam Type" value={examForm.exam_type} onChange={(e) => setExamForm({ ...examForm, exam_type: e.target.value })}>
                <option value="midterm">Midterm</option>
                <option value="endterm">End Term</option>
                <option value="quiz">Quiz</option>
                <option value="assessment">Assessment</option>
                <option value="final">Final</option>
              </Select>
              <Select label="Status" value={examForm.status} onChange={(e) => setExamForm({ ...examForm, status: e.target.value })}>
                {EXAM_SESSION_STATUSES.map((s) => <option key={s} value={s}>{EXAM_SESSION_STATUS_LABELS[s]}</option>)}
              </Select>
            </div>
            {examForm.class_id && examForm.exam_date && (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                <p className="text-xs text-ink-muted">
                  {exams.filter((e) => e.class_id === examForm.class_id && e.exam_date === examForm.exam_date && e.id !== editingExam?.id).length} other exam(s) already scheduled for {classMap[examForm.class_id]?.name ?? 'this class'} on this date.
                </p>
              </div>
            )}
          </form>
        </Modal>

        <Modal
          open={!!deleteExamTarget}
          onClose={() => setDeleteExamTarget(null)}
          title="Delete Exam"
          description={`Delete ${deleteExamTarget?.name}?`}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteExamTarget(null)}>Cancel</Button>
              <Button variant="danger" loading={deletingExam} onClick={confirmDeleteExam}>Delete</Button>
            </>
          }
        >
          <p className="text-sm text-ink-muted">This will also delete any marks recorded for this exam.</p>
        </Modal>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Exam Sessions"
        subtitle="Create exam sessions and build examination timetables"
        icon={<ClipboardList className="h-6 w-6" />}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={openGenerateModal} leftIcon={<Wand2 className="h-4 w-4" />}>Auto-Generate</Button>
            <Button onClick={openAddSession} leftIcon={<Plus className="h-4 w-4" />}>Add Session</Button>
          </div>
        }
      />

      <Card>
        <div className="mb-4 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            className="input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search by name, status, year…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <RowSkeleton rows={5} />
        ) : filteredSessions.length === 0 ? (
          <EmptyState title="No exam sessions" description={search ? 'Try adjusting your search.' : 'Click "Add Session" to create your first exam session.'} icon={<ClipboardList className="h-10 w-10" />} />
        ) : (
          <DataTable columns={sessionColumns} data={filteredSessions} rowKey={(s) => s.id} onRowClick={openSessionDetail} />
        )}
      </Card>

      <Modal
        open={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        title={editingSession ? 'Edit Exam Session' : 'Add Exam Session'}
        description={editingSession ? `Editing ${editingSession.name}` : 'Create a new exam session container'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSessionModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="session-form" loading={savingSession}>{editingSession ? 'Save Changes' : 'Add Session'}</Button>
          </>
        }
      >
        <form id="session-form" onSubmit={submitSession} className="space-y-4">
          <Input label="Session Name *" required value={sessionForm.name} onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })} placeholder="e.g. Mid-Term Exams 2025" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Academic Year *"
              required
              value={sessionForm.academic_year_id}
              onChange={(e) => setSessionForm({ ...sessionForm, academic_year_id: e.target.value, term_id: '' })}
            >
              <option value="">Select year</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
            <Select label="Term" value={sessionForm.term_id} onChange={(e) => setSessionForm({ ...sessionForm, term_id: e.target.value })} disabled={!sessionForm.academic_year_id}>
              <option value="">Select term</option>
              {filteredTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <Input label="Start Date" type="date" value={sessionForm.start_date} onChange={(e) => setSessionForm({ ...sessionForm, start_date: e.target.value })} />
            <Input label="End Date" type="date" value={sessionForm.end_date} onChange={(e) => setSessionForm({ ...sessionForm, end_date: e.target.value })} />
          </div>
          <Select label="Status" value={sessionForm.status} onChange={(e) => setSessionForm({ ...sessionForm, status: e.target.value })}>
            {EXAM_SESSION_STATUSES.map((s) => (
              <option key={s} value={s}>{EXAM_SESSION_STATUS_LABELS[s]}</option>
            ))}
          </Select>
          {sessionForm.status === 'published' && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-3">
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                Setting status to "Published" will make results visible and record the publish timestamp.
              </p>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        title="Auto-Generate Exam Schedule"
        description="Generate exams for every class and subject in the last weeks of a term"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setGenerateModalOpen(false)}>Cancel</Button>
            <Button loading={generating} onClick={runGenerate} leftIcon={<Wand2 className="h-4 w-4" />}>Generate</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Term *" value={genForm.term_id} onChange={(e) => setGenForm({ ...genForm, term_id: e.target.value })}>
            <option value="">Select term</option>
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name} (ends {formatDate(t.end_date)})</option>)}
          </Select>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Weeks Before Term End" value={genForm.weeks_before} onChange={(e) => setGenForm({ ...genForm, weeks_before: e.target.value })}>
              <option value="1">1 week before</option>
              <option value="2">2 weeks before</option>
              <option value="3">3 weeks before</option>
            </Select>
            <Select label="Exam Type" value={genForm.exam_type} onChange={(e) => setGenForm({ ...genForm, exam_type: e.target.value })}>
              <option value="endterm">End Term</option>
              <option value="midterm">Midterm</option>
              <option value="final">Final</option>
              <option value="quiz">Quiz</option>
              <option value="assessment">Assessment</option>
            </Select>
            <Input label="Daily Start Time" type="time" value={genForm.start_time} onChange={(e) => setGenForm({ ...genForm, start_time: e.target.value })} />
            <Input label="Duration (minutes)" type="number" value={genForm.duration_minutes} onChange={(e) => setGenForm({ ...genForm, duration_minutes: e.target.value })} />
            <Select label="Exams Per Day" value={genForm.exams_per_day} onChange={(e) => setGenForm({ ...genForm, exams_per_day: e.target.value })}>
              <option value="1">1 exam per day</option>
              <option value="2">2 exams per day</option>
              <option value="3">3 exams per day</option>
            </Select>
            <Input label="Total Marks" type="number" value={genForm.total_marks} onChange={(e) => setGenForm({ ...genForm, total_marks: e.target.value })} />
          </div>
          {genPreview ? (
            <div className="rounded-lg border border-primary-200 bg-primary-50 dark:border-primary-500/20 dark:bg-primary-500/10 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary-600 dark:text-primary-light" />
                <div className="text-sm text-primary-700 dark:text-primary-light">
                  <p className="font-medium">Schedule Preview</p>
                  <p className="mt-1">This will create <strong>{genPreview.count} exams</strong> across <strong>{classes.length} classes</strong> and <strong>{subjects.length} subjects</strong>.</p>
                  <p className="mt-0.5">Exams are scheduled from <strong>{formatDate(genPreview.startDate)}</strong> to <strong>{formatDate(genPreview.endDate)}</strong> (Monday–Friday only), with up to {genForm.exams_per_day} exam(s) per class per day starting at {genForm.start_time}. The scheduler automatically avoids conflicts — no teacher is assigned to two exams at the same time, and different classes take different subjects in the same slot.</p>
                </div>
              </div>
            </div>
          ) : genTerm && !genTerm.end_date ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10 p-4">
              <p className="text-sm text-amber-700 dark:text-amber-400">The selected term has no end date. Please set a term end date first.</p>
            </div>
          ) : null}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
            <p className="text-xs text-ink-muted">A new exam session named after the term will be created in draft status. Each class gets an exam for every subject linked to it (or all school subjects if none are linked). You can edit individual exams afterward.</p>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteSessionTarget}
        onClose={() => setDeleteSessionTarget(null)}
        title="Delete Exam Session"
        description={`Delete ${deleteSessionTarget?.name}? All exams within this session will also be deleted.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteSessionTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deletingSession} onClick={confirmDeleteSession}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">This action cannot be undone.</p>
      </Modal>
    </div>
  );
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
