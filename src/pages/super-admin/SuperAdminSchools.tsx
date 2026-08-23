import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { RowSkeleton } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/EmptyState';
import { Building2, Search, Ban, CircleCheck as CheckCircle2, Eye, Phone, Mail, MapPin, Users, GraduationCap, UserCog, Plus, Send, Check, Pencil, Trash2, MessageSquare, RefreshCw } from 'lucide-react';
import { formatDate, cn, getAppOrigin } from '@/lib/utils';
import type { School } from '@/types';

interface SchoolWithCounts extends School {
  student_count: number;
  teacher_count: number;
  parent_count: number;
  plan: string | null;
  sub_status: string | null;
}

interface InvitationInfo {
  id: string;
  status: string;
  channel: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  expires_at: string;
}

interface AddSchoolForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  principal_name: string;
  admin_name: string;
  admin_email: string;
  admin_phone: string;
  status: string;
  plan: string;
  send_invite: boolean;
  invite_channel: string;
}

const EMPTY_FORM: AddSchoolForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  principal_name: '',
  admin_name: '',
  admin_email: '',
  admin_phone: '',
  status: 'pending',
  plan: 'starter',
  send_invite: true,
  invite_channel: 'email',
};

const DEFAULT_PASSWORD = 'Password123!';

