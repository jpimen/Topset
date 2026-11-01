import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { HomeRedirect, RequireRole } from './auth/RouteGuards';
import { AuthPage } from './components/AuthPage';
import { AthleteWorkoutSyncProvider } from './components/athlete/AthleteWorkoutSyncProvider';
import { AthleteProgramPage } from './components/athlete/AthleteProgramPage';
import { AthleteProfilePage, AthleteProgressPage } from './components/athlete/AthleteMorePages';
import { CalculatorsPage } from './components/CalculatorsPage';
import { AthletesPage } from './components/coach/AthletesPage';
import { CoachDashboard } from './components/coach/CoachDashboard';
import { CoachSettingsPage } from './components/coach/CoachSettingsPage';
import { ExerciseLibraryPage } from './components/coach/ExerciseLibraryPage';
import { ProgramsPage } from './components/coach/ProgramsPage';
import { ProgramBuilderPage } from './components/programs/ProgramBuilderPage';
import { ThemeToggle } from './components/ThemeToggle';
import { ThemeProvider } from './theme/ThemeProvider';
import { supabase, supabaseConfigurationError } from './lib/supabase';
import './styles.css';

function WorkspaceLayout({ role }: { role: 'coach' | 'athlete' }) {
  const { profile } = useAuth();
  const navigation = role === 'coach'
    ? [{ label: 'Dashboard', to: '/coach' }, { label: 'Programs', to: '/coach/programs' }, { label: 'Athletes', to: '/coach/athletes' }, { label: 'Exercises', to: '/coach/exercises' }, { label: 'Calculators', to: '/coach/calculators' }, { label: 'Settings', to: '/coach/settings' }]
    : [{ label: 'Program', to: '/athlete/program' }, { label: 'Progress', to: '/athlete/progress' }, { label: 'Profile', to: '/athlete/profile' }];
  const routeContent = role === 'athlete'
    ? <AthleteWorkoutSyncProvider><div className="workspace-content"><Outlet /></div></AthleteWorkoutSyncProvider>
    : <div className="workspace-content"><Outlet /></div>;

  return (
    <div className={`workspace-shell workspace-${role}`}>
      <header className="workspace-header">
        <NavLink className="brand-lockup" to="/"><span className="brand-mark">T</span><span>topset<span className="brand-period">.</span></span></NavLink>
        <div className="workspace-user"><span className="user-avatar">{profile?.name.slice(0, 1).toUpperCase() ?? 'T'}</span><span>{profile?.name}</span><button onClick={() => void supabase?.auth.signOut()}>Sign out</button></div>
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
      <Route element={<RequireRole role="coach" />}><Route path="/coach" element={<WorkspaceLayout role="coach" />}><Route index element={<CoachDashboard />} /><Route path="programs" element={<ProgramsPage />} /><Route path="programs/:id" element={<ProgramBuilderPage />} /><Route path="athletes" element={<AthletesPage />} /><Route path="exercises" element={<ExerciseLibraryPage />} /><Route path="calculators" element={<CalculatorsPage />} /><Route path="settings" element={<CoachSettingsPage />} /><Route path="*" element={<Navigate to="/coach" replace />} /></Route></Route>
      <Route element={<RequireRole role="athlete" />}><Route path="/athlete" element={<WorkspaceLayout role="athlete" />}><Route index element={<Navigate to="/athlete/program" replace />} /><Route path="program" element={<AthleteProgramPage />} /><Route path="progress" element={<AthleteProgressPage />} /><Route path="profile" element={<AthleteProfilePage />} /><Route path="calculators" element={<CalculatorsPage />} /><Route path="*" element={<Navigate to="/athlete/program" replace />} /></Route></Route>
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
