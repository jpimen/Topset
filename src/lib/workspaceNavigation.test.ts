import { describe, expect, it } from 'vitest';
import { getWorkspaceNavigation } from './workspaceNavigation';

describe('workspace navigation', () => {
  it('shows the IPF Rulebook link in both workspaces with role-scoped routes', () => {
    expect(getWorkspaceNavigation('coach')).toContainEqual({ label: 'IPF Rulebook', to: '/coach/rulebook' });
    expect(getWorkspaceNavigation('athlete')).toContainEqual({ label: 'IPF Rulebook', to: '/athlete/rulebook' });
  });

  it('preserves the existing role destinations', () => {
    expect(getWorkspaceNavigation('coach').map(({ label }) => label)).toEqual([
      'Dashboard', 'Programs', 'Athletes', 'Exercises', 'Calculators', 'IPF Rulebook', 'Profile', 'Settings',
    ]);
    expect(getWorkspaceNavigation('athlete').map(({ label }) => label)).toEqual([
      'Program', 'Progress', 'Calculators', 'IPF Rulebook', 'Profile', 'Settings',
    ]);
  });
});
