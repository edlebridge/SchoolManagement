import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { RowSkeleton } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Users, Search, UserCog, GraduationCap, Building2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { AppUser, School } from '@/types';

export function SuperAdminUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('all');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const [userRes, schoolRes] = await Promise.all([
      supabase.from('app_users').select('*').order('created_at', { ascending: false }),
      supabase.from('schools').select('id, name'),
    ]);
    setUsers((userRes.data as AppUser[]) ?? []);
    setSchools((schoolRes.data as School[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const schoolMap = useMemo(() => {
    const m: Record<string, string> = {};
    schools.forEach((s) => { m[s.id] = s.name; });
    return m;
  }, [schools]);

  const filteredUsers = useMemo(() => {
    let list = users;
    if (roleFilter !== 'all') list = list.filter((u) => u.role === roleFilter);
    if (schoolFilter !== 'all') list = list.filter((u) => u.school_id === schoolFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) => u.full_name.toLowerCase().includes(q) || (u.phone ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [users, search, roleFilter, schoolFilter]);

  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter((u) => u.role === 'school_admin').length,
    teachers: users.filter((u) => u.role === 'teacher').length,
    parents: users.filter((u) => u.role === 'parent').length,
  }), [users]);

  const roleBadgeVariant = (role: string) => {
    if (role === 'super_admin') return 'primary' as const;
    if (role === 'school_admin') return 'success' as const;
    if (role === 'teacher') return 'warning' as const;
    return 'secondary' as const;
  };

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="All users across the platform"
        icon={<Users className="h-6 w-6" />}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-ink">{stats.total}</p>
          <p className="text-xs text-ink-muted mt-1">Total Users</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-success-soft-text">{stats.admins}</p>
          <p className="text-xs text-ink-muted mt-1">School Admins</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-warning-soft-text">{stats.teachers}</p>
          <p className="text-xs text-ink-muted mt-1">Teachers</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-primary-light">{stats.parents}</p>
          <p className="text-xs text-ink-muted mt-1">Parents</p>
        </div>
      </div>

      <Card>
        <CardHeader
          title="All Users"
          subtitle={`${filteredUsers.length} user${filteredUsers.length !== 1 ? 's' : ''}`}
          action={
            <div className="flex items-center gap-2">
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input text-sm py-1.5 px-2">
                <option value="all">All roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="school_admin">School Admin</option>
                <option value="teacher">Teacher</option>
                <option value="parent">Parent</option>
              </select>
              <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className="input text-sm py-1.5 px-2">
                <option value="all">All schools</option>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          }
        />
        <div className="mb-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input className="input text-sm pl-9" placeholder="Search by name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <RowSkeleton rows={8} />
        ) : filteredUsers.length === 0 ? (
          <EmptyState title="No users found" description="Try adjusting your search or filters." icon={<Users className="h-10 w-10" />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-ink-muted">
                  <th className="pb-2 pr-4 font-medium">User</th>
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 pr-4 font-medium">School</th>
                  <th className="pb-2 pr-4 font-medium">Phone</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="text-ink-soft dark:text-slate-300">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.full_name} src={u.avatar_url} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink dark:text-slate-100">{u.full_name}</p>
                          <p className="truncate text-xs text-ink-muted">{u.phone ?? 'No phone'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4"><Badge variant={roleBadgeVariant(u.role)} className="capitalize">{u.role.replace('_', ' ')}</Badge></td>
                    <td className="py-3 pr-4">
                      {u.school_id ? (
                        <span className="flex items-center gap-1.5 text-xs">
                          <Building2 className="h-3.5 w-3.5 text-ink-muted" />
                          {schoolMap[u.school_id] ?? 'Unknown'}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-muted">Platform</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs">{u.phone ?? '—'}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={u.active ? 'success' : 'secondary'}>{u.active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-xs text-ink-muted">{formatDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
