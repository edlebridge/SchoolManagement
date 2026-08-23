import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useTheme } from '@/context/ThemeContext';
import { GraduationCap, Sun, Moon, CircleCheck as CheckCircle2, Circle as XCircle, Loader as Loader2, LogIn } from 'lucide-react';

type InviteState = 'loading' | 'valid' | 'expired' | 'accepted' | 'invalid' | 'error';

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [state, setState] = useState<InviteState>('loading');
  const [invitation, setInvitation] = useState<{
    role: string;
    email: string | null;
    full_name: string | null;
    school_id: string | null;
  } | null>(null);
  const [schoolName, setSchoolName] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }
    verifyToken();
  }, [token]);

  async function verifyToken() {
    const { data, error } = await supabase
      .from('invitations')
      .select('role, email, full_name, school_id, status, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (error || !data) {
      setState('invalid');
      return;
    }

    if (data.status === 'accepted') {
      setState('accepted');
      return;
    }

    const expired = new Date(data.expires_at).getTime() < Date.now();
    if (expired) {
      setState('expired');
      return;
    }

    setInvitation({
      role: data.role,
      email: data.email,
      full_name: data.full_name,
      school_id: data.school_id,
    });
    setEmail(data.email ?? '');

    if (data.school_id) {
      const { data: school } = await supabase
        .from('schools')
        .select('name')
        .eq('id', data.school_id)
        .maybeSingle();
      if (school) setSchoolName(school.name);
    }

    setState('valid');
  }

  async function acceptAndSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!invitation || !token) return;
    setSigningIn(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        toast(signInError.message, 'error');
        setSigningIn(false);
        return;
      }

      await supabase
        .from('invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('token', token);

      toast('Welcome to EduBridge!', 'success');

      setTimeout(() => navigate('/'), 500);
    } catch (err) {
      toast((err as Error).message, 'error');
      setSigningIn(false);
    }
  }

  const roleLabel = invitation?.role === 'school_admin'
    ? 'School Administrator'
    : invitation?.role === 'teacher'
    ? 'Teacher'
    : 'Parent';

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-bg text-ink">
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-surface-overlay text-ink-soft"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-ink">EduBridge</h1>
          <p className="text-sm mt-1 text-ink-muted">School Management System</p>
        </div>

        <div className="card p-6">
          {state === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-ink-muted">Verifying invitation…</p>
            </div>
          )}

          {state === 'invalid' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <XCircle className="h-12 w-12 text-error-soft-text" />
              <h2 className="text-lg font-semibold text-ink">Invalid Invitation</h2>
              <p className="text-sm text-ink-muted">This invitation link is not valid. Please contact your school administrator for a new link.</p>
              <button onClick={() => navigate('/login')} className="btn btn-primary mt-2">
                Go to Sign In
              </button>
            </div>
          )}

          {state === 'expired' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <XCircle className="h-12 w-12 text-error-soft-text" />
              <h2 className="text-lg font-semibold text-ink">Invitation Expired</h2>
              <p className="text-sm text-ink-muted">This invitation has expired. Please contact your school administrator to resend the invitation.</p>
              <button onClick={() => navigate('/login')} className="btn btn-primary mt-2">
                Go to Sign In
              </button>
            </div>
          )}

          {state === 'accepted' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-success-soft-text" />
              <h2 className="text-lg font-semibold text-ink">Already Accepted</h2>
              <p className="text-sm text-ink-muted">This invitation has already been used. Please sign in with your credentials.</p>
              <button onClick={() => navigate('/login')} className="btn btn-primary mt-2">
                Sign In
              </button>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <XCircle className="h-12 w-12 text-error-soft-text" />
              <h2 className="text-lg font-semibold text-ink">Something Went Wrong</h2>
              <p className="text-sm text-ink-muted">We couldn't process this invitation. Please try again or contact support.</p>
              <button onClick={() => navigate('/login')} className="btn btn-primary mt-2">
                Go to Sign In
              </button>
            </div>
          )}

          {state === 'valid' && invitation && (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-soft">
                  <CheckCircle2 className="h-6 w-6 text-success-soft-text" />
                </div>
                <h2 className="text-lg font-semibold text-ink">You're Invited!</h2>
                <p className="text-sm mt-2 text-ink-muted">
                  {schoolName ? <strong>{schoolName}</strong> : 'A school'} has invited you to join EduBridge as a <strong>{roleLabel}</strong>.
                </p>
                {invitation.full_name && (
                  <p className="text-sm mt-1 text-ink-soft">Welcome, {invitation.full_name}!</p>
                )}
              </div>

              <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 mb-4">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Your account has been created with a temporary password. Sign in below to activate your account, then change your password from your profile.
                </p>
              </div>

              <form onSubmit={acceptAndSignIn} className="space-y-4">
                <div>
                  <label className="input-label">Email</label>
                  <input
                    className="input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.edu"
                  />
                </div>
                <div>
                  <label className="input-label">Password</label>
                  <input
                    className="input"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your temporary password"
                  />
                </div>
                <button type="submit" disabled={signingIn} className="btn btn-primary w-full">
                  {signingIn
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    : <LogIn className="h-4 w-4" />
                  }
                  Register Now
                </button>
              </form>

              <p className="text-xs text-center text-ink-muted mt-4">
                Don't know your password? Your school admin set a default password. Contact them if you need help.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
