import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { LogOut, ChevronDown, Sun, Moon, Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { cn } from '@/lib/utils';

export interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
}

export function DashboardLayout({ navItems, roleLabel }: { navItems: NavItem[]; roleLabel: string }) {
  const [userMenu, setUserMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, school, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  const isActive = (to: string) =>
    location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-surface-border bg-surface transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-surface-border px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-bold">E</div>
            <div className="min-w-0">
              <p className="font-bold leading-none text-ink">EduBridge</p>
              <p className="mt-0.5 truncate text-xs text-ink-muted">{school?.name ?? ''}</p>
            </div>
          </div>
          <button
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-overlay lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive(item.to)
                  ? 'bg-primary text-white'
                  : 'text-ink-soft hover:bg-surface-overlay hover:text-ink'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User section at bottom */}
        <div className="shrink-0 border-t border-surface-border p-3">
          <div className="relative">
            <button
              onClick={() => setUserMenu((p) => !p)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-overlay"
            >
              <Avatar name={profile?.full_name ?? ''} src={profile?.avatar_url} size="sm" />
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium leading-none text-ink">{profile?.full_name}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{roleLabel}</p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted" />
            </button>
            {userMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenu(false)} />
                <div className="absolute bottom-full left-0 mb-2 w-full rounded-xl border border-surface-border bg-surface py-2 shadow-xl z-20">
                  <div className="border-b border-surface-border px-4 py-2">
                    <p className="text-sm font-medium text-ink">{profile?.full_name}</p>
                    <p className="text-xs text-ink-muted">{profile?.phone ?? 'No phone'}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-error-soft-text transition-colors hover:bg-surface-overlay"
                  >
                    <LogOut className="h-4 w-4" /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-surface-border bg-surface px-4">
          {/* Mobile menu button */}
          <button
            className="rounded-xl p-2 text-ink-soft transition-colors hover:bg-surface-overlay lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Desktop spacer */}
          <div className="hidden lg:block" />

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-surface-overlay"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto max-w-7xl p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
