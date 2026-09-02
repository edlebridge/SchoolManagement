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
    <div className="flex min-h-screen items-center justify-center p-4 text-ink relative overflow-hidden"
      style={{ backgroundImage: 'url(/EdLe_Bridge_Background.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-black/40" />
      <button onClick={toggleTheme}
        className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-white/10 text-white"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/EdLe_Bridge_Logo.png" alt="EdLe Bridge" className="mx-auto mb-2 h-40 w-auto max-w-[320px] object-contain" />
          <p className="text-sm mt-2 text-white/80">School Management System</p>
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
