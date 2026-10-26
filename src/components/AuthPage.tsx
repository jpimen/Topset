import { useMemo, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuth, type Role } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'signup';
type IconName = 'barbell' | 'coach' | 'athlete' | 'mail' | 'lock' | 'eye' | 'check' | 'arrow' | 'shield' | 'info' | 'spark';
type FieldErrors = Record<string, string>;
type WeightUnit = 'kg' | 'lb';

const networkErrorMessage = "Can't reach the Topset server. Check that local Supabase is running (npx supabase start) and that your .env is correct.";
const liftClasses: Record<WeightUnit, string[]> = {
  kg: ['53 kg', '59 kg', '66 kg', '74 kg', '83 kg', '93 kg', '105 kg', '120 kg', '120+ kg', '43 kg', '47 kg', '52 kg', '57 kg', '63 kg', '69 kg', '76 kg', '84 kg', '84+ kg', 'Other'],
  lb: ['117 lb', '130 lb', '146 lb', '163 lb', '183 lb', '205 lb', '231 lb', '265 lb', '265+ lb', '95 lb', '104 lb', '115 lb', '126 lb', '139 lb', '152 lb', '168 lb', '185 lb', '185+ lb', 'Other'],
};
const signUpSchema = z.object({
  role: z.enum(['coach', 'athlete']),
  name: z.string().trim().min(2, 'Enter at least 2 characters for your name.').max(80),
  email: z.email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.').regex(/\d/, 'Add at least one number.').regex(/[^A-Za-z0-9]/, 'Add at least one special character.'),
  confirmPassword: z.string(),
  teamName: z.string().trim().max(100),
  bodyweight: z.string(),
  weightClass: z.string().trim().max(30),
  unit: z.enum(['kg', 'lb']),
  squatMax: z.string(),
  benchMax: z.string(),
  deadliftMax: z.string(),
  termsAccepted: z.literal('on', 'Please agree to the Terms of Service and Privacy Policy.'),
});

function getAuthErrorMessage(error: unknown): string {
  const details = error && typeof error === 'object'
    ? error as { message?: unknown; code?: unknown; name?: unknown }
    : {};
  const message = typeof details.message === 'string' ? details.message : '';
  const normalizedMessage = message.toLowerCase();
  const code = typeof details.code === 'string' ? details.code.toLowerCase() : '';
  const name = typeof details.name === 'string' ? details.name.toLowerCase() : '';
  if (error instanceof TypeError || name.includes('retryablefetch') || /failed to fetch|network error|fetch failed|load failed/i.test(message)) return networkErrorMessage;
  if (normalizedMessage.includes('email not confirmed') || code.includes('email_not_confirmed')) return 'Your email address is not confirmed yet. Check your inbox, then try signing in again.';
  if (normalizedMessage.includes('already registered') || normalizedMessage.includes('already been registered') || code.includes('user_already_exists')) return 'An account with this email is already registered. Sign in instead.';
  if (normalizedMessage.includes('invalid login credentials') || code.includes('invalid_credentials')) return 'Email or password is incorrect. Check your details and try again.';
  return 'We could not complete that request. Please try again.';
}

function toOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 2000 ? number : Number.NaN;
}