export function SuperAdminSchools() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [schools, setSchools] = useState<SchoolWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailSchool, setDetailSchool] = useState<SchoolWithCounts | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [invitationMap, setInvitationMap] = useState<Record<string, InvitationInfo | null>>({});

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<AddSchoolForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [successModal, setSuccessModal] = useState<{ schoolName: string; adminName: string; adminEmail: string; inviteLink: string | null; emailSent: boolean; smsSent: boolean; sendError: string | null; credentials: { email: string; password: string } } | null>(null);

  // Edit modal
  const [editSchool, setEditSchool] = useState<SchoolWithCounts | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', address: '', principal_name: '', admin_name: '', admin_email: '', admin_phone: '', status: 'pending' });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<SchoolWithCounts | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Resend invitation
  const [resendTarget, setResendTarget] = useState<SchoolWithCounts | null>(null);
  const [resending, setResending] = useState(false);

  const loadSchools = useCallback(async () => {
    setLoading(true);
    const { data: allSchools } = await supabase.from('schools').select('*').order('created_at', { ascending: false });
    const schoolList = (allSchools as School[]) ?? [];

    const schoolIds = schoolList.map((s) => s.id);
    if (schoolIds.length === 0) {
      setSchools([]);
      setLoading(false);
      return;
    }

    const [sc, tc, pc, subs, invs] = await Promise.all([
      supabase.from('students').select('school_id').in('school_id', schoolIds),
      supabase.from('app_users').select('school_id').eq('role', 'teacher').in('school_id', schoolIds),
      supabase.from('app_users').select('school_id').eq('role', 'parent').in('school_id', schoolIds),
      supabase.from('subscriptions').select('school_id, plan, status').in('school_id', schoolIds),
      supabase.from('invitations').select('id, school_id, status, channel, email, phone, created_at, expires_at, role').in('school_id', schoolIds).eq('role', 'school_admin').order('created_at', { ascending: false }),
    ]);

    const studentCounts: Record<string, number> = {};
    (sc.data ?? []).forEach((r: { school_id: string }) => { studentCounts[r.school_id] = (studentCounts[r.school_id] ?? 0) + 1; });
    const teacherCounts: Record<string, number> = {};
    (tc.data ?? []).forEach((r: { school_id: string }) => { teacherCounts[r.school_id] = (teacherCounts[r.school_id] ?? 0) + 1; });
    const parentCounts: Record<string, number> = {};
    (pc.data ?? []).forEach((r: { school_id: string }) => { parentCounts[r.school_id] = (parentCounts[r.school_id] ?? 0) + 1; });
    const subMap: Record<string, { plan: string; status: string }> = {};
    (subs.data ?? []).forEach((r: { school_id: string; plan: string; status: string }) => {
      subMap[r.school_id] = { plan: r.plan, status: r.status };
    });
    const invMap: Record<string, InvitationInfo> = {};
    (invs.data ?? []).forEach((r: any) => {
      if (!invMap[r.school_id]) {
        invMap[r.school_id] = { id: r.id, status: r.status, channel: r.channel, email: r.email, phone: r.phone, created_at: r.created_at, expires_at: r.expires_at };
      }
    });

    setInvitationMap(invMap);
    setSchools(schoolList.map((s) => ({
      ...s,
      student_count: studentCounts[s.id] ?? 0,
      teacher_count: teacherCounts[s.id] ?? 0,
      parent_count: parentCounts[s.id] ?? 0,
      plan: subMap[s.id]?.plan ?? null,
      sub_status: subMap[s.id]?.status ?? null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { loadSchools(); }, [loadSchools]);

  const filteredSchools = useMemo(() => {
    let list = schools;
    if (statusFilter !== 'all') list = list.filter((s) => s.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.email ?? '').toLowerCase().includes(q) ||
        (s.admin_name ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [schools, search, statusFilter]);

  const writeAuditLog = async (action: string, schoolId: string | null, entity: string, detail: Record<string, unknown>) => {
    await supabase.from('audit_logs').insert({
      school_id: schoolId,
      actor_id: profile?.user_id ?? null,
      actor_role: profile?.role ?? 'super_admin',
      action,
      entity,
      entity_id: schoolId,
      detail,
    });
  };

  const toggleSchoolStatus = async (school: SchoolWithCounts) => {
    setActionLoading(true);
    const newStatus = school.status === 'suspended' ? 'active' : 'suspended';
    const { error } = await supabase.from('schools').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', school.id);
    if (error) {
      toast(`Failed to update school status: ${error.message}`, 'error');
    } else {
      toast(`${school.name} ${newStatus === 'suspended' ? 'suspended' : 'activated'}`, 'success');
      setSchools((prev) => prev.map((s) => s.id === school.id ? { ...s, status: newStatus } : s));
      setDetailSchool((prev) => prev?.id === school.id ? { ...prev, status: newStatus } : prev);
      await writeAuditLog(
        newStatus === 'suspended' ? 'school.suspended' : 'school.activated',
        school.id,
        'schools',
        { school_name: school.name, previous_status: school.status, new_status: newStatus }
      );
    }
    setActionLoading(false);
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'School name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format';
    if (!form.principal_name.trim()) errs.principal_name = 'Principal name is required';
    if (form.send_invite && !form.admin_email.trim()) errs.admin_email = 'Admin email is required to send invitation';
    if (form.send_invite && form.invite_channel === 'sms' && !form.admin_phone.trim()) errs.admin_phone = 'Admin phone is required for SMS invitation';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const sendInvitationEdgeFn = async (session: any, params: { schoolId: string; recipientName: string; recipientEmail: string | null; recipientPhone: string | null; role: string; channel: string; metadata: Record<string, unknown>; }) => {
    const invUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation`;
    const invRes = await fetch(invUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        schoolId: params.schoolId,
        recipientName: params.recipientName,
        recipientEmail: params.recipientEmail,
        recipientPhone: params.recipientPhone,
        role: params.role,
        channel: params.channel,
        appOrigin: getAppOrigin(),
        metadata: params.metadata,
      }),
    });
    return invRes;
  };

  const handleCreateSchool = async () => {
    if (!validateForm()) return;
    setCreating(true);

    const { data: schoolData, error: schoolErr } = await supabase
      .from('schools')
      .insert({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        principal_name: form.principal_name.trim() || null,
        admin_name: form.admin_name.trim() || null,
        admin_email: form.admin_email.trim() || null,
        admin_phone: form.admin_phone.trim() || null,
        status: form.status,
      })
      .select('id, name')
      .single();

    if (schoolErr || !schoolData) {
      toast(`Failed to create school: ${schoolErr?.message ?? 'Unknown error'}`, 'error');
      setCreating(false);
      return;
    }

    const schoolId = schoolData.id;

    if (form.plan) {
      await supabase.from('subscriptions').insert({
        school_id: schoolId,
        plan: form.plan,
        status: form.status === 'active' ? 'active' : 'trial',
        seats: 0,
        student_limit: form.plan === 'enterprise' ? 5000 : form.plan === 'growth' ? 1500 : 500,
        billing_cycle: 'annual',
        amount: 0,
        currency: 'USD',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    await writeAuditLog('school.created', schoolId, 'schools', {
      school_name: form.name,
      email: form.email,
      principal: form.principal_name,
      plan: form.plan,
      status: form.status,
    });

    // Create school admin account and send invitation if admin email provided
    let inviteLink: string | null = null;
    let emailSent = false;
    let smsSent = false;
    let sendError: string | null = null;
    const adminEmail = form.admin_email.trim();
    const adminName = form.admin_name.trim() || form.principal_name.trim();

    if (adminEmail || form.admin_phone.trim()) {
      try {
        const session = (await supabase.auth.getSession()).data.session;

        // Create the school admin auth user + profile via edge function
        if (adminEmail) {
          const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-create-user`;
          const fnRes = await fetch(fnUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              email: adminEmail,
              password: DEFAULT_PASSWORD,
              fullName: adminName,
              phone: form.admin_phone || null,
              schoolId,
              role: 'school_admin',
            }),
          });

          if (!fnRes.ok) {
            const err = await fnRes.json().catch(() => ({ error: 'Failed to create admin account' }));
            toast(`School created, but admin account failed: ${err.error}`, 'error');
            setCreating(false);
            setForm(EMPTY_FORM);
            setFormErrors({});
            setShowAddModal(false);
            loadSchools();
            return;
          }
        }

        // Send invitation link
        if (form.send_invite) {
          const invRes = await sendInvitationEdgeFn(session, {
            schoolId,
            recipientName: adminName,
            recipientEmail: adminEmail || null,
            recipientPhone: form.admin_phone || null,
            role: 'school_admin',
            channel: form.invite_channel,
            metadata: { school_name: form.name },
          });

          if (invRes.ok) {
            const invData = await invRes.json();
            inviteLink = invData.inviteLink as string;
            emailSent = !!invData.emailSent;
            smsSent = !!invData.smsSent;
            sendError = invData.sendError ?? null;
          } else {
            const err = await invRes.json().catch(() => ({ error: 'Invitation failed' }));
            sendError = err.error ?? 'Invitation failed';
          }
        }

        setSuccessModal({
          schoolName: form.name,
          adminName,
          adminEmail,
          inviteLink,
          emailSent,
          smsSent,
          sendError,
          credentials: { email: adminEmail, password: DEFAULT_PASSWORD },
        });
      } catch (err) {
        toast(`School created, but invitation failed: ${(err as Error).message}`, 'error');
      }
    }

    toast(`${form.name} created successfully`, 'success');
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowAddModal(false);
    setCreating(false);
    loadSchools();
  };

  // Edit school
  const openEdit = (s: SchoolWithCounts) => {
    setEditSchool(s);
    setEditForm({
      name: s.name,
      email: s.email ?? '',
      phone: s.phone ?? '',
      address: s.address ?? '',
      principal_name: s.principal_name ?? '',
      admin_name: s.admin_name ?? '',
      admin_email: s.admin_email ?? '',
      admin_phone: s.admin_phone ?? '',
      status: s.status,
    });
    setEditErrors({});
  };

  const saveEdit = async () => {
    if (!editSchool) return;
    const errs: Record<string, string> = {};
    if (!editForm.name.trim()) errs.name = 'School name is required';
    if (!editForm.email.trim()) errs.email = 'Email is required';
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSavingEdit(true);
    const { error } = await supabase.from('schools').update({
      name: editForm.name.trim(),
      email: editForm.email.trim(),
      phone: editForm.phone.trim() || null,
      address: editForm.address.trim() || null,
      principal_name: editForm.principal_name.trim() || null,
      admin_name: editForm.admin_name.trim() || null,
      admin_email: editForm.admin_email.trim() || null,
      admin_phone: editForm.admin_phone.trim() || null,
      status: editForm.status,
      updated_at: new Date().toISOString(),
    }).eq('id', editSchool.id);

    if (error) {
      toast(`Failed to update school: ${error.message}`, 'error');
    } else {
      toast('School updated successfully', 'success');
      setSchools((prev) => prev.map((s) => s.id === editSchool.id ? { ...s, ...editForm } : s));
      setEditSchool(null);
      await writeAuditLog('school.updated', editSchool.id, 'schools', { school_name: editForm.name });
    }
    setSavingEdit(false);
  };

  // Delete school
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Delete related records
    await supabase.from('invitations').delete().eq('school_id', deleteTarget.id);
    await supabase.from('subscriptions').delete().eq('school_id', deleteTarget.id);
    await supabase.from('audit_logs').delete().eq('school_id', deleteTarget.id);
    const { error } = await supabase.from('schools').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast(`Failed to delete school: ${error.message}`, 'error');
      return;
    }
    toast(`${deleteTarget.name} deleted`, 'success');
    await writeAuditLog('school.deleted', null, 'schools', { school_name: deleteTarget.name });
    setDeleteTarget(null);
    loadSchools();
  };

  // Resend invitation
  const resendInvitation = async () => {
    if (!resendTarget) return;
    setResending(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const invRes = await sendInvitationEdgeFn(session, {
        schoolId: resendTarget.id,
        recipientName: resendTarget.admin_name || resendTarget.principal_name || 'School Admin',
        recipientEmail: resendTarget.admin_email || null,
        recipientPhone: resendTarget.admin_phone || null,
        role: 'school_admin',
        channel: 'email',
        metadata: { school_name: resendTarget.name },
      });

      if (invRes.ok) {
        const invData = await invRes.json();
        if (invData.emailSent || invData.smsSent) {
          toast('Invitation resent successfully', 'success');
        } else {
          toast(`Invitation created but delivery failed: ${invData.sendError ?? 'unknown error'}`, 'error');
        }
      } else {
        const err = await invRes.json().catch(() => ({ error: 'Failed' }));
        toast(`Failed to resend: ${err.error}`, 'error');
      }
    } catch (err) {
      toast(`Failed to resend: ${(err as Error).message}`, 'error');
    }
    setResending(false);
    setResendTarget(null);
    loadSchools();
  };

  const invBadgeVariant = (status: string) => {
    if (status === 'sent') return 'success' as const;
    if (status === 'accepted') return 'primary' as const;
    if (status === 'expired') return 'error' as const;
    return 'secondary' as const;
  };

  const stats = useMemo(() => ({
    total: schools.length,
    active: schools.filter((s) => s.status === 'active').length,
    suspended: schools.filter((s) => s.status === 'suspended').length,
    pending: schools.filter((s) => s.status === 'pending').length,
  }), [schools]);

  return (
    <div>
      <PageHeader
        title="Schools"
        subtitle="Manage all schools on the platform"
        icon={<Building2 className="h-6 w-6" />}
        action={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowAddModal(true)}>
            Add School
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-ink">{stats.total}</p>
          <p className="text-xs text-ink-muted mt-1">Total</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-success-soft-text">{stats.active}</p>
          <p className="text-xs text-ink-muted mt-1">Active</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-warning-soft-text">{stats.pending}</p>
          <p className="text-xs text-ink-muted mt-1">Trial</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-error-soft-text">{stats.suspended}</p>
          <p className="text-xs text-ink-muted mt-1">Suspended</p>
        </div>
      </div>

      <Card>
        <CardHeader
          title="All Schools"
          subtitle={`${filteredSchools.length} school${filteredSchools.length !== 1 ? 's' : ''}`}
          action={
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input text-sm py-1.5 px-2">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Trial</option>
              <option value="suspended">Suspended</option>
            </select>
          }
        />
        <div className="mb-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input className="input text-sm pl-9" placeholder="Search by name, email, or admin…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <RowSkeleton rows={5} />
        ) : filteredSchools.length === 0 ? (
          <EmptyState title="No schools found" description="Try adjusting your search or filters, or add a new school." icon={<Building2 className="h-10 w-10" />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-ink-muted">
                  <th className="pb-2 pr-4 font-medium">School</th>
                  <th className="pb-2 pr-4 font-medium text-center">Students</th>
                  <th className="pb-2 pr-4 font-medium text-center">Staff</th>
                  <th className="pb-2 pr-4 font-medium text-center">Parents</th>
                  <th className="pb-2 pr-4 font-medium">Plan</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Invitation</th>
                  <th className="pb-2 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSchools.map((s) => {
                  const b = statusBadge(s.status === 'pending' ? 'scheduled' : s.status);
                  const inv = invitationMap[s.id] ?? null;
                  return (
                    <tr key={s.id} className="text-ink-soft dark:text-slate-300">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-light">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink dark:text-slate-100">{s.name}</p>
                            <p className="truncate text-xs text-ink-muted">{s.email ?? 'No email'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-center font-medium">{s.student_count}</td>
                      <td className="py-3 pr-4 text-center font-medium">{s.teacher_count}</td>
                      <td className="py-3 pr-4 text-center font-medium">{s.parent_count}</td>
                      <td className="py-3 pr-4"><span className="capitalize text-xs">{s.plan ?? '—'}</span></td>
                      <td className="py-3 pr-4"><Badge variant={b.variant}>{b.label}</Badge></td>
                      <td className="py-3 pr-4">
                        {inv ? (
                          <Badge variant={invBadgeVariant(inv.status)} className="capitalize">{inv.status}</Badge>
                        ) : (
                          <span className="text-xs text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setDetailSchool(s)} className="rounded-lg p-1.5 transition-colors hover:bg-surface-overlay text-ink-muted" title="View details">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 transition-colors hover:bg-surface-overlay text-ink-muted" title="Edit school">
                            <Pencil className="h-4 w-4" />
                          </button>
                          {s.admin_email && (
                            <button
                              onClick={() => setResendTarget(s)}
                              className="rounded-lg p-1.5 transition-colors hover:bg-primary-50 hover:text-primary-600 text-ink-muted"
                              title="Resend invitation"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => toggleSchoolStatus(s)}
                            disabled={actionLoading}
                            className={cn('rounded-lg p-1.5 transition-colors', s.status === 'suspended' ? 'text-success-soft-text hover:bg-success-soft' : 'text-error-soft-text hover:bg-error-soft')}
                            title={s.status === 'suspended' ? 'Activate' : 'Suspend'}
                          >
                            {s.status === 'suspended' ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(s)}
                            className="rounded-lg p-1.5 transition-colors hover:bg-rose-50 hover:text-rose-600 text-ink-muted"
                            title="Delete school"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add School Modal */}
      <Modal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); setFormErrors({}); }}
        title="Add New School"
        description="Register a new school on the platform"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowAddModal(false); setFormErrors({}); }}>Cancel</Button>
            <Button onClick={handleCreateSchool} loading={creating} leftIcon={<Plus className="h-4 w-4" />}>Create School</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="School Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={formErrors.name}
              placeholder="e.g. Greenfield Academy"
            />
            <Input
              label="School Email *"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={formErrors.email}
              placeholder="info@school.com"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1 555 000 0000"
            />
            <Input
              label="Principal Name *"
              value={form.principal_name}
              onChange={(e) => setForm({ ...form, principal_name: e.target.value })}
              error={formErrors.principal_name}
              placeholder="Dr. Jane Doe"
            />
          </div>
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="123 Education Road, City"
          />
          <div className="border-t border-surface-border pt-4">
            <p className="text-sm font-medium text-ink mb-3">School Admin Contact (optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Admin Name"
                value={form.admin_name}
                onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
                placeholder="John Smith"
              />
              <Input
                label="Admin Email"
                type="email"
                value={form.admin_email}
                onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                error={formErrors.admin_email}
                placeholder="admin@school.com"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <Input
                label="Admin Phone"
                value={form.admin_phone}
                onChange={(e) => setForm({ ...form, admin_phone: e.target.value })}
                error={formErrors.admin_phone}
                placeholder="+1 555 000 0000"
              />
              <Select
                label="Subscription Plan"
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
              >
                <option value="starter">Starter (500 students)</option>
                <option value="growth">Growth (1,500 students)</option>
                <option value="enterprise">Enterprise (5,000 students)</option>
              </Select>
            </div>
          </div>
          <div className="border-t border-surface-border pt-4">
            <Select
              label="Initial Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="pending">Trial (pending)</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Select>
          </div>

          {(form.admin_email.trim() || form.admin_phone.trim()) && (
            <div className="rounded-xl border border-surface-border p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-ink dark:text-slate-100">
                <input type="checkbox" checked={form.send_invite} onChange={(e) => setForm({ ...form, send_invite: e.target.checked })} className="rounded" />
                <Send className="h-4 w-4 text-primary-600" />
                Send invitation to school admin
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
                      ? `An invitation email with a login link will be sent to ${form.admin_email || 'the admin email above'}.`
                      : `An SMS with a login link will be sent to ${form.admin_phone || 'the admin phone above'}.`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal
        open={!!successModal}
        onClose={() => setSuccessModal(null)}
        title="School Created Successfully"
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
                <strong>{successModal.schoolName}</strong> has been created and <strong>{successModal.adminName}</strong> has been set up as the School Admin.
              </p>
            </div>

            {successModal.emailSent ? (
              <div className="rounded-lg bg-success-soft p-3 text-center">
                <p className="text-sm text-success-soft-text">Invitation email sent successfully to {successModal.adminEmail}</p>
              </div>
            ) : successModal.smsSent ? (
              <div className="rounded-lg bg-success-soft p-3 text-center">
                <p className="text-sm text-success-soft-text">Invitation SMS sent successfully</p>
              </div>
            ) : successModal.inviteLink ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Email delivery failed{successModal.sendError ? `: ${successModal.sendError}` : ''}. Share this link:
                  </p>
                </div>
                <button
                  onClick={() => {
                    const path = new URL(successModal.inviteLink!).pathname;
                    navigate(path);
                  }}
                  className="btn btn-primary w-full justify-center text-sm"
                >
                  Register Now
                </button>
              </div>
            ) : null}

            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 space-y-2">
              <p className="text-xs text-ink-muted">Share these credentials as a fallback:</p>
              <div>
                <p className="text-xs text-ink-muted">Email</p>
                <p className="font-mono text-sm text-ink dark:text-slate-100">{successModal.credentials.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">Password</p>
                <p className="font-mono text-sm text-ink dark:text-slate-100">{successModal.credentials.password}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit School Modal */}
      <Modal
        open={!!editSchool}
        onClose={() => setEditSchool(null)}
        title="Edit School"
        description={editSchool?.name}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditSchool(null)}>Cancel</Button>
            <Button onClick={saveEdit} loading={savingEdit}>Save Changes</Button>
          </>
        }
      >
        {editSchool && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="School Name *" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} error={editErrors.name} />
              <Input label="School Email *" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} error={editErrors.email} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              <Input label="Principal Name" value={editForm.principal_name} onChange={(e) => setEditForm({ ...editForm, principal_name: e.target.value })} />
            </div>
            <Input label="Address" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
            <div className="border-t border-surface-border pt-4">
              <p className="text-sm font-medium text-ink mb-3">School Admin Contact</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Admin Name" value={editForm.admin_name} onChange={(e) => setEditForm({ ...editForm, admin_name: e.target.value })} />
                <Input label="Admin Email" type="email" value={editForm.admin_email} onChange={(e) => setEditForm({ ...editForm, admin_email: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <Input label="Admin Phone" value={editForm.admin_phone} onChange={(e) => setEditForm({ ...editForm, admin_phone: e.target.value })} />
                <Select label="Status" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="pending">Trial (pending)</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </Select>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete School"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This will also remove related subscriptions and invitations.`}
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

      {/* Resend Invitation Confirmation */}
      <Modal
        open={!!resendTarget}
        onClose={() => setResendTarget(null)}
        title="Resend Invitation"
        description={`Send a new invitation to ${resendTarget?.admin_email ?? resendTarget?.admin_name ?? 'the school admin'}?`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResendTarget(null)}>Cancel</Button>
            <Button loading={resending} onClick={resendInvitation} leftIcon={<RefreshCw className="h-4 w-4" />}>Resend</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">A new secure invitation link will be generated and sent via email. The old link will remain valid until it expires.</p>
      </Modal>

      {/* School Detail Modal */}
      <Modal
        open={!!detailSchool}
        onClose={() => setDetailSchool(null)}
        title={detailSchool?.name ?? 'School Details'}
        description="School overview and management"
        size="lg"
        footer={
          detailSchool && (
            <Button
              variant={detailSchool.status === 'suspended' ? 'success' : 'danger'}
              onClick={() => toggleSchoolStatus(detailSchool)}
              loading={actionLoading}
              leftIcon={detailSchool.status === 'suspended' ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
            >
              {detailSchool.status === 'suspended' ? 'Activate School' : 'Suspend School'}
            </Button>
          )
        }
      >
        {detailSchool && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-primary-soft p-4 text-center">
                <GraduationCap className="h-5 w-5 mx-auto text-primary-light mb-1" />
                <p className="text-2xl font-bold text-ink">{detailSchool.student_count}</p>
                <p className="text-xs text-ink-muted">Students</p>
              </div>
              <div className="rounded-xl bg-success-soft p-4 text-center">
                <UserCog className="h-5 w-5 mx-auto text-success-soft-text mb-1" />
                <p className="text-2xl font-bold text-ink">{detailSchool.teacher_count}</p>
                <p className="text-xs text-ink-muted">Staff</p>
              </div>
              <div className="rounded-xl bg-warning-soft p-4 text-center">
                <Users className="h-5 w-5 mx-auto text-warning-soft-text mb-1" />
                <p className="text-2xl font-bold text-ink">{detailSchool.parent_count}</p>
                <p className="text-xs text-ink-muted">Parents</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-ink-muted" />
                <span className="text-ink-muted">Email:</span>
                <span className="text-ink">{detailSchool.email ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-ink-muted" />
                <span className="text-ink-muted">Phone:</span>
                <span className="text-ink">{detailSchool.phone ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-ink-muted" />
                <span className="text-ink-muted">Address:</span>
                <span className="text-ink">{detailSchool.address ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-ink-muted" />
                <span className="text-ink-muted">Principal:</span>
                <span className="text-ink">{detailSchool.principal_name ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-ink-muted" />
                <span className="text-ink-muted">Admin:</span>
                <span className="text-ink">{detailSchool.admin_name ?? '—'} ({detailSchool.admin_email ?? '—'})</span>
              </div>
            </div>

            {/* Invitation Status */}
            {invitationMap[detailSchool.id] && (
              <div className="rounded-xl border border-surface-border p-4 space-y-2">
                <p className="text-sm font-medium text-ink">Invitation Status</p>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-muted">Status</span>
                  <Badge variant={invBadgeVariant(invitationMap[detailSchool.id]!.status)} className="capitalize">{invitationMap[detailSchool.id]!.status}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-muted">Channel</span>
                  <span className="capitalize text-ink">{invitationMap[detailSchool.id]!.channel}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-muted">Sent</span>
                  <span className="text-ink">{formatDate(invitationMap[detailSchool.id]!.created_at)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-muted">Expires</span>
                  <span className="text-ink">{formatDate(invitationMap[detailSchool.id]!.expires_at)}</span>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-surface-border p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Subscription Plan</span>
                <span className="capitalize font-medium text-ink">{detailSchool.plan ?? 'No subscription'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Subscription Status</span>
                <Badge variant={detailSchool.sub_status === 'active' ? 'success' : 'secondary'}>{detailSchool.sub_status ?? 'None'}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">School Status</span>
                <Badge variant={statusBadge(detailSchool.status === 'pending' ? 'scheduled' : detailSchool.status).variant}>
                  {detailSchool.status}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Joined</span>
                <span className="text-ink">{formatDate(detailSchool.created_at)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
