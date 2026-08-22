import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { LogOut, ChevronDown, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

export interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
}

export function DashboardLayout({ navItems, roleLabel }: { navItems: NavItem[]; roleLabel: string }) {
  const [userMenu, setUserMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, school, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-40 border-b border-surface-border bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-bold">E</div>
            <div className="hidden sm:block">
              <p className="font-bold leading-none text-ink">EduBridge</p>
              <p className="text-xs mt-0.5 text-ink-muted">{school?.name ?? ''}</p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
              return (
                <Link key={item.to} to={item.to}
                  className={cn('flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-surface-overlay text-ink' : 'text-ink-soft hover:text-ink hover:bg-surface-overlay')}
                  style={active ? { color: 'var(--color-text)' } : undefined}>
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-surface-overlay text-ink-soft"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <div className="relative">
              <button onClick={() => setUserMenu((p) => !p)}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-surface-overlay">
                <Avatar name={profile?.full_name ?? ''} src={profile?.avatar_url} size="sm" />
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium leading-none text-ink">{profile?.full_name}</p>
                  <p className="text-xs mt-0.5 text-ink-muted">{roleLabel}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-ink-muted" />
              </button>
              {userMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-surface-border shadow-xl z-50 py-2 bg-surface">
                    <div className="px-4 py-2 border-b border-surface-border">
                      <p className="text-sm font-medium text-ink">{profile?.full_name}</p>
                      <p className="text-xs text-ink-muted">{profile?.phone ?? 'No phone'}</p>
                    </div>
                    <button onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-surface-overlay text-error-soft-text">
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="lg:hidden border-t border-surface-border overflow-x-auto">
          <div className="flex items-center gap-1 px-2 py-2 min-w-max">
            {navItems.map((item) => {
              const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
              return (
                <Link key={item.to} to={item.to}
                  className={cn('flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                    active ? 'bg-surface-overlay text-ink' : 'text-ink-soft hover:text-ink hover:bg-surface-overlay')}>
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