export function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, profile, loading, configured } = useAuth();
  const queryRole = searchParams.get('role');
  const selectedRole: Role | null = queryRole === 'coach' || queryRole === 'athlete' ? queryRole : null;
  const [roleChoice, setRoleChoice] = useState<Role | null>(selectedRole);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [passwordValue, setPasswordValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const isCredentialsStep = mode === 'signup' && selectedRole !== null;

  if (loading) return <main className="state-screen auth-state-screen"><span className="spinner" />Checking your account…</main>;
  if (session) return <Navigate to={profile ? `/${profile.role}` : '/'} replace />;

  function chooseRole(role: Role) {
    setRoleChoice(role);
    setError(null);
  }

  function validateField(name: string, value: string, form?: HTMLFormElement) {
    const next = { ...fieldErrors };
    let message = '';
    if (name === 'name' && value.trim().length < 2) message = 'Enter at least 2 characters for your name.';
    if (name === 'email' && !z.email().safeParse(value.trim()).success) message = 'Enter a valid email address.';
    if (name === 'password') {
      if (value.length < 8) message = 'Use at least 8 characters.';
      else if (!/\d/.test(value)) message = 'Add at least one number.';
      else if (!/[^A-Za-z0-9]/.test(value)) message = 'Add at least one special character.';
    }
    if (name === 'confirmPassword' && form && value !== String(new FormData(form).get('password') ?? '')) message = 'Passwords do not match.';
    if (name === 'bodyweight' && value.trim() && (toOptionalNumber(value) === null || Number.isNaN(toOptionalNumber(value)))) message = 'Enter a valid bodyweight.';
    if (['squatMax', 'benchMax', 'deadliftMax'].includes(name) && value.trim() && Number.isNaN(toOptionalNumber(value))) message = 'Enter a value greater than zero.';
    if (message) next[name] = message;
    else delete next[name];
    setFieldErrors(next);
    return !message;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !configured) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setError(null);
    setNotice(null);
    setBusy(true);
    let authRequestStarted = false;

    try {
      const email = String(values.get('email') ?? '').trim();
      const password = String(values.get('password') ?? '');
      if (mode === 'login') {
        const parsed = z.object({ email: z.email('Enter a valid email address.'), password: z.string().min(1, 'Enter your password.') }).safeParse({ email, password });
        if (!parsed.success) {
          const loginErrors: FieldErrors = {};
          for (const issue of parsed.error.issues) loginErrors[String(issue.path[0] ?? 'form')] = issue.message;
          setFieldErrors(loginErrors);
          setError(parsed.error.issues[0]?.message ?? 'Check your details and try again.');
          return;
        }
        setFieldErrors({});
        authRequestStarted = true;
        const { error: authError } = await supabase.auth.signInWithPassword(parsed.data);
        if (authError) throw authError;
        navigate('/', { replace: true });
        return;
      }

      if (!selectedRole) {
        setError('Choose whether you are signing up as a coach or athlete.');
        return;
      }
      const input = {
        role: selectedRole,
        name: String(values.get('name') ?? ''),
        email,
        password,
        confirmPassword: String(values.get('confirmPassword') ?? ''),
        teamName: String(values.get('teamName') ?? ''),
        bodyweight: String(values.get('bodyweight') ?? ''),
        weightClass: String(values.get('weightClass') ?? ''),
        unit: String(values.get('unit') ?? 'kg'),
        squatMax: String(values.get('squatMax') ?? ''),
        benchMax: String(values.get('benchMax') ?? ''),
        deadliftMax: String(values.get('deadliftMax') ?? ''),
        termsAccepted: values.get('termsAccepted') === 'on' ? 'on' : '',
      };
      const parsed = signUpSchema.safeParse(input);
      const nextErrors: FieldErrors = {};
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const fieldName = String(issue.path[0] ?? 'form');
          nextErrors[fieldName] = issue.message;
        }
      }
      if (input.confirmPassword !== input.password) nextErrors.confirmPassword = 'Passwords do not match.';
      const bodyweight = toOptionalNumber(input.bodyweight);
      const squatMax = toOptionalNumber(input.squatMax);
      const benchMax = toOptionalNumber(input.benchMax);
      const deadliftMax = toOptionalNumber(input.deadliftMax);
      if (input.role === 'athlete' && (Number.isNaN(bodyweight) || (bodyweight !== null && bodyweight > 500))) nextErrors.bodyweight = 'Enter a valid bodyweight up to 500.';
      if ([squatMax, benchMax, deadliftMax].some(Number.isNaN)) nextErrors.lifts = 'Lift maxes must be greater than zero and no more than 2,000.';
      setFieldErrors(nextErrors);
      if (!parsed.success || Object.keys(nextErrors).length) {
        setError(nextErrors.form ?? 'Review the highlighted fields and try again.');
        return;
      }

      const details = parsed.data;
      authRequestStarted = true;
      const { data, error: authError } = await supabase.auth.signUp({
        email: details.email,
        password: details.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            role: details.role,
            name: details.name.trim(),
            team_name: details.role === 'coach' ? details.teamName.trim() || null : null,
            unit: details.role === 'athlete' ? details.unit : null,
            bodyweight: details.role === 'athlete' ? bodyweight : null,
            weight_class: details.role === 'athlete' ? details.weightClass || null : null,
            squat_max: details.role === 'athlete' ? squatMax : null,
            bench_max: details.role === 'athlete' ? benchMax : null,
            deadlift_max: details.role === 'athlete' ? deadliftMax : null,
            invite_code: null,
          },
        },
      });
      if (authError) throw authError;
      if (data.session) navigate('/', { replace: true });
      else setNotice('Your account is ready. Check your email to confirm your address, then sign in.');
    } catch (submitError) {
      if (authRequestStarted) console.error('Supabase authentication request failed', submitError);
      setError(authRequestStarted ? getAuthErrorMessage(submitError) : submitError instanceof Error ? submitError.message : 'Check your details and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!supabase || !configured) return;
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

  const appHeader = <header className="auth-header"><Logo /><span className="header-mark">TOPSET PLATFORM</span></header>;

  if (mode === 'login') {
    return (
      <main className="auth-page auth-login-page">
        <section className="auth-main auth-card login-card">
          <div className="auth-card-top"><div className="card-brandline"><span className="card-brand-mark"><Icon name="barbell" /></span><span className="eyebrow">TOPSET PLATFORM</span></div><span className="calibration-mark"><Icon name="shield" /> SECURE SIGN-IN</span></div>
          <p className="eyebrow welcome-eyebrow"><span className="eyebrow-dot" /> WELCOME BACK</p>
          <h1>Sign in to <em>Topset</em></h1>
          <p className="auth-subtitle">Pick up where your last session left off.</p>
          {error && <AlertBanner tone="error" message={error} />}
          {notice && <AlertBanner tone="success" message={notice} />}
          <form className="auth-form login-form" onSubmit={(event) => void onSubmit(event)} noValidate>
            <TextInput label="Email address" name="email" type="email" autoComplete="email" placeholder="you@example.com" icon={<Icon name="mail" />} onBlur={(event) => validateField('email', event.currentTarget.value)} error={fieldErrors.email} />
            <PasswordInput id="login-password" name="password" autoComplete="current-password" placeholder="Enter your password" show={showPassword} onToggle={() => setShowPassword((value) => !value)} error={fieldErrors.password} onBlur={(event) => {
              const next = { ...fieldErrors };
              if (!event.currentTarget.value) next.password = 'Enter your password.';
              else delete next.password;
              setFieldErrors(next);
            }} />
            <div className="form-actions"><span className="keep-note"><Icon name="shield" /> Your session stays private</span></div>
            <Button loading={busy} disabled={!configured} icon={<Icon name="arrow" />}>Sign in</Button>
          </form>
          <Divider />
          <Button variant="secondary" disabled={!configured || busy} onClick={() => void signInWithGoogle()} icon={<GoogleMark />}>Continue with Google</Button>
          <p className="switch-mode">New to Topset? <Link to="/signup">Create account</Link></p>
          <p className="secure-note"><Icon name="shield" /> Secure sign-in powered by Supabase</p>
        </section>
        <BrandPanel />
      </main>
    );
  }

  return (
    <main className="auth-page auth-signup-page">
      <div className="wizard-topline">{appHeader}<div className="wizard-side-note">BUILD WITH INTENTION</div></div>
      {!isCredentialsStep ? (
        <section className="wizard-card role-step">
          <ProgressSteps step={1} />
          <div className="wizard-heading"><p className="eyebrow"><span className="eyebrow-dot" /> CREATE ACCOUNT</p><h1>How will you use <em>Topset?</em></h1><p>Choose your role to shape your training workspace.</p></div>
          <fieldset className="role-choice-group" aria-describedby="role-help">
            <legend className="visually-hidden">Choose your account role</legend>
            <div className="role-options" role="radiogroup" aria-label="Choose your role">
              <RoleCard role="coach" selected={roleChoice === 'coach'} onSelect={() => chooseRole('coach')} title="I'm a Coach" category="COACH TOOLS" description="Build programs, guide athletes, and keep training on track." features={['Program planning and library', 'Athlete roster and progress', 'Peaking and meet-day tools']} />
              <RoleCard role="athlete" selected={roleChoice === 'athlete'} onSelect={() => chooseRole('athlete')} title="I'm an Athlete" category="ATHLETE TOOLS" description="Follow your plan, log your lifts, and prepare for competition." features={['Session logging and timers', 'RPE calculator and progress curves', 'Competition plate calculator']} />
            </div>
            <span id="role-help" className="visually-hidden">Select one role to continue.</span>
          </fieldset>
          {error && <AlertBanner tone="error" message={error} />}
          <Button disabled={!roleChoice} icon={<Icon name="arrow" />} onClick={() => {
            if (!roleChoice) return;
            setError(null);
            setSearchParams({ role: roleChoice });
          }}>Continue</Button>
          <p className="switch-mode">Already have an account? <Link to="/login">Sign in</Link></p>
        </section>
      ) : (
        <section className="wizard-card credentials-step">
          <ProgressSteps step={2} />
          <button className="back-link" type="button" onClick={() => { setRoleChoice(selectedRole); setSearchParams({}); setError(null); setFieldErrors({}); }}><span aria-hidden="true">←</span> Back to role selection</button>
          <div className="wizard-heading wizard-heading-compact"><p className="eyebrow"><span className="eyebrow-dot" /> {selectedRole === 'coach' ? 'COACH ACCOUNT' : 'ATHLETE ACCOUNT'}</p><h1>Create your <em>{selectedRole}</em> account</h1><p>Set up your sign-in and training profile.</p></div>
          {error && <AlertBanner tone="error" message={error} />}
          {notice && <AlertBanner tone="success" message={notice} />}
          <form className="auth-form signup-form" onSubmit={(event) => void onSubmit(event)} noValidate>
            <div className="signup-grid">
              <TextInput label="Full name" name="name" autoComplete="name" placeholder="Your full name" onBlur={(event) => validateField('name', event.currentTarget.value)} error={fieldErrors.name} />
              <TextInput label="Email address" name="email" type="email" autoComplete="email" placeholder="you@example.com" icon={<Icon name="mail" />} onBlur={(event) => validateField('email', event.currentTarget.value)} error={fieldErrors.email} />
              <PasswordInput id="signup-password" name="password" autoComplete="new-password" label="Password" placeholder="Create a password" show={showPassword} onToggle={() => setShowPassword((value) => !value)} value={passwordValue} onChange={(event) => { setPasswordValue(event.target.value); validateField('password', event.target.value); }} error={fieldErrors.password} onBlur={(event) => validateField('password', event.currentTarget.value)} />
              <div className="strength-wrap"><StrengthMeter password={passwordValue} /><RequirementChips password={passwordValue} /></div>
              <PasswordInput id="confirm-password" name="confirmPassword" autoComplete="new-password" label="Confirm password" placeholder="Enter password again" show={showPassword} onToggle={() => setShowPassword((value) => !value)} onBlur={(event) => validateField('confirmPassword', event.currentTarget.value, event.currentTarget.form ?? undefined)} error={fieldErrors.confirmPassword} />
              {selectedRole === 'coach' ? (
                <TextInput label="Club, gym, or affiliation" name="teamName" autoComplete="organization" placeholder="Optional" hint="You can add this later." />
              ) : (
                <div className="metrics-panel">
                  <div className="metrics-heading"><div><span className="field-label">Lifting metrics</span><span className="field-help">Optional starting details</span></div><UnitToggle unit={weightUnit} onChange={setWeightUnit} /></div>
                  <div className="metrics-grid">
                    <TextInput label="Bodyweight" name="bodyweight" type="number" min="1" max="500" step="0.1" placeholder="Optional" onBlur={(event) => validateField('bodyweight', event.currentTarget.value)} error={fieldErrors.bodyweight} />
                    <SelectInput label="Weight class" name="weightClass" error={fieldErrors.weightClass} options={liftClasses[weightUnit]} />
                    <TextInput label="Squat max" name="squatMax" type="number" min="1" max="2000" step="0.5" placeholder="Optional" onBlur={(event) => validateField('squatMax', event.currentTarget.value)} error={fieldErrors.squatMax} />
                    <TextInput label="Bench max" name="benchMax" type="number" min="1" max="2000" step="0.5" placeholder="Optional" onBlur={(event) => validateField('benchMax', event.currentTarget.value)} error={fieldErrors.benchMax} />
                    <TextInput label="Deadlift max" name="deadliftMax" type="number" min="1" max="2000" step="0.5" placeholder="Optional" onBlur={(event) => validateField('deadliftMax', event.currentTarget.value)} error={fieldErrors.deadliftMax} />
                    <TextInput label="Coach invite code" name="inviteCode" disabled placeholder="Available when linking launches" hint="Coach codes are not accepted or stored yet." />
                    <div className="invite-note"><Icon name="info" /><span>Athlete linking is not available yet. Coach codes will connect once that feature is ready.</span></div>
                  </div>
                </div>
              )}
            </div>
            {fieldErrors.lifts && <p className="inline-error" role="alert">{fieldErrors.lifts}</p>}
            {selectedRole === 'coach' && <div className="invite-note coach-note"><Icon name="info" /><span>Coach invitations are not available yet. Athlete linking will be added in a later milestone.</span></div>}
            <Checkbox name="termsAccepted" required error={fieldErrors.termsAccepted}>I agree to the Terms of Service and Privacy Policy.</Checkbox>
            <Button loading={busy} disabled={!configured} icon={<Icon name="arrow" />}>Create {selectedRole} account</Button>
          </form>
          {selectedRole === 'coach' && <p className="provider-note signup-provider-note">Google account signup is not available yet. Use your email and password.</p>}
          <p className="switch-mode">Already have an account? <Link to="/login">Sign in</Link></p>
        </section>
      )}
      <footer className="wizard-footer"><Logo compact /><span>BUILT FOR THE LONG GAME</span></footer>
    </main>
  );
}

function Icon({ name }: { name: IconName }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  const drawings: Record<IconName, ReactNode> = {
    barbell: <><path d="M4 9v6M7 6v12M17 6v12M20 9v6M7 12h10" /><path d="M2.5 10v4M21.5 10v4" /></>,
    coach: <><path d="M4 18.5h16M6 18.5V9l6-4 6 4v9.5" /><path d="M9 18.5v-5h6v5" /></>,
    athlete: <><path d="m6 18 12-12M5 7l3-3 3 3M13 17l3 3 3-3" /><path d="m8 8 8 8" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <><path d="M4 12h15M13 6l6 6-6 6" /></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    spark: <><path d="m12 3 1.6 6.4L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6L12 3Z" /><path d="m19 14 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" /></>,
  };
  return <svg {...common}>{drawings[name]}</svg>;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <span className={`logo-lockup ${compact ? 'logo-compact' : ''}`}><span className="logo-mark"><Icon name="barbell" /></span><span>TOPSET<span className="logo-dot">.</span></span></span>;
}

function GoogleMark() {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.5H5.8v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"/><path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.8-5.8A19.5 19.5 0 0 0 24 4 20 20 0 0 0 5.8 15.1l6.8 5.3c1.6-4.9 6.1-8.5 11.4-8.5Z"/></svg>;
}

function TextInput({ label, name, icon, error, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; icon?: ReactNode; error?: string; hint?: string }) {
  const errorId = `${name}-error`;
  return <div className={`field-wrap ${error ? 'field-invalid' : ''}`}>
    <label htmlFor={name}>{label}</label>
    <div className={`input-shell ${icon ? 'input-with-icon' : ''}`}>{icon && <span className="input-icon">{icon}</span>}<input id={name} name={name} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : hint ? `${name}-hint` : undefined} {...props} /></div>
    {error && <p id={errorId} className="inline-error">{error}</p>}
    {hint && <p id={`${name}-hint`} className="field-help">{hint}</p>}
  </div>;
}

