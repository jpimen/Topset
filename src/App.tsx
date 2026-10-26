import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { HomeRedirect, RequireRole } from './auth/RouteGuards';
import { AuthPage } from './components/AuthPage';
import { supabase, supabaseConfigurationError } from './lib/supabase';
import './styles.css';

function RoleHome({ role }: { role: 'coach' | 'athlete' }) {
  const { profile } = useAuth();
  const title = role === 'coach' ? 'Your coaching starts here.' : 'Your next session starts here.';
  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <a className="brand-lockup" href="/"><span className="brand-mark">T</span><span>topset<span className="brand-period">.</span></span></a>
        <div className="workspace-user"><span className="user-avatar">{profile?.name.slice(0, 1).toUpperCase() ?? 'T'}</span><span>{profile?.name}</span><button onClick={() => void supabase?.auth.signOut()}>Sign out</button></div>
      </header>
      <section className="workspace-welcome">
        <p className="eyebrow">{role === 'coach' ? 'COACH WORKSPACE' : 'ATHLETE WORKSPACE'}</p>
        <h1>{title}</h1>
        <p>Welcome, {profile?.name}. Your Topset workspace is ready.</p>
        <div className="workspace-next"><span className="workspace-icon">✳</span><div><strong>Milestone 1 is in place</strong><span>Role-based accounts and access are set up. Your training tools come next.</span></div></div>
      </section>
    </main>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/auth/callback" element={<HomeRedirect />} />
      <Route element={<RequireRole role="coach" />}><Route path="/coach/*" element={<RoleHome role="coach" />} /></Route>
      <Route element={<RequireRole role="athlete" />}><Route path="/athlete/*" element={<RoleHome role="athlete" />} /></Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  if (supabaseConfigurationError.length > 0) {
    return (
      <main className="state-screen config-error-screen">
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

  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>;
}
