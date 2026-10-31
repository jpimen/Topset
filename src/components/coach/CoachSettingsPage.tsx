import { CoachPageHeader } from './CoachPageHeader';
import { ThemeToggle } from '../ThemeToggle';

export function CoachSettingsPage() {
  return <main className="coach-page"><CoachPageHeader eyebrow="COACH WORKSPACE / SETTINGS" title="Settings" description="Workspace settings will be added in a later milestone." /><section className="coach-panel theme-toggle-settings" aria-labelledby="appearance-heading"><div className="appearance-setting-row"><div className="appearance-setting-copy"><h2 id="appearance-heading">Appearance</h2><p>Choose the display theme for this device.</p></div><ThemeToggle /></div></section><section className="coach-panel empty-state"><h2>Settings are not available yet</h2><p>Your profile and team settings are unchanged.</p></section></main>;
}