function PasswordInput({ id, name, label = 'Password', show, onToggle, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { id: string; name: string; label?: string; show: boolean; onToggle: () => void; error?: string }) {
  const errorId = `${name}-error`;
  return <div className={`field-wrap ${error ? 'field-invalid' : ''}`}>
    <label htmlFor={id}>{label}</label>
    <div className="input-shell input-with-icon password-shell"><span className="input-icon"><Icon name="lock" /></span><input id={id} name={name} type={show ? 'text' : 'password'} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} {...props} /><button className="password-toggle" type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={onToggle}><Icon name="eye" /></button></div>
    {error && <p id={errorId} className="inline-error">{error}</p>}
  </div>;
}

function SelectInput({ label, name, error, options }: { label: string; name: string; error?: string; options: string[] }) {
  return <div className={`field-wrap ${error ? 'field-invalid' : ''}`}><label htmlFor={name}>{label}</label><div className="input-shell select-shell"><select id={name} name={name} defaultValue="" aria-invalid={Boolean(error)}><option value="">Choose a class</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>{error && <p className="inline-error" role="alert">{error}</p>}</div>;
}

function Button({ children, variant = 'primary', loading = false, disabled = false, icon, onClick }: { children: ReactNode; variant?: 'primary' | 'secondary'; loading?: boolean; disabled?: boolean; icon?: ReactNode; onClick?: () => void }) {
  return <button className={`auth-button auth-button-${variant}`} type={onClick ? 'button' : 'submit'} disabled={disabled || loading} onClick={onClick}>{loading ? <><span className="button-spinner" />Please wait…</> : <>{children}{icon && <span className="button-icon">{icon}</span>}</>}</button>;
}

