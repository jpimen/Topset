import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { HomeRedirect, RequireRole } from './auth/RouteGuards';
import { AuthPage } from './components/AuthPage';
import { AthleteWorkoutSyncProvider } from './components/athlete/AthleteWorkoutSyncProvider';
import { AthleteProgramPage } from './components/athlete/AthleteProgramPage';
import { AthletePostVideoPage } from './components/athlete/AthletePostVideoPage';
import { AthleteProfilePage, AthleteSettingsPage } from './components/athlete/AthleteMorePages';
import { CalculatorsPage } from './components/CalculatorsPage';
import { IPFRulebookPage } from './components/IPFRulebookPage';
import { AthletesPage } from './components/coach/AthletesPage';
import { CoachDashboard } from './components/coach/CoachDashboard';
import { CoachProfilePage } from './components/coach/CoachProfilePage';
import { CoachSettingsPage } from './components/coach/CoachSettingsPage';
import { CoachTrainingVideosPage } from './components/coach/CoachTrainingVideosPage';
import { ExerciseLibraryPage } from './components/coach/ExerciseLibraryPage';
import { ProgramsPage } from './components/coach/ProgramsPage';
import { ProgramBuilderPage } from './components/programs/ProgramBuilderPage';
import { getWorkspaceNavigation } from './lib/workspaceNavigation';
import { ThemeToggle } from './components/ThemeToggle';
import { ThemeProvider } from './theme/ThemeProvider';
import { supabase, supabaseConfigurationError } from './lib/supabase';
import './styles.css';

function WorkspaceLayout({ role }: { role: 'coach' | 'athlete' }) {
  const { profile, storageWarning } = useAuth();
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    if (!supabase) return;
    setSigningOut(true);
    setSignOutError('');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (cause) {
      console.error('Sign out failed.', cause);
      setSignOutError('We could not sign you out. Check your connection and try again.');
    } finally { setSigningOut(false); }
  };
  const navigation = getWorkspaceNavigation(role);
  const content = <div className="workspace-content">
    {(storageWarning || signOutError) && <p role="alert" className="inline-error">{storageWarning || signOutError}</p>}
    <Outlet />
  </div>;
  const routeContent = role === 'athlete' ? <AthleteWorkoutSyncProvider>{content}</AthleteWorkoutSyncProvider> : content;

  return (
    <div key={`${profile?.id}:${role}`} className={`workspace-shell workspace-${role}`}>
      <header className="workspace-header">
        <NavLink className="brand-lockup" to="/" aria-label="Topset home"><span className="brand-mark" aria-hidden="true">T</span><span className="brand-word">TOPSET<span className="brand-period">.</span></span></NavLink>
        <div className="workspace-user"><Link className="workspace-user-profile" to={`/${role}/profile`} aria-label={profile?.name ? `Open ${profile.name}'s profile` : 'Open your profile'}><span className="user-avatar" aria-hidden="true">{profile?.name.slice(0, 1).toUpperCase() ?? 'T'}</span><span className="workspace-user-name">{profile?.name}</span></Link><button disabled={signingOut} onClick={() => void signOut()}>{signingOut ? 'Signing out...' : 'Sign out'}</button></div>
      </header>
      <div className="workspace-body">
        <aside className="workspace-sidebar">
          <p className="eyebrow">{role === 'coach' ? 'COACH WORKSPACE' : 'ATHLETE WORKSPACE'}</p>
          <nav className="workspace-nav" aria-label="Primary navigation">
            {navigation.map(({ label, to }, index) => <NavLink key={to} to={to} end={index === 0} aria-label={label} title={label} className={({ isActive }) => `workspace-nav-link${isActive ? ' active' : ''}`}>
              <span className="workspace-nav-icon" aria-hidden="true"><WorkspaceNavIcon destination={to} /></span>
              <span className="workspace-nav-label-full">{label}</span>
              <span className="workspace-nav-label-compact" aria-hidden="true">{compactNavigationLabel(role, label)}</span>
            </NavLink>)}
          </nav>
        </aside>
        {routeContent}
      </div>
    </div>
  );
}

function compactNavigationLabel(role: 'coach' | 'athlete', label: string): string {
  if (role !== 'athlete') return label;
  if (label === 'Calculators') return 'Tools';
  if (label === 'IPF Rulebook') return 'Rules';
  return label;
}

