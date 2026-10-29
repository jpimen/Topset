import { describe, expect, it } from 'vitest';
import { normalizeCoachInviteInput } from './coachInvite';

const inviteCode = '0123456789abcdef0123456789abcdef0123456789abcdef';

describe('normalizeCoachInviteInput', () => {
  it('accepts and normalizes a raw invite code', () => {
    expect(normalizeCoachInviteInput(inviteCode)).toBe(inviteCode);
    expect(normalizeCoachInviteInput(inviteCode.toUpperCase())).toBe(inviteCode);
  });

  it('extracts the invite code from the coach share link', () => {
    const inviteUrl = `http://localhost:5173/signup?role=athlete&invite=${inviteCode}`;
    expect(normalizeCoachInviteInput(inviteUrl)).toBe(inviteCode);
  });

  it('rejects missing, truncated, and unrelated links', () => {
    expect(normalizeCoachInviteInput('')).toBeNull();
    expect(normalizeCoachInviteInput('http://localhost:5173/signup?role=athlete&invite')).toBeNull();
    expect(normalizeCoachInviteInput('https://example.com/signup?role=athlete')).toBeNull();
    expect(normalizeCoachInviteInput('not-an-invite')).toBeNull();
  });
});