function Checkbox({ name, required = false, error, children }: { name: string; required?: boolean; error?: string; children: ReactNode }) {
  return <div className="checkbox-wrap"><label className="checkbox-label"><input name={name} type="checkbox" required={required} aria-invalid={Boolean(error)} /><span className="custom-checkbox"><Icon name="check" /></span><span>{children}</span></label>{error && <p className="inline-error" role="alert">{error}</p>}</div>;
}

function AlertBanner({ tone, message }: { tone: 'error' | 'success' | 'info'; message: string }) {
  return <div className={`alert-banner alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'}><span className="alert-mark">{tone === 'error' ? '!' : tone === 'success' ? '✓' : 'i'}</span><span>{message}</span></div>;
}

function Divider() { return <div className="auth-divider"><span>OR</span></div>; }

function BrandPanel() {
  return <aside className="brand-panel" aria-label="Topset platform preview">
    <div className="brand-grid" aria-hidden="true" />
    <div className="brand-panel-content">
      <div className="telemetry-pill"><span className="eyebrow-dot" /> TOPSET PLATFORM <span className="pill-separator">/</span> STRENGTH TRAINING</div>
      <h2>Build programs.<br /><span>Peak on</span><br /><span>meet day.</span></h2>
      <p className="brand-description">A focused workspace for coaches and lifters planning their next block.</p>
      <SampleProgram />
    </div>
    <div className="brand-panel-footer"><span><Icon name="spark" /> TRAIN WITH INTENTION</span><span>COACH · ATHLETE · TRAINING</span></div>
  </aside>;
}

function SampleProgram() {
  return <section className="sample-program" aria-label="Sample training program preview">
    <div className="sample-card-heading"><div><span className="eyebrow">SAMPLE PROGRAM</span><h3>Week 4 · Accumulation</h3></div><span className="rpe-chip">TARGET RPE 8</span></div>
    <div className="sample-lift"><span className="lift-code">SQ</span><div><strong>Barbell back squat</strong><span>Top set · 4 × 4</span></div><b>160 <small>KG</small></b></div>
    <div className="sample-lift"><span className="lift-code">BP</span><div><strong>Competition bench</strong><span>Paused · 4 × 5</span></div><b>105 <small>KG</small></b></div>
    <div className="sample-lift"><span className="lift-code">DL</span><div><strong>Conventional deadlift</strong><span>Back-off · 3 × 5</span></div><b>185 <small>KG</small></b></div>
    <p className="sample-disclaimer">Illustrative training data · sample only</p>
  </section>;
}

function ProgressSteps({ step }: { step: 1 | 2 }) {
  return <div className="progress-steps" aria-label={`Step ${step} of 2`}><span className="progress-label"><b>0{step}</b> {step === 1 ? 'ROLE SELECTION' : 'ACCOUNT DETAILS'}</span><div className="progress-bars"><span className={step >= 1 ? 'active' : ''} /><span className={step >= 2 ? 'active' : ''} /></div></div>;
}

function RoleCard({ role, selected, onSelect, title, category, description, features }: { role: Role; selected: boolean; onSelect: () => void; title: string; category: string; description: string; features: string[] }) {
  return <label className={`role-card ${selected ? 'selected' : ''}`}>
    <input type="radio" name="accountRole" value={role} checked={selected} onChange={onSelect} aria-label={title} />
    <span className="role-check"><Icon name="check" /></span>
    <span className="role-card-top"><span className="role-icon"><Icon name={role} /></span><span className="role-category">{category}</span></span>
    <span className="role-card-title">{title}</span><span className="role-card-description">{description}</span>
    <span className="role-features-label">PLANNED · NOT AVAILABLE YET</span>
    <span className="role-features">{features.map((feature) => <span key={feature}><span className="feature-check"><Icon name="check" /></span>{feature}</span>)}</span>
  </label>;
}

function StrengthMeter({ password }: { password: string }) {
  const score = useMemo(() => {
    if (!password) return 0;
    return [password.length >= 8, /\d/.test(password), /[^A-Za-z0-9]/.test(password), password.length >= 12].filter(Boolean).length;
  }, [password]);
  return <div className="strength-meter" aria-label={`Password strength ${score} out of 4`}><span>Password strength</span><div>{[0, 1, 2, 3].map((segment) => <i key={segment} className={score > segment ? `strength-on strength-${score}` : ''} />)}</div><b>{score >= 4 ? 'STRONG' : score >= 3 ? 'GOOD' : score >= 1 ? 'BUILDING' : '—'}</b></div>;
}

function RequirementChips({ password }: { password: string }) {
  const requirements = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: '1 number', met: /\d/.test(password) },
    { label: '1 special character', met: /[^A-Za-z0-9]/.test(password) },
  ];
  return <div className="requirement-chips" aria-label="Password requirements">{requirements.map((item) => <span className={item.met ? 'met' : ''} key={item.label}><Icon name="check" />{item.label}</span>)}</div>;
}

function UnitToggle({ unit, onChange }: { unit: WeightUnit; onChange: (unit: WeightUnit) => void }) {
  return <fieldset className="unit-toggle" aria-label="Weight unit"><legend className="visually-hidden">Weight unit</legend><label><input type="radio" name="unit" value="kg" checked={unit === 'kg'} onChange={() => onChange('kg')} /><span>KG</span></label><label><input type="radio" name="unit" value="lb" checked={unit === 'lb'} onChange={() => onChange('lb')} /><span>LB</span></label></fieldset>;
}
