import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { RowSkeleton } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScrollText, Search, Activity, ChevronDown, ChevronRight, User, Building2, Hash } from 'lucide-react';
import { relativeTime, formatDate, cn } from '@/lib/utils';
import type { School, AppUser } from '@/types';

interface AuditLog {
  id: string;
  school_id: string | null;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

interface AuditLogWithActor extends AuditLog {
  actor_name?: string | null;
}

export function SuperAdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLogWithActor[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const [logRes, schoolRes] = await Promise.all([
      supabase
        .from('audit_logs')
        .select('id, school_id, actor_id, actor_role, action, entity, entity_id, detail, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('schools').select('id, name'),
    ]);

    const logData = (logRes.data as AuditLog[]) ?? [];
    const schoolData = (schoolRes.data as School[]) ?? [];
    setSchools(schoolData);

    // Resolve actor names
    const actorIds = [...new Set(logData.map((l) => l.actor_id).filter(Boolean))] as string[];
    let actorMap: Record<string, string> = {};
    if (actorIds.length > 0) {
      const { data: actors } = await supabase
        .from('app_users')
        .select('user_id, full_name')
        .in('user_id', actorIds);
      (actors as Pick<AppUser, 'user_id' | 'full_name'>[] | null)?.forEach((a) => {
        actorMap[a.user_id] = a.full_name;
      });
    }

    setLogs(logData.map((l) => ({
      ...l,
      actor_name: l.actor_id ? actorMap[l.actor_id] ?? null : null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const schoolMap = useMemo(() => {
    const m: Record<string, string> = {};
    schools.forEach((s) => { m[s.id] = s.name; });
    return m;
  }, [schools]);

  const actionPrefixes = useMemo(() => {
    const prefixes = new Set<string>();
    logs.forEach((l) => {
      const prefix = l.action.split('.')[0];
      if (prefix) prefixes.add(prefix);
    });
    return Array.from(prefixes).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let list = logs;
    if (roleFilter !== 'all') list = list.filter((l) => l.actor_role === roleFilter);
    if (schoolFilter !== 'all') {
      if (schoolFilter === 'platform') list = list.filter((l) => !l.school_id);
      else list = list.filter((l) => l.school_id === schoolFilter);
    }
    if (actionFilter !== 'all') {
      list = list.filter((l) => l.action.startsWith(actionFilter + '.') || l.action === actionFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        l.action.toLowerCase().includes(q) ||
        (l.entity ?? '').toLowerCase().includes(q) ||
        (l.actor_name ?? '').toLowerCase().includes(q) ||
        (l.actor_role ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [logs, search, roleFilter, schoolFilter, actionFilter]);

  const roleBadgeVariant = (role: string | null) => {
    if (role === 'super_admin') return 'primary' as const;
    if (role === 'school_admin') return 'success' as const;
    if (role === 'teacher') return 'warning' as const;
    return 'secondary' as const;
  };

  const actionIconColor = (action: string) => {
    if (action.includes('created')) return 'bg-success-soft text-success-soft-text';
    if (action.includes('suspended') || action.includes('deleted')) return 'bg-error-soft text-error-soft-text';
    if (action.includes('activated') || action.includes('updated')) return 'bg-primary-soft text-primary-light';
    return 'bg-surface-overlay text-ink-muted';
  };

  const formatDetail = (detail: Record<string, unknown> | null): string => {
    if (!detail || Object.keys(detail).length === 0) return 'No additional details';
    try {
      return JSON.stringify(detail, null, 2);
    } catch {
      return 'No additional details';
    }
  };

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Platform activity history"
        icon={<ScrollText className="h-6 w-6" />}
      />

      <Card>
        <CardHeader
          title="Activity Feed"
          subtitle={`${filteredLogs.length} event${filteredLogs.length !== 1 ? 's' : ''} (showing latest 200)`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input text-sm py-1.5 px-2">
                <option value="all">All roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="school_admin">School Admin</option>
                <option value="teacher">Teacher</option>
                <option value="parent">Parent</option>
              </select>
              <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input text-sm py-1.5 px-2">
                <option value="all">All actions</option>
                {actionPrefixes.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className="input text-sm py-1.5 px-2">
                <option value="all">All schools</option>
                <option value="platform">Platform-level</option>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          }
        />
        <div className="mb-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input className="input text-sm pl-9" placeholder="Search by action, entity, or actor…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <RowSkeleton rows={8} />
        ) : filteredLogs.length === 0 ? (
          <EmptyState title="No activity found" description="Audit logs will appear here as users interact with the platform." icon={<Activity className="h-10 w-10" />} />
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log) => {
              const isExpanded = expandedId === log.id;
              return (
                <div key={log.id} className="rounded-lg transition-colors hover:bg-surface-overlay">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className="w-full flex items-start gap-3 p-3 text-left"
                  >
                    <div className="mt-0.5 shrink-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-ink-muted" /> : <ChevronRight className="h-4 w-4 text-ink-muted" />}
                    </div>
                    <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', actionIconColor(log.action))}>
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-ink dark:text-slate-100">{log.action}</p>
                        {log.actor_role && <Badge variant={roleBadgeVariant(log.actor_role)} className="capitalize text-xs">{log.actor_role.replace('_', ' ')}</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-ink-muted flex-wrap">
                        {log.actor_name && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {log.actor_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {log.school_id ? schoolMap[log.school_id] ?? 'Unknown school' : 'Platform-level'}
                        </span>
                        {log.entity && (
                          <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {log.entity}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-ink-muted shrink-0" title={formatDate(log.created_at)}>{relativeTime(log.created_at)}</span>
                  </button>
                  {isExpanded && (
                    <div className="ml-11 mr-3 mb-3 rounded-lg border border-surface-border bg-surface-overlay/50 p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-ink-muted mb-0.5">Actor ID</p>
                          <p className="font-mono text-xs text-ink truncate">{log.actor_id ?? 'System'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-muted mb-0.5">Entity ID</p>
                          <p className="font-mono text-xs text-ink truncate">{log.entity_id ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-muted mb-0.5">Timestamp</p>
                          <p className="text-xs text-ink">{formatDate(log.created_at)} · {new Date(log.created_at).toLocaleTimeString('en-US')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-muted mb-0.5">School</p>
                          <p className="text-xs text-ink">{log.school_id ? schoolMap[log.school_id] ?? log.school_id : 'Platform-level'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-ink-muted mb-1">Detail</p>
                        <pre className="rounded-lg bg-surface p-3 text-xs font-mono text-ink overflow-x-auto whitespace-pre-wrap">{formatDetail(log.detail)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
