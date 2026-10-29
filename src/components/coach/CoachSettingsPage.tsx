import { CoachPageHeader } from './CoachPageHeader';

export function CoachSettingsPage() {
  return <main className="coach-page"><CoachPageHeader eyebrow="COACH WORKSPACE / SETTINGS" title="Settings" description="Workspace settings will be added in a later milestone." /><section className="coach-panel empty-state"><h2>Settings are not available yet</h2><p>Your profile and team settings are unchanged.</p></section></main>;
}
