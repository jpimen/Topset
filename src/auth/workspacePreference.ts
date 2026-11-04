export type WorkspaceRole = 'coach' | 'athlete';

export function canAccessWorkspace(capabilities: readonly WorkspaceRole[], requested: WorkspaceRole): boolean {
  return capabilities.includes(requested);
}

const storageKey = (profileId: string) => `topset:workspace:${profileId}`;

export function getPreferredWorkspace(
  profileId: string,
  capabilities: readonly WorkspaceRole[],
  fallback: WorkspaceRole,
): WorkspaceRole {
  try {
    const stored = window.localStorage.getItem(storageKey(profileId));
    if ((stored === 'coach' || stored === 'athlete') && capabilities.includes(stored)) return stored;
  } catch { /* Workspace preference is optional when browser storage is unavailable. */ }
  return capabilities.includes(fallback) ? fallback : capabilities[0] ?? fallback;
}

export function setPreferredWorkspace(profileId: string, workspace: WorkspaceRole): void {
  try { window.localStorage.setItem(storageKey(profileId), workspace); }
  catch { /* The current route still switches if browser storage is unavailable. */ }
}
