import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { cn, relativeTime } from '@/lib/utils';
import type { AppNotification } from '@/types';

export function NotificationBell() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!profile?.user_id) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications((data as AppNotification[]) ?? []);
  }, [profile?.user_id]);

  useEffect(() => {
    loadNotifications();
    if (!profile?.user_id) return;
    const channel = supabase
      .channel('notifications-bell')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.user_id}` },
        () => loadNotifications()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadNotifications, profile?.user_id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    if (!profile?.user_id || unreadCount === 0) return;
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    const now = new Date().toISOString();
    await supabase.from('notifications').update({ read_at: now }).in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setOpen((p) => !p); if (!open) loadNotifications(); }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-surface-overlay text-ink-soft"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-surface-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-light">
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'border-b border-surface-border px-4 py-3 transition-colors',
                    !n.read_at ? 'bg-primary-50/50 dark:bg-primary-500/5' : ''
                  )}
                >
                  {n.link ? (
                    <Link to={n.link} onClick={() => setOpen(false)} className="block">
                      <p className="text-sm font-medium text-ink">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-xs text-ink-muted">{n.body}</p>}
                      <p className="mt-1 text-xs text-ink-muted">{relativeTime(n.created_at)}</p>
                    </Link>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-ink">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-xs text-ink-muted">{n.body}</p>}
                      <p className="mt-1 text-xs text-ink-muted">{relativeTime(n.created_at)}</p>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
