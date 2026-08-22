import { useEffect, useState, useMemo, useCallback } from 'react';
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
import { Building2, Search, Ban, CircleCheck as CheckCircle2, Eye, Phone, Mail, MapPin, Users, GraduationCap, UserCog, Plus, Send, Check } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import type { School } from '@/types';

interface SchoolWithCounts extends School {
  student_count: number;
  teacher_count: number;
  parent_count: number;
  plan: string | null;
  sub_status: string | null;
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
};

export function SuperAdminSchools() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [schools, setSchools] = useState<SchoolWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailSchool, setDetailSchool] = useState<SchoolWithCounts | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<AddSchoolForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [successModal, setSuccessModal] = useState<{ schoolName: string; adminName: string; adminEmail: string; inviteLink: string | null; sendUrl: string | null; credentials: { email: string; password: string } } | null>(null);

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

    const [sc, tc, pc, subs] = await Promise.all([
      supabase.from('students').select('school_id').in('school_id', schoolIds),
      supabase.from('app_users').select('school_id').eq('role', 'teacher').in('school_id', schoolIds),
      supabase.from('app_users').select('school_id').eq('role', 'parent').in('school_id', schoolIds),
      supabase.from('subscriptions').select('school_id, plan, status').in('school_id', schoolIds),
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
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
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
        currency: 'KES',
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
    let sendUrl: string | null = null;
    const adminEmail = form.admin_email.trim();
    const adminName = form.admin_name.trim() || form.principal_name.trim();
    const DEFAULT_PASSWORD = 'Password123!';

    if (adminEmail) {
      try {
        // Create the school admin auth user + profile via edge function
        const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-create-user`;
        const session = await supabase.auth.getSession();
        const fnRes = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session?.access_token}`,
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
        } else {
          // Send invitation link
          if (form.send_invite) {
            const invUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation`;
            const invRes = await fetch(invUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.data.session?.access_token}`,
              },
              body: JSON.stringify({
                schoolId,
                recipientName: adminName,
                recipientEmail: adminEmail,
                recipientPhone: form.admin_phone || null,
                role: 'school_admin',
                channel: 'email',
                appOrigin: window.location.origin,
                metadata: { school_name: form.name },
              }),
            });

            if (invRes.ok) {
              const invData = await invRes.json();
              inviteLink = invData.inviteLink as string;
              const subject = `You're invited to manage ${form.name} on EduBridge`;
              const bodyText = `Hi ${adminName},\n\nYou've been set up as the School Admin for ${form.name} on EduBridge.\n\nYour login credentials:\nEmail: ${adminEmail}\nPassword: ${DEFAULT_PASSWORD}\n\nOr click the link below to activate your account:\n${inviteLink}\n\nThis invitation expires in 7 days.`;
              sendUrl = `mailto:${adminEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
            }
          }

          setSuccessModal({
            schoolName: form.name,
            adminName,
            adminEmail,
            inviteLink,
            sendUrl,
            credentials: { email: adminEmail, password: DEFAULT_PASSWORD },
          });
        }
      } catch {
        toast('School created, but invitation sending failed', 'error');
      }
    }

    toast(`${form.name} created successfully`, 'success');
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowAddModal(false);
    setCreating(false);
    loadSchools();
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
                  <th className="pb-2 pr-4 font-medium">Joined</th>
                  <th className="pb-2 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSchools.map((s) => {
                  const b = statusBadge(s.status === 'pending' ? 'scheduled' : s.status);
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
                      <td className="py-3 pr-4 text-xs text-ink-muted">{formatDate(s.created_at)}</td>
                      <td className="py-3 pr-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setDetailSchool(s)} className="rounded-lg p-1.5 transition-colors hover:bg-surface-overlay text-ink-muted" title="View details">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => toggleSchoolStatus(s)}
                            disabled={actionLoading}
                            className={cn('rounded-lg p-1.5 transition-colors', s.status === 'suspended' ? 'text-success-soft-text hover:bg-success-soft' : 'text-error-soft-text hover:bg-error-soft')}
                            title={s.status === 'suspended' ? 'Activate' : 'Suspend'}
                          >
                            {s.status === 'suspended' ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
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
              placeholder="+254 700 000 000"
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
                placeholder="admin@school.com"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <Input
                label="Admin Phone"
                value={form.admin_phone}
                onChange={(e) => setForm({ ...form, admin_phone: e.target.value })}
                placeholder="+254 700 000 000"
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

          {form.admin_email.trim() && (
            <div className="rounded-xl border border-surface-border p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-ink dark:text-slate-100">
                <input type="checkbox" checked={form.send_invite} onChange={(e) => setForm({ ...form, send_invite: e.target.checked })} className="rounded" />
                <Send className="h-4 w-4 text-primary-600" />
                Send invitation link to school admin
              </label>
              <p className="text-xs text-ink-muted ml-6">
                An invitation email with a login link and credentials will be generated for {form.admin_email}.
              </p>
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

            {successModal.sendUrl && successModal.inviteLink ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-primary-50 dark:bg-primary-500/10 p-3 space-y-2">
                  <p className="text-sm text-primary-600 dark:text-primary-light">
                    Invitation link created for email.
                  </p>
                  <div className="rounded bg-white dark:bg-slate-800 p-2">
                    <p className="text-xs text-ink-muted break-all font-mono">{successModal.inviteLink}</p>
                  </div>
                </div>
                <a href={successModal.sendUrl} className="btn btn-primary w-full justify-center text-sm">
                  <Send className="h-4 w-4" />
                  Open Email App to Send
                </a>
                <p className="text-xs text-ink-muted text-center">
                  This opens your email app with the invitation pre-written. Just hit send.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 space-y-2">
                <p className="text-sm text-amber-700 dark:text-amber-400 text-center">Share these credentials with the school admin:</p>
                <div className="rounded bg-white dark:bg-slate-800 p-2">
                  <p className="text-xs text-ink-muted">Email</p>
                  <p className="font-mono text-sm text-ink dark:text-slate-100">{successModal.credentials.email}</p>
                </div>
                <div className="rounded bg-white dark:bg-slate-800 p-2">
                  <p className="text-xs text-ink-muted">Password</p>
                  <p className="font-mono text-sm text-ink dark:text-slate-100">{successModal.credentials.password}</p>
                </div>
              </div>
            )}
          </div>
        )}
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