function WorkspaceNavIcon({ destination }: { destination: string }) {
  const path = destination.split('/').filter(Boolean).at(-1) ?? '';
  switch (path) {
    case 'program': return <svg viewBox="0 0 20 20"><path d="M3 10h14M5 6v8m10-8v8M2.5 8v4m15-4v4" /></svg>;
    case 'progress': return <svg viewBox="0 0 20 20"><path d="M3 16V9m5 7V5m5 11v-6m4 6H2m1-2 4-4 3 2 6-7" /></svg>;
    case 'calculators': return <svg viewBox="0 0 20 20"><rect x="4" y="2.5" width="12" height="15" rx="2" /><path d="M7 6h6M7 10h.01M10 10h.01M13 10h.01M7 13h.01M10 13h.01M13 13h.01" /></svg>;
    case 'rulebook': return <svg viewBox="0 0 20 20"><path d="M3.5 4.5A2 2 0 0 1 5.5 2.5H16v14H5.5a2 2 0 0 1-2-2zM3.5 4.5v10M7 6h6m-6 3h6" /></svg>;
    case 'profile': return <svg viewBox="0 0 20 20"><circle cx="10" cy="6.5" r="3" /><path d="M4 17a6 6 0 0 1 12 0" /></svg>;
    case 'settings': return <svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="3" /><path d="m8.3 2.8.4-1h2.6l.4 1a7.5 7.5 0 0 1 1.4.6l1-.4 1.8 1.8-.4 1a7.5 7.5 0 0 1 .6 1.4l1 .4v2.6l-1 .4a7.5 7.5 0 0 1-.6 1.4l.4 1-1.8 1.8-1-.4a7.5 7.5 0 0 1-1.4.6l-.4 1H8.7l-.4-1a7.5 7.5 0 0 1-1.4-.6l-1 .4-1.8-1.8.4-1a7.5 7.5 0 0 1-.6-1.4l-1-.4V7.6l1-.4a7.5 7.5 0 0 1 .6-1.4l-.4-1 1.8-1.8 1 .4a7.5 7.5 0 0 1 1.4-.6Z" transform="translate(0 1.5) scale(.9)" /></svg>;
    case 'athletes': return <svg viewBox="0 0 20 20"><circle cx="7" cy="6" r="2.5" /><circle cx="14" cy="7" r="2" /><path d="M2.5 16a4.5 4.5 0 0 1 9 0m.5-3.5a3.5 3.5 0 0 1 5.5 3" /></svg>;
    case 'exercises': return <svg viewBox="0 0 20 20"><path d="M3 10h14M5 6v8m10-8v8M2.5 8v4m15-4v4" /></svg>;
    case 'programs': return <svg viewBox="0 0 20 20"><path d="M4 3.5h12v13H4zM7 7h6m-6 3h6m-6 3h3" /></svg>;
    default: return <svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.5 1.5" /></svg>;
  }
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/auth/callback" element={<HomeRedirect />} />
      <Route element={<RequireRole role="coach" />}><Route path="/coach" element={<WorkspaceLayout role="coach" />}><Route index element={<CoachDashboard />} /><Route path="programs" element={<ProgramsPage />} /><Route path="programs/:id" element={<ProgramBuilderPage />} /><Route path="programs/:programId/days/:dayId/videos" element={<CoachTrainingVideosPage />} /><Route path="athletes" element={<AthletesPage />} /><Route path="exercises" element={<ExerciseLibraryPage />} /><Route path="calculators" element={<CalculatorsPage />} /><Route path="rulebook" element={<IPFRulebookPage />} /><Route path="profile" element={<CoachProfilePage />} /><Route path="settings" element={<CoachSettingsPage />} /><Route path="*" element={<Navigate to="/coach" replace />} /></Route></Route>
      <Route element={<RequireRole role="athlete" />}><Route path="/athlete" element={<WorkspaceLayout role="athlete" />}><Route index element={<Navigate to="/athlete/program" replace />} /><Route path="program" element={<AthleteProgramPage />} /><Route path="post-video" element={<AthletePostVideoPage />} /><Route path="profile" element={<AthleteProfilePage />} /><Route path="settings" element={<AthleteSettingsPage />} /><Route path="calculators" element={<CalculatorsPage />} /><Route path="rulebook" element={<IPFRulebookPage />} /><Route path="*" element={<Navigate to="/athlete/program" replace />} /></Route></Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppContent() {
  if (supabaseConfigurationError.length > 0) {
    return (
      <main className="state-screen config-error-screen">
        <ThemeToggle variant="icon" className="setup-theme-control" />
        <section className="state-card" role="alert">
          <p className="eyebrow">SETUP REQUIRED</p>
          <h1>Supabase environment needs attention</h1>
          <p>These environment variables are missing or still use their example placeholders:</p>
          <ul>
            {supabaseConfigurationError.map((variable) => <li key={variable}><code>{variable}</code></li>)}
          </ul>
          <p>Copy <code>.env.example</code> to <code>.env</code>, set the values from <code>npx supabase status</code>, then restart the dev server with <code>npm run dev</code>.</p>
        </section>
      </main>
    );
  }

  return <AuthProvider><AppRoutes /></AuthProvider>;
}

export default function App() {
  return <BrowserRouter><ThemeProvider><AppContent /></ThemeProvider></BrowserRouter>;
}
