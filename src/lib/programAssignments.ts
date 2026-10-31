import { supabase } from './supabase';

export type ProgramAssignment = {
  id: string;
  program_id: string;
  coach_id: string;
  athlete_id: string;
  start_date: string;
  sync_mode: 'live' | 'snapshot';
  status: 'active' | 'ended';
  athlete: {
    id: string;
    name: string;
    category: string | null;
    weight_class: string | null;
    team_name: string | null;
    profile_photo_path: string | null;
  } | null;
  program: { id: string; name: string } | null;
};

function client() {
  if (!supabase) throw new Error('Supabase environment is not configured.');
  return supabase;
}

function raise(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function assignProgramToAthletes(input: {
  programId: string;
  athleteIds: string[];
  startDate: string;
  syncMode: 'live' | 'snapshot';
}): Promise<void> {
  const { error } = await client().rpc('assign_program_to_athletes', {
    p_program_id: input.programId,
    p_athlete_ids: input.athleteIds,
    p_start_date: input.startDate,
    p_sync_mode: input.syncMode,
  });
  raise(error);
}

export async function listActiveAssignments(coachId: string): Promise<ProgramAssignment[]> {
  const { data, error } = await client().from('program_assignments')
    .select('id, program_id, coach_id, athlete_id, start_date, sync_mode, status, athlete:profiles!program_assignments_athlete_id_fkey(id, name, category, weight_class, team_name, profile_photo_path), program:programs!program_assignments_program_id_fkey(id, name)')
    .eq('coach_id', coachId).eq('status', 'active').order('start_date', { ascending: true });
  raise(error);
  return (data ?? []) as unknown as ProgramAssignment[];
}

export async function endProgramAssignment(assignmentId: string): Promise<void> {
  const { error } = await client().rpc('end_program_assignment', { p_assignment_id: assignmentId });
  raise(error);
}
