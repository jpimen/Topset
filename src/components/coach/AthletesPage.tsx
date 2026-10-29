import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoachPageHeader } from './CoachPageHeader';
import { useCoachId } from './useCoachId';
import {
  generateCoachInviteCode,
  listCoachLinks,
  relationshipErrorMessage,
  removeCoachAthleteLink,
  respondToCoachLink,
  type CoachLink,
} from '../../lib/coachAthletes';
import { endProgramAssignment, listActiveAssignments, type ProgramAssignment } from '../../lib/programAssignments';

export function AthletesPage() {
  const coachId = useCoachId();
  const [links, setLinks] = useState<CoachLink[]>([]);
  const [assignments, setAssignments] = useState<ProgramAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [nextLinks, nextAssignments] = await Promise.all([
        listCoachLinks(coachId),
        listActiveAssignments(coachId),
      ]);
      setLinks(nextLinks);
      setAssignments(nextAssignments);
    } catch (cause) {
      setError(relationshipErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const assignmentsByAthlete = useMemo(() => {
    const grouped = new Map<string, ProgramAssignment[]>();
    assignments.forEach((assignment) => {
      const current = grouped.get(assignment.athlete_id) ?? [];
      current.push(assignment);
      grouped.set(assignment.athlete_id, current);
    });
    return grouped;
  }, [assignments]);

  const createInvite = async () => {
    setBusyId('invite');
    setError('');
    setNotice('');
    try {
      const code = await generateCoachInviteCode();
      const url = new URL('/signup', window.location.origin);
      url.searchParams.set('role', 'athlete');
      url.searchParams.set('invite', code);
      setInviteLink(url.toString());
      setNotice('New invite created. Creating another code will invalidate this one.');
    } catch (cause) {
      setError(relationshipErrorMessage(cause));
    } finally {
      setBusyId('');
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setNotice('Invite link copied. Share it with your athlete.');
    } catch {
      setError('Could not copy the link. Select and copy it manually.');
    }
  };

  const reviewRequest = async (link: CoachLink, approve: boolean) => {
    setBusyId(link.id);
    setError('');
    setNotice('');
    try {
      await respondToCoachLink(link.id, approve);
      setNotice(approve ? `${link.athlete?.name ?? 'Athlete'} is now linked.` : 'Join request declined.');
      await refresh();
    } catch (cause) {
      setError(relationshipErrorMessage(cause));
    } finally {
      setBusyId('');
    }
  };

  const removeAthlete = async (link: CoachLink) => {
    const name = link.athlete?.name ?? 'this athlete';
    if (!window.confirm(`Remove ${name} from your roster? Their program access ends immediately.`)) return;
    setBusyId(link.id);
    setError('');
    setNotice('');
    try {
      await removeCoachAthleteLink(link.id);
      setNotice(`${name} was removed from your roster.`);
      await refresh();
    } catch (cause) {
      setError(relationshipErrorMessage(cause));
    } finally {
      setBusyId('');
    }
  };

  const stopAssignment = async (assignment: ProgramAssignment) => {
    if (!window.confirm(`End ${assignment.program?.name ?? 'this program'} for ${assignment.athlete?.name ?? 'this athlete'}?`)) return;
    setBusyId(assignment.id);
    setError('');
    try {
      await endProgramAssignment(assignment.id);
      setNotice('Program assignment ended.');
      await refresh();
    } catch (cause) {
      setError(relationshipErrorMessage(cause));
    } finally {
      setBusyId('');
    }
  };

  const pending = links.filter((link) => link.status === 'pending');
  const active = links.filter((link) => link.status === 'active');

  return (
    <main className="coach-page athletes-page">
      <CoachPageHeader
        eyebrow="COACH WORKSPACE / ROSTER"
        title="Athletes"
        description="Manage coach links and assigned programs. Athletes request access with your invite; you approve each request."
        actions={<button className="button button-primary" disabled={busyId === 'invite'} onClick={() => void createInvite()}>{busyId === 'invite' ? 'Creating…' : inviteLink ? 'Create new invite' : 'Create invite link'}</button>}
      />

      {error && <div className="inline-state error-state" role="alert">{error}</div>}
      {notice && <div className="inline-state" role="status">{notice}</div>}

      {inviteLink && (
        <section className="coach-panel invite-panel" aria-labelledby="invite-title">
          <div className="panel-heading"><div><p className="eyebrow">SHAREABLE INVITE</p><h2 id="invite-title">Invite an athlete</h2></div></div>
          <p>Share this private link with your athlete. It creates a pending request for your approval. Creating another invite invalidates this one.</p>
          <div className="invite-link-row"><input aria-label="Athlete invite link" readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} /><button className="button button-secondary" onClick={() => void copyInvite()}>Copy link</button></div>
          <small>Email invitations are not configured. Share this link directly.</small>
        </section>
      )}

      <section className="coach-panel roster-panel" aria-labelledby="requests-title">
        <div className="panel-heading"><div><p className="eyebrow">REVIEW</p><h2 id="requests-title">Join requests <span className="result-count">{pending.length}</span></h2></div></div>
        {loading ? <div className="dashboard-skeleton" aria-label="Loading join requests" /> : pending.length === 0 ? (
          <div className="empty-state compact-empty"><h3>No pending requests</h3><p>When an athlete signs up through your invite link, their request will appear here.</p></div>
        ) : (
          <div className="roster-list">
            {pending.map((link) => (
              <article className="roster-row" key={link.id}>
                <div><strong>{link.athlete?.name ?? 'Athlete'}</strong><small>Requested {new Date(link.created_at).toLocaleDateString()}</small></div>
                <div className="program-row-actions"><button className="button button-secondary" disabled={busyId === link.id} onClick={() => void reviewRequest(link, false)}>Decline</button><button className="button button-primary" disabled={busyId === link.id} onClick={() => void reviewRequest(link, true)}>Approve</button></div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="coach-panel roster-panel" aria-labelledby="active-athletes-title">
        <div className="panel-heading"><div><p className="eyebrow">ACTIVE LINKS</p><h2 id="active-athletes-title">Your roster <span className="result-count">{active.length}</span></h2></div></div>
        {loading ? <div className="dashboard-skeleton" aria-label="Loading roster" /> : active.length === 0 ? (
          <div className="empty-state compact-empty"><h3>No athletes linked</h3><p>Create an invite link to start building your roster.</p></div>
        ) : (
          <div className="roster-list">
            {active.map((link) => {
              const athleteAssignments = assignmentsByAthlete.get(link.athlete_id) ?? [];
              return (
                <article className="roster-row roster-athlete-row" key={link.id}>
                  <div><strong>{link.athlete?.name ?? 'Athlete'}</strong><small>Linked {new Date(link.created_at).toLocaleDateString()}</small>
                    {athleteAssignments.length ? <small>Program: {athleteAssignments.map((item) => `${item.program?.name ?? 'Program'} · ${item.sync_mode} · starts ${item.start_date}`).join(', ')}</small> : <small>No program assigned</small>}
                  </div>
                  <div className="program-row-actions">
                    {athleteAssignments.map((assignment) => <button key={assignment.id} className="button button-quiet danger-quiet" disabled={busyId === assignment.id} onClick={() => void stopAssignment(assignment)}>End assignment</button>)}
                    <button className="button button-quiet danger-quiet" disabled={busyId === link.id} onClick={() => void removeAthlete(link)}>Remove athlete</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
