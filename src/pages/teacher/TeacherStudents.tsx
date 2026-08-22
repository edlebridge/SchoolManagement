import { useMemo, useState, useEffect } from 'react';
import { Search, Eye, Users, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useAcademic } from '@/context/AcademicContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import type { Student, AppUser, Attendance, ExamMark, Subject } from '@/types';

export function TeacherStudents() {
  const { profile } = useAuth();
  const { students, classes, classSubjects, subjects, loading } = useSchoolData();
  const { years, terms, selectedYearId, selectedTermId, setYear, setTerm } = useAcademic();
  const { toast } = useToast();

  const [selectedClassId, setSelectedClassId] = useState('');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<Student | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [parents, setParents] = useState<AppUser[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<Attendance[]>([]);
  const [recentMarks, setRecentMarks] = useState<(ExamMark & { subjectName: string })[]>([]);

  // My classes: class_teacher_id === profile.id OR class_subjects has teacher_id === profile.id
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

  // Filter students by selected class
  const filteredStudents = useMemo(() => {
    let list = students.filter((s) => s.class_id === selectedClassId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.admission_number.toLowerCase().includes(q)
      );
    }
    return list;
  }, [students, selectedClassId, search]);

  // Load student details when viewing
  useEffect(() => {
    if (!viewing) return;
    setModalOpen(true);
    setModalLoading(true);
    setParents([]);
    setRecentAttendance([]);
    setRecentMarks([]);

    (async () => {
      try {
        // Fetch parents via student_parents + app_users
        const { data: spData } = await supabase
          .from('student_parents')
          .select('parent_user_id, relationship, is_primary_guardian')
          .eq('student_id', viewing.id);

        let parentUsers: AppUser[] = [];
        if (spData && spData.length > 0) {
          const parentUserIds = spData.map((sp) => sp.parent_user_id);
          const { data: parentData } = await supabase
            .from('app_users')
            .select('*')
            .in('user_id', parentUserIds);
          parentUsers = (parentData as AppUser[]) ?? [];
        }

        // Fetch recent attendance
        const { data: attData } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', viewing.id)
          .order('date', { ascending: false })
          .limit(10);

        // Fetch recent marks with subject names
        const { data: marksData } = await supabase
          .from('exam_marks')
          .select('*')
          .eq('student_id', viewing.id)
          .order('created_at', { ascending: false })
          .limit(10);

        const marksWithSubjects: (ExamMark & { subjectName: string })[] = [];
        for (const m of (marksData as ExamMark[]) ?? []) {
          const subj = subjects.find((s) => s.id === m.subject_id);
          marksWithSubjects.push({ ...m, subjectName: subj?.name ?? '—' });
        }

        setParents(parentUsers);
        setRecentAttendance((attData as Attendance[]) ?? []);
        setRecentMarks(marksWithSubjects);
      } catch {
        toast('Failed to load student details', 'error');
      } finally {
        setModalLoading(false);
      }
    })();
  }, [viewing, subjects, toast]);

  const closeModal = () => {
    setModalOpen(false);
    setViewing(null);
  };

  return (
    <div>
      <PageHeader
        title="My Students"
        subtitle="View and manage students in your classes"
        icon={<Users className="h-5 w-5" />}
      />

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Academic Year"
            value={selectedYearId}
            onChange={(e) => setYear(e.target.value)}
          >
            <option value="">All Years</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>

          <Select
            label="Term"
            value={selectedTermId}
            onChange={(e) => setTerm(e.target.value)}
          >
            <option value="">All Terms</option>
            {terms
              .filter((t) => !selectedYearId || t.academic_year_id === selectedYearId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>

          <Select
            label="Class"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            <option value="">Select a class</option>
            {myClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Input
            label="Search"
            placeholder="Name or admission number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
      </Card>

      {/* Students List */}
      {loading ? (
        <RowSkeleton rows={6} />
      ) : !selectedClassId ? (
        <Card>
          <EmptyState
            title="Select a class"
            description="Please select a class to view its students."
            icon={<Users className="h-10 w-10" />}
          />
        </Card>
      ) : filteredStudents.length === 0 ? (
        <Card>
          <EmptyState
            title="No students found"
            description="No students match your filters in this class."
            icon={<Users className="h-10 w-10" />}
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={`${filteredStudents.length} Students`}
            subtitle={myClasses.find((c) => c.id === selectedClassId)?.name ?? ''}
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-left text-sm text-ink-muted dark:border-slate-800">
                  <th className="pb-3 pr-4 font-medium">Student</th>
                  <th className="pb-3 pr-4 font-medium">Admission No.</th>
                  <th className="pb-3 pr-4 font-medium">Gender</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.full_name} src={s.photo_url} size="sm" />
                        <span className="font-medium text-ink dark:text-slate-100">{s.full_name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-sm text-ink-muted">{s.admission_number}</td>
                    <td className="py-3 pr-4 text-sm text-ink-muted">{s.gender ?? '—'}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={s.enrollment_status === 'active' ? 'success' : 'secondary'}>
                        {s.enrollment_status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<Eye className="h-3.5 w-3.5" />}
                        onClick={() => setViewing(s)}
                      >
                        View Profile
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Student Profile Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Student Profile"
        size="lg"
        footer={
          <Button variant="secondary" onClick={closeModal} leftIcon={<X className="h-4 w-4" />}>
            Close
          </Button>
        }
      >
        {modalLoading || !viewing ? (
          <RowSkeleton rows={4} />
        ) : (
          <div className="space-y-6">
            {/* Student Header */}
            <div className="flex items-center gap-4">
              <Avatar name={viewing.full_name} src={viewing.photo_url} size="lg" />
              <div>
                <h3 className="text-lg font-semibold text-ink dark:text-slate-100">{viewing.full_name}</h3>
                <p className="text-sm text-ink-muted">Admission No: {viewing.admission_number}</p>
                <div className="mt-1 flex gap-2">
                  <Badge variant={viewing.enrollment_status === 'active' ? 'success' : 'secondary'}>
                    {viewing.enrollment_status}
                  </Badge>
                  {viewing.gender && <Badge variant="secondary">{viewing.gender}</Badge>}
                </div>
              </div>
            </div>

            {/* Student Details */}
            <div className="grid grid-cols-2 gap-4">
              <DetailItem label="Date of Birth" value={formatDate(viewing.date_of_birth)} />
              <DetailItem label="Nationality" value={viewing.nationality ?? '—'} />
              <DetailItem label="Phone" value={viewing.phone_number ?? '—'} />
              <DetailItem
                label="Class"
                value={myClasses.find((c) => c.id === viewing.class_id)?.name ?? '—'}
              />
              <DetailItem label="Address" value={viewing.address ?? '—'} />
              <DetailItem
                label="Emergency Contact"
                value={
                  viewing.emergency_contact_name
                    ? `${viewing.emergency_contact_name} (${viewing.emergency_contact_phone ?? '—'})`
                    : '—'
                }
              />
              <DetailItem label="Medical Notes" value={viewing.medical_notes ?? '—'} />
              <DetailItem label="Admitted At" value={formatDate(viewing.admitted_at)} />
            </div>

            {/* Parents / Guardians */}
            <div>
              <h4 className="mb-3 font-semibold text-ink dark:text-slate-100">Parents / Guardians</h4>
              {parents.length === 0 ? (
                <p className="text-sm text-ink-muted">No parents linked to this student.</p>
              ) : (
                <div className="space-y-2">
                  {parents.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                    >
                      <Avatar name={p.full_name} src={p.avatar_url} size="sm" />
                      <div className="flex-1">
                        <p className="font-medium text-ink dark:text-slate-100">{p.full_name}</p>
                        <p className="text-sm text-ink-muted">{p.phone ?? 'No phone'}</p>
                      </div>
                      {p.active && <Badge variant="success">Active</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Attendance */}
            <div>
              <h4 className="mb-3 font-semibold text-ink dark:text-slate-100">Recent Attendance</h4>
              {recentAttendance.length === 0 ? (
                <p className="text-sm text-ink-muted">No attendance records.</p>
              ) : (
                <div className="space-y-2">
                  {recentAttendance.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink dark:text-slate-100">
                          {formatDate(a.date)} · {a.session}
                        </p>
                        {a.notes && <p className="text-xs text-ink-muted">{a.notes}</p>}
                      </div>
                      <Badge
                        variant={
                          a.status === 'present'
                            ? 'success'
                            : a.status === 'absent'
                            ? 'error'
                            : a.status === 'late'
                            ? 'warning'
                            : 'secondary'
                        }
                      >
                        {a.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Marks */}
            <div>
              <h4 className="mb-3 font-semibold text-ink dark:text-slate-100">Recent Marks</h4>
              {recentMarks.length === 0 ? (
                <p className="text-sm text-ink-muted">No marks recorded.</p>
              ) : (
                <div className="space-y-2">
                  {recentMarks.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink dark:text-slate-100">
                          {m.subjectName}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {m.marks ?? '—'} / {m.total_marks}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.grade && <Badge variant="primary">{m.grade}</Badge>}
                        {m.remarks && <Badge variant="secondary">{m.remarks}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="text-sm text-ink dark:text-slate-100">{value}</p>
    </div>
  );
}
