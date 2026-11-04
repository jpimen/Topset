// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { canAccessWorkspace, getPreferredWorkspace, setPreferredWorkspace } from './workspacePreference';

describe('workspace preference', () => {
  beforeEach(() => localStorage.clear());

  it('uses the stored workspace when the account has that capability', () => {
    setPreferredWorkspace('coach-1', 'athlete');
    expect(getPreferredWorkspace('coach-1', ['coach', 'athlete'], 'coach')).toBe('athlete');
  });

  it('ignores a stored workspace the account cannot access', () => {
    setPreferredWorkspace('coach-1', 'athlete');
    expect(getPreferredWorkspace('coach-1', ['coach'], 'coach')).toBe('coach');
  });

  it('keeps legacy single-capability accounts on their existing workspace', () => {
    expect(getPreferredWorkspace('athlete-1', ['athlete'], 'coach')).toBe('athlete');
  });

  it('allows route access only for a granted workspace capability', () => {
    expect(canAccessWorkspace(['coach', 'athlete'], 'athlete')).toBe(true);
    expect(canAccessWorkspace(['athlete'], 'coach')).toBe(false);
  });
});
