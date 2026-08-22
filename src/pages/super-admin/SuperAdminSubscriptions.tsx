import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { RowSkeleton, CardSkeleton } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { DollarSign, TrendingUp, Clock, CircleCheck as CheckCircle2, CreditCard, Search, CreditCard as Edit2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { School } from '@/types';

interface Subscription {
  id: string;
  school_id: string;
  plan: string;
  status: string;
  seats: number;
  student_limit: number;
  billing_cycle: string;
  amount: number;
  currency: string;
  trial_ends_at: string | null;
  renews_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SubWithSchool extends Subscription {
  school_name: string;
}

export function SuperAdminSubscriptions() {
  const { toast } = useToast();
  const [subs, setSubs] = useState<SubWithSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editSub, setEditSub] = useState<SubWithSchool | null>(null);
  const [editForm, setEditForm] = useState({ plan: 'starter', status: 'trial', billing_cycle: 'monthly', amount: 0, student_limit: 500, seats: 50 });
  const [saving, setSaving] = useState(false);

  const loadSubs = useCallback(async () => {
    setLoading(true);
    const [subRes, schoolRes] = await Promise.all([
      supabase.from('subscriptions').select('*').order('created_at', { ascending: false }),
      supabase.from('schools').select('id, name'),
    ]);

    const schoolMap: Record<string, string> = {};
    ((schoolRes.data as School[]) ?? []).forEach((s) => { schoolMap[s.id] = s.name; });

    const enriched = ((subRes.data as Subscription[]) ?? []).map((s) => ({
      ...s,
      school_name: schoolMap[s.school_id] ?? 'Unknown School',
    }));
    setSubs(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { loadSubs(); }, [loadSubs]);

  const filteredSubs = useMemo(() => {
    let list = subs;
    if (statusFilter !== 'all') list = list.filter((s) => s.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.school_name.toLowerCase().includes(q) || (s.plan ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [subs, search, statusFilter]);

  const revenue = useMemo(() => {
    let monthly = 0;
    let total = 0;
    let active = 0;
    let trial = 0;
    subs.forEach((s) => {
      const amt = s.amount ?? 0;
      total += amt;
      monthly += s.billing_cycle === 'annual' ? amt / 12 : amt;
      if (s.status === 'active') active++;
      if (s.status === 'trial') trial++;
    });
    return { monthly, total, active, trial };
  }, [subs]);

  const openEdit = (sub: SubWithSchool) => {
    setEditSub(sub);
    setEditForm({
      plan: sub.plan,
      status: sub.status,
      billing_cycle: sub.billing_cycle,
      amount: sub.amount,
      student_limit: sub.student_limit,
      seats: sub.seats,
    });
  };

  const saveEdit = async () => {
    if (!editSub) return;
    setSaving(true);
    const { error } = await supabase.from('subscriptions').update({
      plan: editForm.plan,
      status: editForm.status,
      billing_cycle: editForm.billing_cycle,
      amount: editForm.amount,
      student_limit: editForm.student_limit,
      seats: editForm.seats,
      updated_at: new Date().toISOString(),
    }).eq('id', editSub.id);

    if (error) {
      toast(`Failed to update subscription: ${error.message}`, 'error');
    } else {
      toast('Subscription updated', 'success');
      setSubs((prev) => prev.map((s) => s.id === editSub.id ? { ...s, ...editForm } : s));
      setEditSub(null);
    }
    setSaving(false);
  };

  const planBadgeVariant = (plan: string) => {
    if (plan === 'enterprise') return 'primary' as const;
    if (plan === 'pro') return 'success' as const;
    return 'secondary' as const;
  };

  const statusBadgeVariant = (status: string) => {
    if (status === 'active') return 'success' as const;
    if (status === 'trial') return 'warning' as const;
    if (status === 'past_due') return 'error' as const;
    return 'secondary' as const;
  };

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        subtitle="Revenue and billing management"
        icon={<CreditCard className="h-6 w-6" />}
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Monthly Revenue" value={`$${revenue.monthly.toFixed(0)}`} icon={<DollarSign className="h-6 w-6 text-success-soft-text" />} accent="bg-success-soft" />
          <StatCard label="Total Billed" value={`$${revenue.total.toFixed(0)}`} icon={<TrendingUp className="h-6 w-6 text-primary-light" />} accent="bg-primary-soft" />
          <StatCard label="Active Subs" value={revenue.active} icon={<CheckCircle2 className="h-6 w-6 text-success-soft-text" />} accent="bg-success-soft" />
          <StatCard label="On Trial" value={revenue.trial} icon={<Clock className="h-6 w-6 text-warning-soft-text" />} accent="bg-warning-soft" />
        </div>
      )}

      <Card>
        <CardHeader
          title="All Subscriptions"
          subtitle={`${filteredSubs.length} subscription${filteredSubs.length !== 1 ? 's' : ''}`}
          action={
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input text-sm py-1.5 px-2">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="past_due">Past Due</option>
              <option value="cancelled">Cancelled</option>
            </select>
          }
        />
        <div className="mb-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input className="input text-sm pl-9" placeholder="Search by school or plan…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <RowSkeleton rows={5} />
        ) : filteredSubs.length === 0 ? (
          <EmptyState title="No subscriptions found" description="Subscriptions will appear here when schools sign up." icon={<CreditCard className="h-10 w-10" />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-ink-muted">
                  <th className="pb-2 pr-4 font-medium">School</th>
                  <th className="pb-2 pr-4 font-medium">Plan</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium text-center">Amount</th>
                  <th className="pb-2 pr-4 font-medium text-center">Cycle</th>
                  <th className="pb-2 pr-4 font-medium text-center">Students</th>
                  <th className="pb-2 pr-4 font-medium">Renews</th>
                  <th className="pb-2 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSubs.map((s) => (
                  <tr key={s.id} className="text-ink-soft dark:text-slate-300">
                    <td className="py-3 pr-4 font-medium text-ink dark:text-slate-100">{s.school_name}</td>
                    <td className="py-3 pr-4"><Badge variant={planBadgeVariant(s.plan)} className="capitalize">{s.plan}</Badge></td>
                    <td className="py-3 pr-4"><Badge variant={statusBadgeVariant(s.status)} className="capitalize">{s.status}</Badge></td>
                    <td className="py-3 pr-4 text-center font-medium">${(s.amount ?? 0).toFixed(0)}<span className="text-xs text-ink-muted"> {s.currency}</span></td>
                    <td className="py-3 pr-4 text-center capitalize text-xs">{s.billing_cycle}</td>
                    <td className="py-3 pr-4 text-center">{s.student_limit}</td>
                    <td className="py-3 pr-4 text-xs text-ink-muted">{s.renews_at ? formatDate(s.renews_at) : '—'}</td>
                    <td className="py-3 pr-4 text-right">
                      <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 transition-colors hover:bg-surface-overlay text-ink-muted" title="Edit subscription">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!editSub}
        onClose={() => setEditSub(null)}
        title="Edit Subscription"
        description={editSub?.school_name}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditSub(null)}>Cancel</Button>
            <Button onClick={saveEdit} loading={saving}>Save Changes</Button>
          </>
        }
      >
        {editSub && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Plan</label>
              <select value={editForm.plan} onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })} className="input">
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Status</label>
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="input">
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="past_due">Past Due</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Billing Cycle</label>
              <select value={editForm.billing_cycle} onChange={(e) => setEditForm({ ...editForm, billing_cycle: e.target.value })} className="input">
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Amount ({editSub.currency})</label>
                <input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Student Limit</label>
                <input type="number" value={editForm.student_limit} onChange={(e) => setEditForm({ ...editForm, student_limit: Number(e.target.value) })} className="input" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Seats (Staff)</label>
              <input type="number" value={editForm.seats} onChange={(e) => setEditForm({ ...editForm, seats: Number(e.target.value) })} className="input" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
