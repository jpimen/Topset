import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { HomeRedirect, RequireRole } from './auth/RouteGuards';
import { AuthPage } from './components/AuthPage';
import { AthleteWorkoutSyncProvider } from './components/athlete/AthleteWorkoutSyncProvider';
import { AthleteProgramPage } from './components/athlete/AthleteProgramPage';
import { AthletePostVideoPage } from './components/athlete/AthletePostVideoPage';
import { AthleteProfilePage, AthleteProgressPage, AthleteSettingsPage } from './components/athlete/AthleteMorePages';
import { CalculatorsPage } from './components/CalculatorsPage';
import { IPFRulebookPage } from './components/IPFRulebookPage';
import { AthletesPage } from './components/coach/AthletesPage';
import { CoachDashboard } from './components/coach/CoachDashboard';
import { CoachSettingsPage } from './components/coach/CoachSettingsPage';
import { CoachTrainingVideosPage } from './components/coach/CoachTrainingVideosPage';
import { CoachTrainingPage } from './components/coach/CoachTrainingPage';
import { ExerciseLibraryPage } from './components/coach/ExerciseLibraryPage';
import { ProgramsPage } from './components/coach/ProgramsPage';
import { ProgramBuilderPage } from './components/programs/ProgramBuilderPage';
import { getWorkspaceNavigation } from './lib/workspaceNavigation';
import { ThemeToggle } from './components/ThemeToggle';
import { ThemeProvider } from './theme/ThemeProvider';
import { setPreferredWorkspace } from './auth/workspacePreference';
import { supabase, supabaseConfigurationError } from './lib/supabase';
import './styles.css';

function WorkspaceLayout({ role }: { role: 'coach' | 'athlete' }) {
  const { profile, storageWarning } = useAuth();
  const navigate = useNavigate();
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
  const canSwitchWorkspace = profile?.capabilities.includes('coach') && profile.capabilities.includes('athlete');
  const otherWorkspace = role === 'coach' ? 'athlete' : 'coach';
  const switchWorkspace = () => {
    if (!profile || !canSwitchWorkspace) return;
    setPreferredWorkspace(profile.id, otherWorkspace);
    navigate(otherWorkspace === 'coach' ? '/coach' : '/athlete/program');
  };
  const content = <div className="workspace-content">
    {(storageWarning || signOutError) && <p role="alert" className="inline-error">{storageWarning || signOutError}</p>}
    <Outlet />
  </div>;
  const routeContent = role === 'athlete' ? <AthleteWorkoutSyncProvider>{content}</AthleteWorkoutSyncProvider> : content;

  return (
    <div key={`${profile?.id}:${role}`} className={`workspace-shell workspace-${role}`}>
      <header className="workspace-header">
        <NavLink className="brand-lockup" to="/"><span className="brand-mark">T</span><span>topset<span className="brand-period">.</span></span></NavLink>
        <div className="workspace-user"><span className="workspace-mode-badge" aria-label={`${role === 'coach' ? 'Coach' : 'Athlete'} workspace`}>{role === 'coach' ? 'Coach' : 'Athlete'}</span><span className="user-avatar" aria-hidden="true">{profile?.name.slice(0, 1).toUpperCase() ?? 'T'}</span><span className="workspace-user-name">{profile?.name}</span>
          {canSwitchWorkspace && <button className="button button-secondary workspace-switch" type="button" onClick={switchWorkspace} aria-label={`Switch to ${otherWorkspace} workspace`}>{otherWorkspace === 'coach' ? 'Coach' : 'Athlete'}</button>}
          <button disabled={signingOut} onClick={() => void signOut()}>{signingOut ? 'Signing out...' : 'Sign out'}</button></div>
      </header>
      <div className="workspace-body">
        <aside className="workspace-sidebar">
          <p className="eyebrow">{role === 'coach' ? 'COACH WORKSPACE' : 'ATHLETE WORKSPACE'}</p>
          <nav className="workspace-nav" aria-label="Primary navigation">
            {navigation.map(({ label, to }, index) => <NavLink key={to} to={to} end={index === 0} className={({ isActive }) => `workspace-nav-link${isActive ? ' active' : ''}`}>{label}</NavLink>)}
          </nav>
        </aside>
        {routeContent}
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/auth/callback" element={<HomeRedirect />} />
      <Route element={<RequireRole role="coach" />}><Route path="/coach" element={<WorkspaceLayout role="coach" />}><Route index element={<CoachDashboard />} /><Route path="programs" element={<ProgramsPage />} /><Route path="programs/:id" element={<ProgramBuilderPage />} /><Route path="programs/:programId/days/:dayId/videos" element={<CoachTrainingVideosPage />} /><Route path="athletes" element={<AthletesPage />} /><Route path="train" element={<CoachTrainingPage />} /><Route path="exercises" element={<ExerciseLibraryPage />} /><Route path="calculators" element={<CalculatorsPage />} /><Route path="rulebook" element={<IPFRulebookPage />} /><Route path="settings" element={<CoachSettingsPage />} /><Route path="*" element={<Navigate to="/coach" replace />} /></Route></Route>
      <Route element={<RequireRole role="athlete" />}><Route path="/athlete" element={<WorkspaceLayout role="athlete" />}><Route index element={<Navigate to="/athlete/program" replace />} /><Route path="program" element={<AthleteProgramPage />} /><Route path="post-video" element={<AthletePostVideoPage />} /><Route path="progress" element={<AthleteProgressPage />} /><Route path="profile" element={<AthleteProfilePage />} /><Route path="settings" element={<AthleteSettingsPage />} /><Route path="calculators" element={<CalculatorsPage />} /><Route path="rulebook" element={<IPFRulebookPage />} /><Route path="*" element={<Navigate to="/athlete/program" replace />} /></Route></Route>
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
