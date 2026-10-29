create or replace function public.athlete_has_live_assigned_exercise(p_exercise_id uuid, p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_athlete_id = (select auth.uid()) and exists (
    select 1
    from public.program_exercises pe
    join public.days d on d.id = pe.day_id
    join public.weeks w on w.id = d.week_id
    join public.program_assignments a on a.program_id = w.program_id
    where pe.exercise_id = p_exercise_id
      and a.athlete_id = p_athlete_id
      and a.status = 'active'
      and a.sync_mode = 'live'
      and public.is_active_coach_athlete(a.coach_id, a.athlete_id)
  );
$$;

revoke all on function public.athlete_has_live_assigned_exercise(uuid, uuid) from public, anon;
grant execute on function public.athlete_has_live_assigned_exercise(uuid, uuid) to authenticated;

drop policy "athletes read exercises in live assignments" on public.exercises;
create policy "athletes read exercises in live assignments" on public.exercises
  for select to authenticated using (
    public.current_user_has_role('athlete')
    and public.athlete_has_live_assigned_exercise(id, (select auth.uid()))
  );
