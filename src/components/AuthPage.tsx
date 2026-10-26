import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth, type Role } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';

const signupSchema = z.object({
  role: z.enum(['coach', 'athlete']),
  name: z.string().trim().min(2, 'Enter at least 2 characters for your name.').max(80),
  email: z.email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
  teamName: z.string().trim().max(100),
  bodyweight: z.string(),
  weightClass: z.string().trim().max(30),
  unit: z.enum(['kg', 'lb']),
  inviteCode: z.string().trim().max(40),
});

type Mode = 'login' | 'signup';

const networkErrorMessage = "Can't reach the Topset server. Check that local Supabase is running (npx supabase start) and that your .env is correct.";

function getAuthErrorMessage(error: unknown): string {
  const details = error && typeof error === 'object'
    ? error as { message?: unknown; code?: unknown; status?: unknown; name?: unknown }
    : {};
  const message = typeof details.message === 'string' ? details.message : '';
  const normalizedMessage = message.toLowerCase();
  const code = typeof details.code === 'string' ? details.code.toLowerCase() : '';
  const name = typeof details.name === 'string' ? details.name.toLowerCase() : '';

  if (error instanceof TypeError || name.includes('retryablefetch') || /failed to fetch|network error|fetch failed|load failed/i.test(message)) {
    return networkErrorMessage;
  }
  if (normalizedMessage.includes('email not confirmed') || code.includes('email_not_confirmed')) {
    return 'Your email address is not confirmed yet. Check your inbox, then try signing in again.';
  }
  if (normalizedMessage.includes('already registered') || normalizedMessage.includes('already been registered') || code.includes('user_already_exists')) {
    return 'An account with this email is already registered. Sign in instead.';
  }
  if (normalizedMessage.includes('invalid login credentials') || code.includes('invalid_credentials')) {
    return 'Email or password is incorrect. Check your details and try again.';
  }
  return 'We could not complete that request. Please try again.';
}

