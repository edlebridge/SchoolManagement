import { useState, useMemo, useEffect, useCallback, type FormEvent } from 'react';
import { Users, Plus, Pencil, Trash2, Search, Mail, Phone, Link2, X, Send, Check, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import type { AppUser, Student, StudentParent } from '@/types';

const SCHOOL_ID = 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb';
const DEFAULT_PASSWORD = 'Password123!';

interface ParentFormState {
  full_name: string;
  email: string;
  phone: string;
  gender: string;
  address: string;
  national_id: string;
  nationality: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  send_invite: boolean;
  invite_channel: string;
}

const emptyForm: ParentFormState = {
  full_name: '',
  email: '',
  phone: '',
  gender: '',
  address: '',
  national_id: '',
  nationality: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  send_invite: true,
  invite_channel: 'email',
};

export function SchoolAdminParents() {
  const { parents, students, loading, refresh } = useSchoolData();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState<ParentFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<{ email: string; password: string; inviteLink: string | null; emailSent: boolean; smsSent: boolean; sendError: string | null } | null>(null);

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkParent, setLinkParent] = useState<AppUser | null>(null);
  const [linkStudentId, setLinkStudentId] = useState('');
  const [linkRelationship, setLinkRelationship] = useState('parent');
  const [linkIsPrimary, setLinkIsPrimary] = useState(false);
  const [linking, setLinking] = useState(false);
  const [parentLinks, setParentLinks] = useState<Record<string, StudentParent[]>>({});

  const studentMap = useMemo(() => {
    const m: Record<string, Student> = {};
    students.forEach((s) => { m[s.id] = s; });
    return m;
  }, [students]);

  const loadLinks = useCallback(async () => {
    if (parents.length === 0) { setParentLinks({}); return; }
    const { data } = await supabase
      .from('student_parents')
      .select('*')
      .in('parent_user_id', parents.map((p) => p.user_id));
    const map: Record<string, StudentParent[]> = {};
    (data as StudentParent[] | null)?.forEach((sp) => {
      if (!map[sp.parent_user_id]) map[sp.parent_user_id] = [];
      map[sp.parent_user_id].push(sp);
    });
    setParentLinks(map);
  }, [parents]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  const filtered = useMemo(() => {
    if (!search.trim()) return parents;
    const q = search.toLowerCase();
    return parents.filter((p) =>
      p.full_name.toLowerCase().includes(q) ||
      (p.phone ?? '').toLowerCase().includes(q) ||
      (p.address ?? '').toLowerCase().includes(q)
    );
  }, [parents, search]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p: AppUser) => {
    setEditing(p);
    setForm({
      full_name: p.full_name,
      email: '',
      phone: p.phone ?? '',
      gender: p.gender ?? '',
      address: p.address ?? '',
      national_id: p.national_id ?? '',
      nationality: p.nationality ?? '',
      emergency_contact_name: p.emergency_contact_name ?? '',
      emergency_contact_phone: p.emergency_contact_phone ?? '',
      send_invite: false,
      invite_channel: 'email',
    });
    setModalOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) { toast('Full name is required', 'error'); return; }
    if (!editing && !form.email.trim()) { toast('Email is required for new parents', 'error'); return; }

    setSaving(true);

    const payload = {
      school_id: SCHOOL_ID,
      role: 'parent' as const,
      full_name: form.full_name.trim(),
      phone: form.phone || null,
      gender: form.gender || null,
      address: form.address || null,
      national_id: form.national_id || null,
      nationality: form.nationality || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      active: true,
    };

    if (editing) {
      const { error } = await supabase.from('app_users').update(payload).eq('id', editing.id);
      if (error) { toast(error.message, 'error'); setSaving(false); return; }
      toast('Parent updated successfully');
    } else {
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
          role: 'parent',
        }),
      });

      if (!fnRes.ok) {
        const err = await fnRes.json().catch(() => ({ error: 'Failed to create user' }));
        toast(`Error: ${err.error}`, 'error');
        setSaving(false);
        return;
      }

      const fnData = await fnRes.json();
      if (fnData.profileId) {
        await supabase.from('app_users').update({
          gender: form.gender || null,
          address: form.address || null,
          national_id: form.national_id || null,
          nationality: form.nationality || null,
          emergency_contact_name: form.emergency_contact_name || null,
          emergency_contact_phone: form.emergency_contact_phone || null,
        }).eq('id', fnData.profileId);
      }

      toast('Parent added successfully');

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
              role: 'parent',
              channel: form.invite_channel,
              appOrigin: window.location.origin,
              metadata: {},
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
    refresh();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('student_parents').delete().eq('parent_user_id', deleteTarget.user_id);
    const { error } = await supabase.from('app_users').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Parent deleted');
    setDeleteTarget(null);
    refresh();
  };

  const openLinkModal = (p: AppUser) => {
    setLinkParent(p);
    setLinkStudentId('');
    setLinkRelationship('parent');
    setLinkIsPrimary(false);
    setLinkModalOpen(true);
  };

  const submitLink = async () => {
    if (!linkParent || !linkStudentId) { toast('Select a student', 'error'); return; }
    setLinking(true);
    const { error } = await supabase.from('student_parents').insert({
      school_id: SCHOOL_ID,
      student_id: linkStudentId,
      parent_user_id: linkParent.user_id,
      relationship: linkRelationship,
      is_primary_guardian: linkIsPrimary,
    });
    setLinking(false);
    if (error) {
      if (error.code === '23505') { toast('This parent is already linked to this student', 'error'); }
      else { toast(error.message, 'error'); }
      return;
    }
    toast(`${linkParent.full_name} linked to ${studentMap[linkStudentId]?.full_name ?? 'student'}`);
    setLinkModalOpen(false);
    loadLinks();
  };

  const unlinkStudent = async (sp: StudentParent) => {
    const { error } = await supabase.from('student_parents').delete().eq('id', sp.id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Link removed');
    loadLinks();
  };

  const columns: Column<AppUser>[] = [
    {
      key: 'full_name',
      header: 'Parent',
      render: (p) => (
        <div className="flex items-center gap-3">
          <Avatar name={p.full_name} src={p.avatar_url} size="sm" />
          <div>
            <p className="font-medium text-ink dark:text-slate-100">{p.full_name}</p>
            <p className="text-xs text-ink-muted">{p.phone ?? 'No phone'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'children',
      header: 'Linked Children',
      render: (p) => {
        const links = parentLinks[p.user_id] ?? [];
        if (links.length === 0) return <span className="text-xs text-ink-muted">No children linked</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {links.map((sp) => (
              <span key={sp.id} className="inline-flex items-center gap-1 rounded-full bg-primary-50 dark:bg-primary-500/15 px-2 py-0.5 text-xs text-primary-600 dark:text-primary-light">
                {studentMap[sp.student_id]?.full_name ?? 'Unknown'}
                {sp.is_primary_guardian && <span className="font-bold">★</span>}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'address',
      header: 'Address',
      render: (p) => <span className="text-ink-soft dark:text-slate-300">{p.address ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <Badge variant={p.active ? 'success' : 'secondary'}>{p.active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openLinkModal(p)} className="rounded-lg p-1.5 text-ink-muted hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-slate-800" title="Link to student">
            <Link2 className="h-4 w-4" />
          </button>
          <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setDeleteTarget(p)} className="rounded-lg p-1.5 text-ink-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Parents"
        subtitle="Manage parent accounts and link them to students"
        icon={<Users className="h-6 w-6" />}
        action={<Button onClick={openAdd} leftIcon={<Plus className="h-4 w-4" />}>Add Parent</Button>}
      />

      <Card>
        <div className="mb-4 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            className="input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search by name, phone, address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <RowSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No parents found" description={search ? 'Try adjusting your search.' : 'Click "Add Parent" to create your first parent account.'} icon={<Users className="h-10 w-10" />} />
        ) : (
          <DataTable columns={columns} data={filtered} rowKey={(p) => p.id} />
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Parent' : 'Add Parent'}
        description={editing ? `Editing ${editing.full_name}` : 'Register a new parent account'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="parent-form" loading={saving}>{editing ? 'Save Changes' : 'Add Parent'}</Button>
          </>
        }
      >
        <form id="parent-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full Name *" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Doe" />
            <Input label={editing ? 'Email (cannot change)' : 'Email *'} type="email" required={!editing} disabled={!!editing} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@email.com" leftIcon={<Mail className="h-4 w-4" />} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 234 567 8900" leftIcon={<Phone className="h-4 w-4" />} />
            <Select label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
            <Input label="National ID" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} placeholder="ID number" />
            <Input label="Nationality" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="e.g. Kenyan" />
          </div>
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St, City" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Emergency Contact Name" value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} placeholder="John Doe" />
            <Input label="Emergency Contact Phone" value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} placeholder="+1 234 567 8900" />
          </div>
          {!editing && (
            <>
              <div className="rounded-xl border border-surface-border p-4 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-ink dark:text-slate-100">
                  <input type="checkbox" checked={form.send_invite} onChange={(e) => setForm({ ...form, send_invite: e.target.checked })} className="rounded" />
                  <Send className="h-4 w-4 text-primary-600" />
                  Send invitation to parent
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
                  A default password of <code className="font-mono font-bold">{DEFAULT_PASSWORD}</code> will be assigned. The parent should change it after first login.
                </p>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* Link Modal */}
      <Modal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        title="Link Parent to Student"
        description={linkParent ? `Link ${linkParent.full_name} to a student` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLinkModalOpen(false)}>Cancel</Button>
            <Button loading={linking} onClick={submitLink}>Link</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Student *" value={linkStudentId} onChange={(e) => setLinkStudentId(e.target.value)}>
            <option value="">Select student…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.admission_number})</option>)}
          </Select>
          <Select label="Relationship" value={linkRelationship} onChange={(e) => setLinkRelationship(e.target.value)}>
            <option value="parent">Parent</option>
            <option value="guardian">Guardian</option>
            <option value="mother">Mother</option>
            <option value="father">Father</option>
            <option value="grandparent">Grandparent</option>
            <option value="sibling">Sibling</option>
            <option value="other">Other</option>
          </Select>
          <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-slate-300">
            <input type="checkbox" checked={linkIsPrimary} onChange={(e) => setLinkIsPrimary(e.target.checked)} className="rounded" />
            Primary guardian
          </label>
          {linkParent && (parentLinks[linkParent.user_id] ?? []).length > 0 && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
              <p className="text-xs font-medium text-ink-muted mb-2">Currently linked to:</p>
              <div className="space-y-1">
                {(parentLinks[linkParent.user_id] ?? []).map((sp) => (
                  <div key={sp.id} className="flex items-center justify-between">
                    <span className="text-sm text-ink-soft dark:text-slate-300">
                      {studentMap[sp.student_id]?.full_name ?? 'Unknown'}
                      {sp.is_primary_guardian && <span className="ml-1 text-xs text-primary-600 dark:text-primary-light">★ Primary</span>}
                    </span>
                    <button onClick={() => unlinkStudent(sp)} className="rounded p-1 text-ink-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-700">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Parent"
        description={`Are you sure you want to delete ${deleteTarget?.full_name}? This will also unlink them from all students.`}
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
        title="Parent Created"
        description="Share these credentials with the parent. They should change the password after first login."
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
