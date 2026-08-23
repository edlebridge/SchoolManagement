import { useState, useMemo, type FormEvent } from 'react';
import { UserCog, Plus, Pencil, Trash2, Upload, Search, Mail, Phone, Building2, Send, Check, MessageSquare } from 'lucide-react';
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
import { uploadFile, cn } from '@/lib/utils';
import type { AppUser, Subject, ClassRow } from '@/types';

const SCHOOL_ID = 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb';
const DEFAULT_PASSWORD = 'Password123!';

interface TeacherFormState {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  national_id: string;
  nationality: string;
  gender: string;
  date_of_birth: string;
  medical_history: string;
  qualification: string;
  department: string;
  employment_date: string;
  employment_status: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  subject_ids: string[];
  class_ids: string[];
  send_invite: boolean;
  invite_channel: string;
}

const emptyForm: TeacherFormState = {
  full_name: '',
  email: '',
  phone: '',
  address: '',
  national_id: '',
  nationality: '',
  gender: '',
  date_of_birth: '',
  medical_history: '',
  qualification: '',
  department: '',
  employment_date: '',
  employment_status: 'active',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  subject_ids: [],
  class_ids: [],
  send_invite: true,
  invite_channel: 'email',
};

export function SchoolAdminStaff() {
  const { profile } = useAuth();
  const { teachers, subjects, classes, classSubjects, loading, refresh } = useSchoolData();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState<TeacherFormState>(emptyForm);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [certificateFiles, setCertificateFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<{ email: string; password: string; inviteLink: string | null; emailSent: boolean; smsSent: boolean; sendError: string | null } | null>(null);

  const subjectMap = useMemo(() => {
    const map: Record<string, Subject> = {};
    subjects.forEach((s) => { map[s.id] = s; });
    return map;
  }, [subjects]);

  const classMap = useMemo(() => {
    const map: Record<string, ClassRow> = {};
    classes.forEach((c) => { map[c.id] = c; });
    return map;
  }, [classes]);

  const filtered = useMemo(() => {
    if (!search.trim()) return teachers;
    const q = search.toLowerCase();
    return teachers.filter((t) =>
      t.full_name.toLowerCase().includes(q) ||
      (t.phone ?? '').toLowerCase().includes(q) ||
      (t.department ?? '').toLowerCase().includes(q) ||
      (t.employment_status ?? '').toLowerCase().includes(q)
    );
  }, [teachers, search]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setAvatarFile(null);
    setAvatarPreview(null);
    setIdCardFile(null);
    setCertificateFiles([]);
    setModalOpen(true);
  };

  const openEdit = (t: AppUser) => {
    setEditing(t);
    // Load existing subject/class assignments
    const tSubjectIds = classSubjects.filter((cs) => cs.teacher_id === t.id).map((cs) => cs.subject_id);
    const tClassIds = classSubjects.filter((cs) => cs.teacher_id === t.id).map((cs) => cs.class_id);
    setForm({
      full_name: t.full_name,
      email: '',
      phone: t.phone ?? '',
      address: t.address ?? '',
      national_id: t.national_id ?? '',
      nationality: t.nationality ?? '',
      gender: t.gender ?? '',
      date_of_birth: t.date_of_birth ?? '',
      medical_history: t.medical_history ?? '',
      qualification: t.qualification ?? '',
      department: t.department ?? '',
      employment_date: t.employment_date ?? '',
      employment_status: t.employment_status ?? 'active',
      emergency_contact_name: t.emergency_contact_name ?? '',
      emergency_contact_phone: t.emergency_contact_phone ?? '',
      subject_ids: tSubjectIds,
      class_ids: tClassIds,
      send_invite: false,
      invite_channel: 'email',
    });
    setAvatarFile(null);
    setAvatarPreview(t.avatar_url);
    setIdCardFile(null);
    setCertificateFiles([]);
    setModalOpen(true);
  };

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const onIdCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setIdCardFile(file);
  };

  const onCertificatesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) setCertificateFiles(Array.from(files));
  };

  const toggleSubject = (id: string) => {
    setForm((f) => ({
      ...f,
      subject_ids: f.subject_ids.includes(id) ? f.subject_ids.filter((x) => x !== id) : [...f.subject_ids, id],
    }));
  };

  const toggleClass = (id: string) => {
    setForm((f) => ({
      ...f,
      class_ids: f.class_ids.includes(id) ? f.class_ids.filter((x) => x !== id) : [...f.class_ids, id],
    }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast('Full name is required', 'error');
      return;
    }
    if (!editing && !form.email.trim()) {
      toast('Email is required for new teachers', 'error');
      return;
    }

    setSaving(true);

    // Upload avatar
    let avatarUrl = editing?.avatar_url ?? null;
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop();
      const path = `${SCHOOL_ID}/avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const url = await uploadFile('teacher-photos', path, avatarFile);
      if (url) avatarUrl = url;
    }

    // Upload ID card
    let idCardUrl = editing?.id_card_url ?? null;
    if (idCardFile) {
      const ext = idCardFile.name.split('.').pop();
      const path = `${SCHOOL_ID}/id-cards/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const url = await uploadFile('teacher-documents', path, idCardFile);
      if (url) idCardUrl = url;
    }

    // Upload certificates
    let certificates = editing?.certificates ?? [];
    if (certificateFiles.length > 0) {
      const uploaded: any[] = [];
      for (const file of certificateFiles) {
        const ext = file.name.split('.').pop();
        const path = `${SCHOOL_ID}/certificates/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const url = await uploadFile('teacher-documents', path, file);
        if (url) uploaded.push({ name: file.name, url });
      }
      certificates = [...certificates, ...uploaded];
    }

    const payload = {
      school_id: SCHOOL_ID,
      role: 'teacher' as const,
      full_name: form.full_name.trim(),
      phone: form.phone || null,
      address: form.address || null,
      national_id: form.national_id || null,
      nationality: form.nationality || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      medical_history: form.medical_history || null,
      qualification: form.qualification || null,
      department: form.department || null,
      employment_date: form.employment_date || null,
      employment_status: form.employment_status || 'active',
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      avatar_url: avatarUrl,
      id_card_url: idCardUrl,
      certificates,
      active: true,
    };

    if (editing) {
      const { error } = await supabase.from('app_users').update(payload).eq('id', editing.id);
      if (error) {
        toast(error.message, 'error');
        setSaving(false);
        return;
      }

      // Update class_subjects: remove old, insert new
      await supabase.from('class_subjects').delete().eq('teacher_id', editing.id);

      // Insert new assignments
      if (form.subject_ids.length > 0 && form.class_ids.length > 0) {
        const assignments: any[] = [];
        for (const classId of form.class_ids) {
          for (const subjectId of form.subject_ids) {
            assignments.push({
              school_id: SCHOOL_ID,
              class_id: classId,
              subject_id: subjectId,
              teacher_id: editing.id,
            });
          }
        }
        if (assignments.length > 0) {
          await supabase.from('class_subjects').upsert(assignments, { onConflict: 'class_id,subject_id' });
        }
      }

      toast('Teacher updated successfully');
    } else {
      // Create auth user via edge function (so admin session is not affected)
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-create-user`;
      const fnRes = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          email: form.email.trim(),
          password: DEFAULT_PASSWORD,
          fullName: form.full_name.trim(),
          phone: form.phone || null,
          schoolId: SCHOOL_ID,
          role: 'teacher',
        }),
      });

      let userId: string;
      let profileId: string | null = null;

      if (!fnRes.ok) {
        const err = await fnRes.json().catch(() => ({ error: 'Failed to create user' }));
        toast(`Error: ${err.error}`, 'error');
        setSaving(false);
        return;
      }

      const fnData = await fnRes.json();
      userId = fnData.userId;
      profileId = fnData.profileId;

      // Update the app_users record with extended profile fields
      if (profileId) {
        await supabase.from('app_users').update({
          gender: form.gender || null,
          date_of_birth: form.date_of_birth || null,
          nationality: form.nationality || null,
          national_id: form.national_id || null,
          address: form.address || null,
          medical_history: form.medical_history || null,
          qualification: form.qualification || null,
          department: form.department || null,
          employment_date: form.employment_date || null,
          employment_status: form.employment_status || 'active',
          emergency_contact_name: form.emergency_contact_name || null,
          emergency_contact_phone: form.emergency_contact_phone || null,
          avatar_url: avatarPreview,
          id_card_url: idCardFile ? await uploadFile('teacher-documents', `id-cards/${userId}-${idCardFile.name}`, idCardFile) : null,
        }).eq('id', profileId);
      }

      // Insert class_subjects assignments
      if (form.subject_ids.length > 0 && form.class_ids.length > 0) {
        const assignments: any[] = [];
        for (const classId of form.class_ids) {
          for (const subjectId of form.subject_ids) {
            assignments.push({
              school_id: SCHOOL_ID,
              class_id: classId,
              subject_id: subjectId,
              teacher_id: profileId,
            });
          }
        }
        if (assignments.length > 0) {
          await supabase.from('class_subjects').upsert(assignments, { onConflict: 'class_id,subject_id' });
        }
      }

      toast('Teacher added successfully');

      // Send invitation link if requested
      let inviteLink: string | null = null;
      let emailSent = false;
      let smsSent = false;
      let sendError: string | null = null;

      if (form.send_invite && (form.email.trim() || form.phone.trim())) {
        try {
          const session = await supabase.auth.getSession();
          const invUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation`;
          const invRes = await fetch(invUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.data.session?.access_token}`,
            },
            body: JSON.stringify({
              schoolId: SCHOOL_ID,
              recipientName: form.full_name.trim(),
              recipientEmail: form.email.trim() || null,
              recipientPhone: form.phone.trim() || null,
              role: 'teacher',
              channel: form.invite_channel,
              appOrigin: window.location.origin,
              metadata: { department: form.department },
            }),
          });

          if (invRes.ok) {
            const invData = await invRes.json();
            inviteLink = invData.inviteLink as string;
            emailSent = !!invData.emailSent;
            smsSent = !!invData.smsSent;
            sendError = invData.sendError ?? null;
            if (emailSent || smsSent) {
              toast('Invitation sent successfully', 'success');
            } else if (sendError) {
              toast(`Invitation delivery failed: ${sendError}`, 'error');
            }
          } else {
            const err = await invRes.json().catch(() => ({ error: 'Failed' }));
            sendError = err.error ?? 'Failed';
            toast(`Invitation failed: ${sendError}`, 'error');
          }
        } catch (err) {
          sendError = (err as Error).message;
          toast(`Invitation failed: ${sendError}`, 'error');
        }
      }

      setCredentialsModal({ email: form.email.trim(), password: DEFAULT_PASSWORD, inviteLink, emailSent, smsSent, sendError });
    }

    setSaving(false);
    setModalOpen(false);
    setAvatarFile(null);
    setAvatarPreview(null);
    setIdCardFile(null);
    setCertificateFiles([]);
    refresh();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Remove class_subjects assignments
    await supabase.from('class_subjects').delete().eq('teacher_id', deleteTarget.id);
    const { error } = await supabase.from('app_users').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast('Teacher deleted');
    setDeleteTarget(null);
    refresh();
  };

  const columns: Column<AppUser>[] = [
    {
      key: 'full_name',
      header: 'Teacher',
      render: (t) => (
        <div className="flex items-center gap-3">
          <Avatar name={t.full_name} src={t.avatar_url} size="sm" />
          <div>
            <p className="font-medium text-ink dark:text-slate-100">{t.full_name}</p>
            <p className="text-xs text-ink-muted">{t.qualification ?? '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (t) => <span className="text-ink-soft dark:text-slate-300">{t.phone ?? '—'}</span>,
    },
    {
      key: 'department',
      header: 'Department',
      render: (t) => <span className="text-ink-soft dark:text-slate-300">{t.department ?? '—'}</span>,
    },
    {
      key: 'employment_status',
      header: 'Status',
      render: (t) => {
        const b = statusBadge(t.employment_status ?? 'active');
        return <Badge variant={b.variant}>{b.label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: '',
      render: (t) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(t)} className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setDeleteTarget(t)} className="rounded-lg p-1.5 text-ink-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Manage teaching staff and assignments"
        icon={<UserCog className="h-6 w-6" />}
        action={<Button onClick={openAdd} leftIcon={<Plus className="h-4 w-4" />}>Add Teacher</Button>}
      />

      <Card>
        <div className="mb-4 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            className="input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search by name, phone, department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <RowSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No teachers found" description={search ? 'Try adjusting your search.' : 'Click "Add Teacher" to create your first staff member.'} icon={<UserCog className="h-10 w-10" />} />
        ) : (
          <DataTable columns={columns} data={filtered} rowKey={(t) => t.id} />
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Teacher' : 'Add Teacher'}
        description={editing ? `Editing ${editing.full_name}` : 'Register a new teacher'}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="teacher-form" loading={saving}>{editing ? 'Save Changes' : 'Add Teacher'}</Button>
          </>
        }
      >
        <form id="teacher-form" onSubmit={submit} className="space-y-5">
          {/* Avatar Upload */}
          <div>
            <label className="input-label">Profile Picture</label>
            <div className="flex items-center gap-4">
              <Avatar name={form.full_name || 'Teacher'} src={avatarPreview} size="lg" />
              <div>
                <label className={cn('btn btn-secondary cursor-pointer', saving && 'opacity-50 pointer-events-none')}>
                  <Upload className="h-4 w-4" />
                  <span>Upload Photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} disabled={saving} />
                </label>
                <p className="text-xs text-ink-muted mt-1">JPG, PNG up to 5MB</p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full Name *" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Smith" />
            <Input label={editing ? 'Email (cannot change)' : 'Email *'} type="email" required={!editing} disabled={!!editing} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@school.edu" leftIcon={<Mail className="h-4 w-4" />} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 234 567 8900" leftIcon={<Phone className="h-4 w-4" />} />
            <Select label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
            <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            <Input label="Nationality" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="e.g. American" />
            <Input label="National ID" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} placeholder="ID number" />
            <Input label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Science" leftIcon={<Building2 className="h-4 w-4" />} />
          </div>

          <Textarea label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St, City, Country" />

          {/* Professional Info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Qualification" value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} placeholder="e.g. BSc Mathematics" />
            <Input label="Employment Date" type="date" value={form.employment_date} onChange={(e) => setForm({ ...form, employment_date: e.target.value })} />
            <Select label="Employment Status" value={form.employment_status} onChange={(e) => setForm({ ...form, employment_status: e.target.value })}>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </Select>
          </div>

          <Textarea label="Medical History" value={form.medical_history} onChange={(e) => setForm({ ...form, medical_history: e.target.value })} placeholder="Known conditions, allergies, medications…" />

          {/* Emergency Contact */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Emergency Contact Name" value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} placeholder="John Smith" />
            <Input label="Emergency Contact Phone" value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} placeholder="+1 234 567 8900" />
          </div>

          {/* Subjects Multi-Select */}
          <div>
            <label className="input-label">Assigned Subjects</label>
            <div className="flex flex-wrap gap-2">
              {subjects.length === 0 ? (
                <p className="text-sm text-ink-muted">No subjects available. Create subjects first.</p>
              ) : (
                subjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSubject(s.id)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      form.subject_ids.includes(s.id)
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-ink-soft hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    )}
                  >
                    {s.name}{s.code ? ` (${s.code})` : ''}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Classes Multi-Select */}
          <div>
            <label className="input-label">Assigned Classes</label>
            <div className="flex flex-wrap gap-2">
              {classes.length === 0 ? (
                <p className="text-sm text-ink-muted">No classes available. Create classes first.</p>
              ) : (
                classes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleClass(c.id)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      form.class_ids.includes(c.id)
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-ink-soft hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    )}
                  >
                    {c.name}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Document Uploads */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="input-label">ID Card (optional)</label>
              <label className={cn('btn btn-secondary w-full cursor-pointer', saving && 'opacity-50 pointer-events-none')}>
                <Upload className="h-4 w-4" />
                <span>{idCardFile ? idCardFile.name : 'Upload ID Card'}</span>
                <input type="file" className="hidden" onChange={onIdCardChange} disabled={saving} />
              </label>
            </div>
            <div>
              <label className="input-label">Certificates (optional)</label>
              <label className={cn('btn btn-secondary w-full cursor-pointer', saving && 'opacity-50 pointer-events-none')}>
                <Upload className="h-4 w-4" />
                <span>{certificateFiles.length > 0 ? `${certificateFiles.length} file(s) selected` : 'Upload Certificates'}</span>
                <input type="file" multiple className="hidden" onChange={onCertificatesChange} disabled={saving} />
              </label>
            </div>
          </div>

          {!editing && (
            <>
              <div className="rounded-xl border border-surface-border p-4 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-ink dark:text-slate-100">
                  <input type="checkbox" checked={form.send_invite} onChange={(e) => setForm({ ...form, send_invite: e.target.checked })} className="rounded" />
                  <Send className="h-4 w-4 text-primary-600" />
                  Send invitation to teacher
                </label>
                {form.send_invite && (
                  <div className="ml-6 space-y-2">
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-slate-300">
                        <input type="radio" checked={form.invite_channel === 'email'} onChange={() => setForm({ ...form, invite_channel: 'email' })} />
                        <Mail className="h-3.5 w-3.5" /> Email
                      </label>
                      <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-slate-300">
                        <input type="radio" checked={form.invite_channel === 'sms'} onChange={() => setForm({ ...form, invite_channel: 'sms' })} />
                        <MessageSquare className="h-3.5 w-3.5" /> SMS
                      </label>
                    </div>
                    <p className="text-xs text-ink-muted">
                      {form.invite_channel === 'email'
                        ? `An invitation email with a login link will be sent to ${form.email || 'the email above'}.`
                        : `An SMS with a login link will be sent to ${form.phone || 'the phone above'}.`}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  A default password of <code className="font-mono font-bold">{DEFAULT_PASSWORD}</code> will be assigned. The teacher should change it after first login.
                </p>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Teacher"
        description={`Are you sure you want to delete ${deleteTarget?.full_name}? This will also remove all class/subject assignments.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">This action cannot be undone.</p>
      </Modal>

      {/* Credentials Modal */}
      <Modal
        open={!!credentialsModal}
        onClose={() => setCredentialsModal(null)}
        title="Teacher Created"
        description="Share these credentials with the teacher. They should change the password after first login."
        size="sm"
        footer={<Button onClick={() => setCredentialsModal(null)}>Done</Button>}
      >
        {credentialsModal && (
          <div className="space-y-3">
            {credentialsModal.emailSent ? (
              <div className="rounded-lg bg-success-soft p-3 text-center">
                <Check className="h-8 w-8 mx-auto text-success-soft-text mb-2" />
                <p className="text-sm text-success-soft-text">Invitation email sent successfully to {credentialsModal.email}</p>
              </div>
            ) : credentialsModal.smsSent ? (
              <div className="rounded-lg bg-success-soft p-3 text-center">
                <Check className="h-8 w-8 mx-auto text-success-soft-text mb-2" />
                <p className="text-sm text-success-soft-text">Invitation SMS sent successfully</p>
              </div>
            ) : credentialsModal.inviteLink ? (
              <>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Delivery failed{credentialsModal.sendError ? `: ${credentialsModal.sendError}` : ''}. Share this link manually:
                  </p>
                </div>
                <div className="rounded bg-white dark:bg-slate-800 p-2">
                  <p className="text-xs text-ink-muted break-all font-mono">{credentialsModal.inviteLink}</p>
                </div>
              </>
            ) : null}

            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
              <p className="text-xs text-ink-muted mb-1">Email</p>
              <p className="font-mono text-sm text-ink dark:text-slate-100">{credentialsModal.email || '—'}</p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
              <p className="text-xs text-ink-muted mb-1">Password</p>
              <p className="font-mono text-sm text-ink dark:text-slate-100">{credentialsModal.password}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
