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
      and a.start_date <= current_date
      and a.sync_mode = 'live'
      and public.is_active_coach_athlete(a.coach_id, a.athlete_id)
  );
$$;

drop policy "athletes read assigned live programs" on public.programs;
create policy "athletes read assigned live programs" on public.programs
  for select to authenticated using (
    exists (
      select 1 from public.program_assignments a
      where a.program_id = programs.id and a.athlete_id = (select auth.uid())
        and a.status = 'active' and a.start_date <= current_date and a.sync_mode = 'live'
        and public.is_active_coach_athlete(a.coach_id, a.athlete_id)
    )
  );

drop policy "athletes read assigned live blocks" on public.blocks;
create policy "athletes read assigned live blocks" on public.blocks
  for select to authenticated using (
    exists (select 1 from public.program_assignments a where a.program_id = blocks.program_id
      and a.athlete_id = (select auth.uid()) and a.status = 'active' and a.start_date <= current_date and a.sync_mode = 'live'
      and public.is_active_coach_athlete(a.coach_id, a.athlete_id))
  );

drop policy "athletes read assigned live weeks" on public.weeks;
create policy "athletes read assigned live weeks" on public.weeks
  for select to authenticated using (
    exists (select 1 from public.program_assignments a where a.program_id = weeks.program_id
      and a.athlete_id = (select auth.uid()) and a.status = 'active' and a.start_date <= current_date and a.sync_mode = 'live'
      and public.is_active_coach_athlete(a.coach_id, a.athlete_id))
  );

drop policy "athletes read assigned live days" on public.days;
create policy "athletes read assigned live days" on public.days
  for select to authenticated using (
    exists (select 1 from public.weeks w join public.program_assignments a on a.program_id = w.program_id
      where w.id = days.week_id and a.athlete_id = (select auth.uid()) and a.status = 'active'
        and a.start_date <= current_date and a.sync_mode = 'live'
        and public.is_active_coach_athlete(a.coach_id, a.athlete_id))
  );

drop policy "athletes read assigned live exercises" on public.program_exercises;
create policy "athletes read assigned live exercises" on public.program_exercises
  for select to authenticated using (
    exists (select 1 from public.days d join public.weeks w on w.id = d.week_id
      join public.program_assignments a on a.program_id = w.program_id
      where d.id = program_exercises.day_id and a.athlete_id = (select auth.uid())
        and a.status = 'active' and a.start_date <= current_date and a.sync_mode = 'live'
        and public.is_active_coach_athlete(a.coach_id, a.athlete_id))
  );

drop policy "athletes read own active assignments" on public.program_assignments;
create policy "athletes read own active assignments" on public.program_assignments
  for select to authenticated using (
    athlete_id = (select auth.uid()) and status = 'active' and start_date <= current_date
    and public.is_active_coach_athlete(coach_id, athlete_id)
  );
