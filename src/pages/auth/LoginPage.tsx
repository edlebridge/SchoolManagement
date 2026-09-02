import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast(error.message, 'error');
      return;
    }
    setTimeout(() => {
      setLoading(false);
      navigate('/');
    }, 300);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white p-4 text-ink">
      <button onClick={toggleTheme}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-slate-100"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/EdLe_Bridge_Logo copy 2.png" alt="EdLe Bridge" className="mx-auto mb-3 h-auto w-[360px] max-w-[88vw] object-contain" />
          <p className="mt-2 text-sm text-slate-600">School Management System</p>
        </div>
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4 text-ink">Sign In</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="input-label">Email</label>
              <input className="input" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" />
            </div>
            <div>
              <label className="input-label">Password</label>
              <input className="input" type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
