import { useMemo, useState, useEffect, useCallback } from 'react';
import { Check, X, Clock, FileText, Save, CalendarCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useAcademic } from '@/context/AcademicContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Spinner';
import { cn, formatDate } from '@/lib/utils';
import { ATTENDANCE_LABELS } from '@/lib/constants';
import type { Attendance } from '@/types';

type Status = 'present' | 'absent' | 'late' | 'excused';

const STATUS_OPTIONS: { value: Status; label: string; icon: typeof Check; activeClass: string }[] = [
  { value: 'present', label: 'Present', icon: Check, activeClass: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'absent', label: 'Absent', icon: X, activeClass: 'bg-rose-600 text-white border-rose-600' },
  { value: 'late', label: 'Late', icon: Clock, activeClass: 'bg-amber-500 text-white border-amber-500' },
  { value: 'excused', label: 'Excused', icon: FileText, activeClass: 'bg-slate-600 text-white border-slate-600' },
];

export function TeacherAttendance() {
  const { profile } = useAuth();
  const { students, classes, classSubjects, loading } = useSchoolData();
  const { years, terms, selectedYearId, selectedTermId, setYear, setTerm } = useAcademic();
  const { toast } = useToast();

  const today = new Date().toISOString().split('T')[0];
  const [selectedClassId, setSelectedClassId] = useState('');
  const [date, setDate] = useState(today);
  const [session, setSession] = useState<'morning' | 'afternoon'>('morning');
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [existingRecords, setExistingRecords] = useState<Attendance[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // My classes
  const myClasses = useMemo(() => {
    if (!profile) return [];
    return classes.filter(
      (c) =>
        c.class_teacher_id === profile.id ||
        classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === profile.id)
    );
  }, [classes, classSubjects, profile]);

  // Auto-select first class
  useEffect(() => {
    if (!selectedClassId && myClasses.length > 0) {
      setSelectedClassId(myClasses[0].id);
    }
  }, [myClasses, selectedClassId]);

  // Students in selected class
  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return students.filter((s) => s.class_id === selectedClassId && s.enrollment_status === 'active');
  }, [students, selectedClassId]);

  // Load existing attendance records for the selected class/date/session
  const loadRecords = useCallback(async () => {
    if (!selectedClassId || !date || !profile?.school_id) {
      setExistingRecords([]);
      setMarks({});
      return;
    }
    setLoadingRecords(true);
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('class_id', selectedClassId)
      .eq('date', date)
      .eq('session', session);

    const records = (data as Attendance[]) ?? [];
    setExistingRecords(records);

    // Build marks map from existing records
    const marksMap: Record<string, Status> = {};
    records.forEach((r) => {
      marksMap[r.student_id] = r.status as Status;
    });

    // Default unmarked students to present
    classStudents.forEach((s) => {
      if (!marksMap[s.id]) {
        marksMap[s.id] = 'present';
      }
    });

    setMarks(marksMap);
    setLoadingRecords(false);
  }, [selectedClassId, date, session, profile?.school_id, classStudents]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const setStatus = (studentId: string, status: Status) => {
    setMarks((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    if (!profile?.id || !profile?.school_id || !selectedClassId) {
      toast('Missing required information', 'error');
      return;
    }
    setSaving(true);
    try {
      const rows = classStudents.map((s) => ({
        school_id: profile.school_id!,
        student_id: s.id,
        class_id: selectedClassId,
        date,
        session,
        status: marks[s.id] ?? 'present',
        notes: null,
        marked_by: profile.id,
      }));

      const { error } = await supabase
        .from('attendance')
        .upsert(rows, { onConflict: 'student_id,date,session' });

      if (error) throw error;
      toast('Attendance saved successfully');
      loadRecords();
    } catch {
      toast('Failed to save attendance', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const counts: Record<Status, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    classStudents.forEach((s) => {
      const st = marks[s.id];
      if (st) counts[st]++;
    });
    return counts;
  }, [classStudents, marks]);

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Mark daily attendance for your classes"
        icon={<CalendarCheck className="h-5 w-5" />}
      />

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Select label="Academic Year" value={selectedYearId} onChange={(e) => setYear(e.target.value)}>
            <option value="">All Years</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </Select>

          <Select label="Term" value={selectedTermId} onChange={(e) => setTerm(e.target.value)}>
            <option value="">All Terms</option>
            {terms.filter((t) => !selectedYearId || t.academic_year_id === selectedYearId).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>

          <Select label="Class" value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
            <option value="">Select a class</option>
            {myClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <div>
            <label className="input-label">Date</label>
            <input
              type="date"
              className="input"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <Select label="Session" value={session} onChange={(e) => setSession(e.target.value as 'morning' | 'afternoon')}>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
          </Select>
        </div>
      </Card>

      {/* Stats Bar */}
      {selectedClassId && classStudents.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATUS_OPTIONS.map((opt) => (
            <div key={opt.value} className="card p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">{opt.label}</span>
                <span className="text-xl font-bold text-ink dark:text-slate-100">{stats[opt.value]}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Students Attendance Grid */}
      {loading || loadingRecords ? (
        <RowSkeleton rows={6} />
      ) : !selectedClassId ? (
        <Card>
          <EmptyState title="Select a class" description="Please select a class to mark attendance." icon={<CalendarCheck className="h-10 w-10" />} />
        </Card>
      ) : classStudents.length === 0 ? (
        <Card>
          <EmptyState title="No students" description="No active students in this class." icon={<CalendarCheck className="h-10 w-10" />} />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={`Attendance for ${formatDate(date)} · ${session}`}
            subtitle={myClasses.find((c) => c.id === selectedClassId)?.name ?? ''}
            action={
              <Button onClick={handleSave} loading={saving} leftIcon={<Save className="h-4 w-4" />}>
                Save Attendance
              </Button>
            }
          />
          <div className="space-y-2">
            {classStudents.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={s.full_name} src={s.photo_url} size="sm" />
                  <div>
                    <p className="font-medium text-ink dark:text-slate-100">{s.full_name}</p>
                    <p className="text-sm text-ink-muted">{s.admission_number}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map((opt) => {
                    const isActive = marks[s.id] === opt.value;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setStatus(s.id, opt.value)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                          isActive
                            ? opt.activeClass
                            : 'border-slate-200 text-ink-muted hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Existing records indicator */}
          {existingRecords.length > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-primary-50 p-3 text-sm text-primary-700 dark:bg-primary-500/10 dark:text-primary-light">
              <Check className="h-4 w-4" />
              Attendance was previously marked for this session. Changes will update existing records.
            </div>
          )}

          {/* Save button (mobile-friendly bottom) */}
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave} loading={saving} leftIcon={<Save className="h-4 w-4" />}>
              Save Attendance
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
