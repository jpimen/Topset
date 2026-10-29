import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AthleteCoachLinkCard } from './AthleteCoachLinkCard';

export function AthleteProgressPage() {
  return <main className="athlete-page"><header className="athlete-page-heading"><div><p className="eyebrow">PROGRESS</p><h1>Your training, over time</h1><p>Strength trends and training history will appear here as you log workouts.</p></div></header><section className="coach-panel empty-state athlete-placeholder"><span className="empty-state-mark">↗</span><h2>Progress tracking is next</h2><p>For now, your completed sessions are available in Today and your coach can review synced logs.</p><Link className="button button-secondary" to="/athlete">Go to today’s workout</Link></section></main>;
}

export function AthleteProfilePage() {
  const { profile } = useAuth();
  return <main className="athlete-page"><header className="athlete-page-heading"><div><p className="eyebrow">PROFILE</p><h1>Your account</h1><p>Your training details and coach connection.</p></div></header><section className="coach-panel athlete-profile-card"><span className="user-avatar">{profile?.name.slice(0, 1).toUpperCase() ?? 'A'}</span><div><p className="eyebrow">ATHLETE</p><h2>{profile?.name ?? 'Athlete'}</h2></div><Link className="button button-secondary" to="/athlete/calculators">Calculators</Link></section><AthleteCoachLinkCard /></main>;
}
