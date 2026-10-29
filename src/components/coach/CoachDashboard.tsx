import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCoachSummary } from '../../lib/programs/repository';
import { CoachPageHeader } from './CoachPageHeader';
import { useCoachId } from './useCoachId';

export function CoachDashboard() {
  const coachId = useCoachId();
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getCoachSummary>> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { let active = true; void getCoachSummary(coachId).then((value) => active && setSummary(value)).catch(() => active && setError(true)); return () => { active = false; }; }, [coachId]);
  return <main className="coach-page dashboard-page">
    <CoachPageHeader eyebrow="COACH WORKSPACE / OVERVIEW" title="Dashboard" description="Your programs and roster at a glance." actions={<Link className="button button-primary" to="/coach/programs">Open programs <span aria-hidden="true">→</span></Link>} />
    {error ? <div className="inline-state error-state" role="alert">We could not load your dashboard. Refresh to try again.</div> : !summary ? <div className="dashboard-skeleton" aria-label="Loading dashboard" /> : <>
      <section className="metric-cards" aria-label="Workspace counts"><article><span>PROGRAMS</span><strong>{summary.programCount}</strong><small>Active program documents</small></article><article><span>ACTIVE ATHLETES</span><strong>{summary.athleteCount}</strong><small>Roster links available</small></article></section>
      <section className="coach-panel recent-programs"><div className="panel-heading"><div><p className="eyebrow">RECENT WORK</p><h2>Recently updated programs</h2></div><Link to="/coach/programs">View all <span aria-hidden="true">→</span></Link></div>
        {summary.recent.length ? <div className="recent-list">{summary.recent.map((program) => <Link className="recent-program" key={program.id} to={`/coach/programs/${program.id}`}><span className="recent-program-icon">P</span><span><strong>{program.name}</strong><small>{program.unit.toUpperCase()} · Updated {new Date(program.updated_at).toLocaleDateString()}</small></span><b aria-hidden="true">→</b></Link>)}</div> : <div className="empty-state compact-empty"><span className="empty-state-mark">＋</span><h3>Your first program starts here</h3><p>Create a program to begin building training weeks and sessions.</p><Link className="button button-primary" to="/coach/programs">Create a program</Link></div>}
      </section>
    </>}
  </main>;
}
