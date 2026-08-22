import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { RowSkeleton, CardSkeleton } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { LayoutDashboard, Building2, GraduationCap, Users, UserCog, TrendingUp, DollarSign, Activity, ChevronRight, Clock } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import type { School, AppUser } from '@/types';

interface SchoolWithCounts extends School {
  student_count: number;
  teacher_count: number;
  parent_count: number;
}

interface ActivityLog {
  id: string;
  school_id: string | null;
  actor_role: string | null;
  action: string;
  entity: string | null;
  created_at: string;
}

export function SuperAdminDashboard() {
  const { profile } = useAuth();
  const [schools, setSchools] = useState<SchoolWithCounts[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalTeachers, setTotalTeachers] = useState(0);
  const [totalParents, setTotalParents] = useState(0);
  const [recentUsers, setRecentUsers] = useState<AppUser[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState({ total: 0, monthly: 0, active: 0, trial: 0 });
  const [sortField, setSortField] = useState<'created_at' | 'student_count' | 'teacher_count'>('created_at');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const [sRes, uRes, stRes, tRes, pRes, recentRes, actRes] = await Promise.all([
        supabase.from('schools').select('*').order('created_at', { ascending: false }),
        supabase.from('app_users').select('id', { count: 'exact', head: true }),
        supabase.from('students').select('id', { count: 'exact', head: true }),
        supabase.from('app_users').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
        supabase.from('app_users').select('id', { count: 'exact', head: true }).eq('role', 'parent'),
        supabase.from('app_users').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('audit_logs').select('id, school_id, actor_role, action, entity, created_at').order('created_at', { ascending: false }).limit(8),
      ]);

      const allSchools = (sRes.data as School[]) ?? [];
      setTotalUsers(uRes.count ?? 0);
      setTotalStudents(stRes.count ?? 0);
      setTotalTeachers(tRes.count ?? 0);
      setTotalParents(pRes.count ?? 0);
      setRecentUsers((recentRes.data as AppUser[]) ?? []);
      setActivity((actRes.data as ActivityLog[]) ?? []);

      // Get per-school counts
      const schoolIds = allSchools.map((s) => s.id);
      if (schoolIds.length > 0) {
        const [sc, tc, pc] = await Promise.all([
          supabase.from('students').select('school_id').in('school_id', schoolIds),
          supabase.from('app_users').select('school_id').eq('role', 'teacher').in('school_id', schoolIds),
          supabase.from('app_users').select('school_id').eq('role', 'parent').in('school_id', schoolIds),
        ]);

        const studentCounts: Record<string, number> = {};
        (sc.data ?? []).forEach((r: { school_id: string }) => { studentCounts[r.school_id] = (studentCounts[r.school_id] ?? 0) + 1; });
        const teacherCounts: Record<string, number> = {};
        (tc.data ?? []).forEach((r: { school_id: string }) => { teacherCounts[r.school_id] = (teacherCounts[r.school_id] ?? 0) + 1; });
        const parentCounts: Record<string, number> = {};
        (pc.data ?? []).forEach((r: { school_id: string }) => { parentCounts[r.school_id] = (parentCounts[r.school_id] ?? 0) + 1; });

        const enriched = allSchools.map((s) => ({
          ...s,
          student_count: studentCounts[s.id] ?? 0,
          teacher_count: teacherCounts[s.id] ?? 0,
          parent_count: parentCounts[s.id] ?? 0,
        }));
        setSchools(enriched);

        // Revenue calc from subscriptions
        const { data: subs } = await supabase.from('subscriptions').select('school_id, plan, status, amount, billing_cycle').in('school_id', schoolIds);
        let totalRev = 0;
        let monthlyRev = 0;
        let activeCount = 0;
        let trialCount = 0;
        (subs ?? []).forEach((sub: { plan: string; status: string; amount: number; billing_cycle: string }) => {
          const amt = sub.amount ?? 0;
          totalRev += amt;
          monthlyRev += sub.billing_cycle === 'annual' ? amt / 12 : amt;
          if (sub.status === 'active') activeCount++;
          if (sub.status === 'trial') trialCount++;
        });
        setRevenue({ total: totalRev, monthly: monthlyRev, active: activeCount, trial: trialCount });
      } else {
        setSchools([]);
      }

      setLoading(false);
    })();
  }, []);

  const filteredSchools = useMemo(() => {
    if (!search.trim()) return schools;
    const q = search.toLowerCase();
    return schools.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.email ?? '').toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q)
    );
  }, [schools, search]);

  const sortedSchools = useMemo(() => {
    const sorted = [...filteredSchools];
    sorted.sort((a, b) => {
      if (sortField === 'created_at') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return (b[sortField] as number) - (a[sortField] as number);
    });
    return sorted;
  }, [filteredSchools, sortField]);

  const schoolMap = useMemo(() => {
    const m: Record<string, School> = {};
    schools.forEach((s) => { m[s.id] = s; });
    return m;
  }, [schools]);

  const activeSchools = schools.filter((s) => s.status === 'active').length;
  const trialSchools = schools.filter((s) => s.status === 'pending').length;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${profile?.full_name?.split(' ')[0] ?? 'Owner'}`}
        subtitle="EduBridge Platform Overview"
        icon={<LayoutDashboard className="h-6 w-6" />}
      />

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Schools" value={schools.length} icon={<Building2 className="h-6 w-6 text-primary-light" />} accent="bg-primary-soft" />
          <StatCard label="Total Users" value={totalUsers} icon={<Users className="h-6 w-6 text-success-soft-text" />} accent="bg-success-soft" />
          <StatCard label="Total Students" value={totalStudents} icon={<GraduationCap className="h-6 w-6 text-warning-soft-text" />} accent="bg-warning-soft" />
          <StatCard label="Monthly Revenue" value={`$${revenue.monthly.toFixed(0)}`} icon={<DollarSign className="h-6 w-6 text-info-soft-text" />} accent="bg-info-soft" />
        </div>
      )}

      {/* Secondary KPIs */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Teachers" value={totalTeachers} icon={<UserCog className="h-5 w-5 text-primary-light" />} accent="bg-primary-soft" />
        <StatCard label="Parents" value={totalParents} icon={<Users className="h-5 w-5 text-success-soft-text" />} accent="bg-success-soft" />
        <StatCard label="Active Schools" value={activeSchools} icon={<TrendingUp className="h-5 w-5 text-success-soft-text" />} accent="bg-success-soft" />
        <StatCard label="Trial Schools" value={trialSchools} icon={<Clock className="h-5 w-5 text-warning-soft-text" />} accent="bg-warning-soft" />
      </div>

      {/* Schools Table + Activity Feed */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Schools — spans 2 columns */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Registered Schools"
              subtitle="All schools on the platform"
              action={
                <div className="flex items-center gap-2">
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as typeof sortField)}
                    className="input text-sm py-1.5 px-2"
                  >
                    <option value="created_at">Newest first</option>
                    <option value="student_count">Most students</option>
                    <option value="teacher_count">Most teachers</option>
                  </select>
                </div>
              }
            />
            <div className="mb-3 relative">
              <input
                className="input text-sm"
                placeholder="Search schools…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading ? (
              <RowSkeleton rows={5} />
            ) : sortedSchools.length === 0 ? (
              <p className="text-sm text-ink-muted py-6 text-center">No schools found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-ink-muted">
                      <th className="pb-2 pr-4 font-medium">School</th>
                      <th className="pb-2 pr-4 font-medium text-center">Students</th>
                      <th className="pb-2 pr-4 font-medium text-center">Staff</th>
                      <th className="pb-2 pr-4 font-medium text-center">Parents</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 pr-4 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sortedSchools.map((s) => {
                      const b = statusBadge(s.status);
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
                          <td className="py-3 pr-4"><Badge variant={b.variant}>{b.label}</Badge></td>
                          <td className="py-3 pr-4 text-xs text-ink-muted">{formatDate(s.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Activity Feed + Recent Users */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Recent Activity" subtitle="Latest platform events" />
            {loading ? (
              <RowSkeleton rows={4} />
            ) : activity.length === 0 ? (
              <p className="text-sm text-ink-muted py-4 text-center">No recent activity.</p>
            ) : (
              <div className="space-y-3">
                {activity.map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5">
                    <div className={cn(
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                      log.actor_role === 'super_admin' ? 'bg-primary-soft text-primary-light' :
                      log.actor_role === 'school_admin' ? 'bg-success-soft text-success-soft-text' :
                      'bg-slate-100 text-ink-muted dark:bg-slate-800'
                    )}>
                      <Activity className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-ink dark:text-slate-100">{log.action}</p>
                      <p className="text-xs text-ink-muted">
                        {log.school_id && schoolMap[log.school_id]?.name ? schoolMap[log.school_id].name : 'Platform'}
                        {log.actor_role ? ` · ${log.actor_role}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="New Users" subtitle="Recently joined" />
            {loading ? (
              <RowSkeleton rows={3} />
            ) : recentUsers.length === 0 ? (
              <p className="text-sm text-ink-muted py-4 text-center">No recent users.</p>
            ) : (
              <div className="space-y-2.5">
                {recentUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2.5">
                    <Avatar name={u.full_name} src={u.avatar_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink dark:text-slate-100">{u.full_name}</p>
                      <p className="text-xs text-ink-muted capitalize">{u.role}</p>
                    </div>
                    <span className="text-xs text-ink-muted">{formatDate(u.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
