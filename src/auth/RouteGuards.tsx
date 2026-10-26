import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, type Role } from './AuthProvider';

export function HomeRedirect() {
  const { session, profile, loading, profileError } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (profileError || !profile) return <ProfileError />;
  return <Navigate to={`/${profile.role}`} replace />;
}

export function RequireRole({ role }: { role: Role }) {
  const { session, profile, loading, profileError } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  if (profileError || !profile) return <ProfileError />;
  if (profile.role !== role) return <Navigate to={`/${profile.role}`} replace />;
  return <Outlet />;
}

export function LoadingScreen() {
  return <main className="state-screen" role="status"><span className="spinner" />Checking your account…</main>;
}

function ProfileError() {
  const { profileError, refreshProfile } = useAuth();
  return (
    <main className="state-screen">
      <div className="state-card">
        <p className="eyebrow">ACCOUNT PROFILE</p>
        <h1>We couldn’t finish signing you in.</h1>
        <p>{profileError ?? 'Your account profile is not available yet.'}</p>
        <button className="button button-primary" onClick={() => void refreshProfile()}>Try again</button>
      </div>
    </main>
  );
}
