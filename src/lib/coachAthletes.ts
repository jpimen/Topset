import { supabase } from './supabase';
import { normalizeCoachInviteInput } from './coachInvite';

export type CoachLink = {
  id: string;
  coach_id: string;
  athlete_id: string;
  status: 'pending' | 'active' | 'removed';
  created_at: string;
  athlete: {
    id: string;
    name: string;
    bio: string | null;
    category: string | null;
    weight_class: string | null;
    team_name: string | null;
    achievements: string | null;
    profile_photo_path: string | null;
  } | null;
};

export type AthleteCoachLink = {
  id: string;
  status: 'pending' | 'active' | 'removed';
  created_at: string;
  coach: { id: string; name: string; team_name: string | null } | null;
};

function client() {
  if (!supabase) throw new Error('Supabase environment is not configured.');
  return supabase;
}

function raise(error: { message: string; code?: string } | null): void {
  if (error) throw new Error(error.code === '23505' ? error.message : error.message);
}

export async function generateCoachInviteCode(): Promise<string> {
  const { data, error } = await client().rpc('make_coach_invite_code');
  raise(error);
  if (typeof data !== 'string') throw new Error('An invite code could not be created.');
  return data;
}

export async function isCoachInviteCodeValid(code: string): Promise<boolean> {
  const normalizedCode = normalizeCoachInviteInput(code);
  if (!normalizedCode) return false;
  const { data, error } = await client().rpc('is_coach_invite_code_valid', { p_code: normalizedCode });
  raise(error);
  return data === true;
}

export async function requestCoachLink(code: string): Promise<void> {
  const normalizedCode = normalizeCoachInviteInput(code);
  if (!normalizedCode) throw new Error('invite_code_invalid');
  const { error } = await client().rpc('request_coach_link', { p_code: normalizedCode });
  raise(error);
}

export async function listCoachLinks(coachId: string): Promise<CoachLink[]> {
  const { data, error } = await client().from('coach_athlete_links')
    .select('id, coach_id, athlete_id, status, created_at, athlete:profiles!coach_athlete_links_athlete_id_fkey(id, name, bio, category, weight_class, team_name, achievements, profile_photo_path)')
    .eq('coach_id', coachId).in('status', ['pending', 'active']).order('created_at', { ascending: false });
  raise(error);
  return (data ?? []) as unknown as CoachLink[];
}

export async function getAthleteCoachLink(athleteId: string): Promise<AthleteCoachLink | null> {
  const { data, error } = await client().from('coach_athlete_links')
    .select('id, status, created_at, coach:profiles!coach_athlete_links_coach_id_fkey(id, name, team_name)')
    .eq('athlete_id', athleteId).in('status', ['pending', 'active'])
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  raise(error);
  return data as unknown as AthleteCoachLink | null;
}

export async function respondToCoachLink(linkId: string, approve: boolean): Promise<void> {
  const { error } = await client().rpc('respond_to_coach_link', { p_link_id: linkId, p_approve: approve });
  raise(error);
}

export async function removeCoachAthleteLink(linkId: string): Promise<void> {
  const { error } = await client().rpc('remove_coach_athlete_link', { p_link_id: linkId });
  raise(error);
}

export function relationshipErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('invite_code_invalid')) return 'That invite code is not valid. Check it with your coach and try again.';
  if (message.includes('already_linked_to_coach')) return 'You already have an active coach.';
  if (message.includes('link_request_already_pending')) return 'You already have a pending coach request. Wait for that coach to respond.';
  if (message.includes('athlete_already_linked')) return 'This athlete is already connected to another coach.';
  if (message.includes('program_not_owned') || message.includes('athlete_not_linked')) return 'That program or athlete is no longer available for this assignment.';
  if (message.includes('assignment_not_found') || message.includes('link_request_not_found') || message.includes('link_not_found')) return 'This item has changed. Refresh the page and try again.';
  return 'We could not complete that request. Check your connection and try again.';
}
