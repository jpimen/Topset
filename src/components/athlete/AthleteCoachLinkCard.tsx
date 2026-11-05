import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { getAthleteCoachLink, relationshipErrorMessage, requestCoachLink, type AthleteCoachLink } from '../../lib/coachAthletes';

export function AthleteCoachLinkCard() {
  const { profile } = useAuth();
  const [link, setLink] = useState<AthleteCoachLink | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setLink(await getAthleteCoachLink(profile.id));
    } catch (cause) {
      setError(relationshipErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await requestCoachLink(code);
      setCode('');
      setNotice('Request sent. Your coach must approve it before you are linked.');
      await refresh();
    } catch (cause) {
      setError(relationshipErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <section className="coach-panel athlete-link-card" aria-label="Loading coach link"><div className="skeleton-line short" /></section>;

  return (
    <section className="coach-panel athlete-link-card" aria-labelledby="athlete-coach-link-title">
      <p className="eyebrow">COACH CONNECTION</p>
      <h2 id="athlete-coach-link-title">{link?.status === 'active' ? 'Your coach' : link?.status === 'pending' ? 'Request pending' : 'Connect with a coach'}</h2>
      {link?.status === 'active' ? <p>You are linked with {link.coach?.name ?? 'your coach'}{link.coach?.team_name ? ` · ${link.coach.team_name}` : ''}.</p> : link?.status === 'pending' ? <p>Your request to {link.coach?.name ?? 'this coach'} is waiting for approval.</p> : <>
        <p>Paste the full invite link or its code. Your coach will approve the request before linking your accounts.</p>
        <form className="athlete-link-form" onSubmit={(event) => void submit(event)}>
          <label className="form-field">Coach invite link or code<input autoComplete="off" maxLength={2048} value={code} onChange={(event) => setCode(event.target.value)} placeholder="Paste invite link or code" required /></label>
          <button className="button button-primary" disabled={busy || !code.trim()}>{busy ? 'Sending…' : 'Request link'}</button>
        </form>
      </>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {notice && <p className="inline-state" role="status">{notice}</p>}
    </section>
  );
}
