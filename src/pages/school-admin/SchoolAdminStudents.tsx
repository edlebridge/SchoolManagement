import { useState, useMemo, useEffect, useCallback, type FormEvent } from 'react';
import { GraduationCap, Plus, Pencil, Trash2, Upload, Search, Users, Mail, Phone, Send, Check, ChevronRight, ChevronLeft, Link2, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Spinner';
import { uploadFile, cn, formatDate } from '@/lib/utils';
import type { Student, ClassRow, AppUser, StudentParent } from '@/types';

const SCHOOL_ID = 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb';
const DEFAULT_PASSWORD = 'Password123!';

interface StudentFormState {
  full_name: string;
  admission_number: string;
  gender: string;
  date_of_birth: string;
  class_id: string;
  phone_number: string;
  address: string;
  nationality: string;
  medical_notes: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  enrollment_status: string;
}

const emptyStudentForm: StudentFormState = {
  full_name: '',
  admission_number: '',
  gender: '',
  date_of_birth: '',
  class_id: '',
  phone_number: '',
  address: '',
  nationality: '',
  medical_notes: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  enrollment_status: 'active',
};

interface ParentFormState {
  full_name: string;
  email: string;
  phone: string;
  relationship: string;
  is_primary_guardian: boolean;
  send_invite: boolean;
  invite_channel: 'email' | 'sms';
}

const emptyParentForm: ParentFormState = {
  full_name: '',
  email: '',
  phone: '',
  relationship: 'guardian',
  is_primary_guardian: true,
  send_invite: true,
  invite_channel: 'email',
};

export function SchoolAdminStudents() {
  const { profile, school } = useAuth();
  const { students, classes, parents, loading, refresh } = useSchoolData();
  const { toast } = useToast();

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState<StudentFormState>(emptyStudentForm);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [studentForm, setStudentForm] = useState<StudentFormState>(emptyStudentForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [parentForm, setParentForm] = useState<ParentFormState>(emptyParentForm);
  const [saving, setSaving] = useState(false);

  // Existing parent link
  const [linkExisting, setLinkExisting] = useState(false);
  const [existingParentId, setExistingParentId] = useState('');

  // Search & delete
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Parent links display
  const [parentLinks, setParentLinks] = useState<Record<string, StudentParent[]>>({});
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkStudent, setLinkStudent] = useState<Student | null>(null);
  const [linkParentId, setLinkParentId] = useState('');
  const [linkRelationship, setLinkRelationship] = useState('guardian');
  const [linkIsPrimary, setLinkIsPrimary] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);

  // Success modal
  const [successModal, setSuccessModal] = useState<{ studentName: string; parentName: string; inviteLink: string | null; channel: string; sendUrl: string | null; credentials?: { email: string; password: string } } | null>(null);

  const classNameMap = useMemo(() => {
    const map: Record<string, ClassRow> = {};
    classes.forEach((c) => { map[c.id] = c; });
    return map;
  }, [classes]);

  const parentMap = useMemo(() => {
    const map: Record<string, AppUser> = {};
    parents.forEach((p) => { map[p.user_id] = p; map[p.id] = p; });
    return map;
  }, [parents]);

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter((s) =>
      s.full_name.toLowerCase().includes(q) ||
      s.admission_number.toLowerCase().includes(q) ||
      (s.gender ?? '').toLowerCase().includes(q) ||
      (classNameMap[s.class_id ?? '']?.name ?? '').toLowerCase().includes(q)
    );
  }, [students, search, classNameMap]);

  // Load parent links for all students
  const loadParentLinks = useCallback(async () => {
    if (students.length === 0) return;
    const { data } = await supabase
      .from('student_parents')
      .select('*')
      .in('student_id', students.map((s) => s.id));
    const map: Record<string, StudentParent[]> = {};
    (data as StudentParent[] | null)?.forEach((sp) => {
      if (!map[sp.student_id]) map[sp.student_id] = [];
      map[sp.student_id].push(sp);
    });
    setParentLinks(map);
  }, [students]);

  useEffect(() => { loadParentLinks(); }, [loadParentLinks]);

  // ---- Wizard handlers ----
  const openWizard = () => {
    setStep(1);
    setStudentForm(emptyStudentForm);
    setPhotoFile(null);
    setPhotoPreview(null);
    setParentForm(emptyParentForm);
    setLinkExisting(false);
    setExistingParentId('');
    setWizardOpen(true);
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const validateStep1 = (): boolean => {
    if (!studentForm.full_name.trim()) { toast('Student full name is required', 'error'); return false; }
    if (!studentForm.admission_number.trim()) { toast('Admission number is required', 'error'); return false; }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (linkExisting) {
      if (!existingParentId) { toast('Please select a parent', 'error'); return false; }
    } else {
      if (!parentForm.full_name.trim()) { toast('Parent name is required', 'error'); return false; }
      if (parentForm.send_invite && parentForm.invite_channel === 'email' && !parentForm.email.trim()) {
        toast('Email is required to send an email invitation', 'error'); return false;
      }
      if (parentForm.send_invite && parentForm.invite_channel === 'sms' && !parentForm.phone.trim()) {
        toast('Phone is required to send an SMS invitation', 'error'); return false;
      }
      if (!parentForm.send_invite && !parentForm.email.trim()) {
        toast('Email is required to create a parent account', 'error'); return false;
      }
    }
    return true;
  };

  const submitWizard = async () => {
    if (!validateStep2()) return;
    setSaving(true);

    // 1. Upload photo
    let photoUrl: string | null = null;
    if (photoFile) {
      const ext = photoFile.name.split('.').pop();
      const path = `${SCHOOL_ID}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      photoUrl = await uploadFile('student-photos', path, photoFile);
      if (!photoUrl) toast('Photo upload failed, but student will still be saved', 'error');
    }

    // 2. Insert student
    const studentPayload = {
      school_id: SCHOOL_ID,
      full_name: studentForm.full_name.trim(),
      admission_number: studentForm.admission_number.trim(),
      gender: studentForm.gender || null,
      date_of_birth: studentForm.date_of_birth || null,
      class_id: studentForm.class_id || null,
      phone_number: studentForm.phone_number || null,
      address: studentForm.address || null,
      nationality: studentForm.nationality || null,
      medical_notes: studentForm.medical_notes || null,
      emergency_contact_name: studentForm.emergency_contact_name || null,
      emergency_contact_phone: studentForm.emergency_contact_phone || null,
      enrollment_status: studentForm.enrollment_status,
      photo_url: photoUrl,
      admitted_at: new Date().toISOString(),
    };

    const { data: studentData, error: studentErr } = await supabase
      .from('students').insert(studentPayload).select('id').single();

    if (studentErr || !studentData) {
      toast(studentErr?.message ?? 'Failed to create student', 'error');
      setSaving(false);
      return;
    }

    const newStudentId = (studentData as { id: string }).id;
    let inviteSent = false;
    let channel = '';
    let credentials: { email: string; password: string } | undefined;

    if (linkExisting && existingParentId) {
      // Link existing parent to student
      const existingParent = parentMap[existingParentId];
      const { error: linkErr } = await supabase.from('student_parents').insert({
        school_id: SCHOOL_ID,
        student_id: newStudentId,
        parent_user_id: existingParent.user_id,
        relationship: parentForm.relationship,
        is_primary_guardian: parentForm.is_primary_guardian,
      });

      if (linkErr) {
        toast(`Student created, but linking failed: ${linkErr.message}`, 'error');
      } else {
        toast(`${studentForm.full_name} enrolled and linked to ${existingParent.full_name}`);
      }
      setSuccessModal({ studentName: studentForm.full_name, parentName: existingParent.full_name, inviteLink: null, channel: '', sendUrl: null });
    } else {
      // Create new parent account
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-create-user`;
      const session = await supabase.auth.getSession();
      const fnRes = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({
          email: parentForm.email.trim(),
          password: DEFAULT_PASSWORD,
          fullName: parentForm.full_name.trim(),
          phone: parentForm.phone || null,
          schoolId: SCHOOL_ID,
          role: 'parent',
        }),
      });

      if (!fnRes.ok) {
        const err = await fnRes.json().catch(() => ({ error: 'Failed to create parent account' }));
        toast(`Student created, but parent account failed: ${err.error}`, 'error');
        setSaving(false);
        setWizardOpen(false);
        refresh();
        return;
      }

      const fnData = await fnRes.json();
      const parentUserId = fnData.userId;
      const parentProfileId = fnData.profileId;

      // Update parent profile with extended fields
      if (parentProfileId) {
        await supabase.from('app_users').update({
          gender: null,
          address: null,
        }).eq('id', parentProfileId);
      }

      // Link parent to student
      const { error: linkErr } = await supabase.from('student_parents').insert({
        school_id: SCHOOL_ID,
        student_id: newStudentId,
        parent_user_id: parentUserId,
        relationship: parentForm.relationship,
        is_primary_guardian: parentForm.is_primary_guardian,
      });

      if (linkErr) {
        toast(`Accounts created, but linking failed: ${linkErr.message}`, 'error');
      }

      credentials = { email: parentForm.email.trim(), password: DEFAULT_PASSWORD };

      // Create invitation record if requested — the admin sends it themselves
      let inviteLink: string | null = null;
      let sendUrl: string | null = null;

      if (parentForm.send_invite) {
        channel = parentForm.invite_channel;
        try {
          const invUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation`;
          const invRes = await fetch(invUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.data.session?.access_token}`,
            },
            body: JSON.stringify({
              schoolId: SCHOOL_ID,
              studentName: studentForm.full_name,
              parentName: parentForm.full_name,
              parentEmail: parentForm.email.trim() || null,
              parentPhone: parentForm.phone || null,
              relationship: parentForm.relationship,
              channel: parentForm.invite_channel,
              studentId: newStudentId,
              appOrigin: window.location.origin,
            }),
          });

          if (invRes.ok) {
            const invData = await invRes.json();
            inviteLink = invData.inviteLink as string;
            const schoolNameVal = school?.name ?? 'Your school';
            const subject = `You're invited to join ${schoolNameVal} on EduBridge`;
            const bodyText = `Hi ${parentForm.full_name},\n\n${schoolNameVal} has invited you to join EduBridge as a parent of ${studentForm.full_name}.\n\nClick the link below to activate your account:\n${inviteLink}\n\nThis invitation expires in 7 days.`;
            if (parentForm.invite_channel === 'email') {
              sendUrl = `mailto:${parentForm.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
            } else {
              sendUrl = `sms:${parentForm.phone}?body=${encodeURIComponent(`${schoolNameVal} invited you to EduBridge as parent of ${studentForm.full_name}. Activate: ${inviteLink}`)}`;
            }
          } else {
            const invErr = await invRes.json().catch(() => ({}));
            toast(`Invitation not created: ${invErr.error ?? 'unknown error'}`, 'error');
          }
        } catch {
          toast('Invitation creation failed, but accounts were created', 'error');
        }
      }

      toast(`${studentForm.full_name} enrolled and ${parentForm.full_name} connected`);
      setSuccessModal({ studentName: studentForm.full_name, parentName: parentForm.full_name, inviteLink, channel, sendUrl, credentials });
    }

    setSaving(false);
    setWizardOpen(false);
    refresh();
  };

  // ---- Edit handlers ----
  const openEdit = (s: Student) => {
    setEditing(s);
    setEditForm({
      full_name: s.full_name,
      admission_number: s.admission_number,
      gender: s.gender ?? '',
      date_of_birth: s.date_of_birth ?? '',
      class_id: s.class_id ?? '',
      phone_number: s.phone_number ?? '',
      address: s.address ?? '',
      nationality: s.nationality ?? '',
      medical_notes: s.medical_notes ?? '',
      emergency_contact_name: s.emergency_contact_name ?? '',
      emergency_contact_phone: s.emergency_contact_phone ?? '',
      enrollment_status: s.enrollment_status ?? 'active',
    });
    setEditPhotoFile(null);
    setEditPhotoPreview(s.photo_url);
    setEditModalOpen(true);
  };

  const onEditPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditPhotoFile(file);
    setEditPhotoPreview(URL.createObjectURL(file));
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editForm.full_name.trim() || !editForm.admission_number.trim()) {
      toast('Full name and admission number are required', 'error');
      return;
    }
    setEditSaving(true);

    let photoUrl = editing.photo_url;
    if (editPhotoFile) {
      const ext = editPhotoFile.name.split('.').pop();
      const path = `${SCHOOL_ID}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const url = await uploadFile('student-photos', path, editPhotoFile);
      if (url) photoUrl = url;
    }

    const payload = {
      full_name: editForm.full_name.trim(),
      admission_number: editForm.admission_number.trim(),
      gender: editForm.gender || null,
      date_of_birth: editForm.date_of_birth || null,
      class_id: editForm.class_id || null,
      phone_number: editForm.phone_number || null,
      address: editForm.address || null,
      nationality: editForm.nationality || null,
      medical_notes: editForm.medical_notes || null,
      emergency_contact_name: editForm.emergency_contact_name || null,
      emergency_contact_phone: editForm.emergency_contact_phone || null,
      enrollment_status: editForm.enrollment_status,
      photo_url: photoUrl,
    };

    const { error } = await supabase.from('students').update(payload).eq('id', editing.id);
    setEditSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Student updated successfully');
    setEditModalOpen(false);
    refresh();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('students').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Student deleted');
    setDeleteTarget(null);
    refresh();
  };

  // ---- Link modal handlers ----
  const openLinkModal = (s: Student) => {
    setLinkStudent(s);
    setLinkParentId('');
    setLinkRelationship('guardian');
    setLinkIsPrimary(false);
    setLinkModalOpen(true);
  };

  const submitLink = async () => {
    if (!linkStudent || !linkParentId) { toast('Select a parent', 'error'); return; }
    setLinkSaving(true);
    const parent = parentMap[linkParentId];
    const { error } = await supabase.from('student_parents').insert({
      school_id: SCHOOL_ID,
      student_id: linkStudent.id,
      parent_user_id: parent.user_id,
      relationship: linkRelationship,
      is_primary_guardian: linkIsPrimary,
    });
    setLinkSaving(false);
    if (error) {
      if (error.code === '23505') toast('This parent is already linked to this student', 'error');
      else toast(error.message, 'error');
      return;
    }
    toast(`${parent.full_name} linked to ${linkStudent.full_name}`);
    setLinkModalOpen(false);
    refresh();
  };

  const unlinkParent = async (sp: StudentParent) => {
    const { error } = await supabase.from('student_parents').delete().eq('id', sp.id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Link removed');
    refresh();
  };

  const columns: Column<Student>[] = [
    {
      key: 'full_name',
      header: 'Student',
      render: (s) => (
        <div className="flex items-center gap-3">
          <Avatar name={s.full_name} src={s.photo_url} size="sm" />
          <div>
            <p className="font-medium text-ink dark:text-slate-100">{s.full_name}</p>
            <p className="text-xs text-ink-muted">{s.admission_number}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'class',
      header: 'Class',
      render: (s) => <span className="text-ink-soft dark:text-slate-300">{classNameMap[s.class_id ?? '']?.name ?? '—'}</span>,
    },
    {
      key: 'parents',
      header: 'Parents',
      render: (s) => {
        const links = parentLinks[s.id] ?? [];
        if (links.length === 0) return <span className="text-xs text-ink-muted">No parent linked</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {links.map((sp) => {
              const p = parentMap[sp.parent_user_id];
              return (
                <span key={sp.id} className="inline-flex items-center gap-1 rounded-full bg-primary-50 dark:bg-primary-500/15 px-2 py-0.5 text-xs text-primary-600 dark:text-primary-light">
                  {p?.full_name ?? 'Unknown'}
                  {sp.is_primary_guardian && <span className="font-bold">★</span>}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      key: 'enrollment_status',
      header: 'Status',
      render: (s) => {
        const b = statusBadge(s.enrollment_status);
        return <Badge variant={b.variant}>{b.label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: '',
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); openLinkModal(s); }} className="rounded-lg p-1.5 text-ink-muted hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-slate-800" title="Link parent">
            <Link2 className="h-4 w-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); openEdit(s); }} className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }} className="rounded-lg p-1.5 text-ink-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const stepLabels = ['Student Details', 'Parent / Guardian', 'Review & Finish'];

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle="Enroll students and connect parents in one flow"
        icon={<GraduationCap className="h-6 w-6" />}
        action={<Button onClick={openWizard} leftIcon={<Plus className="h-4 w-4" />}>Add Student</Button>}
      />

      <Card>
        <div className="mb-4 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            className="input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search by name, admission #, class, gender…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <RowSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No students found" description={search ? 'Try adjusting your search.' : 'Click "Add Student" to enroll your first student.'} icon={<GraduationCap className="h-10 w-10" />} />
        ) : (
          <DataTable columns={columns} data={filtered} rowKey={(s) => s.id} />
        )}
      </Card>

      {/* ===== Multi-Step Wizard Modal ===== */}
      <Modal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title="Enroll New Student"
        description="Add a student and connect their parent in 3 quick steps"
        size="xl"
        footer={
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              {stepLabels.map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                    step > i + 1 ? 'bg-success text-white' :
                    step === i + 1 ? 'bg-primary-600 text-white' :
                    'bg-slate-200 text-ink-muted dark:bg-slate-700'
                  )}>
                    {step > i + 1 ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className={cn('text-xs font-medium hidden sm:block', step === i + 1 ? 'text-ink dark:text-slate-100' : 'text-ink-muted')}>{label}</span>
                  {i < stepLabels.length - 1 && <ChevronRight className="h-3 w-3 text-ink-muted hidden sm:block" />}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {step > 1 && (
                <Button variant="secondary" onClick={() => setStep(step - 1)} leftIcon={<ChevronLeft className="h-4 w-4" />}>Back</Button>
              )}
              {step < 3 ? (
                <Button onClick={() => {
                  if (step === 1 && !validateStep1()) return;
                  setStep(step + 1);
                }}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
              ) : (
                <Button onClick={submitWizard} loading={saving} leftIcon={<Check className="h-4 w-4" />}>Finish & Save</Button>
              )}
            </div>
          </div>
        }
      >
        {/* Step 1: Student Details */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="input-label">Student Photo</label>
              <div className="flex items-center gap-4">
                <Avatar name={studentForm.full_name || 'Student'} src={photoPreview} size="lg" />
                <div>
                  <label className={cn('btn btn-secondary cursor-pointer', saving && 'opacity-50 pointer-events-none')}>
                    <Upload className="h-4 w-4" />
                    <span>Upload Photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} disabled={saving} />
                  </label>
                  <p className="text-xs text-ink-muted mt-1">JPG, PNG up to 5MB</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Full Name *" required value={studentForm.full_name} onChange={(e) => setStudentForm({ ...studentForm, full_name: e.target.value })} placeholder="John Doe" />
              <Input label="Admission Number *" required value={studentForm.admission_number} onChange={(e) => setStudentForm({ ...studentForm, admission_number: e.target.value })} placeholder="ADM-001" />
              <Select label="Gender" value={studentForm.gender} onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}>
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
              <Input label="Date of Birth" type="date" value={studentForm.date_of_birth} onChange={(e) => setStudentForm({ ...studentForm, date_of_birth: e.target.value })} />
              <Select label="Class" value={studentForm.class_id} onChange={(e) => setStudentForm({ ...studentForm, class_id: e.target.value })}>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Input label="Phone Number" value={studentForm.phone_number} onChange={(e) => setStudentForm({ ...studentForm, phone_number: e.target.value })} placeholder="+1 234 567 8900" />
              <Input label="Nationality" value={studentForm.nationality} onChange={(e) => setStudentForm({ ...studentForm, nationality: e.target.value })} placeholder="e.g. American" />
              <Select label="Enrollment Status" value={studentForm.enrollment_status} onChange={(e) => setStudentForm({ ...studentForm, enrollment_status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="graduated">Graduated</option>
                <option value="transferred">Transferred</option>
                <option value="suspended">Suspended</option>
              </Select>
            </div>

            <Textarea label="Address" value={studentForm.address} onChange={(e) => setStudentForm({ ...studentForm, address: e.target.value })} placeholder="123 Main St, City, Country" />
            <Textarea label="Medical Notes" value={studentForm.medical_notes} onChange={(e) => setStudentForm({ ...studentForm, medical_notes: e.target.value })} placeholder="Allergies, conditions, medications…" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Emergency Contact Name" value={studentForm.emergency_contact_name} onChange={(e) => setStudentForm({ ...studentForm, emergency_contact_name: e.target.value })} placeholder="Jane Doe" />
              <Input label="Emergency Contact Phone" value={studentForm.emergency_contact_phone} onChange={(e) => setStudentForm({ ...studentForm, emergency_contact_phone: e.target.value })} placeholder="+1 234 567 8900" />
            </div>
          </div>
        )}

        {/* Step 2: Parent Details */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 rounded-lg bg-primary-50 dark:bg-primary-500/10 p-3">
              <Users className="h-5 w-5 text-primary-600 dark:text-primary-light shrink-0" />
              <p className="text-sm text-primary-600 dark:text-primary-light">
                Connect a parent to <strong>{studentForm.full_name}</strong> so they can track attendance, grades, and homework.
              </p>
            </div>

            {/* Toggle: link existing vs create new */}
            <div className="flex gap-2 rounded-xl border border-surface-border p-1">
              <button
                type="button"
                onClick={() => setLinkExisting(false)}
                className={cn('flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  !linkExisting ? 'bg-primary-600 text-white' : 'text-ink-soft hover:bg-surface-overlay')}
              >
                Create New Parent
              </button>
              <button
                type="button"
                onClick={() => setLinkExisting(true)}
                className={cn('flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  linkExisting ? 'bg-primary-600 text-white' : 'text-ink-soft hover:bg-surface-overlay')}
              >
                Link Existing Parent
              </button>
            </div>

            {linkExisting ? (
              <div className="space-y-4">
                {parents.length === 0 ? (
                  <p className="text-sm text-ink-muted py-4 text-center">No parents found. Create a new parent instead.</p>
                ) : (
                  <Select label="Select Parent *" value={existingParentId} onChange={(e) => setExistingParentId(e.target.value)}>
                    <option value="">Choose a parent…</option>
                    {parents.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.phone ?? 'no phone'})</option>)}
                  </Select>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Select label="Relationship" value={parentForm.relationship} onChange={(e) => setParentForm({ ...parentForm, relationship: e.target.value })}>
                    <option value="guardian">Guardian</option>
                    <option value="father">Father</option>
                    <option value="mother">Mother</option>
                    <option value="aunt">Aunt</option>
                    <option value="uncle">Uncle</option>
                    <option value="other">Other</option>
                  </Select>
                  <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-slate-300 mt-6">
                    <input type="checkbox" checked={parentForm.is_primary_guardian} onChange={(e) => setParentForm({ ...parentForm, is_primary_guardian: e.target.checked })} className="rounded" />
                    Primary guardian
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Parent Full Name *" required value={parentForm.full_name} onChange={(e) => setParentForm({ ...parentForm, full_name: e.target.value })} placeholder="Jane Doe" leftIcon={<User className="h-4 w-4" />} />
                  <Input label="Email *" type="email" required value={parentForm.email} onChange={(e) => setParentForm({ ...parentForm, email: e.target.value })} placeholder="jane@email.com" leftIcon={<Mail className="h-4 w-4" />} />
                  <Input label="Phone" value={parentForm.phone} onChange={(e) => setParentForm({ ...parentForm, phone: e.target.value })} placeholder="+1 234 567 8900" leftIcon={<Phone className="h-4 w-4" />} />
                  <Select label="Relationship" value={parentForm.relationship} onChange={(e) => setParentForm({ ...parentForm, relationship: e.target.value })}>
                    <option value="guardian">Guardian</option>
                    <option value="father">Father</option>
                    <option value="mother">Mother</option>
                    <option value="aunt">Aunt</option>
                    <option value="uncle">Uncle</option>
                    <option value="other">Other</option>
                  </Select>
                </div>

                <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-slate-300">
                  <input type="checkbox" checked={parentForm.is_primary_guardian} onChange={(e) => setParentForm({ ...parentForm, is_primary_guardian: e.target.checked })} className="rounded" />
                  Primary guardian
                </label>

                {/* Invite section */}
                <div className="rounded-xl border border-surface-border p-4 space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-ink dark:text-slate-100">
                    <input type="checkbox" checked={parentForm.send_invite} onChange={(e) => setParentForm({ ...parentForm, send_invite: e.target.checked })} className="rounded" />
                    <Send className="h-4 w-4 text-primary-600" />
                    Send invitation link to parent
                  </label>

                  {parentForm.send_invite && (
                    <div className="ml-6 space-y-2">
                      <div className="flex gap-2">
                        <label className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors',
                          parentForm.invite_channel === 'email' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-ink-soft dark:bg-slate-800 dark:text-slate-300')}>
                          <input type="radio" name="channel" value="email" checked={parentForm.invite_channel === 'email'} onChange={() => setParentForm({ ...parentForm, invite_channel: 'email' })} className="hidden" />
                          <Mail className="h-4 w-4" /> Email
                        </label>
                        <label className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors',
                          parentForm.invite_channel === 'sms' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-ink-soft dark:bg-slate-800 dark:text-slate-300')}>
                          <input type="radio" name="channel" value="sms" checked={parentForm.invite_channel === 'sms'} onChange={() => setParentForm({ ...parentForm, invite_channel: 'sms' })} className="hidden" />
                          <Phone className="h-4 w-4" /> SMS
                        </label>
                      </div>
                      <p className="text-xs text-ink-muted">
                        {parentForm.invite_channel === 'email'
                          ? `An invitation email will be sent to ${parentForm.email || 'the email above'} with a link to activate their account.`
                          : `An SMS will be sent to ${parentForm.phone || 'the phone above'} with a link to activate their account.`}
                      </p>
                    </div>
                  )}
                </div>

                {!parentForm.send_invite && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      A default password of <code className="font-mono font-bold">{DEFAULT_PASSWORD}</code> will be assigned. Share these credentials with the parent manually.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-ink dark:text-slate-100">Review before saving</h3>

            {/* Student review */}
            <div className="rounded-xl border border-surface-border p-4">
              <div className="flex items-center gap-3 mb-3">
                <Avatar name={studentForm.full_name || 'Student'} src={photoPreview} size="md" />
                <div>
                  <p className="font-medium text-ink dark:text-slate-100">{studentForm.full_name || '—'}</p>
                  <p className="text-xs text-ink-muted">{studentForm.admission_number || 'No admission #'} · {classNameMap[studentForm.class_id]?.name ?? 'No class'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <ReviewItem label="Gender" value={studentForm.gender || '—'} />
                <ReviewItem label="Date of Birth" value={studentForm.date_of_birth || '—'} />
                <ReviewItem label="Nationality" value={studentForm.nationality || '—'} />
                <ReviewItem label="Phone" value={studentForm.phone_number || '—'} />
                <ReviewItem label="Status" value={studentForm.enrollment_status} />
                <ReviewItem label="Emergency Contact" value={studentForm.emergency_contact_name || '—'} />
              </div>
            </div>

            {/* Parent review */}
            <div className="rounded-xl border border-surface-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-primary-600" />
                <p className="font-medium text-ink dark:text-slate-100">Parent / Guardian</p>
              </div>
              {linkExisting ? (
                <div className="space-y-2">
                  <ReviewItem label="Parent" value={parentMap[existingParentId]?.full_name ?? '—'} />
                  <ReviewItem label="Phone" value={parentMap[existingParentId]?.phone ?? '—'} />
                  <ReviewItem label="Relationship" value={parentForm.relationship} />
                  <ReviewItem label="Primary Guardian" value={parentForm.is_primary_guardian ? 'Yes' : 'No'} />
                </div>
              ) : (
                <div className="space-y-2">
                  <ReviewItem label="Name" value={parentForm.full_name || '—'} />
                  <ReviewItem label="Email" value={parentForm.email || '—'} />
                  <ReviewItem label="Phone" value={parentForm.phone || '—'} />
                  <ReviewItem label="Relationship" value={parentForm.relationship} />
                  <ReviewItem label="Primary Guardian" value={parentForm.is_primary_guardian ? 'Yes' : 'No'} />
                  <ReviewItem label="Invitation" value={parentForm.send_invite ? `Send via ${parentForm.invite_channel.toUpperCase()}` : 'No (share credentials manually)'} />
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ===== Edit Modal ===== */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Student"
        description={`Editing ${editing?.full_name}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="edit-student-form" loading={editSaving}>Save Changes</Button>
          </>
        }
      >
        <form id="edit-student-form" onSubmit={submitEdit} className="space-y-4">
          <div>
            <label className="input-label">Student Photo</label>
            <div className="flex items-center gap-4">
              <Avatar name={editForm.full_name || 'Student'} src={editPhotoPreview} size="lg" />
              <div>
                <label className={cn('btn btn-secondary cursor-pointer', editSaving && 'opacity-50 pointer-events-none')}>
                  <Upload className="h-4 w-4" />
                  <span>Upload Photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={onEditPhotoChange} disabled={editSaving} />
                </label>
                <p className="text-xs text-ink-muted mt-1">JPG, PNG up to 5MB</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full Name *" required value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} placeholder="John Doe" />
            <Input label="Admission Number *" required value={editForm.admission_number} onChange={(e) => setEditForm({ ...editForm, admission_number: e.target.value })} placeholder="ADM-001" />
            <Select label="Gender" value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
            <Input label="Date of Birth" type="date" value={editForm.date_of_birth} onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })} />
            <Select label="Class" value={editForm.class_id} onChange={(e) => setEditForm({ ...editForm, class_id: e.target.value })}>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input label="Phone Number" value={editForm.phone_number} onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })} placeholder="+1 234 567 8900" />
            <Input label="Nationality" value={editForm.nationality} onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })} placeholder="e.g. American" />
            <Select label="Enrollment Status" value={editForm.enrollment_status} onChange={(e) => setEditForm({ ...editForm, enrollment_status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option>
              <option value="transferred">Transferred</option>
              <option value="suspended">Suspended</option>
            </Select>
          </div>

          <Textarea label="Address" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="123 Main St, City, Country" />
          <Textarea label="Medical Notes" value={editForm.medical_notes} onChange={(e) => setEditForm({ ...editForm, medical_notes: e.target.value })} placeholder="Allergies, conditions, medications…" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Emergency Contact Name" value={editForm.emergency_contact_name} onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })} placeholder="Jane Doe" />
            <Input label="Emergency Contact Phone" value={editForm.emergency_contact_phone} onChange={(e) => setEditForm({ ...editForm, emergency_contact_phone: e.target.value })} placeholder="+1 234 567 8900" />
          </div>
        </form>
      </Modal>

      {/* ===== Link Parent Modal ===== */}
      <Modal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        title="Link Parent to Student"
        description={linkStudent ? `Connect a parent to ${linkStudent.full_name}` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLinkModalOpen(false)}>Cancel</Button>
            <Button loading={linkSaving} onClick={submitLink}>Link Parent</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Parent *" value={linkParentId} onChange={(e) => setLinkParentId(e.target.value)}>
            <option value="">Select parent…</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.phone ?? 'no phone'})</option>)}
          </Select>
          <Select label="Relationship" value={linkRelationship} onChange={(e) => setLinkRelationship(e.target.value)}>
            <option value="guardian">Guardian</option>
            <option value="father">Father</option>
            <option value="mother">Mother</option>
            <option value="aunt">Aunt</option>
            <option value="uncle">Uncle</option>
            <option value="other">Other</option>
          </Select>
          <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-slate-300">
            <input type="checkbox" checked={linkIsPrimary} onChange={(e) => setLinkIsPrimary(e.target.checked)} className="rounded" />
            Primary guardian
          </label>

          {linkStudent && (parentLinks[linkStudent.id] ?? []).length > 0 && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
              <p className="text-xs font-medium text-ink-muted mb-2">Currently linked parents:</p>
              <div className="space-y-1">
                {(parentLinks[linkStudent.id] ?? []).map((sp) => {
                  const p = parentMap[sp.parent_user_id];
                  return (
                    <div key={sp.id} className="flex items-center justify-between">
                      <span className="text-sm text-ink-soft dark:text-slate-300">
                        {p?.full_name ?? 'Unknown'}
                        {sp.is_primary_guardian && <span className="ml-1 text-xs text-primary-600 dark:text-primary-light">★ Primary</span>}
                      </span>
                      <button onClick={() => unlinkParent(sp)} className="rounded p-1 text-ink-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ===== Delete Confirmation ===== */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Student"
        description={`Are you sure you want to delete ${deleteTarget?.full_name}? This action cannot be undone.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">Deleting this student will permanently remove their record from the system.</p>
      </Modal>

      {/* ===== Success Modal ===== */}
      <Modal
        open={!!successModal}
        onClose={() => setSuccessModal(null)}
        title="Student Enrolled Successfully"
        size="sm"
        footer={<Button onClick={() => setSuccessModal(null)}>Done</Button>}
      >
        {successModal && (
          <div className="space-y-4">
            <div className="flex items-center justify-center h-16 w-16 mx-auto rounded-full bg-success-soft">
              <Check className="h-8 w-8 text-success-soft-text" />
            </div>
            <div className="text-center">
              <p className="text-sm text-ink dark:text-slate-100">
                <strong>{successModal.studentName}</strong> has been enrolled and connected to <strong>{successModal.parentName}</strong>.
              </p>
            </div>

            {successModal.sendUrl && successModal.inviteLink ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-primary-50 dark:bg-primary-500/10 p-3 space-y-2">
                  <p className="text-sm text-primary-600 dark:text-primary-light">
                    Invitation link created for {successModal.channel.toUpperCase()}.
                  </p>
                  <div className="rounded bg-white dark:bg-slate-800 p-2">
                    <p className="text-xs text-ink-muted break-all font-mono">{successModal.inviteLink}</p>
                  </div>
                </div>
                <a href={successModal.sendUrl} className="btn btn-primary w-full justify-center text-sm">
                  <Send className="h-4 w-4" />
                  Open {successModal.channel === 'email' ? 'Email' : 'SMS'} App to Send
                </a>
                <p className="text-xs text-ink-muted text-center">
                  This opens your {successModal.channel === 'email' ? 'email app' : 'messaging app'} with the invitation pre-written. Just hit send.
                </p>
              </div>
            ) : successModal.credentials ? (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 space-y-2">
                <p className="text-sm text-amber-700 dark:text-amber-400 text-center">Share these credentials with the parent:</p>
                <div className="rounded bg-white dark:bg-slate-800 p-2">
                  <p className="text-xs text-ink-muted">Email</p>
                  <p className="font-mono text-sm text-ink dark:text-slate-100">{successModal.credentials.email}</p>
                </div>
                <div className="rounded bg-white dark:bg-slate-800 p-2">
                  <p className="text-xs text-ink-muted">Password</p>
                  <p className="font-mono text-sm text-ink dark:text-slate-100">{successModal.credentials.password}</p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="text-sm text-ink dark:text-slate-100">{value}</p>
    </div>
  );
}
