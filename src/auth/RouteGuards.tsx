import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, type Role } from './AuthProvider';
import { supabase } from '../lib/supabase';

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
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const signOut = async () => {
    if (!supabase) return;
    setSigningOut(true);
    setSignOutError('');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (cause) {
      console.error('Sign out from the account profile error screen failed.', cause);
      setSignOutError('We could not sign you out. Check your connection and try again.');
    } finally {
      setSigningOut(false);
    }
  };
  return (
    <main className="state-screen">
      <div className="state-card">
        <p className="eyebrow">ACCOUNT PROFILE</p>
        <h1>We couldn’t finish signing you in.</h1>
        <p>{profileError ?? 'Your account profile is not available yet.'}</p>
        {signOutError && <p className="inline-error" role="alert">{signOutError}</p>}
        <div className="profile-error-actions">
          <button className="button button-primary" type="button" onClick={() => void refreshProfile()}>Try again</button>
          <button className="button button-secondary" type="button" onClick={() => void signOut()} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </div>
    </main>
  );
}