export function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const { session, profile, loading, configured } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading) return <main className="state-screen"><span className="spinner" />Checking your account…</main>;
  if (session) return <Navigate to={profile ? `/${profile.role}` : '/'} replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    let authRequestStarted = false;

    try {
      if (mode === 'login') {
        const parsed = z.object({ email: z.email('Enter a valid email address.'), password: z.string().min(1, 'Enter your password.') }).safeParse({ email, password });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check your details and try again.');
        authRequestStarted = true;
        const { error: authError } = await supabase.auth.signInWithPassword(parsed.data);
        if (authError) throw authError;
        navigate('/', { replace: true });
      } else {
        if (!role) throw new Error('Choose whether you are signing up as a coach or athlete.');
        const parsed = signupSchema.safeParse({
          role,
          name: String(form.get('name') ?? ''),
          email,
          password,
          teamName: String(form.get('teamName') ?? ''),
          bodyweight: String(form.get('bodyweight') ?? ''),
          weightClass: String(form.get('weightClass') ?? ''),
          unit: String(form.get('unit') ?? 'kg'),
          inviteCode: String(form.get('inviteCode') ?? ''),
        });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check your details and try again.');
        const details = parsed.data;
        const bodyweight = details.bodyweight.trim() ? Number(details.bodyweight) : null;
        if (details.role === 'athlete' && bodyweight !== null && (!Number.isFinite(bodyweight) || bodyweight <= 0 || bodyweight > 500)) {
          throw new Error('Enter a valid bodyweight, or leave it blank.');
        }
        authRequestStarted = true;
        const { data, error: authError } = await supabase.auth.signUp({
          email: details.email,
          password: details.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              role: details.role,
              name: details.name,
              team_name: details.role === 'coach' ? details.teamName || null : null,
              unit: details.role === 'athlete' ? details.unit : null,
              bodyweight: details.role === 'athlete' ? bodyweight : null,
              weight_class: details.role === 'athlete' ? details.weightClass || null : null,
              invite_code: details.role === 'athlete' ? details.inviteCode || null : null,
            },
          },
        });
        if (authError) throw authError;
        if (data.session) navigate('/', { replace: true });
        else setNotice('Your account is ready. Check your email to confirm your address, then sign in.');
      }
    } catch (submitError) {
      if (authRequestStarted) console.error('Supabase authentication request failed', submitError);
      setError(authRequestStarted ? getAuthErrorMessage(submitError) : submitError instanceof Error ? submitError.message : 'Check your details and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (oauthError) throw oauthError;
    } catch (oauthError) {
      console.error('Supabase OAuth request failed', oauthError);
      setError(getAuthErrorMessage(oauthError));
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="brand-panel" aria-label="Topset overview">
        <Link className="brand-lockup" to="/login"><span className="brand-mark">T</span><span>topset<span className="brand-period">.</span></span></Link>
        <div className="brand-copy">
          <p className="eyebrow">TRAIN WITH INTENTION</p>
          <h1>Strength is built<br />one good week<br /><em>at a time.</em></h1>
          <p className="brand-subcopy">Your training, your coach, one clear plan.</p>
        </div>
        <div className="brand-footer"><span className="status-dot" /> A stronger system for strength sports <span>EST. 2025</span></div>
        <div className="brand-watermark" aria-hidden="true">T</div>
      </section>

      <section className="form-panel">
        <div className="form-topline"><span>POWERING YOUR NEXT PR</span><span className="topline-line" /></div>
        <div className="form-content">
          <div className="mobile-brand"><span className="brand-mark">T</span><span>topset<span className="brand-period">.</span></span></div>
          <p className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'START YOUR JOURNEY'}</p>
          <h2>{mode === 'login' ? 'Sign in to Topset' : 'Create your account'}</h2>
          <p className="form-intro">{mode === 'login' ? 'Pick up where your last session left off.' : 'A better training week starts here.'}</p>

          {!configured && <div className="alert alert-warning">Supabase is not configured. Add the project URL and anon key to <code>.env</code> to enable account access.</div>}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {notice && <div className="alert alert-success" role="status">{notice}</div>}

          <form onSubmit={(event) => void onSubmit(event)}>
            {mode === 'signup' && <>
              <fieldset className="role-fieldset">
                <legend>I’m joining Topset as a</legend>
                <div className="role-grid">
                  <button type="button" className={`role-card ${role === 'coach' ? 'selected' : ''}`} onClick={() => setRole('coach')} aria-pressed={role === 'coach'}>
                    <span className="role-icon" aria-hidden="true">↗</span><span className="role-title">Coach</span><span className="role-description">Build plans. Guide progress.</span>
                  </button>
                  <button type="button" className={`role-card ${role === 'athlete' ? 'selected' : ''}`} onClick={() => setRole('athlete')} aria-pressed={role === 'athlete'}>
                    <span className="role-icon athlete-icon" aria-hidden="true">◉</span><span className="role-title">Athlete</span><span className="role-description">Train well. Track it all.</span>
                  </button>
                </div>
              </fieldset>
              <label className="field"><span>Full name</span><input name="name" autoComplete="name" placeholder="Alex Morgan" required minLength={2} maxLength={80} /></label>
            </>}

            <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
            <label className="field"><span>Password</span><input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" required minLength={mode === 'signup' ? 8 : undefined} /></label>

            {mode === 'signup' && role === 'coach' && <label className="field"><span>Team or gym <small>OPTIONAL</small></span><input name="teamName" autoComplete="organization" placeholder="Northside Barbell" maxLength={100} /></label>}
            {mode === 'signup' && role === 'athlete' && <>
              <div className="field-row">
                <label className="field"><span>Bodyweight <small>OPTIONAL</small></span><input name="bodyweight" type="number" min="1" max="500" step="0.1" placeholder="82.5" /></label>
                <label className="field"><span>Unit</span><select name="unit" defaultValue="kg"><option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option></select></label>
              </div>
              <div className="field-row">
                <label className="field"><span>Weight class <small>OPTIONAL</small></span><input name="weightClass" placeholder="e.g. 83 kg" maxLength={30} /></label>
                <label className="field"><span>Coach invite code <small>OPTIONAL</small></span><input name="inviteCode" placeholder="Enter code" maxLength={40} /></label>
              </div>
              <p className="field-hint">You can add your lifts after signup. Coach invite linking is a later milestone, so this code will not connect your account yet.</p>
            </>}

            <button className="button button-primary submit-button" type="submit" disabled={busy || !configured || (mode === 'signup' && !role)}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <span aria-hidden="true">→</span>
            </button>
          </form>

          {mode === 'login' && <>
            <div className="divider"><span>OR</span></div>
            <button className="button button-secondary google-button" type="button" onClick={() => void signInWithGoogle()} disabled={busy || !configured}>
              <GoogleMark /> Continue with Google
            </button>
            <p className="provider-note">For existing accounts. New Google account onboarding needs a role-choice callback and is deferred.</p>
          </>}

          <p className="switch-mode">{mode === 'login' ? 'New to Topset?' : 'Already have an account?'}{' '}
            <Link to={mode === 'login' ? '/signup' : '/login'}>{mode === 'login' ? 'Create account' : 'Sign in'}</Link>
          </p>
        </div>
        <footer className="auth-footer"><span>© 2025 TOPSET</span><span>BUILT FOR THE LONG GAME</span></footer>
      </section>
    </main>
  );
}

function GoogleMark() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.5H5.8v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"/><path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.8-5.8A19.5 19.5 0 0 0 24 4 20 20 0 0 0 5.8 15.1l6.8 5.3c1.6-4.9 6.1-8.5 11.4-8.5Z"/></svg>;
}
