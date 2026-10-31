import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { archiveProgram, createProgram, duplicateProgram, listPrograms } from '../../lib/programs/repository';
import { listActiveAssignments, assignProgramToAthletes } from '../../lib/programAssignments';
import { listCoachLinks, relationshipErrorMessage, type CoachLink } from '../../lib/coachAthletes';
import { supabase } from '../../lib/supabase';
import { CoachPageHeader } from './CoachPageHeader';
import { useCoachId } from './useCoachId';

export function ProgramsPage() {
  const coachId = useCoachId();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Awaited<ReturnType<typeof listPrograms>>>([]);
  const [assignments, setAssignments] = useState<Awaited<ReturnType<typeof listActiveAssignments>>>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [assignmentError, setAssignmentError] = useState('');
  const [activeAthletes, setActiveAthletes] = useState<CoachLink[]>([]);
  const [programToAssign, setProgramToAssign] = useState<{ id: string; name: string } | null>(null);
  const [selectedAthleteId, setSelectedAthleteId] = useState('');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [syncMode, setSyncMode] = useState<'live' | 'snapshot'>('live');

  const refresh = async () => {
    try {
      const [nextPrograms, nextAssignments] = await Promise.all([listPrograms(coachId), listActiveAssignments(coachId)]);
      setPrograms(nextPrograms);
      setAssignments(nextAssignments);
      setError(false);
    } catch {
      setError(true);
    }
  };

  useEffect(() => { void refresh(); }, [coachId]);

  useEffect(() => {
    let current = true;
    const paths = new Map<string, string>();
    assignments.forEach((assignment) => {
      if (assignment.athlete?.profile_photo_path) paths.set(assignment.athlete_id, assignment.athlete.profile_photo_path);
    });
    activeAthletes.forEach((link) => {
      if (link.athlete?.profile_photo_path) paths.set(link.athlete_id, link.athlete.profile_photo_path);
    });
    if (!supabase || !paths.size) {
      setPhotoUrls({});
      return () => { current = false; };
    }
    const storage = supabase;
    void Promise.all([...paths].map(async ([athleteId, path]) => {
      const { data, error: photoError } = await storage.storage.from('athlete-profile-photos').createSignedUrl(path, 3600);
      return photoError ? null : [athleteId, data.signedUrl] as const;
    })).then((results) => {
      if (current) setPhotoUrls(Object.fromEntries(results.filter((result): result is readonly [string, string] => result !== null)));
    });
    return () => { current = false; };
  }, [assignments, activeAthletes]);

  const assignmentsByProgram = useMemo(() => {
    const grouped = new Map<string, typeof assignments>();
    assignments.forEach((assignment) => {
      grouped.set(assignment.program_id, [...(grouped.get(assignment.program_id) ?? []), assignment]);
    });
    return grouped;
  }, [assignments]);
  const filtered = programs.filter((program) => program.name.toLowerCase().includes(search.trim().toLowerCase()));

  const makeProgram = async () => {
    setBusy(true);
    try { navigate(`/coach/programs/${await createProgram(coachId)}`); } catch { setError(true); } finally { setBusy(false); }
  };
  const makeCopy = async (id: string) => {
    setBusy(true);
    try { navigate(`/coach/programs/${await duplicateProgram(id, coachId)}`); } catch { setError(true); } finally { setBusy(false); }
  };
  const archive = async (id: string, name: string) => {
    if (!window.confirm(`Archive “${name}”? It will leave the active program list.`)) return;
    setBusy(true);
    try { await archiveProgram(id); await refresh(); } catch { setError(true); } finally { setBusy(false); }
  };
  const openAssignment = async (program: { id: string; name: string }) => {
    setProgramToAssign(program);
    setSelectedAthleteId('');
    setAssignmentError('');
    setNotice('');
    try {
      setActiveAthletes((await listCoachLinks(coachId)).filter((link) => link.status === 'active'));
    } catch (cause) {
      setAssignmentError(relationshipErrorMessage(cause));
    }
  };
  const submitAssignment = async () => {
    if (!programToAssign || !selectedAthleteId || !startDate) return;
    setBusy(true);
    setAssignmentError('');
    try {
      await assignProgramToAthletes({ programId: programToAssign.id, athleteIds: [selectedAthleteId], startDate, syncMode });
      const athleteName = activeAthletes.find((link) => link.athlete_id === selectedAthleteId)?.athlete?.name ?? 'athlete';
      setNotice(`${programToAssign.name} assigned to ${athleteName}.`);
      setProgramToAssign(null);
      await refresh();
    } catch (cause) {
      setAssignmentError(relationshipErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return <main className="coach-page programs-page">
    <CoachPageHeader eyebrow="COACH WORKSPACE / PROGRAMS" title="Programs" description="Build and maintain your training plans." actions={<button className="button button-primary" disabled={busy} onClick={() => void makeProgram()}>+ New program</button>} />
    <section className="coach-panel programs-panel">
      <div className="list-toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search programs" aria-label="Search programs" /></label><span className="result-count">{filtered.length} {filtered.length === 1 ? 'program' : 'programs'}</span></div>
      {error && <div className="inline-state error-state" role="alert">A program action failed. Check your connection and retry.</div>}
      {notice && <div className="inline-state" role="status">{notice}</div>}
      {programs.length === 0 && !error ? <div className="empty-state"><span className="empty-state-mark">+</span><h2>No programs yet</h2><p>Create your first program, then add weeks, days, and exercises in the builder.</p><button className="button button-primary" disabled={busy} onClick={() => void makeProgram()}>Create a program</button></div>
        : filtered.length === 0 ? <div className="empty-state"><h2>No matching programs</h2><p>Try a different search.</p></div>
          : <div className="program-list" role="list">{filtered.map((program) => {
            const programAssignments = assignmentsByProgram.get(program.id) ?? [];
            return <article className="program-list-row" key={program.id} role="listitem">
              <div className="program-list-icon">P</div>
              <div className="program-list-main">
                <Link to={`/coach/programs/${program.id}`}>{program.name}</Link>
                <p>{program.unit.toUpperCase()} · Updated {new Date(program.updated_at).toLocaleDateString()}</p>
                {programAssignments.length ? <div className="program-assigned-athletes" aria-label={`Athletes assigned to ${program.name}`}>
                  {programAssignments.map((assignment) => <div className="program-assigned-athlete" key={assignment.id}>
                    {photoUrls[assignment.athlete_id] ? <img className="program-athlete-avatar" src={photoUrls[assignment.athlete_id]} alt="" /> : <span className="program-athlete-avatar program-athlete-avatar-fallback" aria-hidden="true">{assignment.athlete?.name.slice(0, 1).toUpperCase() ?? 'A'}</span>}
                    <span><strong>{assignment.athlete?.name ?? 'Athlete'}</strong><small>{assignment.athlete?.category || 'Athlete'}{assignment.athlete?.weight_class ? ` · ${assignment.athlete.weight_class}` : ''}</small></span>
                  </div>)}
                </div> : <small className="program-no-athletes">No athletes assigned</small>}
              </div>
              <div className="program-row-actions"><button className="button button-secondary" disabled={busy} onClick={() => void openAssignment(program)}>Assign</button><Link className="button button-secondary" to={`/coach/programs/${program.id}`}>Open</Link><button className="button button-quiet" disabled={busy} onClick={() => void makeCopy(program.id)}>Duplicate</button><button className="button button-quiet danger-quiet" disabled={busy} onClick={() => void archive(program.id, program.name)}>Archive</button></div>
            </article>;
          })}</div>}
    </section>
    {programToAssign && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setProgramToAssign(null); }}>
      <section className="exercise-dialog assignment-dialog" role="dialog" aria-modal="true" aria-labelledby="assignment-title">
        <div className="panel-heading"><div><p className="eyebrow">PROGRAM ASSIGNMENT</p><h2 id="assignment-title">Assign {programToAssign.name}</h2></div><button className="icon-button" aria-label="Close" disabled={busy} onClick={() => setProgramToAssign(null)}>×</button></div>
        {assignmentError && <p className="inline-error" role="alert">{assignmentError}</p>}
        <fieldset className="assignment-athletes"><legend className="field-label">Choose one active athlete</legend>
          {activeAthletes.length ? activeAthletes.map((link) => <label key={link.id} className={`assignment-athlete-option${selectedAthleteId === link.athlete_id ? ' selected' : ''}`}>
            <input type="radio" name="assignment-athlete" value={link.athlete_id} checked={selectedAthleteId === link.athlete_id} onChange={() => setSelectedAthleteId(link.athlete_id)} />
            {photoUrls[link.athlete_id] ? <img className="assignment-athlete-avatar" src={photoUrls[link.athlete_id]} alt="" /> : <span className="assignment-athlete-avatar assignment-athlete-avatar-fallback" aria-hidden="true">{link.athlete?.name.slice(0, 1).toUpperCase() ?? 'A'}</span>}
            <span className="assignment-athlete-copy"><strong>{link.athlete?.name ?? 'Athlete'}</strong><small>{link.athlete?.category || 'Athlete'}{link.athlete?.weight_class ? ` · ${link.athlete.weight_class}` : ''}{link.athlete?.team_name ? ` · ${link.athlete.team_name}` : ''}</small></span>
          </label>) : <p>No linked athletes yet. Approve a join request from the Athletes page first.</p>}
        </fieldset>
        <label className="form-field">Start date<input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label className="form-field">Edit behavior<select value={syncMode} onChange={(event) => setSyncMode(event.target.value as 'live' | 'snapshot')}><option value="live">Live — future coach edits sync</option><option value="snapshot">Snapshot — keep this version fixed</option></select></label>
        <p className="field-help">Assigning a new program ends this athlete’s previous active assignment.</p>
        <div className="dialog-actions"><button className="button button-secondary" disabled={busy} onClick={() => setProgramToAssign(null)}>Cancel</button><button className="button button-primary" disabled={busy || !selectedAthleteId || !activeAthletes.length} onClick={() => void submitAssignment()}>{busy ? 'Assigning…' : 'Assign to athlete'}</button></div>
      </section>
    </div>}
  </main>;
}
