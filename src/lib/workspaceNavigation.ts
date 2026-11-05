export type WorkspaceRole = 'coach' | 'athlete';

export interface WorkspaceNavigationLink {
  label: string;
  to: string;
}

export function getWorkspaceNavigation(role: WorkspaceRole): WorkspaceNavigationLink[] {
  return role === 'coach'
    ? [
      { label: 'Dashboard', to: '/coach' },
      { label: 'Programs', to: '/coach/programs' },
      { label: 'Athletes', to: '/coach/athletes' },
      { label: 'Exercises', to: '/coach/exercises' },
      { label: 'Calculators', to: '/coach/calculators' },
      { label: 'IPF Rulebook', to: '/coach/rulebook' },
      { label: 'Profile', to: '/coach/profile' },
      { label: 'Settings', to: '/coach/settings' },
    ]
    : [
      { label: 'Program', to: '/athlete/program' },
      { label: 'Progress', to: '/athlete/progress' },
      { label: 'Calculators', to: '/athlete/calculators' },
      { label: 'IPF Rulebook', to: '/athlete/rulebook' },
      { label: 'Profile', to: '/athlete/profile' },
      { label: 'Settings', to: '/athlete/settings' },
    ];
}
