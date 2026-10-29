const COACH_INVITE_CODE_PATTERN = /^[a-f0-9]{48}$/i;

export function normalizeCoachInviteInput(value: string): string | null {
  const input = value.trim();
  if (!input) return null;

  let candidate = input;
  if (input.includes('?') || input.startsWith('/')) {
    try {
      const inviteUrl = new URL(input, 'http://topset.local');
      const invite = inviteUrl.searchParams.get('invite');
      if (!invite) return null;
      candidate = invite.trim();
    } catch {
      return null;
    }
  }

  return COACH_INVITE_CODE_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
}
