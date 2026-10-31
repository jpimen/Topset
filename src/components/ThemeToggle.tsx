import { useTheme } from '../theme/ThemeProvider';
import type { ThemePreference } from '../lib/themePreference';

type ThemeToggleProps = {
  variant?: 'segmented' | 'icon';
  className?: string;
};

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  return theme === 'light'
    ? <svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="10" cy="10" r="3.5" /><path d="M10 1.5v2M10 16.5v2M1.5 10h2m13 0h2M4 4l1.4 1.4m9.2 9.2L16 16m0-12-1.4 1.4m-9.2 9.2L4 16" /></svg>
    : <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M15.8 12.3A7 7 0 0 1 7.7 4.2 7 7 0 1 0 15.8 12.3Z" /></svg>;
}

export function ThemeToggle({ variant = 'segmented', className = '' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  if (variant === 'icon') {
    return <button className={`theme-toggle-icon ${className}`.trim()} type="button" aria-label={`Switch to ${nextTheme} mode`} aria-pressed={theme === 'light'} title={`Current theme: ${theme}`} onClick={() => setTheme(nextTheme)}>
      <ThemeIcon theme={theme} /><span>{theme === 'light' ? 'Light' : 'Dark'}</span>
    </button>;
  }

  return <div className={`theme-toggle ${className}`.trim()} role="group" aria-label="Appearance">
    <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><ThemeIcon theme="light" />Light</button>
    <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><ThemeIcon theme="dark" />Dark</button>
  </div>;
}
